/**
 * The guarded RPC operations and their route paths.
 *
 * One operation per request: the payload names a Session and an operation, and
 * the repository is always resolved from the Session's working directory, so
 * the browser never sends a repository path of its own. This module only
 * validates non-path fields and dispatches; file paths and mutations live under
 * `git/`, and none of them run through a shell.
 */
import { existsSync } from 'node:fs'
import type { GitGraphRpcValue } from '../shared/git.ts'
import type { HostContext } from './context.ts'
import { GitGraphError } from './errors.ts'
import { readBranches, readRemoteBranches } from './git/branches.ts'
import { discardPath, ignorePath, stagePaths, unstagePaths } from './git/changes.ts'
import { readCommitDiff, readDiff } from './git/diff.ts'
import { findRepositoryRoot } from './git/exec.ts'
import { readCommitDetails, readHistory } from './git/history.ts'
import {
  checkoutBranch,
  checkoutDetached,
  checkoutRemoteBranch,
  commitChanges,
  createBranch,
  createTag,
  deleteBranch,
} from './git/mutations.ts'
import { readGraphReferences } from './git/references.ts'
import {
  addRemote,
  fetchAll,
  publishBranch,
  pullBranch,
  pushBranch,
  readRemotes,
  removeRemote,
  syncBranch,
} from './git/remotes.ts'
import { readStatus } from './git/status.ts'
import { resolveSessionDirectory } from './session.ts'
import {
  branchNameOf,
  checkoutBranchNameOf,
  commitMessageOf,
  commitOf,
  filePathOf,
  historyOffsetOf,
  optionalFilePathOf,
  optionalRemoteNameOf,
  panelOf,
  remoteBranchNameOf,
  remoteNameOf,
  remoteUrlOf,
  tagMessageOf,
  tagNameOf,
} from './validation.ts'
import type { RepositoryWatchRegistry } from './watch/registry.ts'

/** Route paths of the guarded family. */
export const RPC_PATH = '/api/dsh-git-sidepanel/rpc'
export const HEALTH_PATH = '/api/dsh-git-sidepanel/health'

/**
 * Dispatch one operation inside the repository containing a Session's directory.
 * @param ctx - Host context.
 * @param payload - validated request.
 * @param registry - repository watch registry owned by the route setup.
 * @returns operation value.
 */
export async function dispatch(
  ctx: HostContext,
  payload: Record<string, unknown>,
  registry: RepositoryWatchRegistry,
): Promise<GitGraphRpcValue> {
  const op = payload.op
  // Unsubscribing must work even when the Session or its directory is gone:
  // the watcher is keyed by the panel, not by the Session.
  if (op === 'unwatch') {
    registry.unwatch(panelOf(payload))
    return { ok: true }
  }
  const cwd = await resolveSessionDirectory(ctx, payload.sessionId)
  if (!existsSync(cwd))
    throw new GitGraphError(
      'workspace-not-found',
      `The working directory "${cwd}" does not exist.`,
      404,
    )
  if (op === 'status') return readStatus(cwd)
  if (op === 'watch') return registry.watch(cwd, panelOf(payload))

  const root = await findRepositoryRoot(cwd)
  if (root === null)
    throw new GitGraphError(
      'not-a-repository',
      `The working directory "${cwd}" is not inside a Git repository.`,
      409,
    )

  switch (op) {
    case 'references':
      return readGraphReferences(root)
    case 'history': {
      const offset = historyOffsetOf(payload.offset)
      const [page, references] = await Promise.all([
        readHistory(root, offset),
        readGraphReferences(root),
      ])
      return { commits: page.commits, hasMore: page.hasMore, references }
    }
    case 'commit-details':
      return readCommitDetails(root, commitOf(payload.oid))
    case 'branches': {
      const [branches, remotes] = await Promise.all([readBranches(root), readRemotes(root)])
      const remoteBranches = await readRemoteBranches(
        root,
        remotes.map((remote) => remote.name),
      )
      return { branches, remoteBranches }
    }
    case 'remotes':
      return { remotes: await readRemotes(root) }
    case 'add-remote':
      await addRemote(root, remoteNameOf(payload.name), remoteUrlOf(payload.url))
      return { ok: true }
    case 'remove-remote':
      await removeRemote(root, remoteNameOf(payload.name))
      return { ok: true }
    case 'fetch':
      await fetchAll(root)
      return { ok: true }
    case 'pull':
      await pullBranch(root, payload.rebase === true)
      return { ok: true }
    case 'push':
      await pushBranch(root)
      return { ok: true }
    case 'publish':
      await publishBranch(root, optionalRemoteNameOf(payload.remote))
      return { ok: true }
    case 'sync':
      await syncBranch(root)
      return { ok: true }
    case 'stage':
      await stagePaths(root, payload.paths)
      return { ok: true }
    case 'unstage':
      await unstagePaths(root, payload.paths)
      return { ok: true }
    case 'discard':
      await discardPath(root, payload.path, payload.untracked === true)
      return { ok: true }
    case 'ignore':
      await ignorePath(root, payload.path)
      return { ok: true }
    case 'commit':
      return {
        ok: true,
        commit: await commitChanges(
          root,
          commitMessageOf(payload.message),
          payload.stageAll === true,
          payload.amend === true,
        ),
      }
    case 'checkout': {
      const branch = await checkoutBranchNameOf(root, payload.branch)
      await checkoutBranch(root, branch)
      return { ok: true, branch }
    }
    case 'checkout-remote': {
      const remote = remoteNameOf(payload.remote)
      const remotes = await readRemotes(root)
      if (!remotes.some((entry) => entry.name === remote)) {
        throw new GitGraphError('unknown-remote', `No remote named "${remote}" is configured.`, 404)
      }
      const branch = await remoteBranchNameOf(root, remote, payload.branch)
      return { ok: true, branch: await checkoutRemoteBranch(root, remote, branch) }
    }
    case 'checkout-detached':
      await checkoutDetached(root, commitOf(payload.oid))
      return { ok: true }
    case 'create-branch': {
      const oid = commitOf(payload.oid)
      const name = await branchNameOf(root, payload.name)
      await createBranch(root, oid, name)
      return { ok: true, branch: name }
    }
    case 'create-tag': {
      const oid = commitOf(payload.oid)
      const name = await tagNameOf(root, payload.name)
      await createTag(root, oid, name, tagMessageOf(payload.message))
      return { ok: true }
    }
    case 'delete-branch': {
      const branch = await branchNameOf(root, payload.branch)
      await deleteBranch(root, branch)
      return { ok: true }
    }
    case 'diff': {
      const path = filePathOf(payload.path)
      if (payload.commit !== undefined) {
        return readCommitDiff(
          root,
          path,
          commitOf(payload.commit),
          optionalFilePathOf(payload.origPath),
        )
      }
      return readDiff(root, path, payload.staged === true, payload.untracked === true)
    }
    default:
      throw new GitGraphError('unknown-operation', `Unknown operation "${String(op)}".`, 400)
  }
}
