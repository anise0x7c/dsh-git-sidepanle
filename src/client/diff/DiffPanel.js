/**
 * The unified-diff tab body.
 */

import { createElement, useEffect, useMemo, useState } from 'react'
import { createCaller } from '../data/caller.js'
import { renderDiff } from './render.js'
import { baseName, errorText } from '../git/format.js'
import { FileIcon, RefreshIcon } from '../icons.js'
import { bindMenuTrigger, menuTarget } from '../menu/trigger.js'
import { IconButton } from '../panel/controls.js'
import { Banner, EmptyState } from '../panel/feedback.js'

const h = createElement

export function DiffPanel(props) {
  const sessionId = props.sessionId
  const t = props.t
  const tabInfo = props.useTabInfo()
  const tab = tabInfo.tab
  const params = tab.navigation?.params ?? {}
  const revision = tab.navigation?.revision ?? 0
  const call = useMemo(() => createCaller(sessionId), [sessionId])
  const menuTrigger = useMemo(
    () => (typeof sessionId === 'string' && sessionId !== '' ? bindMenuTrigger(props.useContextMenu) : null),
    [props.useContextMenu, sessionId],
  )
  const [state, setState] = useState({ phase: 'loading', diff: null, failure: null })
  const [reload, setReload] = useState(0)

  const hasTarget = typeof params.path === 'string' && params.path !== ''
  const commit = typeof params.commit === 'string' && params.commit !== '' ? params.commit : null

  useEffect(() => {
    if (!hasTarget) {
      setState({ phase: 'empty', diff: null, failure: null })
      return undefined
    }
    let cancelled = false
    setState({ phase: 'loading', diff: null, failure: null })
    call('diff', {
      path: params.path,
      staged: params.staged === true,
      untracked: params.untracked === true,
      ...(commit === null ? {} : { commit, origPath: params.origPath }),
    }).then((diff) => {
      if (!cancelled) setState({ phase: 'ready', diff, failure: null })
    }).catch((failure) => {
      if (!cancelled) setState({ phase: 'error', diff: null, failure })
    })
    return () => { cancelled = true }
  }, [call, hasTarget, params.path, params.staged, params.untracked, params.origPath, commit, revision, reload])

  const badgeKind = commit !== null
    ? 'commit'
    : params.untracked === true ? 'untracked' : params.staged === true ? 'staged' : 'unstaged'
  const badgeLabel = commit !== null
    ? t('diff.commit', { hash: typeof params.shortOid === 'string' && params.shortOid !== '' ? params.shortOid : commit.slice(0, 7) })
    : badgeKind === 'untracked' ? t('diff.untracked') : badgeKind === 'staged' ? t('diff.staged') : t('diff.unstaged')
  const headerMenu = menuTrigger === null || !hasTarget
    ? null
    : menuTrigger(menuTarget(sessionId, 'diff', { path: params.path, cwd: params.cwd }), { tabIndex: -1, 'aria-haspopup': 'menu', title: t('menu.hint') })
  const header = hasTarget
    ? h('div', { className: 'dshgg-diffHeader', ...(headerMenu ?? {}) },
      h('span', { className: 'dshgg-diffPath' },
        h('span', { className: 'dshgg-diffName' }, baseName(params.path)),
        params.origPath === undefined || params.origPath === null || params.origPath === ''
          ? null
          : h('span', { className: 'dshgg-diffFrom' }, t('diff.from', { path: params.origPath }))),
      h('span', { className: 'dshgg-diffBadge', 'data-kind': badgeKind }, badgeLabel),
      state.phase === 'ready' && state.diff !== null && state.diff.binary !== true
        ? h('span', { className: 'dshgg-diffStats' },
          h('span', { className: 'dshgg-diffAdd' }, `+${state.diff.additions}`),
          h('span', { className: 'dshgg-diffDel' }, `\u2212${state.diff.deletions}`))
        : null,
      h(IconButton, {
        label: t('diff.refresh'),
        title: t('diff.refresh'),
        onClick: () => setReload((value) => value + 1),
      }, h(RefreshIcon, { size: 14 })))
    : null

  let content
  if (!hasTarget) {
    content = h(EmptyState, {
      icon: h(FileIcon, { size: 26 }),
      title: t('diff.title'),
      desc: t('diff.pick'),
    })
  } else if (state.phase === 'loading') {
    content = h('div', { className: 'dshgg-diffNote' }, t('diff.loading'))
  } else if (state.phase === 'error') {
    content = h(Banner, {
      title: t('diff.error'),
      detail: errorText(t, state.failure),
      retryLabel: t('retry'),
      onRetry: () => setReload((value) => value + 1),
    })
  } else {
    content = renderDiff(t, state.diff)
  }

  return h('div', { className: 'dshgg-diffRoot', 'data-dsh-git-graph-diff': '' },
    header,
    h('div', { className: 'dshgg-diffBody' }, content))
}
