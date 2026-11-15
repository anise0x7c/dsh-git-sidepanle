/**
 * Collapsible section header shared by the change groups and the history graph.
 */

import { createElement } from 'react'
import { ChevronRightIcon } from '../icons.js'
import { menuTarget } from '../menu/trigger.js'

const h = createElement

export function Section(props) {
  const actions = props.actions === undefined || props.actions === null ? null : props.actions
  const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
  const menuProps = menuTrigger === null || props.menuTarget === undefined
    ? null
    : menuTrigger(props.menuTarget, { tabIndex: -1, 'aria-haspopup': 'menu', title: props.menuHint })
  return h('section', { className: 'dshgg-section', 'data-section': props.id, 'aria-label': props.title },
    h('div', { className: 'dshgg-sectionHeader', ...(menuProps ?? {}) },
      h('button', {
        type: 'button',
        className: 'dshgg-sectionToggle',
        'aria-expanded': props.open,
        onClick: props.onToggle,
      },
      h('span', { className: 'dshgg-chevron', 'data-open': props.open === true ? 'true' : 'false' },
        h(ChevronRightIcon, { size: 12 })),
      h('span', { className: 'dshgg-sectionTitle' }, props.title),
      props.count === undefined || props.count === null ? null : h('span', { className: 'dshgg-sectionCount' }, String(props.count))),
      actions === null ? null : h('div', { className: 'dshgg-sectionActions' }, actions)),
    props.open === true ? h('div', { className: 'dshgg-sectionBody' }, props.children) : null)
}
