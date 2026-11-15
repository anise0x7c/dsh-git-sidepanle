/**
 * Branch picker dropdown rendered under the toolbar chip.
 */

import { createElement } from 'react'
import { errorText } from '../git/format.js'
import { CheckIcon } from '../icons.js'

const h = createElement

export function BranchMenu(props) {
  const t = props.t
  let content
  if (props.loading === true && props.branches === null) {
    content = h('div', { className: 'dshgg-menuNote' }, t('branch.loading'))
  } else if (props.failure !== null) {
    content = h('div', { className: 'dshgg-menuNote' },
      errorText(t, props.failure), ' ',
      h('button', { type: 'button', className: 'dshgg-linkBtn', onClick: props.onRetry }, t('retry')))
  } else if (props.branches === null || props.branches.length === 0) {
    content = h('div', { className: 'dshgg-menuNote' }, t('branch.empty'))
  } else {
    content = props.branches.map((branch) => h('button', {
      key: branch.name,
      type: 'button',
      className: 'dshgg-menuItem',
      role: 'menuitemradio',
      'aria-checked': branch.current === true,
      disabled: branch.current === true,
      onClick: () => props.onPick(branch.name),
    },
    h('span', { className: 'dshgg-menuCheck' }, branch.current === true ? h(CheckIcon, { size: 12 }) : null),
    h('span', { className: 'dshgg-menuLabel' }, branch.name)))
  }
  return h('div', { className: 'dshgg-menu', role: 'menu', 'aria-label': t('branch.menu') }, content)
}
