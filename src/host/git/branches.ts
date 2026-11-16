/**
 * Local branch listing and lookup.
 */
import type { BranchInfo } from '../../shared/git.ts'
import { gitOrThrow, runGit } from './exec.ts'

/**
 * List local branches.
 * @param root - repository root.
 * @returns branches.
 */
export async function readBranches(root: string): Promise<BranchInfo[]> {
  const output = await gitOrThrow(root, [
    'for-each-ref',
    '--format=%(HEAD)%09%(refname:short)',
    'refs/heads',
  ])
  const branches: BranchInfo[] = []
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
 * @param root - repository root.
 * @param name - candidate branch.
 * @returns true when present.
 */
export async function branchExists(root: string, name: string): Promise<boolean> {
  const result = await runGit(root, ['show-ref', '--verify', '--quiet', `refs/heads/${name}`])
  return result.ok
}
