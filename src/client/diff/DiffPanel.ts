/**
 * The unified-diff tab body.
 */

import type React from 'react'
import { createElement, useEffect, useState } from 'react'
import { toFailure } from '../data/caller.ts'
import { baseName, errorText } from '../git/format.ts'
import { FileIcon, RefreshIcon } from '../icons.ts'
import { menuTarget } from '../menu/trigger.ts'
import { IconButton } from '../panel/controls.ts'
import { Banner, EmptyState } from '../panel/feedback.ts'
import { usePanelWiring } from '../panel/menu.ts'
import type { DiffResult, Failure } from '../types/domain.ts'
import type { LocaleBinder, TabInfoHook, UseContextMenu } from '../types/dsh.ts'
import { renderDiff } from './render.ts'

const h = createElement

/** Props of the diff tab body. */
export interface DiffPanelProps {
  /** Session the tab is bound to. */
  readonly sessionId: string
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Slot-owned tab information hook. */
  readonly useTabInfo: TabInfoHook
  /** Host context-menu trigger hook from the slot's root props. */
  readonly useContextMenu?: UseContextMenu
}

/** One phase of the diff read. */
type DiffPhase = 'loading' | 'empty' | 'ready' | 'error'

/** Diff-panel state. */
interface DiffState {
  /** Which part of the read the body should show. */
  readonly phase: DiffPhase
  /** Parsed diff once ready. */
  readonly diff: DiffResult | null
  /** Failed diff read. */
  readonly failure: Failure | null
}

/**
 * Render the unified-diff tab body for one Session.
 * @param props - slot props.
 * @returns the diff tab element.
 */
export function DiffPanel(props: DiffPanelProps): React.ReactElement {
  const sessionId = props.sessionId
  const t = props.t
  const tabInfo = props.useTabInfo()
  const tab = tabInfo.tab
  const params = tab.navigation?.params ?? {}
  const revision = tab.navigation?.revision ?? 0
  const { call, menuTrigger } = usePanelWiring({ sessionId, useContextMenu: props.useContextMenu })
  const [state, setState] = useState<DiffState>({ phase: 'loading', diff: null, failure: null })
  const [reload, setReload] = useState(0)

  const path = typeof params.path === 'string' && params.path !== '' ? params.path : null
  const commit = typeof params.commit === 'string' && params.commit !== '' ? params.commit : null
  const origPath =
    typeof params.origPath === 'string' && params.origPath !== '' ? params.origPath : undefined
  const cwd = typeof params.cwd === 'string' && params.cwd !== '' ? params.cwd : undefined
  const staged = params.staged === true
  const untracked = params.untracked === true

  useEffect(() => {
    if (path === null) {
      setState({ phase: 'empty', diff: null, failure: null })
      return undefined
    }
    let cancelled = false
    setState({ phase: 'loading', diff: null, failure: null })
    call('diff', {
      path,
      staged,
      untracked,
      ...(commit === null ? {} : { commit }),
      ...(commit === null || origPath === undefined ? {} : { origPath }),
    })
      .then((diff) => {
        if (!cancelled) setState({ phase: 'ready', diff, failure: null })
      })
      .catch((failure: unknown) => {
        if (!cancelled) setState({ phase: 'error', diff: null, failure: toFailure(failure) })
      })
    return () => {
      cancelled = true
    }
  }, [call, path, staged, untracked, origPath, commit, revision, reload])

  const badgeKind =
    commit !== null ? 'commit' : untracked ? 'untracked' : staged ? 'staged' : 'unstaged'
  const badgeLabel =
    commit !== null
      ? t('diff.commit', {
          hash:
            typeof params.shortOid === 'string' && params.shortOid !== ''
              ? params.shortOid
              : commit.slice(0, 7),
        })
      : badgeKind === 'untracked'
        ? t('diff.untracked')
        : badgeKind === 'staged'
          ? t('diff.staged')
          : t('diff.unstaged')
  const headerMenu =
    menuTrigger === null || path === null
      ? null
      : menuTrigger(
          menuTarget(sessionId, 'diff', { path, ...(cwd === undefined ? {} : { cwd }) }),
          {
            tabIndex: -1,
            'aria-haspopup': 'menu',
            title: t('menu.hint'),
          },
        )
  const rawOrigPath = params.origPath
  const header =
    path !== null
      ? h(
          'div',
          { className: 'dshgg-diffHeader', ...(headerMenu ?? {}) },
          h(
            'span',
            { className: 'dshgg-diffPath' },
            h('span', { className: 'dshgg-diffName' }, baseName(path)),
            rawOrigPath === undefined || rawOrigPath === null || rawOrigPath === ''
              ? null
              : h(
                  'span',
                  { className: 'dshgg-diffFrom' },
                  t('diff.from', { path: String(rawOrigPath) }),
                ),
          ),
          h('span', { className: 'dshgg-diffBadge', 'data-kind': badgeKind }, badgeLabel),
          state.phase === 'ready' && state.diff !== null && state.diff.binary !== true
            ? h(
                'span',
                { className: 'dshgg-diffStats' },
                h('span', { className: 'dshgg-diffAdd' }, `+${state.diff.additions}`),
                h('span', { className: 'dshgg-diffDel' }, `\u2212${state.diff.deletions}`),
              )
            : null,
          h(
            IconButton,
            {
              label: t('diff.refresh'),
              title: t('diff.refresh'),
              onClick: () => setReload((value) => value + 1),
            },
            h(RefreshIcon, { size: 14 }),
          ),
        )
      : null

  let content: React.ReactNode
  if (path === null) {
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

  return h(
    'div',
    { className: 'dshgg-diffRoot', 'data-dsh-git-graph-diff': '' },
    header,
    h('div', { className: 'dshgg-diffBody' }, content),
  )
}
