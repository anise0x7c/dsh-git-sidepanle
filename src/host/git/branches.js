/**
 * Local branch listing and lookup.
 */
import { gitOrThrow, runGit } from './exec.js'

/**
 * List local branches.
 * @param {string} root - repository root.
 * @returns {Promise<Array<{ name: string, current: boolean }>>} branches.
 */
export async function readBranches(root) {
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
 * Whether the branch name exists as a local branch.
 * @param {string} root - repository root.
 * @param {string} name - candidate branch.
 * @returns {Promise<boolean>} true when present.
 */
export async function branchExists(root, name) {
  const result = await runGit(root, ['show-ref', '--verify', '--quiet', `refs/heads/${name}`])
  return result.ok
}
