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
 * @param root - repository root.
 * @param message - non-empty, length-checked commit message.
 * @param stageAll - stage all working-tree changes before committing.
 * @returns the short HEAD id, or null when Git cannot report one.
 */
export async function commitChanges(
  root: string,
  message: string,
  stageAll: boolean,
): Promise<string | null> {
  if (stageAll) await gitOrThrow(root, ['add', '-A'])
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
  const committed = await runGit(root, ['commit', '-m', message], {
    timeout: COMMIT_TIMEOUT_MS,
  })
  if (!committed.ok) {
    if (committed.code === 'ENOENT')
      throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    const detail = `${committed.stdout}\n${committed.stderr}`.trim() || 'git commit failed'
    if (/nothing to commit|no changes added to commit/i.test(detail)) {
      throw new GitGraphError('nothing-staged', 'There are no staged changes to commit.', 409)
    }
    throw new GitGraphError('git-command-failed', detail, 409)
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
