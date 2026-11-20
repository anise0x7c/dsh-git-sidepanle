/**
 * The frame-wide host that renders the plugin's current notice through DSH's
 * native `Toast`, so placement, motion, replacement and dismissal stay the
 * application's rather than a private component's.
 *
 * The Toast component is borrowed from the host's frozen module table in the
 * same guarded way `host-file-icon.ts` borrows the file-type glyph: a host
 * without the entry keeps the plugin working and only loses the notice surface.
 * Every failure carries the warning glyph and every success keeps the Toast's
 * native check, so the message type is distinguishable without reading the text.
 */

import type React from 'react'
import { createElement, useEffect, useState } from 'react'
import { AlertIcon } from '../icons.ts'
import type { ToastNotice, ToastStore } from './notify.ts'

const h = createElement

/** One text action the host Toast renders after the message. */
interface HostToastAction {
  /** Localized label. */
  readonly label: string
  /** Runs after the notice is dismissed. */
  readonly onClick: () => void
}

/** Props the host Toast accepts from this plugin. */
interface HostToastProps {
  /** Localized message. */
  readonly text: string
  /** Leading glyph; omitted for the native success check. */
  readonly icon?: React.ReactNode
  /** Success presentation with the host's own check icon. */
  readonly tone?: 'success'
  /** How long the fully opaque notice stays before it fades; defaults to 3 s. */
  readonly holdMs?: number
  /** Text actions rendered inline after the message. */
  readonly actions?: readonly HostToastAction[]
  /** Called after the hold and fade, when the owner should unmount it. */
  readonly onDone: () => void
}

/** One native Toast component. */
type HostToast = (props: HostToastProps) => React.ReactElement

/** How long a failure stays readable before it fades. */
const FAILURE_HOLD_MS = 6000

/**
 * Read the application's Toast component from the module table.
 * @returns the component, or undefined when the table has no usable entry.
 */
function resolveHostToast(): HostToast | undefined {
  try {
    const hostModule: { Toast?: unknown } | undefined =
      require('@deepseek-ai/dsh-client-ui-primitives')
    return typeof hostModule?.Toast === 'function' ? (hostModule.Toast as HostToast) : undefined
  } catch {
    // A host that does not provide the entry keeps the shared-service fallback.
    return undefined
  }
}

/** The host Toast this page provides, or undefined when it provides none. */
export const hostToast: HostToast | undefined = resolveHostToast()

/** Props of {@link ToastHost}. */
export interface ToastHostProps {
  /** Single-notice store the plugin delivers through. */
  readonly store: ToastStore
}

/**
 * Render the current notice through the host Toast.
 * @param props - the plugin's toast store.
 * @returns the host Toast element, or null while no notice is showing.
 */
export function ToastHost(props: ToastHostProps): React.ReactElement | null {
  const [notice, setNotice] = useState<ToastNotice | null>(() => props.store.getSnapshot())
  useEffect(() => props.store.subscribe(() => setNotice(props.store.getSnapshot())), [props.store])
  if (hostToast === undefined || notice === null) return null
  const dismiss = (): void => props.store.dismiss()
  const action = notice.action
  const actions =
    action === undefined
      ? undefined
      : [
          {
            label: action.label,
            onClick: () => {
              dismiss()
              action.run()
            },
          },
        ]
  return h(hostToast, {
    key: notice.seq,
    text: notice.text,
    ...(notice.success
      ? { tone: 'success' }
      : { icon: h(AlertIcon, { size: 16 }), holdMs: FAILURE_HOLD_MS }),
    ...(actions === undefined ? {} : { actions }),
    onDone: dismiss,
  })
}
