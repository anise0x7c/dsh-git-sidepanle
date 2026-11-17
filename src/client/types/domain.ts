/**
 * Domain types for the browser half.
 *
 * The wire contract with the guarded Host route lives in `src/shared/git.ts`
 * and is re-exported here so client modules and tests import one local module.
 * The row types below are presentation-only: they add the display letter (and
 * the commit-file marker) the flat lists render.
 */

import type {
  ChangedFile,
  ChangeEntry,
  GitGraphOperation,
  GitGraphPayloads,
  GitGraphRpcValues,
} from '../../shared/git.ts'

export type {
  BranchesResult,
  BranchInfo,
  ChangedFile,
  ChangeEntry,
  ChangeKind,
  CheckoutResult,
  CommitDetails,
  CommitDetailsCommit,
  CommitDiff,
  CommitResult,
  CommitSummary,
  DiffHunk,
  DiffLine,
  DiffResult,
  GitGraphOperation,
  GitGraphPayloads,
  GitGraphRequest,
  GitGraphRpcValue,
  GitGraphRpcValues,
  GraphReference,
  GraphReferences,
  HistoryResult,
  OkResult,
  ParsedDiff,
  RepositoryInfo,
  RepositoryStatus,
  RpcErrorBody,
  RpcResponseBody,
  RpcSuccessBody,
  StatusResult,
  WatchState,
  WorkingTreeDiff,
} from '../../shared/git.ts'

/** One changed-file row with the letter its group renders. */
export interface ChangeRow extends ChangeEntry {
  /** Display letter of the group the row belongs to. */
  readonly letter: string
}

/** One file a commit changed, marked for the commit-details flat list. */
export interface CommitFileRow extends ChangedFile {
  /** Distinguishes past-commit rows from working-tree rows. */
  readonly kind: 'commit'
}

/** Failure envelope surfaced by the panel: host code plus display message. */
export interface Failure {
  /** Stable Host error code, when the failure carries one. */
  readonly code?: string
  /** Host-supplied detail, when the failure carries one. */
  readonly message?: string
}

/** Error carrying the Host failure envelope; thrown by the panel caller. */
export interface CallerFailure extends Error {
  /** Stable failure code. */
  readonly code: string
  /** Failure detail. */
  readonly detail: string
  /** HTTP status when the Host answered. */
  readonly status: number | undefined
}

/**
 * Required argument tuple of one RPC operation.
 *
 * Operations whose payload has no required field accept an optional argument
 * (`{}` for none, `{ offset }` for a later history page); every operation with
 * a required field requires its payload, so `call('commit')` is a type error.
 */
export type RpcArgs<Operation extends GitGraphOperation> =
  Partial<GitGraphPayloads[Operation]> extends GitGraphPayloads[Operation]
    ? [payload?: GitGraphPayloads[Operation]]
    : [payload: GitGraphPayloads[Operation]]

/**
 * Call one Host RPC operation for the panel's Session.
 *
 * The generic keeps each operation's value type, so hooks read the exact
 * response shape instead of a union. The argument tuple makes a payload
 * mandatory for every operation that has one.
 * @param operation - Host operation name.
 * @param args - the operation's payload, required unless it takes none.
 * @returns that operation's value.
 */
export type RpcCall = <Operation extends GitGraphOperation>(
  operation: Operation,
  ...args: RpcArgs<Operation>
) => Promise<GitGraphRpcValues[Operation]>
