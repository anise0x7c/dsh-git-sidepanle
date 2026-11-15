/**
 * Branch picker state: the branch list, its loading/failure flags, the open
 * state of the dropdown and its outside-click/Escape dismissal, and checkout.
 */

import { useCallback, useEffect, useState } from 'react'

/**
 * Own the branch dropdown. The list loads lazily on first open, and a checkout
 * runs through the shared action wrapper so it gets the busy lock and refresh.
 * @param {object} options - hook inputs.
 * @param {Function} options.call - panel RPC caller.
 * @param {object} options.refs - shared panel refs (see `usePanelRefs`).
 * @param {Function} options.perform - busy-locked action wrapper.
 * @returns {object} branch state and handlers.
 */
export function useBranches({ call, refs, perform }) {
  const [branchMenu, setBranchMenu] = useState(false)
  const [branches, setBranches] = useState(null)
  const [branchLoading, setBranchLoading] = useState(false)
  const [branchFailure, setBranchFailure] = useState(null)

  const loadBranches = useCallback(async () => {
    if (refs.mounted.current) setBranchLoading(true)
    try {
      const value = await call('branches')
      if (!refs.mounted.current) return
      setBranches(Array.isArray(value?.branches) ? value.branches : [])
      setBranchFailure(null)
    } catch (error) {
      if (!refs.mounted.current) return
      setBranchFailure(error)
    } finally {
      if (refs.mounted.current) setBranchLoading(false)
    }
  }, [call, refs])

  useEffect(() => {
    if (!branchMenu) return undefined
    const onPointerDown = (event) => {
      const wrap = refs.wrap.current
      if (wrap !== null && wrap.contains(event.target)) return
      setBranchMenu(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setBranchMenu(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [branchMenu, refs])

  const toggleBranchMenu = () => {
    const next = !branchMenu
    setBranchMenu(next)
    if (next && branches === null && branchFailure === null) void loadBranches()
  }

  const checkout = (branch) => {
    setBranchMenu(false)
    void perform('checkout', () => call('checkout', { branch }), {
      graph: true,
      after: () => {
        setBranches(null)
        setBranchFailure(null)
      },
    })
  }

  return { branchMenu, branches, branchLoading, branchFailure, loadBranches, toggleBranchMenu, checkout }
}
