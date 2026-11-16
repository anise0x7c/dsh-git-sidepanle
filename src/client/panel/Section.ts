/**
 * Collapsible section header shared by the change groups and the history graph.
 */

import type React from 'react'
import { createElement } from 'react'
import { ChevronRightIcon } from '../icons.ts'
import type { MenuTarget, MenuTriggerFactory } from '../menu/trigger.ts'

const h = createElement

/** Props of the collapsible section. */
export interface SectionProps {
  /** Section identity used as the data attribute. */
  readonly id: string
  /** Section title. */
  readonly title: string
  /** Whether the body is expanded. */
  readonly open: boolean
  /** Optional count chip. */
  readonly count?: number | null
  /** Optional header actions. */
  readonly actions?: React.ReactNode
  /** Host trigger binding; null or absent disables the header menu. */
  readonly menuTrigger?: MenuTriggerFactory | null
  /** Tooltip for the header menu. */
  readonly menuHint?: string
  /** Captured target for the header menu. */
  readonly menuTarget?: MenuTarget
  /** Toggle handler. */
  readonly onToggle: () => void
  /** Section body. */
  readonly children?: React.ReactNode
}

/**
 * Render one collapsible section.
 * @param props - section props.
 * @returns the section element.
 */
export function Section(props: SectionProps): React.ReactElement {
  const actions = props.actions === undefined || props.actions === null ? null : props.actions
  const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
  const menuProps =
    menuTrigger === null || props.menuTarget === undefined
      ? null
      : menuTrigger(props.menuTarget, {
          tabIndex: -1,
          'aria-haspopup': 'menu',
          title: props.menuHint,
        })
  return h(
    'section',
    { className: 'dshgg-section', 'data-section': props.id, 'aria-label': props.title },
    h(
      'div',
      { className: 'dshgg-sectionHeader', ...(menuProps ?? {}) },
      h(
        'button',
        {
          type: 'button',
          className: 'dshgg-sectionToggle',
          'aria-expanded': props.open,
          onClick: props.onToggle,
        },
        h(
          'span',
          { className: 'dshgg-chevron', 'data-open': props.open === true ? 'true' : 'false' },
          h(ChevronRightIcon, { size: 12 }),
        ),
        h('span', { className: 'dshgg-sectionTitle' }, props.title),
        props.count === undefined || props.count === null
          ? null
          : h('span', { className: 'dshgg-sectionCount' }, String(props.count)),
      ),
      actions === null ? null : h('div', { className: 'dshgg-sectionActions' }, actions),
    ),
    props.open === true ? h('div', { className: 'dshgg-sectionBody' }, props.children) : null,
  )
}
