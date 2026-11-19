/**
 * Remote overflow menu rendered under the toolbar ellipsis.
 *
 * Labels follow the branch's upstream: Publish Branch replaces Push until the
 * branch tracks a remote, and the actions that need an upstream stay disabled.
 * Remote configuration lives behind a disclosure below the separator so the
 * menu keeps its compact size.
 */

import type React from 'react'
import { createElement, useState } from 'react'
import { errorText } from '../../git/format.ts'
import { ChevronDownIcon } from '../../icons.ts'
import type { Failure, RemoteInfo } from '../../types/domain.ts'
import type { LocaleBinder } from '../../types/dsh.ts'

const h = createElement

/** Props of the remote overflow menu. */
export interface RemoteMenuProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Configured remotes, or null before the first successful read. */
  readonly remotes: readonly RemoteInfo[] | null
  /** Whether the remote list is loading. */
  readonly loading: boolean
  /** Failed remote-list read. */
  readonly failure: Failure | null
  /** Whether another Git operation currently owns the panel. */
  readonly busy: boolean
  /** Whether the current branch can start a remote operation. */
  readonly usable: boolean
  /** Whether the current branch tracks an upstream. */
  readonly hasUpstream: boolean
  /** Fetch from every configured remote. */
  readonly onFetch: () => void
  /** Merge the upstream into the current branch. */
  readonly onPull: () => void
  /** Rebase the current branch onto its upstream. */
  readonly onPullRebase: () => void
  /** Push the current branch to its upstream. */
  readonly onPush: () => void
  /** Start the publish flow. */
  readonly onPublish: () => void
  /** Pull by merging and then push. */
  readonly onSync: () => void
  /** Open the Add Remote form. */
  readonly onAddRemote: () => void
  /** Read the remotes and open the Remove Remote form. */
  readonly onRemoveRemote: () => void
  /** Retry the remote-list read. */
  readonly onRetry: () => void
}

/**
 * Render the remote overflow menu.
 * @param props - remote-menu props.
 * @returns the menu element.
 */
export function RemoteMenu(props: RemoteMenuProps): React.ReactElement {
  const t = props.t
  const [configOpen, setConfigOpen] = useState(false)
  const branchBlocked = props.busy || !props.usable
  const canRemove = props.failure === null && props.remotes !== null && props.remotes.length > 0
  const notes: React.ReactNode[] = []
  if (props.loading && props.remotes === null) {
    notes.push(h('div', { key: 'loading', className: 'dshgg-menuNote' }, t('remote.loading')))
  }
  if (props.failure !== null) {
    notes.push(
      h(
        'div',
        { key: 'failure', className: 'dshgg-menuNote' },
        errorText(t, props.failure),
        ' ',
        h(
          'button',
          { type: 'button', className: 'dshgg-linkBtn', onClick: props.onRetry },
          t('retry'),
        ),
      ),
    )
  }
  const item = (
    key: string,
    label: string,
    onSelect: () => void,
    disabled: boolean,
  ): React.ReactElement =>
    h(
      'button',
      {
        key,
        type: 'button',
        role: 'menuitem',
        className: 'dshgg-menuItem',
        disabled,
        onClick: onSelect,
      },
      h('span', { className: 'dshgg-menuLabel' }, label),
    )
  const items: React.ReactNode[] = [
    item('fetch', t('remote.fetch'), props.onFetch, props.busy),
    item('pull', t('remote.pull'), props.onPull, branchBlocked || !props.hasUpstream),
    item(
      'pull-rebase',
      t('remote.pullRebase'),
      props.onPullRebase,
      branchBlocked || !props.hasUpstream,
    ),
  ]
  items.push(
    props.hasUpstream
      ? item('push', t('remote.push'), props.onPush, branchBlocked)
      : item('publish', t('remote.publishBranch'), props.onPublish, branchBlocked),
  )
  items.push(item('sync', t('remote.sync'), props.onSync, branchBlocked || !props.hasUpstream))
  items.push(
    h('div', { key: 'separator', className: 'dshgg-menuSeparator', role: 'separator' }),
    h(
      'button',
      {
        key: 'remote-group',
        type: 'button',
        role: 'menuitem',
        className: 'dshgg-menuItem dshgg-menuDisclosure',
        'aria-expanded': configOpen,
        onClick: () => setConfigOpen((open) => !open),
      },
      h('span', { className: 'dshgg-menuLabel' }, t('remote.group')),
      h(ChevronDownIcon, { size: 12, className: 'dshgg-menuCaret' }),
    ),
  )
  if (configOpen) {
    items.push(
      h(
        'div',
        {
          key: 'remote-group-items',
          className: 'dshgg-menuGroup',
          role: 'group',
          'aria-label': t('remote.group'),
        },
        item('add', t('remote.add'), props.onAddRemote, props.busy),
        item('remove', t('remote.remove'), props.onRemoveRemote, props.busy || !canRemove),
      ),
    )
  }
  return h(
    'div',
    { className: 'dshgg-menu dshgg-menuEnd', role: 'menu', 'aria-label': t('remote.menu') },
    notes,
    items,
  )
}
