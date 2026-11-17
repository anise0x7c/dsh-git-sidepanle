/**
 * Commit-history state: the graph commits, their loading and failure flags, the
 * refresh used after commit/checkout and by the inline retry controls, and the
 * paging that appends earlier commits below the loaded rows.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { toFailure } from '../../data/caller.ts'
import type { CommitSummary, Failure, GraphReferences, RpcCall } from '../../types/domain.ts'
import type { PanelRefs } from '../menu.ts'

/** Inputs of {@link useHistory}. */
export interface UseHistoryOptions {
  /** Panel RPC caller. */
  readonly call: RpcCall
  /** Shared panel refs. */
  readonly refs: PanelRefs
}

/** Commit-history state and its loaders. */
export interface HistoryState {
  /** Graph commits loaded so far, or null before the first answer. */
  readonly graph: CommitSummary[] | null
  /** Checked-out, upstream and base references of the last answer. */
  readonly references: GraphReferences | null
  /** Whether the first-page load is running. */
  readonly graphLoading: boolean
  /** Failed first-page load. */
  readonly graphFailure: Failure | null
  /** Whether commits older than the loaded ones remain. */
  readonly hasMore: boolean
  /** Whether an earlier page is loading. */
  readonly moreLoading: boolean
  /** Failed earlier page; the loaded rows stay visible. */
  readonly moreFailure: Failure | null
  /** Reload the history from the newest page. */
  readonly loadGraph: () => Promise<void>
  /** Reload only the checked-out, upstream and base references. */
  readonly refreshReferences: () => Promise<GraphReferences | null>
  /** Append the next page of earlier commits. */
  readonly loadMore: () => Promise<void>
}

/**
 * Whether an answer carries the graph references object.
 * @param value - candidate.
 * @returns true for an object with the three reference slots.
 */
function isReferences(value: unknown): value is GraphReferences {
  return typeof value === 'object' && value !== null && 'current' in value
}

/**
 * Load the newest page of commits once on mount, then append earlier pages on
 * demand. A repository that is not a repository shows an empty graph rather
 * than an error, matching the Host status that the panel already renders.
 * @param options - hook inputs.
 * @returns history state and its loaders.
 */
export function useHistory(options: UseHistoryOptions): HistoryState {
  const { call, refs } = options
  const [graph, setGraph] = useState<CommitSummary[] | null>(null)
  const [references, setReferences] = useState<GraphReferences | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphFailure, setGraphFailure] = useState<Failure | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [moreFailure, setMoreFailure] = useState<Failure | null>(null)
  // Number of commits the Host has returned for the current generation. A
  // refresh starts a new generation, so a page that was already in flight when
  // it began cannot append its rows to the replacement list.
  const offset = useRef(0)
  const generation = useRef(0)
  const moreInFlight = useRef(false)

  const loadGraph = useCallback(async (): Promise<void> => {
    const current = generation.current + 1
    generation.current = current
    if (refs.mounted.current) setGraphLoading(true)
    try {
      const value = await call('history')
      if (!refs.mounted.current || generation.current !== current) return
      const commits = Array.isArray(value.commits) ? value.commits : []
      offset.current = commits.length
      setGraph(commits)
      setHasMore(value.hasMore === true)
      setMoreFailure(null)
      setReferences(isReferences(value.references) ? value.references : null)
      setGraphFailure(null)
    } catch (error) {
      if (!refs.mounted.current || generation.current !== current) return
      const failure = toFailure(error)
      if (failure.code === 'not-a-repository') {
        offset.current = 0
        setGraph([])
        setReferences(null)
        setHasMore(false)
        setMoreFailure(null)
      } else setGraphFailure(failure)
    } finally {
      if (refs.mounted.current && generation.current === current) setGraphLoading(false)
    }
  }, [call, refs])

  const refreshReferences = useCallback(async (): Promise<GraphReferences | null> => {
    try {
      const value = await call('references')
      if (!refs.mounted.current) return null
      setReferences(value)
      return value
    } catch {
      // The fixed colors only; a failed read keeps the previous references and
      // lets the next change or the manual refresh try again.
      return null
    }
  }, [call, refs])

  const loadMore = useCallback(async (): Promise<void> => {
    if (!refs.mounted.current || moreInFlight.current || graphLoading || !hasMore) return
    const current = generation.current
    moreInFlight.current = true
    setMoreLoading(true)
    try {
      const value = await call('history', { offset: offset.current })
      if (!refs.mounted.current || generation.current !== current) return
      const page = Array.isArray(value.commits) ? value.commits : []
      offset.current += page.length
      setGraph((previous) => {
        const loaded = previous ?? []
        const known = new Set(loaded.map((commit) => commit.oid))
        return [...loaded, ...page.filter((commit) => !known.has(commit.oid))]
      })
      if (isReferences(value.references)) setReferences(value.references)
      setHasMore(value.hasMore === true)
      setMoreFailure(null)
    } catch (error) {
      if (!refs.mounted.current || generation.current !== current) return
      setMoreFailure(toFailure(error))
    } finally {
      moreInFlight.current = false
      if (refs.mounted.current) setMoreLoading(false)
    }
  }, [call, graphLoading, hasMore, refs])

  useEffect(() => {
    void loadGraph()
  }, [loadGraph])

  return {
    graph,
    references,
    graphLoading,
    graphFailure,
    hasMore,
    moreLoading,
    moreFailure,
    loadGraph,
    refreshReferences,
    loadMore,
  }
}
