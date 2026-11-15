/**
 * Panel toolbar: the branch chip with its picker dropdown, and the refresh
 * control.
 */

import { createElement } from 'react'
import { ChevronDownIcon, GitBranchIcon, RefreshIcon } from '../../icons.js'
import { BranchMenu } from '../BranchMenu.js'
import { IconButton } from '../controls.js'

const h = createElement

/**
 * @param {object} props - toolbar props.
 * @param {Function} props.t - locale binder.
 * @param {object} props.wrapRef - ref for the chip wrapper (outside-click dismissal).
 * @param {object|null} props.repo - repository record, or null.
 * @param {string|null} props.branchLabel - resolved branch label.
 * @param {number} props.ahead - commits ahead of upstream.
 * @param {number} props.behind - commits behind upstream.
 * @param {string|null} props.busy - current busy operation name or null.
 * @param {boolean} props.branchMenu - whether the picker is open.
 * @param {object[]|null} props.branches - branch list.
 * @param {boolean} props.branchLoading - branch list loading.
 * @param {object|null} props.branchFailure - branch list failure.
 * @param {Function} props.onToggleMenu - open/close the picker.
 * @param {Function} props.onPickBranch - checkout a branch.
 * @param {Function} props.onRetryBranches - retry the branch list.
 * @param {Function} props.onRefresh - refresh status and history.
 * @returns {object} toolbar element.
 */
export function BranchHeader(props) {
  const t = props.t
  const repo = props.repo
  return h('div', { className: 'dshgg-toolbar' },
    h('div', { className: 'dshgg-branchWrap', ref: props.wrapRef },
      h('button', {
        type: 'button',
        className: 'dshgg-branchChip',
        onClick: props.onToggleMenu,
        disabled: repo === null || props.busy !== null,
        'aria-haspopup': 'menu',
        'aria-expanded': props.branchMenu,
        title: repo === null ? t('noRepo.title') : t('branch.menu'),
      },
      h(GitBranchIcon, { size: 14 }),
      h('span', { className: 'dshgg-branchName' }, props.branchLabel ?? t('loading')),
      props.ahead > 0 ? h('span', { className: 'dshgg-sync', title: t('branch.ahead', { n: props.ahead }) }, h('span', null, '\u2191'), String(props.ahead)) : null,
      props.behind > 0 ? h('span', { className: 'dshgg-sync', title: t('branch.behind', { n: props.behind }) }, h('span', null, '\u2193'), String(props.behind)) : null,
      repo?.upstream !== undefined && repo?.upstream !== null
        ? h('span', { className: 'dshgg-upstream', title: t('branch.upstream', { name: repo.upstream }) }, repo.upstream)
        : null,
      h(ChevronDownIcon, { size: 12 })),
    props.branchMenu ? h(BranchMenu, {
      t,
      branches: props.branches,
      loading: props.branchLoading,
      failure: props.branchFailure,
      onPick: props.onPickBranch,
      onRetry: props.onRetryBranches,
    }) : null),
    h('span', { className: 'dshgg-spacer' }),
    h(IconButton, {
      label: t('refresh'),
      title: t('refresh'),
      disabled: props.busy !== null,
      spinning: props.busy === 'refresh',
      onClick: props.onRefresh,
    }, h(RefreshIcon, { size: 14 })))
}
