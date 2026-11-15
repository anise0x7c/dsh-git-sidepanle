/**
 * Commit history for the graph view, and one commit's metadata and file list.
 */
import { GitGraphError } from '../errors.js'
import { runGit } from './exec.js'

const MAX_GRAPH_COMMITS = 60
const MAX_COMMIT_FILES = 1000
const FULL_OID = /^[0-9a-f]{40}$/
const COMMIT_META_FORMAT = '%H%x00%h%x00%an%x00%at%x00%D%x00%P%x00%s%x00%b'

/**
 * Read recent commits across local branches, tags, and remote-tracking branches.
 * @param {string} root - repository root.
 * @returns {Promise<object[]>} graph rows.
 */
export async function readHistory(root) {
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
 * Parse one `git log --format=%H%x00...` commit record.
 *
 * The format writes NUL-separated fields and Git terminates the record with a
 * newline; the body may itself end with newlines, so only the record terminator
 * is removed.
 * @param {string} stdout - command output.
 * @returns {{ oid: string, shortOid: string, author: string, authoredAt: number, refs: string, parents: string[], subject: string, body: string } | null} commit metadata, or null when the record is malformed.
 */
export function parseCommitMeta(stdout) {
  const parts = stdout.split('\0')
  if (parts.length < 7) return null
  const [oid, shortOid, author, authoredAt, refs, parents, subject] = parts
  const body = parts.slice(7).join('\0').replace(/\n+$/, '')
  if (!FULL_OID.test(oid)) return null
  return {
    oid,
    shortOid,
    author,
    authoredAt: Number(authoredAt) || 0,
    refs,
    parents: parents.split(' ').filter((parent) => parent !== ''),
    subject,
    body,
  }
}

/**
 * Parse `git diff-tree --name-status -z` output.
 *
 * Each record is a status field followed by one path, except renames and copies
 * (status `R`/`C`, possibly with a similarity score) which carry the original
 * path before the new one.
 * @param {string} stdout - NUL-separated name-status output.
 * @returns {{ path: string, origPath?: string, letter: string }[]} changed files in Git's order.
 */
export function parseNameStatus(stdout) {
  const tokens = stdout.split('\0')
  const files = []
  let index = 0
  while (index < tokens.length) {
    const status = tokens[index]
    index += 1
    if (status === undefined || status === '') continue
    const letter = status.charAt(0)
    if (letter === 'R' || letter === 'C') {
      const origPath = tokens[index]
      const path = tokens[index + 1]
      index += 2
      if (origPath !== undefined && origPath !== '' && path !== undefined && path !== '') {
        files.push({ path, origPath, letter })
      }
      continue
    }
    const path = tokens[index]
    index += 1
    if (path !== undefined && path !== '') files.push({ path, letter })
  }
  return files
}

/**
 * Read one commit's metadata and the files it changed.
 *
 * The file list compares the commit with its first parent; a root commit is
 * compared with the empty tree. A merge commit therefore lists what it brought
 * into the checked-out line of history, which is what the per-file diff shows.
 * @param {string} root - repository root.
 * @param {string} oid - full commit identifier.
 * @returns {Promise<{ commit: object, files: object[], truncated: boolean }>} commit details.
 */
export async function readCommitDetails(root, oid) {
  if (typeof oid !== 'string' || !FULL_OID.test(oid)) {
    throw new GitGraphError('bad-request', 'A full commit identifier is required.', 400)
  }
  const verified = await runGit(root, ['rev-parse', '--verify', '--quiet', `${oid}^{commit}`])
  if (!verified.ok) {
    if (verified.code === 'ENOENT') throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    throw new GitGraphError('unknown-commit', `No commit "${oid}" exists in this repository.`, 404)
  }
  const meta = await runGit(root, ['log', '-1', `--format=${COMMIT_META_FORMAT}`, oid])
  if (!meta.ok) {
    if (meta.code === 'ENOENT') throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    throw new GitGraphError('git-command-failed', meta.stderr.trim() || 'git log failed', 409)
  }
  const commit = parseCommitMeta(meta.stdout)
  if (commit === null) throw new GitGraphError('git-command-failed', 'The commit record could not be read.', 409)
  const parent = commit.parents[0]
  const listed = parent === undefined
    ? await runGit(root, ['diff-tree', '--root', '-r', '--name-status', '-M', '-z', '--no-commit-id', oid])
    : await runGit(root, ['diff-tree', '-r', '--name-status', '-M', '-z', parent, oid])
  if (!listed.ok) {
    if (listed.code === 'ENOENT') throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    throw new GitGraphError('git-command-failed', listed.stderr.trim() || 'git diff-tree failed', 409)
  }
  const files = parseNameStatus(listed.stdout)
  return {
    commit,
    files: files.length > MAX_COMMIT_FILES ? files.slice(0, MAX_COMMIT_FILES) : files,
    truncated: files.length > MAX_COMMIT_FILES,
  }
}
