/**
 * Branch picker dropdown rendered under the toolbar chip.
 */

import type React from 'react'
import { createElement } from 'react'
import { errorText } from '../git/format.ts'
import { CheckIcon } from '../icons.ts'
import type { BranchInfo, Failure } from '../types/domain.ts'
import type { LocaleBinder } from '../types/dsh.ts'

const h = createElement

/** Props of the branch picker dropdown. */
export interface BranchMenuProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Branch list, or null before it has loaded. */
  readonly branches: readonly BranchInfo[] | null
  /** Whether the list is loading. */
  readonly loading: boolean
  /** Failed branch-list read. */
  readonly failure: Failure | null
  /** Check out one branch. */
  readonly onPick: (name: string) => void
  /** Retry the branch-list read. */
  readonly onRetry: () => void
}

/**
 * Render the branch picker dropdown.
 * @param props - branch-menu props.
 * @returns the menu element.
 */
export function BranchMenu(props: BranchMenuProps): React.ReactElement {
  const t = props.t
  let content: React.ReactNode
  if (props.loading === true && props.branches === null) {
    content = h('div', { className: 'dshgg-menuNote' }, t('branch.loading'))
  } else if (props.failure !== null) {
    content = h(
      'div',
      { className: 'dshgg-menuNote' },
      errorText(t, props.failure),
      ' ',
      h(
        'button',
        { type: 'button', className: 'dshgg-linkBtn', onClick: props.onRetry },
        t('retry'),
      ),
    )
  } else if (props.branches === null || props.branches.length === 0) {
    content = h('div', { className: 'dshgg-menuNote' }, t('branch.empty'))
  } else {
    content = props.branches.map((branch) =>
      h(
        'button',
        {
          key: branch.name,
          type: 'button',
          className: 'dshgg-menuItem',
          role: 'menuitemradio',
          'aria-checked': branch.current === true,
          disabled: branch.current === true,
          onClick: () => props.onPick(branch.name),
        },
        h(
          'span',
          { className: 'dshgg-menuCheck' },
          branch.current === true ? h(CheckIcon, { size: 12 }) : null,
        ),
        h('span', { className: 'dshgg-menuLabel' }, branch.name),
      ),
    )
  }
  return h(
    'div',
    { className: 'dshgg-menu', role: 'menu', 'aria-label': t('branch.menu') },
    content,
  )
}
