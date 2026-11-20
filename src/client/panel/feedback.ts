/**
 * Empty-state building block.
 *
 * Notifications moved to the plugin's native Toast host; the only surface left
 * here is the centered state that explains what the pane is waiting for.
 */

import type React from 'react'
import { createElement } from 'react'

const h = createElement

/** Props of the centered empty state. */
export interface EmptyStateProps {
  /** Large icon shown above the title. */
  readonly icon?: React.ReactNode
  /** Headline. */
  readonly title: React.ReactNode
  /** Optional description. */
  readonly desc?: React.ReactNode
  /** Optional action control. */
  readonly action?: React.ReactNode
}

/**
 * Render a centered empty state.
 * @param props - empty-state props.
 * @returns the state element.
 */
export function EmptyState(props: EmptyStateProps): React.ReactElement {
  return h(
    'div',
    { className: 'dshgg-state' },
    h('span', { className: 'dshgg-stateIcon' }, props.icon),
    h('p', { className: 'dshgg-stateTitle' }, props.title),
    props.desc === undefined ? null : h('p', { className: 'dshgg-stateDesc' }, props.desc),
    props.action === undefined ? null : h('div', { className: 'dshgg-stateAction' }, props.action),
  )
}
