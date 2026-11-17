/** Shared nonmodal, panel-scoped surface for operation prompts. */

import type React from 'react'
import { createElement, useId, useRef } from 'react'

const h = createElement

/** Props of the shared floating operation panel. */
export interface FloatingPanelProps {
  /** Localized dialog name. */
  readonly title: string
  /** Optional explanatory copy; empty descriptions have no ARIA reference. */
  readonly description?: string
  /** Localized cancel and submit labels. */
  readonly cancelLabel: string
  readonly submitLabel: string
  /** Keep controls focusable but reject interaction during a write. */
  readonly busy: boolean
  /** Whether the current form can be submitted. */
  readonly canSubmit?: boolean
  /** Creation forms focus their own name input instead. */
  readonly focusCancel?: boolean
  /** Optional form fields, progress and operation failure. */
  readonly children?: React.ReactNode
  readonly progress?: string
  readonly feedback?: React.ReactNode
  /** Idle-only callbacks; the owning hook retains the operation's busy lock. */
  readonly onCancel: () => void
  readonly onSubmit: () => void
}

/** Return whether a key belongs to an in-progress IME composition. */
export function isCompositionKey(event: React.KeyboardEvent<HTMLElement>): boolean {
  return event.nativeEvent?.isComposing === true || event.keyCode === 229
}

/** Render a bottom-anchored prompt without a modal backdrop or focus trap. */
export function FloatingPanel(props: FloatingPanelProps): React.ReactElement {
  const titleId = useId()
  const descriptionId = useId()
  const composing = useRef(false)
  const hasDescription = props.description !== undefined && props.description.trim() !== ''
  const canSubmit = props.canSubmit !== false
  return h(
    'div',
    { className: 'dshgg-floating-panel-layer' },
    h(
      'div',
      {
        className: 'dshgg-floating-panel',
        role: 'alertdialog',
        'aria-label': props.title,
        'aria-labelledby': titleId,
        'aria-describedby': hasDescription ? descriptionId : undefined,
        'aria-busy': props.busy,
        onCompositionStart: () => {
          composing.current = true
        },
        onCompositionEnd: () => {
          composing.current = false
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          // Preserve the IME's candidate dismissal without closing the dock.
          if (composing.current || isCompositionKey(event)) return
          event.preventDefault()
          if (!props.busy) props.onCancel()
        },
      },
      h(
        'div',
        { className: 'dshgg-floating-panel-body' },
        h('div', { id: titleId, className: 'dshgg-confirmTitle' }, props.title),
        hasDescription
          ? h('div', { id: descriptionId, className: 'dshgg-confirmDesc' }, props.description)
          : null,
        props.children,
        props.busy && props.progress
          ? h('div', { className: 'dshgg-dialogHint', role: 'status' }, props.progress)
          : null,
        props.feedback,
      ),
      h(
        'div',
        { className: 'dshgg-floating-panel-footer' },
        h(
          'button',
          {
            type: 'button',
            className: 'dshgg-btn dshgg-btnGhost',
            autoFocus: props.focusCancel !== false,
            'aria-disabled': props.busy ? 'true' : undefined,
            onClick: () => {
              if (!props.busy) props.onCancel()
            },
          },
          props.cancelLabel,
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dshgg-btn dshgg-btnPrimary',
            disabled: !props.busy && !canSubmit,
            'aria-disabled': props.busy || !canSubmit ? 'true' : undefined,
            onClick: () => {
              if (!props.busy && canSubmit) props.onSubmit()
            },
          },
          props.submitLabel,
        ),
      ),
    ),
  )
}
