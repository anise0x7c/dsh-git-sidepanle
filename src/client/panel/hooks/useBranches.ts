/**
 * Branch picker state: the branch list, its loading/failure flags, the open
 * state of the dropdown and its outside-click/Escape dismissal, and checkout.
 */

import { useCallback, useEffect, useState } from 'react'
import { toFailure } from '../../data/caller.ts'
import type { BranchInfo, Failure, RpcCall } from '../../types/domain.ts'
import type { PanelRefs } from '../menu.ts'
import type { Perform } from './useChangeActions.ts'

/** Inputs of {@link useBranches}. */
export interface UseBranchesOptions {
  /** Panel RPC caller. */
  readonly call: RpcCall
  /** Shared panel refs. */
  readonly refs: PanelRefs
  /** Busy-locked action wrapper. */
  readonly perform: Perform
}

/** Branch-picker state and handlers. */
export interface BranchesState {
  /** Whether the dropdown is open. */
  readonly branchMenu: boolean
  /** Branch list, or null before it has loaded. */
  readonly branches: BranchInfo[] | null
  /** Whether the list is loading. */
  readonly branchLoading: boolean
  /** Failed branch-list read. */
  readonly branchFailure: Failure | null
  /** Load the branch list. */
  readonly loadBranches: () => Promise<void>
  /** Open or close the dropdown. */
  readonly toggleBranchMenu: () => void
  /** Check out one branch. */
  readonly checkout: (branch: string) => void
}

/**
 * Own the branch dropdown. The list loads lazily on first open, and a checkout
 * runs through the shared action wrapper so it gets the busy lock and refresh.
 * @param options - hook inputs.
 * @returns branch state and handlers.
 */
export function useBranches(options: UseBranchesOptions): BranchesState {
  const { call, refs, perform } = options
  const [branchMenu, setBranchMenu] = useState(false)
  const [branches, setBranches] = useState<BranchInfo[] | null>(null)
  const [branchLoading, setBranchLoading] = useState(false)
  const [branchFailure, setBranchFailure] = useState<Failure | null>(null)

  const loadBranches = useCallback(async (): Promise<void> => {
    if (refs.mounted.current) setBranchLoading(true)
    try {
      const value = await call('branches')
      if (!refs.mounted.current) return
      setBranches(Array.isArray(value.branches) ? value.branches : [])
      setBranchFailure(null)
    } catch (error) {
      if (!refs.mounted.current) return
      setBranchFailure(toFailure(error))
    } finally {
      if (refs.mounted.current) setBranchLoading(false)
    }
  }, [call, refs])

  useEffect(() => {
    if (!branchMenu) return undefined
    const onPointerDown = (event: PointerEvent): void => {
      const wrap = refs.wrap.current
      if (wrap !== null && event.target instanceof Node && wrap.contains(event.target)) return
      setBranchMenu(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setBranchMenu(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [branchMenu, refs])

  const toggleBranchMenu = (): void => {
    const next = !branchMenu
    setBranchMenu(next)
    if (next && branches === null && branchFailure === null) void loadBranches()
  }

  const checkout = (branch: string): void => {
    setBranchMenu(false)
    void perform('checkout', () => call('checkout', { branch }), {
      graph: true,
      after: () => {
        setBranches(null)
        setBranchFailure(null)
      },
    })
  }

  return {
    branchMenu,
    branches,
    branchLoading,
    branchFailure,
    loadBranches,
    toggleBranchMenu,
    checkout,
  }
}
