/**
 * Keep one visibility flag on for at least a minimum time once it turns on, so
 * a quick load or operation does not flash an indicator for a single frame.
 */

import { useEffect, useRef, useState } from 'react'

/**
 * Hold a visibility flag for a minimum visible time.
 *
 * The flag rises with `active` and stays on until both `active` has fallen and
 * `minimumMs` has elapsed since it rose. Rising again during the hold cancels
 * the pending hide without restarting the timer, so a burst of quick work reads
 * as one continuous period.
 * @param active - whether the indicator should currently be shown.
 * @param minimumMs - shortest time the indicator stays on once shown.
 * @returns whether the indicator is visible.
 */
export function useMinimumVisible(active: boolean, minimumMs: number): boolean {
  const [visible, setVisible] = useState(active)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const minimumElapsed = useRef(false)
  const hidePending = useRef(false)

  useEffect(() => {
    if (active) {
      hidePending.current = false
      setVisible(true)
      if (timer.current !== null || minimumElapsed.current) return
      timer.current = setTimeout(() => {
        timer.current = null
        minimumElapsed.current = true
        if (!hidePending.current) return
        hidePending.current = false
        minimumElapsed.current = false
        setVisible(false)
      }, minimumMs)
      return
    }
    if (timer.current !== null) {
      hidePending.current = true
      return
    }
    if (!minimumElapsed.current) return
    minimumElapsed.current = false
    setVisible(false)
  }, [active, minimumMs])

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  return visible
}
