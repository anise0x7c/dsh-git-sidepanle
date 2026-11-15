/**
 * Commit history for the graph view.
 */
import { GitGraphError } from '../errors.js'
import { runGit } from './exec.js'

const MAX_GRAPH_COMMITS = 60

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
