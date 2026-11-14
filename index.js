/**
 * Host half of the Git graph bundle.
 *
 * The browser half is a pure renderer: it asks this half for structured
 * repository state and operations over one guarded `/api/dsh-git-graph` route
 * family. Every Git command runs in the Session's working directory, with the
 * workspace filesystem's permissions, and never through a shell.
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { lstat, open, stat, unlink } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

/** Host services this bundle cannot run without. */
export const inject = ['webServer']

const RPC_PATH = '/api/dsh-git-graph/rpc'
const HEALTH_PATH = '/api/dsh-git-graph/health'
const MAX_BODY_BYTES = 256 * 1024
const MAX_GRAPH_COMMITS = 60
const MAX_DIFF_BYTES = 2 * 1024 * 1024
const MAX_UNTRACKED_BYTES = 512 * 1024
const DEFAULT_TIMEOUT_MS = 20_000
const COMMIT_TIMEOUT_MS = 120_000
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024

/** A failure that crosses the wire with a stable code and a human message. */
class GitGraphError extends Error {
  /**
   * @param {string} code - stable failure code.
   * @param {string} message - human-readable description.
   * @param {number} [status] - HTTP status to answer with.
   */
  constructor(code, message, status = 500) {
    super(message)
    this.name = 'GitGraphError'
    this.code = code
    this.status = status
  }
}

/**
 * Answer one JSON body with a stable envelope.
 * @param {import('node:http').ServerResponse} response - Node response.
 * @param {number} status - HTTP status.
 * @param {unknown} value - JSON-serializable value.
 */
function sendJson(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  response.end(body)
}

/**
 * Read a bounded JSON object body.
 * @param {import('node:http').IncomingMessage} request - Node request.
 * @returns {Promise<Record<string, unknown> | null>} the parsed object, or null when malformed or oversized.
 */
function readJsonBody(request) {
  return new Promise((resolveBody) => {
    const chunks = []
    let bytes = 0
    let refused = false
    request.on('data', (chunk) => {
      if (refused) return
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += buffer.length
      if (bytes > MAX_BODY_BYTES) {
        refused = true
        chunks.length = 0
        return
      }
      chunks.push(buffer)
    })
    request.on('end', () => {
      if (refused) return resolveBody(null)
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        resolveBody(parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null)
      } catch {
        resolveBody(null)
      }
    })
    request.on('error', () => resolveBody(null))
  })
}

/**
 * Whether a socket address names loopback.
 * @param {string | undefined} address - socket remote address.
 * @returns {boolean} true for 127/8, ::1, and IPv4-mapped loopback.
 */
function isLoopbackAddress(address) {
  if (typeof address !== 'string') return false
  const normalized = address.toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('::ffff:')) return isLoopbackAddress(normalized.slice(7))
  const parts = normalized.split('.')
  return parts.length === 4 && parts[0] === '127' && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/**
 * Whether a Host header names a loopback authority.
 * @param {string} hostname - URL hostname.
 * @returns {boolean} true for localhost and loopback literals.
 */
function isLoopbackHostname(hostname) {
  return hostname === 'localhost' || hostname === '[::1]' || isLoopbackAddress(hostname)
}

/**
 * The same local-request fence the other local plugin routes use: an unproxied
 * loopback socket, a loopback Host header, same-origin browser markers, and the
 * bundle's own request header so a cross-site form post cannot forge a call.
 * @param {import('node:http').IncomingMessage} request - Node request.
 * @returns {boolean} whether the request may enter.
 */
function isTrustedRequest(request) {
  if (request.headers['x-dsh-git-graph'] !== '1') return false
  if (request.headers['x-forwarded-for'] !== undefined || request.headers['cf-connecting-ip'] !== undefined) return false
  if (!isLoopbackAddress(request.socket?.remoteAddress)) return false
  const host = request.headers.host
  if (typeof host !== 'string' || host === '') return false
  let hostUrl
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (!isLoopbackHostname(hostUrl.hostname)) return false
  const site = request.headers['sec-fetch-site']
  if (site !== undefined && site !== 'same-origin') return false
  const origin = request.headers.origin
  if (origin === undefined || origin === '') return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/**
 * Run Git without a shell.
 * @param {string} cwd - working directory.
 * @param {readonly string[]} args - Git arguments.
 * @param {{ timeout?: number }} [options] - timeout override.
 * @returns {Promise<{ ok: boolean; stdout: string; stderr: string; code: number | string | undefined }>} result.
 */
function runGit(cwd, args, options = {}) {
  return new Promise((resolveRun) => {
    execFile(
      'git',
      [...args],
      {
        cwd,
        timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_OPTIONAL_LOCKS: '0',
          GIT_PAGER: 'cat',
          LC_ALL: 'C',
          LANG: 'C',
        },
      },
      (error, stdout, stderr) => {
        resolveRun({
          ok: error === null,
          stdout: typeof stdout === 'string' ? stdout : '',
          stderr: typeof stderr === 'string' ? stderr : '',
          code: error === null ? undefined : error.code,
        })
      },
    )
  })
}

