/**
 * Commit graph section header remote controls: Fetch, Pull and Push as icon
 * buttons, after VS Code's Source Control Graph, plus the overflow menu that
 * keeps Pull (Rebase), Sync, Publish Branch and the remote configuration.
 */

import type React from 'react'
import { createElement, Fragment } from 'react'
import { MoreIcon, RepoFetchIcon, RepoPullIcon, RepoPushIcon } from '../../icons.ts'
import type { LocaleBinder } from '../../types/dsh.ts'
import { IconButton } from '../controls.ts'

const h = createElement

/** Props of the commit graph header's remote controls. */
export interface GraphRemoteActionsProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Whether the panel has a repository. */
  readonly hasRepo: boolean
  /** Whether another Git operation currently owns the panel. */
  readonly busy: boolean
  /** Whether the current branch can start a remote operation. */
  readonly canUseBranch: boolean
  /** Whether the current branch tracks an upstream. */
  readonly hasUpstream: boolean
  /** Fetch from every configured remote. */
  readonly onFetch: () => void
  /** Merge the upstream into the current branch. */
  readonly onPull: () => void
  /** Push the current branch to its upstream. */
  readonly onPush: () => void
  /** Whether the overflow menu is open. */
  readonly menuOpen: boolean
  /** Overflow menu node, rendered under the ellipsis; null when closed. */
  readonly menuNode: React.ReactNode
  /** Ref for the overflow wrapper (outside-click dismissal). */
  readonly wrapRef: React.RefObject<HTMLDivElement>
  /** Open or close the overflow menu. */
  readonly onToggleMenu: () => void
}

/**
 * Render the commit graph header's remote controls.
 * @param props - remote action props.
 * @returns the header actions element.
 */
export function GraphRemoteActions(props: GraphRemoteActionsProps): React.ReactElement {
  const t = props.t
  return h(
    Fragment,
    null,
    h(
      IconButton,
      {
        label: t('remote.fetch'),
        disabled: !props.hasRepo || props.busy,
        onClick: props.onFetch,
      },
      h(RepoFetchIcon, { size: 14 }),
    ),
    h(
      IconButton,
      {
        label: t('remote.pull'),
        disabled: props.busy || !props.canUseBranch || !props.hasUpstream,
        onClick: props.onPull,
      },
      h(RepoPullIcon, { size: 14 }),
    ),
    h(
      IconButton,
      {
        label: t('remote.push'),
        disabled: props.busy || !props.canUseBranch || !props.hasUpstream,
        onClick: props.onPush,
      },
      h(RepoPushIcon, { size: 14 }),
    ),
    h(
      'div',
      { className: 'dshgg-remoteWrap', ref: props.wrapRef },
      h(
        'button',
        {
          type: 'button',
          className: 'dshgg-iconBtn',
          'aria-label': t('remote.menu'),
          title: t('remote.menu'),
          'aria-haspopup': 'menu',
          'aria-expanded': props.menuOpen,
          disabled: !props.hasRepo,
          onClick: props.onToggleMenu,
        },
        h(MoreIcon, { size: 14 }),
      ),
      props.menuNode,
    ),
  )
}
