/**
 * Commit-history state: the graph commits, their loading and failure flags, and
 * the refresh used after commit/checkout and by the inline retry controls.
 */

import { useCallback, useEffect, useState } from 'react'

/**
 * Load commits once on mount and expose a refresh for the panel.
 * A repository that is not a repository shows an empty graph rather than an
 * error, matching the Host status that the panel already renders.
 * @param {object} options - hook inputs.
 * @param {Function} options.call - panel RPC caller.
 * @param {object} options.refs - shared panel refs (see `usePanelRefs`).
 * @returns {{graph: object[]|null, graphLoading: boolean, graphFailure: object|null, loadGraph: Function}} history state.
 */
export function useHistory({ call, refs }) {
  const [graph, setGraph] = useState(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphFailure, setGraphFailure] = useState(null)

  const loadGraph = useCallback(async () => {
    if (refs.mounted.current) setGraphLoading(true)
    try {
      const value = await call('history')
      if (!refs.mounted.current) return
      setGraph(Array.isArray(value?.commits) ? value.commits : [])
      setGraphFailure(null)
    } catch (error) {
      if (!refs.mounted.current) return
      if (error.code === 'not-a-repository') setGraph([])
      else setGraphFailure(error)
    } finally {
      if (refs.mounted.current) setGraphLoading(false)
    }
  }, [call, refs])

  useEffect(() => { void loadGraph() }, [loadGraph])

  return { graph, graphLoading, graphFailure, loadGraph }
}
