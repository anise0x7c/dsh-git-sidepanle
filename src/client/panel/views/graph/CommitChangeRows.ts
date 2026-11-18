/**
 * The rows listed under an expanded commit (VS Code `HistoryItemChangeRenderer`):
 * one 22px row per changed file with a graph area as wide as the commit's
 * outgoing lanes, a file icon, the name with its dimmed directory and the status
 * letter at the end — or a single loading, empty, failure or capped-list row.
 *
 * Presentational only. The lanes running through these rows are drawn by the
 * section's line layer, so this module only reserves their width.
 */

import type React from 'react'
import { createElement } from 'react'
import { errorText, splitPath, statusKey } from '../../../git/format.ts'
import { HostFileIcon } from '../../../host-file-icon.ts'
import type { MenuTarget, MenuTriggerFactory } from '../../../menu/trigger.ts'
import type { CommitFileRow, Failure } from '../../../types/domain.ts'
import type { LocaleBinder } from '../../../types/dsh.ts'
import type { CommitExpansion } from '../../hooks/useCommitExpansion.ts'

const h = createElement

/** One row listed under an expanded commit. */
export type ChangeRowItem =
  | { readonly kind: 'file'; readonly entry: CommitFileRow }
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'failure'; readonly failure: Failure }
  | { readonly kind: 'truncated'; readonly count: number }

/**
 * The rows an expanded commit lists, in display order. The graph section uses
 * the same list to size the line layer, so the drawn lanes and the rendered rows
 * can never disagree about how many rows were inserted.
 * @param expansion - the commit's read state.
 * @returns one item per inserted 22px row.
 */
export function changeRowItems(expansion: CommitExpansion): ChangeRowItem[] {
  if (expansion.failure !== null) return [{ kind: 'failure', failure: expansion.failure }]
  if (expansion.loading) return [{ kind: 'loading' }]
  if (expansion.files.length === 0) return [{ kind: 'empty' }]
  const items: ChangeRowItem[] = expansion.files.map((entry) => ({ kind: 'file', entry }))
  if (expansion.truncated) items.push({ kind: 'truncated', count: expansion.files.length })
  return items
}

/** Props of the rows listed under one expanded commit. */
export interface CommitChangeRowsProps {
  /** Rows to render, from {@link changeRowItems}. */
  readonly items: readonly ChangeRowItem[]
  /** Full id of the expanded commit, used in element keys. */
  readonly oid: string
  /** Width of the graph area the commit's outgoing lanes occupy. */
  readonly graphWidth: number
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Open one changed file's diff for the commit. */
  readonly onOpen: (entry: CommitFileRow) => void
  /** Read the commit's file list again. */
  readonly onRetry: () => void
  /** Host trigger binding; null disables the file menus. */
  readonly menuTrigger: MenuTriggerFactory | null
  /** Captured copy-menu target for one file path. */
  readonly fileTarget?: (path: string) => MenuTarget
}

/**
 * Reserve the graph area at the start of a change row.
 * @param width - graph area width.
 * @returns spacer element.
 */
function graphArea(width: number): React.ReactElement {
  return h('span', {
    className: 'dshgg-graphChangeLanes',
    style: { width: `${width}px` },
    'aria-hidden': 'true',
  })
}

/**
 * One changed-file row under an expanded commit.
 * @param props - row props.
 * @returns row element.
 */
function ChangeFileRow(props: {
  readonly entry: CommitFileRow
  readonly graphWidth: number
  readonly t: LocaleBinder
  readonly onOpen: (entry: CommitFileRow) => void
  readonly menuTrigger: MenuTriggerFactory | null
  readonly menuTarget?: MenuTarget
}): React.ReactElement {
  const entry = props.entry
  const { dir, name } = splitPath(entry.path)
  const letter = entry.letter ?? ''
  const open = (): void => props.onOpen(entry)
  const interactive = {
    role: 'button',
    tabIndex: 0,
    onClick: open,
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open()
      }
    },
  }
  const trigger = props.menuTrigger
  const rowProps: Record<string, unknown> =
    trigger === null || props.menuTarget === undefined
      ? interactive
      : trigger(props.menuTarget, { ...interactive, 'aria-haspopup': 'menu' })
  return h(
    'div',
    {
      className: 'dshgg-graphChange dshgg-fileRow',
      'aria-label': `${props.t(statusKey(letter))} ${entry.path}`,
      title: entry.origPath === undefined ? entry.path : `${entry.origPath} → ${entry.path}`,
      ...rowProps,
    },
    graphArea(props.graphWidth),
    h(
      'span',
      { className: 'dshgg-graphChangeIcon' },
      h(HostFileIcon, { path: entry.path, size: 16 }),
    ),
    h(
      'span',
      { className: 'dshgg-graphChangeLabel' },
      h('span', { className: 'dshgg-graphChangeName' }, name),
      dir === '' ? null : h('span', { className: 'dshgg-graphChangeDir' }, dir),
    ),
    h('span', { className: 'dshgg-status dshgg-graphChangeStatus', 'data-status': letter }, letter),
  )
}

/**
 * Render the rows listed under one expanded commit.
 * @param props - change-row props.
 * @returns one element per item.
 */
export function renderCommitChangeRows(props: CommitChangeRowsProps): React.ReactElement[] {
  const t = props.t
  return props.items.map((item) => {
    if (item.kind === 'file') {
      const target = props.fileTarget?.(item.entry.path)
      return h(ChangeFileRow, {
        key: `change:${props.oid}:${item.entry.path}`,
        entry: item.entry,
        graphWidth: props.graphWidth,
        t,
        onOpen: props.onOpen,
        menuTrigger: props.menuTrigger,
        ...(target === undefined ? {} : { menuTarget: target }),
      })
    }
    const note =
      item.kind === 'loading'
        ? t('commitDetails.loading')
        : item.kind === 'empty'
          ? t('commitDetails.empty')
          : item.kind === 'truncated'
            ? t('commitDetails.truncated', { n: item.count })
            : errorText(t, item.failure)
    return h(
      'div',
      {
        key: `change:${props.oid}:${item.kind}`,
        className: 'dshgg-graphChange dshgg-graphChangeNote',
        'data-note': item.kind,
        role: item.kind === 'failure' ? 'alert' : 'status',
      },
      graphArea(props.graphWidth),
      h('span', { className: 'dshgg-graphChangeText', title: note }, note),
      item.kind === 'failure'
        ? h(
            'button',
            {
              type: 'button',
              className: 'dshgg-graphChangeRetry',
              onClick: (event: React.MouseEvent<HTMLElement>) => {
                event.stopPropagation()
                props.onRetry()
              },
            },
            t('retry'),
          )
        : null,
    )
  })
}
