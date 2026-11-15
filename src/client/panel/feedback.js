/**
 * Banner and empty-state building blocks.
 */

import { createElement } from 'react'
import { CloseIcon } from '../icons.js'
import { IconButton } from './controls.js'

const h = createElement

export function Banner(props) {
  return h('div', { className: 'dshgg-banner', 'data-kind': props.kind ?? 'error', role: props.kind === 'error' ? 'alert' : 'status' },
    h('span', { className: 'dshgg-bannerText' },
      h('span', null, props.title),
      props.detail === undefined || props.detail === '' ? null
        : h('div', { className: 'dshgg-bannerDetail' }, props.detail)),
    h('span', { className: 'dshgg-bannerActions' },
      props.onRetry === undefined ? null : h('button', { type: 'button', className: 'dshgg-linkBtn', onClick: props.onRetry }, props.retryLabel),
      props.onDismiss === undefined ? null : h(IconButton, { label: props.dismissLabel ?? 'Dismiss', onClick: props.onDismiss }, h(CloseIcon, { size: 12 }))))
}

export function EmptyState(props) {
  return h('div', { className: 'dshgg-state' },
    h('span', { className: 'dshgg-stateIcon' }, props.icon),
    h('p', { className: 'dshgg-stateTitle' }, props.title),
    props.desc === undefined ? null : h('p', { className: 'dshgg-stateDesc' }, props.desc),
    props.action === undefined ? null : h('div', { className: 'dshgg-stateAction' }, props.action))
}
