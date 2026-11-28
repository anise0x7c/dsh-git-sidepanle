/**
 * Live repository updates: keep the panel in step with changes made outside
 * DSH without re-reading Git on a timer.
 *
 * The Host watches the repository and exposes two monotonic counters. This
 * hook subscribes the panel when it mounts (and again when its repository
 * changes), asks for the counters on a short interval while the tab is visible,
 * and turns a counter move into the smallest refresh that keeps the panel
 * accurate: a working-tree/index move refreshes the status only, while a
 * `HEAD`/reference move also re-reads the graph references. When the Host
 * cannot watch, the hook reports `watching: false` and the periodic status
 * check in `useRepoStatus` stays in charge as the fallback.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { LIVE_POLL_INTERVAL_MS, POLL_INTERVAL_MS } from '../../constants.ts'
import type { RpcCall, WatchState } from '../../types/domain.ts'
import type { PanelRefs } from '../menu.ts'

/** Inputs of {@link useLiveUpdates}. */
export interface UseLiveUpdatesOptions {
  /** Panel RPC caller. */
  readonly call: RpcCall
  /** Per-panel identity the Host keys the subscription by. */
  readonly panelId: string
  /** Whether the tab is visible. */
  readonly visible: boolean
  /** Repository root of the last status, used to resubscribe on a move. */
  readonly repoRoot: string | null
  /** Shared panel refs. */
  readonly refs: PanelRefs
  /** Refresh after the working tree or index changed. */
  readonly onWorktreeChange: () => void | Promise<void>
  /** Refresh after `HEAD` or a reference changed. */
  readonly onReferencesChange: () => void | Promise<void>
}

/** Live-update state. */
export interface LiveUpdatesState {
  /** Whether the Host is watching the panel's repository. */
  readonly watching: boolean
}

/** Counters the hook compares against, remembered between polls. */
interface SignalBaseline {
  worktree: number
  references: number
}

/**
 * Subscribe, poll and classify repository change signals.
 * @param options - hook inputs.
 * @returns whether the Host is watching the repository.
 */
export function useLiveUpdates(options: UseLiveUpdatesOptions): LiveUpdatesState {
  const { call, panelId, visible, repoRoot, refs, onWorktreeChange, onReferencesChange } = options
  const [watching, setWatching] = useState(false)
  const baseline = useRef<SignalBaseline | null>(null)
  // The command bus pattern: the interval keeps one stable identity and reads
  // the handlers of the newest render through this ref.
  const handlers = useRef({ onWorktreeChange, onReferencesChange })
  useEffect(() => {
    handlers.current = { onWorktreeChange, onReferencesChange }
  })
  // The periodic status check reads this to stand down while the Host watches.
  refs.watching.current = watching

  const subscribe = useCallback(async (): Promise<void> => {
    try {
      const state = await call('watch', { panel: panelId })
      if (!refs.mounted.current) return
      baseline.current = { worktree: state.worktree, references: state.references }
      refs.watching.current = state.watching === true
      setWatching(state.watching === true)
    } catch {
      // An older Host or a failed subscription: keep the periodic fallback.
      if (refs.mounted.current) {
        baseline.current = null
        refs.watching.current = false
        setWatching(false)
      }
    }
  }, [call, panelId, refs])

  // biome-ignore lint/correctness/useExhaustiveDependencies: repoRoot resubscribes when the repository changes.
  useEffect(() => {
    void subscribe()
    return () => {
      // A dependency change resubscribes; only unmounting the panel stops the
      // status fallback too.
      if (!refs.mounted.current) refs.watching.current = false
      void call('unwatch', { panel: panelId }).catch(() => {})
    }
  }, [subscribe, call, panelId, repoRoot, refs])

  useEffect(() => {
    if (!visible) return undefined
    let active = true

    const poll = async (): Promise<void> => {
      let state: WatchState
      try {
        state = await call('watch', { panel: panelId })
      } catch {
        if (active && refs.mounted.current) {
          baseline.current = null
          refs.watching.current = false
          setWatching(false)
        }
        return
      }
      if (!active || !refs.mounted.current) return
      if (state.watching !== true) {
        baseline.current = null
        refs.watching.current = false
        setWatching(false)
        return
      }
      if (!watching) {
        // The first watch after a fallback period: catch up once, then follow
        // the counters.
        baseline.current = { worktree: state.worktree, references: state.references }
        refs.watching.current = true
        setWatching(true)
        await handlers.current.onReferencesChange()
        return
      }
      const previous = baseline.current
      if (previous === null) {
        baseline.current = { worktree: state.worktree, references: state.references }
        return
      }
      const worktreeMoved = state.worktree !== previous.worktree
      const referencesMoved = state.references !== previous.references
      if (!worktreeMoved && !referencesMoved) return
      if (refs.inFlight.current || refs.busy.current !== null || refs.confirm.current !== null) {
        // Leave the baseline alone so the next poll retries once the panel is
        // idle; a refresh would otherwise be skipped and the change lost.
        return
      }
      baseline.current = { worktree: state.worktree, references: state.references }
      if (referencesMoved) await handlers.current.onReferencesChange()
      else await handlers.current.onWorktreeChange()
    }

    const timer = setInterval(
      () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
        void poll()
      },
      watching ? LIVE_POLL_INTERVAL_MS : POLL_INTERVAL_MS,
    )
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [visible, watching, call, panelId, refs])

  return { watching }
}
