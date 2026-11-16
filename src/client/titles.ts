/**
 * Tab title components for the source-control and diff tabs.
 */

import type React from 'react'
import { createElement } from 'react'
import { baseName } from './git/format.ts'
import { FileIcon, GitBranchIcon } from './icons.ts'
import type { LocaleBinder, TabInfoHook } from './types/dsh.ts'

const h = createElement

/** Props shared by both tab-title components. */
export interface GitTabTitleProps {
  /** Locale binder supplied by the slot. */
  readonly t?: LocaleBinder
  /** Slot-owned tab information hook. */
  readonly useTabInfo: TabInfoHook
}

/** Props of the diff tab title; the diff title has no localized override. */
export interface DiffTabTitleProps {
  /** Locale binder supplied by the slot. */
  readonly t?: LocaleBinder
  /** Slot-owned tab information hook. */
  readonly useTabInfo: TabInfoHook
}

/**
 * Render the source-control tab title.
 * @param props - slot props.
 * @returns the title element.
 */
export function GitTabTitle(props: GitTabTitleProps): React.ReactElement {
  const tabInfo = props.useTabInfo()
  const title = typeof props.t === 'function' ? props.t('title') : tabInfo.tab.title
  return h(
    'span',
    { className: 'dshgg-title' },
    h(GitBranchIcon, { size: 14 }),
    h('span', { className: 'dshgg-titleText' }, title),
  )
}

/**
 * Render the diff tab title.
 * @param props - slot props.
 * @returns the title element.
 */
export function DiffTabTitle(props: DiffTabTitleProps): React.ReactElement {
  const tabInfo = props.useTabInfo()
  const params = tabInfo.tab.navigation?.params ?? {}
  const name =
    typeof params.path === 'string' && params.path !== ''
      ? baseName(params.path)
      : tabInfo.tab.title
  // A commit diff names the commit after the file so two revisions of the same
  // file stay distinguishable in the tab strip.
  const shortOid =
    typeof params.shortOid === 'string' && params.shortOid !== ''
      ? params.shortOid
      : typeof params.commit === 'string' && params.commit !== ''
        ? params.commit.slice(0, 7)
        : ''
  const label = shortOid === '' ? name : `${name} \u00b7 ${shortOid}`
  return h(
    'span',
    { className: 'dshgg-title' },
    h(FileIcon, { size: 14 }),
    h('span', { className: 'dshgg-titleText' }, label),
  )
}
