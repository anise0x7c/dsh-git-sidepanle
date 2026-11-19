/**
 * Local and remote-tracking branch listing and lookup.
 */
import type { BranchInfo, RemoteBranchInfo } from '../../shared/git.ts'
import { gitOrThrow, runGit } from './exec.ts'

/** Prefix every remote-tracking ref shares. */
const REMOTE_PREFIX = 'refs/remotes/'

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
 * Parse `git for-each-ref` output for the remote-tracking namespaces.
 *
 * Each record is `<refname>\t<symref>`. Symbolic remote `HEAD` pointers and a
 * branch part literally named `HEAD` are not branches. A ref is attributed to
 * the longest configured remote whose name prefixes it, so a remote name that
 * contains `/` such as `team/fork` wins over `team`. The result keeps Git's
 * ref order.
 * @param stdout - output of the remote-tracking `for-each-ref`.
 * @param remotes - configured remote names.
 * @returns remote-tracking branches.
 */
export function parseRemoteBranches(
  stdout: string,
  remotes: readonly string[],
): RemoteBranchInfo[] {
  const branches: RemoteBranchInfo[] = []
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (line === '') continue
    const separator = line.indexOf('\t')
    const refname = (separator < 0 ? line : line.slice(0, separator)).trim()
    const symref = separator < 0 ? '' : line.slice(separator + 1).trim()
    if (symref !== '' || !refname.startsWith(REMOTE_PREFIX)) continue
    const remainder = refname.slice(REMOTE_PREFIX.length)
    let remote = ''
    for (const candidate of remotes) {
      if (candidate === '' || candidate.length <= remote.length) continue
      if (remainder.startsWith(`${candidate}/`)) remote = candidate
    }
    if (remote === '') continue
    const branch = remainder.slice(remote.length + 1)
    if (branch === '' || branch === 'HEAD') continue
    branches.push({ name: `${remote}/${branch}`, remote, branch })
  }
  return branches
}

/**
 * Read the remote-tracking branches for the configured remotes.
 * @param root - repository root.
 * @param remotes - configured remote names.
 * @returns remote-tracking branches in Git's ref order.
 */
export async function readRemoteBranches(
  root: string,
  remotes: readonly string[],
): Promise<RemoteBranchInfo[]> {
  const output = await gitOrThrow(root, [
    'for-each-ref',
    '--format=%(refname)%09%(symref)',
    'refs/remotes',
  ])
  return parseRemoteBranches(output, remotes)
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
