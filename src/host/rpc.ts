/**
 * The guarded RPC operations and their route paths.
 *
 * One operation per request: the payload names a Session and an operation, and
 * the repository is always resolved from the Session's working directory, so
 * the browser never sends a repository path of its own. Operations reuse the
 * validated path helpers from `git/exec.ts`; none of them run through a shell.
 */
import { existsSync } from 'node:fs'
import { lstat, unlink } from 'node:fs/promises'
import type { GitGraphRpcValue } from '../shared/git.ts'
import type { HostContext } from './context.ts'
import { GitGraphError } from './errors.ts'
import { branchExists, readBranches } from './git/branches.ts'
import { readCommitDiff, readDiff } from './git/diff.ts'
import {
  findRepositoryRoot,
  gitOrThrow,
  resolveRepositoryPath,
  resolveRepositoryPaths,
  runGit,
} from './git/exec.ts'
import { readCommitDetails, readHistory } from './git/history.ts'
import { readGraphReferences } from './git/references.ts'
import { readStatus } from './git/status.ts'
import { resolveSessionDirectory } from './session.ts'

/** Route paths of the guarded family. */
export const RPC_PATH = '/api/dsh-git-graph/rpc'
export const HEALTH_PATH = '/api/dsh-git-graph/health'

const COMMIT_TIMEOUT_MS = 120_000
const FULL_OID = /^[0-9a-f]{40}$/

/**
 * Dispatch one operation inside the repository containing a Session's directory.
 * @param ctx - Host context.
 * @param payload - validated request.
 * @returns operation value.
 */
export async function dispatch(
  ctx: HostContext,
  payload: Record<string, unknown>,
): Promise<GitGraphRpcValue> {
  const cwd = await resolveSessionDirectory(ctx, payload.sessionId)
  if (!existsSync(cwd))
    throw new GitGraphError(
      'workspace-not-found',
      `The working directory "${cwd}" does not exist.`,
      404,
    )
  const op = payload.op
  if (op === 'status') return readStatus(cwd)

  const root = await findRepositoryRoot(cwd)
  if (root === null)
    throw new GitGraphError(
      'not-a-repository',
      `The working directory "${cwd}" is not inside a Git repository.`,
      409,
    )

  switch (op) {
    case 'history': {
      const offset = payload.offset
      if (
        offset !== undefined &&
        (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0)
      ) {
        throw new GitGraphError(
          'bad-request',
          'The history offset must be a non-negative integer.',
          400,
        )
      }
      const [page, references] = await Promise.all([
        readHistory(root, offset ?? 0),
        readGraphReferences(root),
      ])
      return { commits: page.commits, hasMore: page.hasMore, references }
    }
    case 'commit-details': {
      const oid = payload.oid
      if (typeof oid !== 'string' || !FULL_OID.test(oid)) {
        throw new GitGraphError('bad-request', 'A full commit identifier is required.', 400)
      }
      return readCommitDetails(root, oid)
    }
    case 'branches':
      return { branches: await readBranches(root) }
    case 'stage': {
      const paths = resolveRepositoryPaths(root, payload.paths)
      await gitOrThrow(root, ['add', '-A', '--', ...paths])
      return { ok: true }
    }
    case 'unstage': {
      const paths = resolveRepositoryPaths(root, payload.paths)
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
      return { ok: true }
    }
    case 'discard': {
      const paths = resolveRepositoryPaths(root, [payload.path])
      const absolute = resolveRepositoryPath(root, payload.path)
      if (payload.untracked === true) {
        const info = await lstat(absolute).catch(() => undefined)
        if (info === undefined) return { ok: true }
        if (!info.isFile() && !info.isSymbolicLink()) {
          throw new GitGraphError('not-a-file', `"${String(payload.path)}" is not a file.`, 409)
        }
        await unlink(absolute)
        return { ok: true }
      }
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
      return { ok: true }
    }
    case 'commit': {
      const message = typeof payload.message === 'string' ? payload.message.trim() : ''
      if (message === '')
        throw new GitGraphError('empty-message', 'A commit message is required.', 400)
      if (message.length > 20_000)
        throw new GitGraphError('message-too-long', 'The commit message is too long.', 400)
      if (payload.stageAll === true) await gitOrThrow(root, ['add', '-A'])
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
      return { ok: true, commit: head.ok ? head.stdout.trim() : null }
    }
    case 'checkout': {
      const branch = payload.branch
      if (typeof branch !== 'string' || branch === '' || branch.startsWith('-')) {
        throw new GitGraphError('bad-request', 'A local branch name is required.', 400)
      }
      const formatted = await runGit(root, ['check-ref-format', '--branch', branch])
      if (!formatted.ok || !(await branchExists(root, branch))) {
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
      return { ok: true, branch }
    }
    case 'diff': {
      const path = payload.path
      if (typeof path !== 'string')
        throw new GitGraphError('bad-request', 'A file path is required.', 400)
      if (payload.commit !== undefined) {
        const commit = payload.commit
        if (typeof commit !== 'string' || !FULL_OID.test(commit)) {
          throw new GitGraphError('bad-request', 'A full commit identifier is required.', 400)
        }
        const origPath =
          typeof payload.origPath === 'string' && payload.origPath !== ''
            ? payload.origPath
            : undefined
        return readCommitDiff(root, path, commit, origPath)
      }
      return readDiff(root, path, payload.staged === true, payload.untracked === true)
    }
    default:
      throw new GitGraphError('unknown-operation', `Unknown operation "${String(op)}".`, 400)
  }
}