/**
 * Run Git and reject with a stable failure when it exits non-zero.
 * @param {string} cwd - working directory.
 * @param {readonly string[]} args - Git arguments.
 * @param {{ timeout?: number }} [options] - timeout override.
 * @returns {Promise<string>} standard output.
 */
async function gitOrThrow(cwd, args, options = {}) {
  const result = await runGit(cwd, args, options)
  if (result.ok) return result.stdout
  if (result.code === 'ENOENT') throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
  const detail = (result.stderr.trim() || result.stdout.trim() || `git ${args[0] ?? ''} failed`)
  throw new GitGraphError('git-command-failed', detail, 409)
}

/**
 * The repository root that contains one directory.
 * @param {string} cwd - directory to inspect.
 * @returns {Promise<string | null>} absolute root, or null outside a repository.
 */
async function findRepositoryRoot(cwd) {
  const result = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  if (result.ok) {
    const root = result.stdout.trim().split('\n')[0]?.trim()
    return root === undefined || root === '' ? null : root
  }
  if (result.code === 'ENOENT') throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
  return null
}

/**
 * Resolve a Session's working directory without activating its Agent.
 * @param {import('@deepseek-ai/cordis').Context} ctx - Host context.
 * @param {unknown} sessionId - wire identity.
 * @returns {Promise<string>} absolute directory.
 */
async function resolveSessionDirectory(ctx, sessionId) {
  if (typeof sessionId !== 'string' || sessionId === '') {
    throw new GitGraphError('bad-request', 'A Session identity is required.', 400)
  }
  const sessions = ctx.get('sessions')
  const session = sessions?.get?.(sessionId)
  if (session !== undefined) {
    const workingDirectory = ctx.get('workingDirectory')
    try {
      const directory = workingDirectory?.get?.(session)
      if (typeof directory === 'string' && directory !== '') return directory
    } catch {
      // Fall through to the Session header.
    }
    const headerDirectory = session.header?.cwd
    if (typeof headerDirectory === 'string' && headerDirectory !== '') return headerDirectory
  }
  const persistence = ctx.get('sessionPersistence')
  if (persistence?.stat !== undefined) {
    const snapshot = await persistence.stat(sessionId)
    const directory = snapshot?.header?.cwd
    if (typeof directory === 'string' && directory !== '') return directory
  }
  throw new GitGraphError('session-not-found', `Session "${sessionId}" has no working directory.`, 404)
}

/**
 * Resolve one repository-relative path, refusing escapes and option-shaped paths.
 * @param {string} root - repository root.
 * @param {unknown} input - wire path.
 * @returns {string} absolute path inside the repository.
 */
function resolveRepositoryPath(root, input) {
  if (typeof input !== 'string' || input === '' || input.includes('\0')) {
    throw new GitGraphError('bad-request', 'A file path is required.', 400)
  }
  if (isAbsolute(input)) throw new GitGraphError('bad-request', 'A repository-relative path is required.', 400)
  const absolute = resolve(root, input)
  const rel = relative(root, absolute)
  if (rel === '' || rel.startsWith('..') || rel.includes('\0')) {
    throw new GitGraphError('path-outside-repository', `"${input}" is outside the repository.`, 400)
  }
  if (rel.split(sep).some((part) => part === '..')) {
    throw new GitGraphError('path-outside-repository', `"${input}" is outside the repository.`, 400)
  }
  return absolute
}

/**
 * Validate a list of repository-relative paths.
 * @param {string} root - repository root.
 * @param {unknown} input - wire paths.
 * @returns {string[]} validated paths, relative as given.
 */
