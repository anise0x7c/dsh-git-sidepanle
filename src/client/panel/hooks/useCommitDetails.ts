/**
 * Commit-details state: the commit row the user activated, the metadata and
 * file list read for it, the loading/failure flags, and the back/retry
 * transitions the details view needs.
 */

import { useCallback, useRef, useState } from 'react'
import { toFailure } from '../../data/caller.ts'
import type {
  ChangedFile,
  CommitDetailsCommit,
  CommitSummary,
  Failure,
  RpcCall,
} from '../../types/domain.ts'
import type { PanelRefs } from '../menu.ts'

/** The fields a graph row carries into the details header before the Host answers. */
export type CommitSummaryPreview = Pick<
  CommitSummary,
  'oid' | 'shortOid' | 'subject' | 'author' | 'authoredAt'
>

/** The commit metadata and files the Host answered for the selected commit. */
export interface LoadedCommitDetails {
  /** Commit metadata, or null when a malformed answer omitted it. */
  readonly commit: CommitDetailsCommit | null
  /** Changed files in Git's order. */
  readonly files: ChangedFile[]
  /** Whether the Host capped the file list. */
  readonly truncated: boolean
}

/** Inputs of {@link useCommitDetails}. */
export interface UseCommitDetailsOptions {
  /** Panel RPC caller. */
  readonly call: RpcCall
  /** Shared panel refs. */
  readonly refs: PanelRefs
}

/** Commit selection and the details read. */
export interface CommitDetailsState {
  /** Activated graph row, or null while the change list shows. */
  readonly selected: CommitSummaryPreview | null
  /** Fetched details, or null while loading or before a selection. */
  readonly details: LoadedCommitDetails | null
  /** Whether the details read is running. */
  readonly loading: boolean
  /** Failed details read. */
  readonly failure: Failure | null
  /** Open one commit's details. */
  readonly selectCommit: (commit: CommitSummary | null | undefined) => void
  /** Return to the change list. */
  readonly closeCommit: () => void
  /** Retry the failed details read for the selected commit. */
  readonly retryCommit: () => void
}

/**
 * Read one commit's details on demand and expose the selection state.
 * Selecting a new commit discards the previous answer; a slow answer for a
 * commit the user already left is ignored.
 * @param options - hook inputs.
 * @returns commit selection, details, flags and handlers.
 */
export function useCommitDetails(options: UseCommitDetailsOptions): CommitDetailsState {
  const { call, refs } = options
  const [selected, setSelected] = useState<CommitSummaryPreview | null>(null)
  const [details, setDetails] = useState<LoadedCommitDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const requestToken = useRef(0)

  const loadCommit = useCallback(
    async (commit: { readonly oid: string }): Promise<void> => {
      requestToken.current += 1
      const token = requestToken.current
      setLoading(true)
      setFailure(null)
      setDetails(null)
      try {
        const value = await call('commit-details', { oid: commit.oid })
        if (!refs.mounted.current || requestToken.current !== token) return
        setDetails({
          commit: value.commit ?? null,
          files: Array.isArray(value.files) ? value.files : [],
          truncated: value.truncated === true,
        })
      } catch (error) {
        if (!refs.mounted.current || requestToken.current !== token) return
        setFailure(toFailure(error))
      } finally {
        if (refs.mounted.current && requestToken.current === token) setLoading(false)
      }
    },
    [call, refs],
  )

  const selectCommit = useCallback(
    (commit: CommitSummary | null | undefined): void => {
      if (commit === null || commit === undefined) return
      setSelected({
        oid: commit.oid,
        shortOid: commit.shortOid,
        subject: commit.subject,
        author: commit.author,
        authoredAt: commit.authoredAt,
      })
      void loadCommit(commit)
    },
    [loadCommit],
  )

  const closeCommit = useCallback((): void => {
    requestToken.current += 1
    setSelected(null)
    setDetails(null)
    setFailure(null)
    setLoading(false)
  }, [])

  const retryCommit = useCallback((): void => {
    if (selected !== null) void loadCommit(selected)
  }, [loadCommit, selected])

  return { selected, details, loading, failure, selectCommit, closeCommit, retryCommit }
}
