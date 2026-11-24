/**
 * Inline commit expansion in the graph (Code OSS's expanded history item): which
 * commits list their changed files below their rows, the file list read for
 * each one, its loading/failure flags, and the toggle/retry transitions.
 */

import { useCallback, useRef, useState } from 'react'
import { toFailure } from '../../data/caller.ts'
import { sortChangeEntries } from '../../git/list.ts'
import type { CommitFileRow, Failure, RpcCall } from '../../types/domain.ts'
import type { PanelRefs } from '../menu.ts'

/** The read state of one expanded commit's file list. */
export interface CommitExpansion {
  /** Whether the file list is being read. */
  readonly loading: boolean
  /** Failed read, or null. */
  readonly failure: Failure | null
  /** Changed files sorted by path, empty until the read answers. */
  readonly files: readonly CommitFileRow[]
  /** Whether the Host capped the file list. */
  readonly truncated: boolean
}

/** Inputs of {@link useCommitExpansion}. */
export interface UseCommitExpansionOptions {
  /** Panel RPC caller. */
  readonly call: RpcCall
  /** Shared panel refs. */
  readonly refs: PanelRefs
}

/** Expanded commits and their transitions. */
export interface CommitExpansionState {
  /** Expanded commits by full id, in expansion order. */
  readonly expanded: ReadonlyMap<string, CommitExpansion>
  /** Expand a collapsed commit and read its files, or collapse an expanded one. */
  readonly toggleCommit: (commit: { readonly oid: string } | null | undefined) => void
  /** Read an expanded commit's file list again. */
  readonly retryCommit: (commit: { readonly oid: string } | null | undefined) => void
}

/** State of a commit whose read has just started. */
const LOADING: CommitExpansion = { loading: true, failure: null, files: [], truncated: false }

/**
 * Track the expanded commits and read each one's file list on demand. Every
 * commit has its own request token, so collapsing a commit or reading it again
 * discards a slow answer for the earlier request without touching the others.
 * @param options - hook inputs.
 * @returns expanded commits and toggle/retry handlers.
 */
export function useCommitExpansion(options: UseCommitExpansionOptions): CommitExpansionState {
  const { call, refs } = options
  const [expanded, setExpanded] = useState<ReadonlyMap<string, CommitExpansion>>(() => new Map())
  const tokens = useRef(new Map<string, number>())

  /**
   * Replace one commit's entry, or remove it with null.
   * @param oid - commit id.
   * @param next - replacement entry.
   */
  const put = useCallback((oid: string, next: CommitExpansion | null): void => {
    setExpanded((current) => {
      const copy = new Map(current)
      if (next === null) copy.delete(oid)
      else copy.set(oid, next)
      return copy
    })
  }, [])

  /**
   * Start a new token for one commit so earlier answers are ignored.
   * @param oid - commit id.
   * @returns the new token.
   */
  const nextToken = useCallback((oid: string): number => {
    const token = (tokens.current.get(oid) ?? 0) + 1
    tokens.current.set(oid, token)
    return token
  }, [])

  const load = useCallback(
    async (oid: string): Promise<void> => {
      const token = nextToken(oid)
      const current = (): boolean => refs.mounted.current && tokens.current.get(oid) === token
      put(oid, LOADING)
      try {
        const value = await call('commit-details', { oid })
        if (!current()) return
        const files = sortChangeEntries(Array.isArray(value.files) ? value.files : []).map(
          (file): CommitFileRow => ({ ...file, kind: 'commit' }),
        )
        put(oid, { loading: false, failure: null, files, truncated: value.truncated === true })
      } catch (error) {
        if (!current()) return
        put(oid, { loading: false, failure: toFailure(error), files: [], truncated: false })
      }
    },
    [call, refs, put, nextToken],
  )

  const toggleCommit = useCallback(
    (commit: { readonly oid: string } | null | undefined): void => {
      if (commit === null || commit === undefined || typeof commit.oid !== 'string') return
      const oid = commit.oid
      if (expanded.has(oid)) {
        nextToken(oid)
        put(oid, null)
        return
      }
      void load(oid)
    },
    [expanded, load, put, nextToken],
  )

  const retryCommit = useCallback(
    (commit: { readonly oid: string } | null | undefined): void => {
      if (commit === null || commit === undefined || !expanded.has(commit.oid)) return
      void load(commit.oid)
    },
    [expanded, load],
  )

  return { expanded, toggleCommit, retryCommit }
}
