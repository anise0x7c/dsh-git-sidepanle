/**
 * Remote configuration and network synchronization operations.
 *
 * Every remote name arrives validated and is passed as a literal argument
 * vector — never through a shell. Network-facing commands get a longer bound
 * than ordinary repository reads; a killed command leaves no output, so an
 * empty failure is the timeout signal the design maps to `remote-timeout`.
 */
import type { RemoteInfo } from '../../shared/git.ts'
import { GitGraphError } from '../errors.ts'
import { gitOrThrow, runGit } from './exec.ts'

/** Bound for one network-facing Git command. */
const REMOTE_TIMEOUT_MS = 120_000
/** One `git remote -v` record: `<name>\t<url> (fetch|push)`. */
const REMOTE_LINE = /^([^\t]+)\t(.+) \((fetch|push)\)$/

/** URL kinds collected for one remote while parsing. */
interface RemoteUrls {
  /** First fetch URL Git printed, when any. */
  fetchUrl?: string
  /** First push URL Git printed, when any. */
  pushUrl?: string
}

/**
 * Parse `git remote -v` output.
 *
 * Each line is `<name>\t<url> (fetch|push)`; the first occurrence of each URL
 * kind wins, a missing push URL falls back to the fetch URL, and lines that do
 * not match the shape are skipped. The result keeps Git's configured order.
 * @param stdout - output of `git remote -v`.
 * @returns remotes in configured order.
 */
export function parseRemoteVerbose(stdout: string): RemoteInfo[] {
  const records = new Map<string, RemoteUrls>()
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    const match = REMOTE_LINE.exec(line)
    if (match === null) continue
    const name = (match[1] ?? '').trim()
    const url = (match[2] ?? '').trim()
    if (name === '' || url === '') continue
    const record = records.get(name) ?? {}
    if (match[3] === 'fetch') {
      if (record.fetchUrl === undefined) record.fetchUrl = url
    } else if (record.pushUrl === undefined) {
      record.pushUrl = url
    }
    records.set(name, record)
  }
  const remotes: RemoteInfo[] = []
  for (const [name, record] of records) {
    const fetchUrl = record.fetchUrl ?? record.pushUrl
    if (fetchUrl === undefined) continue
    remotes.push({ name, fetchUrl, pushUrl: record.pushUrl ?? fetchUrl })
  }
  return remotes
}

/**
 * Read the configured remotes in Git's order.
 * @param root - repository root.
 * @returns configured remotes.
 */
export async function readRemotes(root: string): Promise<RemoteInfo[]> {
  return parseRemoteVerbose(await gitOrThrow(root, ['remote', '-v']))
}

/**
 * Configure a new remote with a literal name and URL.
 *
 * An already-configured name is reported before Git runs so the failure code is
 * stable; every other refusal keeps Git's message.
 * @param root - repository root.
 * @param name - validated remote name.
 * @param url - validated remote URL.
 */
export async function addRemote(root: string, name: string, url: string): Promise<void> {
  const remotes = await readRemotes(root)
  if (remotes.some((remote) => remote.name === name)) {
    throw new GitGraphError('remote-exists', `A remote named "${name}" is already configured.`, 409)
  }
  await gitOrThrow(root, ['remote', 'add', '--', name, url])
}

/**
 * Remove one configured remote and its remote-tracking branches.
 * @param root - repository root.
 * @param name - validated remote name.
 */
export async function removeRemote(root: string, name: string): Promise<void> {
  const remotes = await readRemotes(root)
  if (!remotes.some((remote) => remote.name === name)) {
    throw new GitGraphError('unknown-remote', `No remote named "${name}" is configured.`, 404)
  }
  await gitOrThrow(root, ['remote', 'remove', '--', name])
}

/**
 * Read the checked-out branch name.
 * @param root - repository root.
 * @returns branch name, or null for a detached HEAD.
 */
