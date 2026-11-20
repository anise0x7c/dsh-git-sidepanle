/**
 * Commit and reference mutations requested by the graph and branch menus.
 *
 * Identifiers and names arrive validated; these functions change repository
 * state with the same Git commands and failure mapping the Host always used.
 */
import { GitGraphError } from '../errors.ts'
import { branchExists } from './branches.ts'
import { gitOrThrow, runGit } from './exec.ts'

const COMMIT_TIMEOUT_MS = 120_000

/**
 * Create a commit from the index, optionally staging every change first.
 *
 * With `amend` the current HEAD commit is replaced instead of extended, so a
 * new message alone is a valid amend and the staged-changes check is skipped.
 * @param root - repository root.
 * @param message - non-empty, length-checked commit message.
 * @param stageAll - stage all working-tree changes before committing.
 * @param amend - replace the current HEAD commit instead of adding one.
 * @returns the short HEAD id, or null when Git cannot report one.
 */
export async function commitChanges(
  root: string,
  message: string,
  stageAll: boolean,
  amend = false,
): Promise<string | null> {
  if (amend) {
    const head = await runGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD'])
    if (!head.ok) {
      if (head.code === 'ENOENT')
        throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
      throw new GitGraphError('nothing-to-amend', 'The current branch has no commit to amend.', 409)
    }
  }
  if (stageAll) await gitOrThrow(root, ['add', '-A'])
  if (!amend) {
    const staged = await runGit(root, ['diff', '--cached', '--quiet'])
    // Exit code 1 means staged differences exist; anything else is a real failure.
    if (staged.ok)
      throw new GitGraphError('nothing-staged', 'There are no staged changes to commit.', 409)
    if (staged.code !== 1) {
      if (staged.code === 'ENOENT')
        throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
      throw new GitGraphError(
        'git-command-failed',
        staged.stderr.trim() || 'git diff --cached failed',
        409,
      )
    }
  }
  const committed = await runGit(root, ['commit', ...(amend ? ['--amend'] : []), '-m', message], {
    timeout: COMMIT_TIMEOUT_MS,
  })
  if (!committed.ok) {
    if (committed.code === 'ENOENT')
      throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    const detail = `${committed.stdout}\n${committed.stderr}`.trim()
    if (amend) {
      throw new GitGraphError('git-command-failed', detail || 'git commit --amend failed', 409)
    }
    const failure = detail || 'git commit failed'
    if (/nothing to commit|no changes added to commit/i.test(failure)) {
      throw new GitGraphError('nothing-staged', 'There are no staged changes to commit.', 409)
    }
    throw new GitGraphError('git-command-failed', failure, 409)
  }
  const head = await runGit(root, ['rev-parse', '--short', 'HEAD'])
  return head.ok ? head.stdout.trim() : null
}

/**
 * Switch to a validated existing local branch.
 * @param root - repository root.
 * @param branch - branch name.
 */
export async function checkoutBranch(root: string, branch: string): Promise<void> {
  if (!(await branchExists(root, branch))) {
    throw new GitGraphError('unknown-branch', `No local branch named "${branch}" exists.`, 404)
  }
  const switched = await runGit(root, ['switch', branch])
  if (!switched.ok) {
    if (switched.code === 'ENOENT')
      throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    throw new GitGraphError(
      'git-command-failed',
      `${switched.stdout}\n${switched.stderr}`.trim() || 'git switch failed',
      409,
    )
  }
}

/**
 * Check out the local branch corresponding to a remote-tracking branch.
 *
 * A validated `refs/remotes/<remote>/<branch>` must exist. When a local branch
 * of the same name already exists it is switched to as-is, so its upstream is
 * untouched; otherwise a new local branch tracks the remote one.
 * @param root - repository root.
 * @param remote - validated remote name.
 * @param branch - validated branch name within that remote.
 * @returns the checked-out local branch name.
 */
export async function checkoutRemoteBranch(
  root: string,
  remote: string,
  branch: string,
): Promise<string> {
  const remoteBranch = `${remote}/${branch}`
  const exists = await runGit(root, [
    'rev-parse',
    '--verify',
    '--quiet',
    `refs/remotes/${remoteBranch}`,
  ])
  if (!exists.ok) {
    if (exists.code === 'ENOENT')
      throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    throw new GitGraphError(
      'unknown-remote-branch',
      `No remote branch named "${remoteBranch}" exists.`,
      404,
    )
  }
  if (await branchExists(root, branch)) {
    await checkoutBranch(root, branch)
    return branch
  }
  const switched = await runGit(root, ['switch', '-c', branch, '--track', remoteBranch])
  if (!switched.ok) {
    if (switched.code === 'ENOENT')
      throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    throw new GitGraphError(
      'git-command-failed',
      `${switched.stdout}\n${switched.stderr}`.trim() || 'git switch failed',
      409,
    )
  }
  return branch
}

/**
 * Detach HEAD at a validated commit.
 * @param root - repository root.
 * @param oid - full commit identifier.
 */
export async function checkoutDetached(root: string, oid: string): Promise<void> {
  await gitOrThrow(root, ['switch', '--detach', '--', oid])
}

/**
 * Create and switch to a new branch at a validated commit.
 * @param root - repository root.
 * @param oid - full commit identifier.
 * @param name - validated branch name.
 */
export async function createBranch(root: string, oid: string, name: string): Promise<void> {
  await gitOrThrow(root, ['switch', '-c', name, '--', oid])
}

/**
 * Create a lightweight or annotated tag at a validated commit.
 * @param root - repository root.
 * @param oid - full commit identifier.
 * @param name - validated tag name.
 * @param message - trimmed message; empty for a lightweight tag.
 */
export async function createTag(
  root: string,
  oid: string,
  name: string,
  message: string,
): Promise<void> {
  await gitOrThrow(root, ['tag', ...(message === '' ? [] : ['-a', '-m', message]), '--', name, oid])
}

/**
 * Delete a validated existing local branch.
 * @param root - repository root.
 * @param branch - branch name.
 */
export async function deleteBranch(root: string, branch: string): Promise<void> {
  if (!(await branchExists(root, branch))) {
    throw new GitGraphError('unknown-branch', `No local branch named "${branch}" exists.`, 404)
  }
  await gitOrThrow(root, ['branch', '-d', '--', branch])
}
