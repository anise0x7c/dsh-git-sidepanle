/**
 * Branch picker dropdown rendered under the toolbar chip: local branches first,
 * then remote-tracking branches under their own heading.
 */

import type React from 'react'
import { createElement } from 'react'
import { errorText } from '../git/format.ts'
import { CheckIcon, CloudIcon } from '../icons.ts'
import type { BranchInfo, Failure, RemoteBranchInfo } from '../types/domain.ts'
import type { LocaleBinder } from '../types/dsh.ts'

const h = createElement

/** Props of the branch picker dropdown. */
export interface BranchMenuProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Local branch list, or null before it has loaded. */
  readonly branches: readonly BranchInfo[] | null
  /** Remote-tracking branch list, or null before it has loaded. */
  readonly remoteBranches: readonly RemoteBranchInfo[] | null
  /** Whether the list is loading. */
  readonly loading: boolean
  /** Failed branch-list read. */
  readonly failure: Failure | null
  /** Check out one local branch. */
  readonly onPick: (name: string) => void
  /** Check out a local branch tracking one remote branch. */
  readonly onPickRemote: (remote: string, branch: string) => void
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
  const local = props.branches ?? []
  const remote = props.remoteBranches ?? []
  let content: React.ReactNode
  if (props.loading === true && props.branches === null && props.remoteBranches === null) {
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
  } else if (local.length === 0 && remote.length === 0) {
    content = h('div', { className: 'dshgg-menuNote' }, t('branch.empty'))
  } else {
    const items: React.ReactNode[] = local.map((branch) =>
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
    if (local.length === 0) {
      items.push(h('div', { key: 'local-empty', className: 'dshgg-menuNote' }, t('branch.empty')))
    }
    if (remote.length > 0) {
      items.push(
        h('div', { key: 'remote-heading', className: 'dshgg-menuNote' }, t('branch.remoteHeading')),
      )
      for (const branch of remote) {
        items.push(
          h(
            'button',
            {
              key: `remote:${branch.name}`,
              type: 'button',
              className: 'dshgg-menuItem',
              role: 'menuitem',
              title: branch.name,
              onClick: () => props.onPickRemote(branch.remote, branch.branch),
            },
            h('span', { className: 'dshgg-menuCheck' }, h(CloudIcon, { size: 12 })),
            h('span', { className: 'dshgg-menuLabel' }, branch.name),
          ),
        )
      }
    }
    content = items
  }
  return h(
    'div',
    { className: 'dshgg-menu', role: 'menu', 'aria-label': t('branch.menu') },
    content,
  )
}
