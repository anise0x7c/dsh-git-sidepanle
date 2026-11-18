/**
 * Presence for one animated surface. A surface that closes is still mounted
 * while its exit animation runs, so the caller keeps rendering the element it
 * rendered last; the surface unmounts when the animation is over.
 */

import { useEffect, useRef, useState } from 'react'

/** The animation a mounted surface plays. */
export type MotionPhase = 'enter' | 'leave'

/** Mount state and motion phase of one animated surface. */
export interface PresenceState {
  /** Whether the surface stays mounted, including during its exit. */
  readonly mounted: boolean
  /** Animation to play: an open surface always enters. */
  readonly phase: MotionPhase
}

/**
 * Keep a surface mounted until its exit animation ends.
 *
 * The effect owns the exit timer, so reopening the surface in the meantime
 * clears it and the surface never disappears under the new content.
 * @param open - whether the surface is logically open.
 * @param exitMs - exit animation duration; the surface unmounts after it.
 * @returns whether the surface is still mounted and which motion it plays.
 */
export function usePresence(open: boolean, exitMs: number): PresenceState {
  const [mounted, setMounted] = useState(open)
  const [leaving, setLeaving] = useState(false)
  // The effect decides from the state the render just committed, which the
  // effect itself may not have observed yet.
  const mountedRef = useRef(mounted)
  mountedRef.current = mounted

  useEffect(() => {
    if (open) {
      setMounted(true)
      setLeaving(false)
      return
    }
    if (!mountedRef.current) return
    setLeaving(true)
    const timer = setTimeout(() => {
      setMounted(false)
      setLeaving(false)
    }, exitMs)
    return () => clearTimeout(timer)
  }, [open, exitMs])

  const phase: MotionPhase = open || !leaving ? 'enter' : 'leave'
  return { mounted: open || mounted, phase }
}
