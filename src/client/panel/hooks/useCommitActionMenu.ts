/**
 * Commit action menu: the split commit button's dropdown state and its
 * dismissal (outside pointerdown, Escape) for as long as it is open. It owns no
 * Git call.
 */

import type { MutableRefObject } from 'react'
import { useEffect, useRef, useState } from 'react'

/** State and handlers of the commit action menu. */
export interface CommitActionMenuState {
  /** Whether the dropdown is open. */
  readonly open: boolean
  /** Element the dropdown renders inside; a pointerdown outside it closes. */
  readonly wrap: MutableRefObject<HTMLDivElement | null>
  /** Open or close the dropdown; a no-op while the commit action is unavailable. */
  readonly toggle: () => void
  /** Close the dropdown. */
  readonly close: () => void
}

/**
 * Manage the commit action menu's dismissal.
 * @param options - whether the commit action is available, so the menu may open.
 * @returns menu open state and handlers.
 */
export function useCommitActionMenu(options: { readonly enabled: boolean }): CommitActionMenuState {
  const { enabled } = options
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)

  // While open, a press outside the wrapper or Escape dismisses the menu. The
  // listeners stay passive so an Escape that closes the menu can still reach
  // the other panel surfaces.
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent): void => {
      const element = wrap.current
      if (
        element !== null &&
        typeof Node !== 'undefined' &&
        event.target instanceof Node &&
        element.contains(event.target)
      )
        return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, wrap])

  // An unavailable commit action owns the panel, so the menu does not stay open
  // over a running operation or an emptied message.
  useEffect(() => {
    if (!enabled) setOpen(false)
  }, [enabled])

  const toggle = (): void => {
    if (!enabled) return
    setOpen((value) => !value)
  }

  const close = (): void => {
    setOpen(false)
  }

  return { open, wrap, toggle, close }
}
