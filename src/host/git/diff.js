/**
 * File-level diffs: reading from Git or the filesystem, and unified-diff parsing.
 */
import { open, stat } from 'node:fs/promises'
import { GitGraphError } from '../errors.js'
import { resolveRepositoryPath, runGit } from './exec.js'

const MAX_DIFF_BYTES = 2 * 1024 * 1024
const MAX_UNTRACKED_BYTES = 512 * 1024

/**
 * Read one file comparison as a unified diff.
 * @param {string} root - repository root.
 * @param {string} path - repository-relative path.
 * @param {boolean} staged - compare the index instead of the working tree.
 * @param {boolean} untracked - render the file's content as additions.
 * @returns {Promise<object>} diff payload.
 */
export async function readDiff(root, path, staged, untracked) {
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
 *
 * Only hunk lines are interpreted: `---`/`+++` name the compared files, a
 * `\ No newline at end of file` marker is not a change line, and content
 * outside a hunk (such as `index` or `diff --git` lines) is skipped.
 *
 * @param {string} text - `git diff` output.
 * @returns {{ binary: boolean, additions: number, deletions: number, oldPath?: string, newPath?: string, hunks: object[] }} parsed diff.
 */
export function parseUnifiedDiff(text) {
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
