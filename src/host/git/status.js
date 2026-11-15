/**
 * Working-tree status: porcelain-v2 parsing and reading.
 */
import { changeEntry, findRepositoryRoot, gitOrThrow } from './exec.js'

/**
 * Parse `git status --porcelain=v2 --branch -z` output.
 *
 * `-z` keeps paths unquoted and NUL-terminated, so a rename is two records;
 * the parser must therefore consume the original path when it sees a `2 `
 * record instead of treating it as a separate entry.
 *
 * @param {string} output - NUL-terminated records.
 * @returns {{ repo: object, files: object[] }} status payload.
 */
export function parseStatus(output) {
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
      // u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
      const match = /^u (.)(.) \S+ (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (.*)$/s.exec(token)
      if (match !== null) files.push(changeEntry('unmerged', match[1], match[2], match[10]))
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
export async function readStatus(cwd) {
  const root = await findRepositoryRoot(cwd)
  if (root === null) return { repo: null, cwd, files: [] }
  const output = await gitOrThrow(root, ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'])
  const { repo, files } = parseStatus(output)
  return { repo: { ...repo, root, cwd }, files }
}
