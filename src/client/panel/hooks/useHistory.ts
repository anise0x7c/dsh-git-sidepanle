/**
 * Commit-history state: the graph commits, their loading and failure flags, and
 * the refresh used after commit/checkout and by the inline retry controls.
 */

import { useCallback, useEffect, useState } from 'react'
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

/** Commit-history state and its loader. */
export interface HistoryState {
  /** Graph commits, or null before the first answer. */
  readonly graph: CommitSummary[] | null
  /** Checked-out, upstream and base references of the last answer. */
  readonly references: GraphReferences | null
  /** Whether the history load is running. */
  readonly graphLoading: boolean
  /** Failed history load. */
  readonly graphFailure: Failure | null
  /** Reload the history. */
  readonly loadGraph: () => Promise<void>
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
 * Load commits once on mount and expose a refresh for the panel.
 * A repository that is not a repository shows an empty graph rather than an
 * error, matching the Host status that the panel already renders.
 * @param options - hook inputs.
 * @returns history state and its loader.
 */
export function useHistory(options: UseHistoryOptions): HistoryState {
  const { call, refs } = options
  const [graph, setGraph] = useState<CommitSummary[] | null>(null)
  const [references, setReferences] = useState<GraphReferences | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphFailure, setGraphFailure] = useState<Failure | null>(null)

  const loadGraph = useCallback(async (): Promise<void> => {
    if (refs.mounted.current) setGraphLoading(true)
    try {
      const value = await call('history')
      if (!refs.mounted.current) return
      setGraph(Array.isArray(value.commits) ? value.commits : [])
      setReferences(isReferences(value.references) ? value.references : null)
      setGraphFailure(null)
    } catch (error) {
      if (!refs.mounted.current) return
      const failure = toFailure(error)
      if (failure.code === 'not-a-repository') {
        setGraph([])
        setReferences(null)
      } else setGraphFailure(failure)
    } finally {
      if (refs.mounted.current) setGraphLoading(false)
    }
  }, [call, refs])

  useEffect(() => {
    void loadGraph()
  }, [loadGraph])

  return { graph, references, graphLoading, graphFailure, loadGraph }
}
