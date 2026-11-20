/**
 * Commit action menu rendered under the split button's chevron: a plain commit,
 * an amend, and the combined commit-then-push/sync variants.
 */

import type React from 'react'
import { createElement } from 'react'
import type { LocaleBinder } from '../../types/dsh.ts'
import type { CommitMode } from '../commit-mode.ts'

const h = createElement

/** Props of the commit action menu. */
export interface CommitMenuProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Whether a commit cannot run right now. */
  readonly blocked: boolean
  /** Whether the current branch tracks an upstream. */
  readonly canPush: boolean
  /** Run the chosen commit variant. */
  readonly onChoose: (mode: CommitMode) => void
}

/**
 * Render the commit action menu.
 * @param props - commit-menu props.
 * @returns the menu element.
 */
export function CommitMenu(props: CommitMenuProps): React.ReactElement {
  const t = props.t
  const item = (
    action: CommitMode,
    label: string,
    disabled: boolean,
    title?: string,
  ): React.ReactElement =>
    h(
      'button',
      {
        type: 'button',
        className: 'dshgg-menuItem',
        role: 'menuitem',
        'data-action': action,
        disabled,
        ...(title === undefined ? {} : { title }),
        onClick: () => props.onChoose(action),
      },
      h('span', { className: 'dshgg-menuLabel' }, label),
    )
  return h(
    'div',
    {
      className: 'dshgg-menu dshgg-menuEnd dshgg-commitMenu',
      role: 'menu',
      'aria-label': t('commit.menu'),
    },
    item('commit', t('commit.action'), props.blocked),
    item('amend', t('commit.amend'), props.blocked),
    h('div', { className: 'dshgg-menuSeparator', role: 'separator' }),
    item(
      'commit-push',
      t('commit.push'),
      props.blocked || !props.canPush,
      props.canPush ? t('commit.push') : t('remote.noUpstream'),
    ),
    item(
      'commit-sync',
      t('commit.sync'),
      props.blocked || !props.canPush,
      props.canPush ? t('commit.sync') : t('remote.noUpstream'),
    ),
  )
}