function resolveRepositoryPaths(root, input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new GitGraphError('bad-request', 'At least one path is required.', 400)
  }
  if (input.length > 2000) throw new GitGraphError('bad-request', 'Too many paths in one request.', 400)
  const paths = []
  for (const item of input) {
    resolveRepositoryPath(root, item)
    if (typeof item !== 'string' || item.startsWith('-')) {
      throw new GitGraphError('bad-request', `Invalid path "${String(item)}".`, 400)
    }
    paths.push(item)
  }
  return paths
}

/**
 * One parsed porcelain-v2 record.
 * @param {'ordinary' | 'renamed' | 'unmerged' | 'untracked'} kind - record kind.
 * @param {string} x - index status character.
 * @param {string} y - worktree status character.
 * @param {string} path - path.
 * @param {string | undefined} origPath - rename source.
 * @returns {{ kind: string, x: string, y: string, path: string, origPath?: string }} wire entry.
 */
function changeEntry(kind, x, y, path, origPath) {
  return {
    kind,
    x,
    y,
    path,
    ...origPath === undefined ? {} : { origPath },
    conflict: kind === 'unmerged',
    untracked: kind === 'untracked',
  }
}

/**
 * Parse `git status --porcelain=v2 --branch -z` output.
 * @param {string} output - NUL-terminated records.
 * @returns {{ repo: object, files: object[] }} status payload.
 */
function parseStatus(output) {
  const tokens = output.split('\0')
  const files = []
  const repo = {
    root: '',
    branch: null,
    detached: false,
    unborn: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    headOid: null,
  }
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === '') continue
    if (token.startsWith('# branch.oid ')) {
      const oid = token.slice('# branch.oid '.length)
      repo.unborn = oid === '(initial)'
      repo.headOid = repo.unborn ? null : oid
      continue
    }
    if (token.startsWith('# branch.head ')) {
      const head = token.slice('# branch.head '.length)
      repo.detached = head === '(detached)'
      repo.branch = repo.detached ? null : head
      continue
    }
    if (token.startsWith('# branch.upstream ')) {
      repo.upstream = token.slice('# branch.upstream '.length)
      continue
    }
    if (token.startsWith('# branch.ab ')) {
      const match = /^# branch\.ab \+(\d+) -(\d+)$/.exec(token)
      if (match !== null) {
        repo.ahead = Number(match[1])
        repo.behind = Number(match[2])
      }
      continue
    }
    if (token.startsWith('1 ')) {
      const match = /^1 (.)(.) \S+ (\S+) (\S+) (\S+) (\S+) (\S+) (.*)$/s.exec(token)
      if (match !== null) files.push(changeEntry('ordinary', match[1], match[2], match[8]))
      continue
    }
    if (token.startsWith('2 ')) {
      const match = /^2 (.)(.) \S+ (\S+) (\S+) (\S+) (\S+) (\S+) ([^ ]+) (.*)$/s.exec(token)
      const origPath = tokens[index + 1]
      index += 1
      if (match !== null) files.push(changeEntry('renamed', match[1], match[2], match[9], typeof origPath === 'string' && origPath !== '' ? origPath : undefined))
      continue
    }
    if (token.startsWith('u ')) {
      const match = /^u (.)(.) \S+ (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (.*)$/s.exec(token)
      if (match !== null) files.push(changeEntry('unmerged', match[1], match[2], match[11]))
      continue
    }
    if (token.startsWith('? ')) {
      files.push(changeEntry('untracked', '?', '?', token.slice(2)))
    }
  }
  return { repo, files }
}

/**
 * Read the full status of one working directory.
 * @param {string} cwd - Session working directory.
 * @returns {Promise<{ repo: object | null, cwd: string, files: object[] }>} status payload.
 */
