/**
 * Report failures as native Toast notices, once per failure.
 *
 * The owning panel passes the failure values it already renders. A repeated
 * poll or refresh that fails with the same code and message does not re-notify;
 * clearing the failure, or bumping the entry's explicit-retry generation,
 * re-arms that key so the same failure is shown again when the user asks for a
 * retry. The effect intentionally runs after every render so a failure state
 * change is observed without the caller rebuilding its entries.
 */

import { useEffect, useRef } from 'react'
import type { Notify, ToastAction } from '../../toast/notify.ts'
import type { Failure } from '../../types/domain.ts'

/** One failure the panel reports. */
export interface FailureToastEntry {
  /** Stable scope of the failure, such as `status` or `diff`. */
  readonly key: string
  /** Failure currently showing, or null once it cleared. */
  readonly failure: Failure | null
  /** Localized message the notice displays. */
  readonly text: string
  /** Optional retry action. */
  readonly action?: ToastAction
  /**
   * Explicit-retry generation. An explicit retry bumps this so the same
   * failure reports again even when no render cleared the previous one first.
   */
  readonly generation?: number
}

/** Identity used to suppress a repeated notification for the same failure. */
function failureIdentity(entry: FailureToastEntry): string {
  const failure = entry.failure
  if (failure === null) return ''
  return `${failure.code}\u0000${failure.message}\u0000${entry.generation ?? 0}`
}

/**
 * Deliver a non-success notice whenever one of the watched failures changes.
 * @param entries - failures to watch, computed from the panel's state.
 * @param notify - native Toast delivery.
 */
export function useFailureToasts(entries: readonly FailureToastEntry[], notify: Notify): void {
  const shown = useRef(new Map<string, string>())
  useEffect(() => {
    for (const entry of entries) {
      if (entry.failure === null) {
        shown.current.delete(entry.key)
        continue
      }
      const identity = failureIdentity(entry)
      if (shown.current.get(entry.key) === identity) continue
      shown.current.set(entry.key, identity)
      notify(entry.text, false, entry.action)
    }
  })
}
