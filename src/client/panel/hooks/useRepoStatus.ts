/**
 * Repository status state: the panel's command caller and menu wiring, the
 * initial load, the silent refresh actions use, and the 5 s visibility-aware
 * poll that remains as the fallback while the Host cannot watch the repository.
 */

import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { POLL_INTERVAL_MS } from '../../constants.ts'
import { toFailure } from '../../data/caller.ts'
import type { MenuTriggerFactory } from '../../menu/trigger.ts'
import type { Failure, RpcCall, StatusResult } from '../../types/domain.ts'
import type { UseContextMenu } from '../../types/dsh.ts'
import type { PanelRefs } from '../menu.ts'
import { usePanelMenu } from '../menu.ts'

/** Inputs of {@link useRepoStatus}. */
export interface UseRepoStatusOptions {
  /** Session the panel is bound to. */
  readonly sessionId: string
  /** Host context-menu trigger hook; undefined when menus are unavailable. */
  readonly useContextMenu?: UseContextMenu | undefined
  /** Whether the tab is visible. */
  readonly visible: boolean
  /** Shared panel refs. */
  readonly refs: PanelRefs
}

/** Options of one status load. */
export interface LoadStatusOptions {
  /** Skip the visible loading state. */
  readonly silent?: boolean
}

/** One request queued behind the status read that is already in flight. */
interface QueuedStatusRead {
  /** Whether the follow-up read also skips the visible loading state. */
  readonly silent: boolean
}

/** Status state, its loader and the panel wiring. */
export interface RepoStatusState {
  /** RPC caller bound to the panel's Session. */
  readonly call: RpcCall
  /** Host context-menu trigger binding, or null. */
  readonly menuTrigger: MenuTriggerFactory | null
  /** Per-panel id. */
  readonly panelId: string
  /** Latest status, or null before the first answer. */
  readonly status: StatusResult | null
  /** Whether the first/visible load is running. */
  readonly loading: boolean
  /** Failed status load. */
  readonly loadFailure: Failure | null
  /** Clear the failed status load. */
  readonly setLoadFailure: Dispatch<SetStateAction<Failure | null>>
  /** Load the status once, waiting for a queued follow-up when required. */
  readonly loadStatus: (options?: LoadStatusOptions) => Promise<void>
}

/**
 * Load the repository status once, then keep it fresh. The periodic check
 * stands down while the tab is hidden or an action/confirmation owns the
 * panel; this loader itself never drops a request.
 *
 * Explicit requests that arrive while a status read is in flight are not
 * dropped: they fold into at most one follow-up read. Every caller receives a
 * Promise that settles after the read satisfying its request, so an action
 * stays busy until the post-write snapshot has actually arrived. Only one
 * status RPC is ever outstanding.
 * @param options - hook inputs.
 * @returns status state, its loader and the panel wiring.
 */
export function useRepoStatus(options: UseRepoStatusOptions): RepoStatusState {
  const { sessionId, useContextMenu, visible, refs } = options
  const { call, menuTrigger, panelId } = usePanelMenu({ sessionId, useContextMenu })
  const [status, setStatus] = useState<StatusResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState<Failure | null>(null)
  const activeRead = useRef<Promise<void> | null>(null)
  const queuedRead = useRef<QueuedStatusRead | null>(null)

  const drain = useCallback(
    async (firstSilent: boolean): Promise<void> => {
      refs.inFlight.current = true
      let silent = firstSilent
      try {
        for (;;) {
          if (!silent) setLoading(true)
          try {
            const value = await call('status')
            if (!refs.mounted.current) return
            setStatus(value)
            setLoadFailure(null)
          } catch (error) {
            if (!refs.mounted.current) return
            setLoadFailure(toFailure(error))
          }
          const queued = queuedRead.current
          if (queued === null) return
          queuedRead.current = null
          silent = queued.silent
        }
      } finally {
        // No await separates the last read from releasing the flag, so a poll
        // or watch signal can never start a competing read in between.
        refs.inFlight.current = false
        queuedRead.current = null
        activeRead.current = null
        if (refs.mounted.current) setLoading(false)
      }
    },
    [call, refs],
  )

  const loadStatus = useCallback(
    (loadOptions: LoadStatusOptions = {}): Promise<void> => {
      const silent = loadOptions.silent === true
      const active = activeRead.current
      if (active !== null) {
        // Requests during one read coalesce: the follow-up is visible when any
        // of the folded requests wanted the visible loading state.
        const queued = queuedRead.current
        queuedRead.current = { silent: (queued?.silent ?? true) && silent }
        return active
      }
      const read = drain(silent)
      activeRead.current = read
      return read
    },
    [drain],
  )

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (!visible) return undefined
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      // The Host watches the repository: its change signal is the primary
      // path, and this periodic check is only the fallback.
      if (refs.watching.current) return
      if (refs.inFlight.current || refs.busy.current !== null || refs.confirm.current !== null)
        return
      void loadStatus({ silent: true })
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [visible, loadStatus, refs])

  return { call, menuTrigger, panelId, status, loading, loadFailure, setLoadFailure, loadStatus }
}