async function readStatus(cwd) {
  const root = await findRepositoryRoot(cwd)
  if (root === null) return { repo: null, cwd, files: [] }
  const output = await gitOrThrow(root, ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'])
  const { repo, files } = parseStatus(output)
  return { repo: { ...repo, root, cwd }, files }
}

/**
 * Read recent commits across local branches, tags, and remote-tracking branches.
 * @param {string} root - repository root.
 * @returns {Promise<object[]>} graph rows.
 */
async function readHistory(root) {
  const result = await runGit(root, [
    'log',
    '--graph',
    '--branches',
    '--tags',
    '--remotes',
    '--date-order',
    `--pretty=format:%H%x09%h%x09%an%x09%at%x09%D%x09%s`,
    '-n',
    String(MAX_GRAPH_COMMITS),
  ], { timeout: 30_000 })
  if (!result.ok) {
    // An unborn branch has no commits; every other failure is real.
    if (/does not have any commits yet|bad default revision/i.test(result.stderr)) return []
    if (result.code === 'ENOENT') throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    throw new GitGraphError('git-command-failed', result.stderr.trim() || 'git log failed', 409)
  }
  const commits = []
  for (const line of result.stdout.split('\n')) {
    if (line === '') continue
    const match = /^([|/\\*_.\- ]*)([0-9a-f]{40})\t([^\t]*)\t([^\t]*)\t([^\t]*)\t([^\t]*)\t?(.*)$/.exec(line)
    if (match === null) continue
    commits.push({
      oid: match[2],
      shortOid: match[3],
      author: match[4],
      authoredAt: Number(match[5]) || 0,
      refs: match[6],
      subject: match[7],
      graph: match[1],
    })
  }
  return commits
}

/**
 * List local branches.
 * @param {string} root - repository root.
 * @returns {Promise<Array<{ name: string, current: boolean }>>} branches.
 */
async function readBranches(root) {
  const output = await gitOrThrow(root, ['for-each-ref', '--format=%(HEAD)%09%(refname:short)', 'refs/heads'])
  const branches = []
  for (const line of output.split('\n')) {
    if (line === '') continue
    const separator = line.indexOf('\t')
    if (separator < 0) continue
    const name = line.slice(separator + 1).trim()
    if (name === '') continue
    branches.push({ name, current: line.slice(0, separator).trim() === '*' })
  }
  return branches
}

/**
 * Read one file comparison as a unified diff.
 * @param {string} root - repository root.
 * @param {string} path - repository-relative path.
 * @param {boolean} staged - compare the index instead of the working tree.
 * @param {boolean} untracked - render the file's content as additions.
 * @returns {Promise<object>} diff payload.
 */
async function readDiff(root, path, staged, untracked) {
  const absolute = resolveRepositoryPath(root, path)
  if (untracked) {
    const info = await stat(absolute).catch(() => undefined)
    if (info === undefined || !info.isFile()) {
      throw new GitGraphError('not-found', `"${path}" is not a readable file.`, 404)
    }
    const wanted = Math.min(info.size, MAX_UNTRACKED_BYTES)
    const buffer = Buffer.alloc(wanted)
    const handle = await open(absolute, 'r')
    let bytesRead = 0
    try {
      const read = await handle.read(buffer, 0, wanted, 0)
      bytesRead = read.bytesRead
    } finally {
      await handle.close()
    }
    const slice = buffer.subarray(0, bytesRead)
    const truncated = info.size > bytesRead
    if (slice.includes(0)) {
      return { path, staged: false, untracked: true, binary: true, truncated, additions: 0, deletions: 0, hunks: [] }
    }
    const text = slice.toString('utf8')
    const lines = text.split('\n')
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    return {
      path,
      staged: false,
      untracked: true,
      binary: false,
      truncated,
      additions: lines.length,
      deletions: 0,
      hunks: [{
        header: `@@ -0,0 +1,${lines.length} @@`,
        oldStart: 0,
        oldCount: 0,
        newStart: 1,
        newCount: lines.length,
        lines: lines.map((text, index) => ({ t: '+', text, newLine: index + 1 })),
      }],
    }
  }
  const result = await runGit(root, [
    'diff',
    '--no-color',
    '--no-ext-diff',
    '--no-textconv',
    '--unified=3',
    ...staged ? ['--cached'] : [],
    '--',
    path,
  ])
  if (!result.ok) {
    if (result.code === 'ENOENT') throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    throw new GitGraphError('git-command-failed', result.stderr.trim() || 'git diff failed', 409)
  }
  const truncated = result.stdout.length > MAX_DIFF_BYTES
  const text = truncated ? result.stdout.slice(0, MAX_DIFF_BYTES) : result.stdout
  return { path, staged, untracked: false, truncated, ...parseUnifiedDiff(text) }
}

/**
 * Parse unified diff text into hunks.
 * @param {string} text - `git diff` output.
 * @returns {{ binary: boolean, additions: number, deletions: number, oldPath?: string, newPath?: string, hunks: object[] }} parsed diff.
 */
function parseUnifiedDiff(text) {
  const lines = text.split('\n')
  const hunks = []
  let current = null
  let additions = 0
  let deletions = 0
  let oldPath
  let newPath
  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      current = null
      continue
    }
    if (line.startsWith('--- ')) {
      oldPath = line.slice(4).replace(/^a\//, '')
      continue
    }
    if (line.startsWith('+++ ')) {
      newPath = line.slice(4).replace(/^b\//, '')
      continue
    }
    if (line.startsWith('@@ ')) {
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(line)
      if (match === null) continue
      current = {
        header: line,
        oldStart: Number(match[1]),
        oldCount: match[2] === undefined ? 1 : Number(match[2]),
        newStart: Number(match[3]),
        newCount: match[4] === undefined ? 1 : Number(match[4]),
        lines: [],
      }
      hunks.push(current)
      continue
    }
    if (current === null) continue
    const marker = line.charAt(0)
    if (marker === ' ') {
      current.lines.push({ t: ' ', text: line.slice(1) })
    } else if (marker === '-') {
      current.lines.push({ t: '-', text: line.slice(1) })
      deletions += 1
    } else if (marker === '+') {
      current.lines.push({ t: '+', text: line.slice(1) })
      additions += 1
    }
  }
  return {
    binary: /Binary files .* differ/.test(text) || text.startsWith('GIT binary patch'),
    additions,
    deletions,
    ...oldPath === undefined ? {} : { oldPath },
    ...newPath === undefined ? {} : { newPath },
    hunks,
  }
}

/**
 * Report Git failures with the Host's own words, keeping the stable code when it is one of ours.
 * @param {unknown} error - thrown value.
 * @returns {GitGraphError} normalized failure.
 */
function normalizeFailure(error) {
  if (error instanceof GitGraphError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new GitGraphError('internal', message, 500)
}

/**
 * Whether the branch name exists as a local branch.
 * @param {string} root - repository root.
 * @param {string} name - candidate branch.
 * @returns {Promise<boolean>} true when present.
 */
async function branchExists(root, name) {
  const result = await runGit(root, ['show-ref', '--verify', '--quiet', `refs/heads/${name}`])
  return result.ok
}

/**
 * Dispatch one operation inside the repository containing a Session's directory.
 * @param {import('@deepseek-ai/cordis').Context} ctx - Host context.
 * @param {Record<string, unknown>} payload - validated request.
 * @returns {Promise<unknown>} operation value.
 */
async function dispatch(ctx, payload) {
  const cwd = await resolveSessionDirectory(ctx, payload.sessionId)
  if (!existsSync(cwd)) throw new GitGraphError('workspace-not-found', `The working directory "${cwd}" does not exist.`, 404)
  const op = payload.op
  if (op === 'status') return readStatus(cwd)

  const root = await findRepositoryRoot(cwd)
  if (root === null) throw new GitGraphError('not-a-repository', `The working directory "${cwd}" is not inside a Git repository.`, 409)

  switch (op) {
    case 'history':
      return { commits: await readHistory(root) }
    case 'branches':
      return { branches: await readBranches(root) }
    case 'stage': {
      const paths = resolveRepositoryPaths(root, payload.paths)
      await gitOrThrow(root, ['add', '-A', '--', ...paths])
      return { ok: true }
    }
    case 'unstage': {
      const paths = resolveRepositoryPaths(root, payload.paths)
      const restored = await runGit(root, ['restore', '--staged', '--', ...paths])
      if (!restored.ok) {
        // An unborn branch has no HEAD to restore from; remove the entries instead.
        const removed = await runGit(root, ['rm', '--cached', '-r', '--quiet', '--ignore-unmatch', '--', ...paths])
        if (!removed.ok) {
          throw new GitGraphError('git-command-failed', removed.stderr.trim() || restored.stderr.trim() || 'git restore failed', 409)
        }
      }
      return { ok: true }
    }
    case 'discard': {
      const paths = resolveRepositoryPaths(root, [payload.path])
      const absolute = resolveRepositoryPath(root, payload.path)
      if (payload.untracked === true) {
        const info = await lstat(absolute).catch(() => undefined)
        if (info === undefined) return { ok: true }
        if (!info.isFile() && !info.isSymbolicLink()) {
          throw new GitGraphError('not-a-file', `"${String(payload.path)}" is not a file.`, 409)
        }
        await unlink(absolute)
        return { ok: true }
      }
      const restored = await runGit(root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', ...paths])
      if (!restored.ok) {
        if (/could not resolve HEAD|unknown revision|bad revision/i.test(restored.stderr)) {
          throw new GitGraphError('discard-unborn', 'Changes cannot be discarded before the first commit.', 409)
        }
        throw new GitGraphError('git-command-failed', restored.stderr.trim() || 'git restore failed', 409)
      }
      return { ok: true }
    }
    case 'commit': {
      const message = typeof payload.message === 'string' ? payload.message.trim() : ''
      if (message === '') throw new GitGraphError('empty-message', 'A commit message is required.', 400)
      if (message.length > 20_000) throw new GitGraphError('message-too-long', 'The commit message is too long.', 400)
      if (payload.stageAll === true) await gitOrThrow(root, ['add', '-A'])
      const staged = await runGit(root, ['diff', '--cached', '--quiet'])
      // Exit code 1 means staged differences exist; anything else is a real failure.
      if (staged.ok) throw new GitGraphError('nothing-staged', 'There are no staged changes to commit.', 409)
      if (staged.code !== 1) {
        if (staged.code === 'ENOENT') throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
        throw new GitGraphError('git-command-failed', staged.stderr.trim() || 'git diff --cached failed', 409)
      }
      const committed = await runGit(root, ['commit', '-m', message], { timeout: COMMIT_TIMEOUT_MS })
      if (!committed.ok) {
        if (committed.code === 'ENOENT') throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
        const detail = `${committed.stdout}\n${committed.stderr}`.trim() || 'git commit failed'
        if (/nothing to commit|no changes added to commit/i.test(detail)) {
          throw new GitGraphError('nothing-staged', 'There are no staged changes to commit.', 409)
        }
        throw new GitGraphError('git-command-failed', detail, 409)
      }
      const head = await runGit(root, ['rev-parse', '--short', 'HEAD'])
      return { ok: true, commit: head.ok ? head.stdout.trim() : null }
    }
    case 'checkout': {
      const branch = payload.branch
      if (typeof branch !== 'string' || branch === '' || branch.startsWith('-')) {
        throw new GitGraphError('bad-request', 'A local branch name is required.', 400)
      }
      const formatted = await runGit(root, ['check-ref-format', '--branch', branch])
      if (!formatted.ok || !await branchExists(root, branch)) {
        throw new GitGraphError('unknown-branch', `No local branch named "${branch}" exists.`, 404)
      }
      const switched = await runGit(root, ['switch', branch])
      if (!switched.ok) {
        if (switched.code === 'ENOENT') throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
        throw new GitGraphError('git-command-failed', `${switched.stdout}\n${switched.stderr}`.trim() || 'git switch failed', 409)
      }
      return { ok: true, branch }
    }
    case 'diff': {
      if (typeof payload.path !== 'string') throw new GitGraphError('bad-request', 'A file path is required.', 400)
      return readDiff(root, payload.path, payload.staged === true, payload.untracked === true)
    }
    default:
      throw new GitGraphError('unknown-operation', `Unknown operation "${String(op)}".`, 400)
  }
}

/**
 * Register the guarded route family.
 * @param {import('@deepseek-ai/cordis').Context} ctx - Host context.
 * @returns {() => void} disposer removing both routes.
 */
export function apply(ctx) {
  const disposeHealth = ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: HEALTH_PATH,
    handler: (request, response) => {
      if (!isTrustedRequest(request)) {
        sendJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'Request refused.' } })
        return
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { allow: 'GET, HEAD' })
        response.end()
        return
      }
      sendJson(response, 200, { ok: true, service: '@local/dsh-git-graph' })
    },
  }), 'git-graph: health route')

  const disposeRpc = ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: RPC_PATH,
    handler: async (request, response) => {
      if (!isTrustedRequest(request)) {
        sendJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'Request refused.' } })
        return
      }
      if (request.method !== 'POST') {
        response.writeHead(405, { allow: 'POST' })
        response.end()
        return
      }
      const payload = await readJsonBody(request)
      if (payload === null) {
        sendJson(response, 400, { ok: false, error: { code: 'bad-request', message: 'A JSON object body is required.' } })
        return
      }
      try {
        const value = await dispatch(ctx, payload)
        sendJson(response, 200, { ok: true, value })
      } catch (error) {
        const failure = normalizeFailure(error)
        sendJson(response, failure.status, { ok: false, error: { code: failure.code, message: failure.message } })
      }
    },
  }), 'git-graph: rpc route')

  return () => {
    disposeRpc()
    disposeHealth()
  }
}
