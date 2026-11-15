/**
 * Repository status state: the panel's command caller and menu wiring, the
 * initial load, the silent refresh actions use, and the 5 s visibility-aware
 * poll. This is the only status loader in the panel.
 */

import { useCallback, useEffect, useState } from 'react'
import { POLL_INTERVAL_MS } from '../../constants.js'
import { usePanelMenu } from '../menu.js'

/**
 * Load the repository status once, then keep it fresh. A load is skipped while
 * one is in flight, while the tab is hidden, and while an action or the
 * confirmation dialog owns the panel.
 * @param {object} options - hook inputs.
 * @param {string} options.sessionId - Session the panel is bound to.
 * @param {Function} [options.useContextMenu] - host context-menu trigger hook.
 * @param {boolean} options.visible - whether the tab is visible.
 * @param {object} options.refs - shared panel refs (see `usePanelRefs`).
 * @returns {object} status state, its loader and the panel wiring.
 */
export function useRepoStatus({ sessionId, useContextMenu, visible, refs }) {
  const { call, menuTrigger, panelId } = usePanelMenu({ sessionId, useContextMenu })
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState(null)

  const loadStatus = useCallback(async (options = {}) => {
    if (refs.inFlight.current) return
    refs.inFlight.current = true
    if (options.silent !== true) setLoading(true)
    try {
      const value = await call('status')
      if (!refs.mounted.current) return
      setStatus(value)
      setLoadFailure(null)
    } catch (error) {
      if (!refs.mounted.current) return
      setLoadFailure(error)
    } finally {
      refs.inFlight.current = false
      if (refs.mounted.current) setLoading(false)
    }
  }, [call, refs])

  useEffect(() => { void loadStatus() }, [loadStatus])

  useEffect(() => {
    if (!visible) return undefined
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (refs.inFlight.current || refs.busy.current !== null || refs.confirm.current !== null) return
      void loadStatus({ silent: true })
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [visible, loadStatus, refs])

  return { call, menuTrigger, panelId, status, loading, loadFailure, setLoadFailure, loadStatus }
}
