/**
 * The plugin's notice value and its single-notice store.
 *
 * A notice is one line of already-localized text plus a success flag. The
 * plugin's native Toast host renders the current notice; a later notice
 * replaces it, matching the host's own Toast replacement behavior.
 */

/** One retry action a notice offers. */
export interface ToastAction {
  /** Localized action label. */
  readonly label: string
  /** Run the retried read; the host dismissed the notice first. */
  readonly run: () => void
}

/** Deliver one localized notice. */
export type Notify = (text: string, success?: boolean, action?: ToastAction) => void

/** The notice currently showing. */
export interface ToastNotice {
  /** Monotonic identity that restarts the host's notice transition. */
  readonly seq: number
  /** Localized message. */
  readonly text: string
  /** Whether the operation succeeded. */
  readonly success: boolean
  /** Optional retry action. */
  readonly action?: ToastAction
}

/** Store the native Toast host subscribes to. */
export interface ToastStore {
  /** Current notice, or null when none is showing. */
  getSnapshot(): ToastNotice | null
  /**
   * Subscribe to notice changes.
   * @param listener - called after every change.
   * @returns unsubscribe.
   */
  subscribe(listener: () => void): () => void
  /**
   * Show a notice, replacing the current one.
   * @param input - localized text, success flag and optional retry action.
   */
  push(input: {
    readonly text: string
    readonly success: boolean
    readonly action?: ToastAction
  }): void
  /** Remove the current notice without running its action. */
  dismiss(): void
}

/**
 * Create one single-notice store.
 * @returns the store the host renders and the plugin delivers through.
 */
export function createToastStore(): ToastStore {
  let notice: ToastNotice | null = null
  let seq = 0
  const listeners = new Set<() => void>()
  const publish = (): void => {
    for (const listener of [...listeners]) listener()
  }
  return {
    getSnapshot: () => notice,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    push(input) {
      seq += 1
      notice = {
        seq,
        text: input.text,
        success: input.success,
        ...(input.action === undefined ? {} : { action: input.action }),
      }
      publish()
    },
    dismiss() {
      if (notice === null) return
      notice = null
      publish()
    },
  }
}
