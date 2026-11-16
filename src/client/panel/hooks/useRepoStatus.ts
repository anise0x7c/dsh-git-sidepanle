/**
 * Repository status state: the panel's command caller and menu wiring, the
 * initial load, the silent refresh actions use, and the 5 s visibility-aware
 * poll. This is the only status loader in the panel.
 */

import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useState } from 'react'
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
  /** Host context-menu trigger hook. */
  readonly useContextMenu?: UseContextMenu
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
  /** Load the status once. */
  readonly loadStatus: (options?: LoadStatusOptions) => Promise<void>
}

/**
 * Load the repository status once, then keep it fresh. A load is skipped while
 * one is in flight, while the tab is hidden, and while an action or the
 * confirmation dialog owns the panel.
 * @param options - hook inputs.
 * @returns status state, its loader and the panel wiring.
 */
export function useRepoStatus(options: UseRepoStatusOptions): RepoStatusState {
  const { sessionId, useContextMenu, visible, refs } = options
  const { call, menuTrigger, panelId } = usePanelMenu({ sessionId, useContextMenu })
  const [status, setStatus] = useState<StatusResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState<Failure | null>(null)

  const loadStatus = useCallback(
    async (loadOptions: LoadStatusOptions = {}): Promise<void> => {
      if (refs.inFlight.current) return
      refs.inFlight.current = true
      if (loadOptions.silent !== true) setLoading(true)
      try {
        const value = await call('status')
        if (!refs.mounted.current) return
        setStatus(value)
        setLoadFailure(null)
      } catch (error) {
        if (!refs.mounted.current) return
        setLoadFailure(toFailure(error))
      } finally {
        refs.inFlight.current = false
        if (refs.mounted.current) setLoading(false)
      }
    },
    [call, refs],
  )

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (!visible) return undefined
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (refs.inFlight.current || refs.busy.current !== null || refs.confirm.current !== null)
        return
      void loadStatus({ silent: true })
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [visible, loadStatus, refs])

  return { call, menuTrigger, panelId, status, loading, loadFailure, setLoadFailure, loadStatus }
}
