/**
 * Working-tree, index and ignore-file mutations for one file-action request.
 *
 * Paths are validated and passed to Git literally by the callers in this
 * module; the RPC dispatcher only validates the non-path wire fields.
 */
import { GitGraphError } from '../errors.ts'
import { gitOrThrow, runGit } from './exec.ts'
import { removeUntrackedPath } from './files.ts'
import { appendGitignoreRule } from './ignore.ts'
import { resolveRepositoryPath, resolveRepositoryPaths } from './paths.ts'

/**
 * Stage the requested repository-relative paths.
 * @param root - repository root.
 * @param input - wire paths.
 */
export async function stagePaths(root: string, input: unknown): Promise<void> {
  const paths = resolveRepositoryPaths(root, input)
  await gitOrThrow(root, ['add', '-A', '--', ...paths])
}

/**
 * Unstage the requested repository-relative paths.
 * @param root - repository root.
 * @param input - wire paths.
 */
export async function unstagePaths(root: string, input: unknown): Promise<void> {
  const paths = resolveRepositoryPaths(root, input)
  const restored = await runGit(root, ['restore', '--staged', '--', ...paths])
  if (!restored.ok) {
    // An unborn branch has no HEAD to restore from; remove the entries instead.
    const removed = await runGit(root, [
      'rm',
      '--cached',
      '-r',
      '--quiet',
      '--ignore-unmatch',
      '--',
      ...paths,
    ])
    if (!removed.ok) {
      throw new GitGraphError(
        'git-command-failed',
        removed.stderr.trim() || restored.stderr.trim() || 'git restore failed',
        409,
      )
    }
  }
}

/**
 * Discard tracked changes for the requested repository-relative paths.
 * @param root - repository root.
 * @param input - wire paths.
 */
export async function discardTracked(root: string, input: unknown): Promise<void> {
  const paths = resolveRepositoryPaths(root, [input])
  const restored = await runGit(root, [
    'restore',
    '--source=HEAD',
    '--staged',
    '--worktree',
    '--',
    ...paths,
  ])
  if (!restored.ok) {
    if (/could not resolve HEAD|unknown revision|bad revision/i.test(restored.stderr)) {
      throw new GitGraphError(
        'discard-unborn',
        'Changes cannot be discarded before the first commit.',
        409,
      )
    }
    throw new GitGraphError(
      'git-command-failed',
      restored.stderr.trim() || 'git restore failed',
      409,
    )
  }
}

/**
 * Discard one path, deleting only a target Git reports as untracked.
 * @param root - repository root.
 * @param rawPath - wire path.
 * @param untracked - browser's request; Git remains the authority.
 */
export async function discardPath(
  root: string,
  rawPath: unknown,
  untracked: boolean,
): Promise<void> {
  const [path] = resolveRepositoryPaths(root, [rawPath])
  if (untracked) {
    await removeUntrackedPath(root, path)
    return
  }
  await discardTracked(root, path)
}

/**
 * Append a literal ignore rule for one repository-relative path.
 * @param root - repository root.
 * @param rawPath - wire path.
 */
export async function ignorePath(root: string, rawPath: unknown): Promise<void> {
  resolveRepositoryPath(root, rawPath)
  const path = rawPath as string
  if (path.includes('\n') || path.includes('\r')) {
    throw new GitGraphError(
      'bad-request',
      'The file path cannot be represented in .gitignore.',
      400,
    )
  }
  await appendGitignoreRule(root, path)
}
