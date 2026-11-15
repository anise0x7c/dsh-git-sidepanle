/**
 * Icon button used by the panel toolbar and section headers.
 */

import { createElement } from 'react'

const h = createElement

export function IconButton(props) {
  return h('button', {
    type: 'button',
    className: 'dshgg-iconBtn',
    'aria-label': props.label,
    title: props.title ?? props.label,
    disabled: props.disabled === true,
    onClick: props.onClick,
    'data-spinning': props.spinning === true ? 'true' : undefined,
  }, props.children)
}