export async function currentBranch(root: string): Promise<string | null> {
  const result = await runGit(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
  if (!result.ok) return null
  const branch = result.stdout.trim()
  return branch === '' ? null : branch
}

/**
 * Whether the checked-out branch has at least one commit.
 * @param root - repository root.
 * @returns true when HEAD resolves.
 */
export async function headExists(root: string): Promise<boolean> {
  return (await runGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD'])).ok
}

/**
 * Read the upstream of the checked-out branch.
 * @param root - repository root.
 * @returns upstream such as `origin/main`, or null when there is none.
 */
export async function upstreamOf(root: string): Promise<string | null> {
  const branch = await currentBranch(root)
  if (branch === null) return null
  // `for-each-ref` reads the configured upstream even when its remote-tracking
  // ref has not been fetched yet, while `rev-parse @{u}` would report none.
  const result = await runGit(root, [
    'for-each-ref',
    '--format=%(upstream:short)',
    `refs/heads/${branch}`,
  ])
  if (!result.ok) return null
  const upstream = result.stdout.trim().split('\n')[0]?.trim() ?? ''
  return upstream === '' ? null : upstream
}

/**
 * Run one network-facing Git command with the remote time bound.
 * @param root - repository root.
 * @param args - Git arguments.
 */
async function runRemote(root: string, args: readonly string[]): Promise<void> {
  const result = await runGit(root, args, { timeout: REMOTE_TIMEOUT_MS })
  if (result.ok) return
  if (result.timedOut) {
    throw new GitGraphError('remote-timeout', 'The remote operation did not finish in time.', 504)
  }
  const detail = `${result.stdout}\n${result.stderr}`.trim() || `git ${args[0] ?? ''} failed`
  throw new GitGraphError('git-command-failed', detail, 409)
}

/**
 * Require the checked-out branch to track an upstream.
 * @param root - repository root.
 */
async function requireUpstream(root: string): Promise<void> {
  if ((await upstreamOf(root)) === null) {
    throw new GitGraphError('no-upstream', 'The current branch has no upstream branch.', 409)
  }
}

/**
 * Fetch every configured remote and prune deleted remote-tracking branches.
 * @param root - repository root.
 */
export async function fetchAll(root: string): Promise<void> {
  await runRemote(root, ['fetch', '--all', '--prune'])
}

/**
 * Integrate the upstream into the current branch.
 * @param root - repository root.
 * @param rebase - rebase the local commits instead of merging the upstream.
 */
export async function pullBranch(root: string, rebase: boolean): Promise<void> {
  await requireUpstream(root)
  await runRemote(root, ['pull', rebase ? '--rebase' : '--no-rebase', '--no-edit'])
}

/**
 * Send the current branch's commits to its upstream.
 * @param root - repository root.
 */
export async function pushBranch(root: string): Promise<void> {
  await requireUpstream(root)
  await runRemote(root, ['push'])
}

/**
 * Push a born branch to a remote and set that remote branch as its upstream.
 *
 * The requested remote wins; otherwise `origin`, otherwise the first
 * configured remote. A detached HEAD, an unborn branch, an unknown remote and a
 * repository without remotes each fail with a stable code.
 * @param root - repository root.
 * @param remote - validated remote name, or undefined for the default choice.
 */
export async function publishBranch(root: string, remote?: string): Promise<void> {
  const branch = await currentBranch(root)
  if (branch === null) {
    throw new GitGraphError('no-current-branch', 'No branch is checked out.', 409)
  }
  if (!(await headExists(root))) {
    throw new GitGraphError('unborn-branch', 'The current branch has no commits yet.', 409)
  }
  const remotes = await readRemotes(root)
  if (remotes.length === 0) {
    throw new GitGraphError('no-remotes', 'No remote is configured for this repository.', 409)
  }
  let target: RemoteInfo | undefined
  if (remote === undefined) {
    target = remotes.find((entry) => entry.name === 'origin') ?? remotes[0]
  } else {
    target = remotes.find((entry) => entry.name === remote)
    if (target === undefined) {
      throw new GitGraphError('unknown-remote', `No remote named "${remote}" is configured.`, 404)
    }
  }
  if (target === undefined) {
    // Unreachable after the empty-list check; keeps the type and failure stable.
    throw new GitGraphError('no-remotes', 'No remote is configured for this repository.', 409)
  }
  await runRemote(root, ['push', '--set-upstream', target.name, branch])
}

/**
 * Pull the upstream by merging, then push only when the pull succeeded.
 * @param root - repository root.
 */
export async function syncBranch(root: string): Promise<void> {
  await requireUpstream(root)
  await runRemote(root, ['pull', '--no-rebase', '--no-edit'])
  await runRemote(root, ['push'])
}
