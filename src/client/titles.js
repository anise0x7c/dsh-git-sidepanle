/**
 * Tab title components for the source-control and diff tabs.
 */

import { createElement } from 'react'
import { baseName } from './git/format.js'
import { FileIcon, GitBranchIcon } from './icons.js'

const h = createElement

export function GitTabTitle(props) {
  const tabInfo = props.useTabInfo()
  const title = typeof props.t === 'function' ? props.t('title') : tabInfo.tab.title
  return h('span', { className: 'dshgg-title' }, h(GitBranchIcon, { size: 14 }), h('span', { className: 'dshgg-titleText' }, title))
}

export function DiffTabTitle(props) {
  const tabInfo = props.useTabInfo()
  const params = tabInfo.tab.navigation?.params ?? {}
  const name = typeof params.path === 'string' && params.path !== '' ? baseName(params.path) : tabInfo.tab.title
  return h('span', { className: 'dshgg-title' }, h(FileIcon, { size: 14 }), h('span', { className: 'dshgg-titleText' }, name))
}
