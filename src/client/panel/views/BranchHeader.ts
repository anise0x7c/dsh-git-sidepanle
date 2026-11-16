/**
 * Panel toolbar: the branch chip with its picker dropdown, and the refresh
 * control.
 */

import type React from 'react'
import { createElement } from 'react'
import { ChevronDownIcon, GitBranchIcon, RefreshIcon } from '../../icons.ts'
import type { BranchInfo, Failure, RepositoryStatus } from '../../types/domain.ts'
import type { LocaleBinder } from '../../types/dsh.ts'
import { BranchMenu } from '../BranchMenu.ts'
import { IconButton } from '../controls.ts'

const h = createElement

/** Props of the panel toolbar. */
export interface BranchHeaderProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Ref for the chip wrapper (outside-click dismissal). */
  readonly wrapRef: React.RefObject<HTMLDivElement>
  /** Repository record, or null. */
  readonly repo: RepositoryStatus | null
  /** Resolved branch label. */
  readonly branchLabel: string | null
  /** Commits ahead of upstream. */
  readonly ahead: number
  /** Commits behind upstream. */
  readonly behind: number
  /** Current busy operation name or null. */
  readonly busy: string | null
  /** Whether the picker is open. */
  readonly branchMenu: boolean
  /** Branch list. */
  readonly branches: readonly BranchInfo[] | null
  /** Branch list loading. */
  readonly branchLoading: boolean
  /** Branch list failure. */
  readonly branchFailure: Failure | null
  /** Open or close the picker. */
  readonly onToggleMenu: () => void
  /** Check out a branch. */
  readonly onPickBranch: (name: string) => void
  /** Retry the branch list. */
  readonly onRetryBranches: () => void
  /** Refresh status and history. */
  readonly onRefresh: () => void
}

/**
 * Render the panel toolbar.
 * @param props - toolbar props.
 * @returns toolbar element.
 */
export function BranchHeader(props: BranchHeaderProps): React.ReactElement {
  const t = props.t
  const repo = props.repo
  return h(
    'div',
    { className: 'dshgg-toolbar' },
    h(
      'div',
      { className: 'dshgg-branchWrap', ref: props.wrapRef },
      h(
        'button',
        {
          type: 'button',
          className: 'dshgg-branchChip',
          onClick: props.onToggleMenu,
          disabled: repo === null || props.busy !== null,
          'aria-haspopup': 'menu',
          'aria-expanded': props.branchMenu,
          'aria-label': props.branchLabel ?? t('title'),
          title:
            repo === null
              ? t('noRepo.title')
              : repo.upstream === undefined || repo.upstream === null
                ? t('branch.menu')
                : `${t('branch.upstream', { name: repo.upstream })} \u00b7 ${t('branch.menu')}`,
        },
        h(GitBranchIcon, { size: 14 }),
        props.branchLabel === undefined || props.branchLabel === null
          ? null
          : h('span', { className: 'dshgg-branchName' }, props.branchLabel),
        props.ahead > 0
          ? h(
              'span',
              { className: 'dshgg-sync', title: t('branch.ahead', { n: props.ahead }) },
              h('span', null, '\u2191'),
              String(props.ahead),
            )
          : null,
        props.behind > 0
          ? h(
              'span',
              { className: 'dshgg-sync', title: t('branch.behind', { n: props.behind }) },
              h('span', null, '\u2193'),
              String(props.behind),
            )
          : null,
        repo?.upstream === undefined || repo?.upstream === null
          ? null
          : h(
              'span',
              { className: 'dshgg-upstream', title: t('branch.upstream', { name: repo.upstream }) },
              repo.upstream,
            ),
        h(ChevronDownIcon, { size: 12 }),
      ),
      props.branchMenu
        ? h(BranchMenu, {
            t,
            branches: props.branches,
            loading: props.branchLoading,
            failure: props.branchFailure,
            onPick: props.onPickBranch,
            onRetry: props.onRetryBranches,
          })
        : null,
    ),
    h('span', { className: 'dshgg-spacer' }),
    h(
      IconButton,
      {
        label: t('refresh'),
        title: t('refresh'),
        disabled: props.busy !== null,
        spinning: props.busy === 'refresh',
        onClick: props.onRefresh,
      },
      h(RefreshIcon, { size: 14 }),
    ),
  )
}
