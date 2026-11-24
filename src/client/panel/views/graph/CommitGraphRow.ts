/**
 * One commit row of the history section: the node cell, the subject with its
 * dimmed author, and the reference badges, with the row's menu target and hover
 * wiring. Presentational only; the layout comes from the pure `git/graph.ts`.
 */

import type React from 'react'
import { createElement } from 'react'
import { formatAgo } from '../../../git/format.ts'
import type {
  BadgeIcon,
  GraphRowGeometry,
  GraphRow as GraphRowLayout,
  RefBadge,
} from '../../../git/graph.ts'
import { refBadges } from '../../../git/graph.ts'
import { CloudIcon, GitBranchIcon, TagIcon, TargetIcon } from '../../../icons.ts'
import type { MenuTarget, MenuTriggerFactory } from '../../../menu/trigger.ts'
import type { CommitSummary } from '../../../types/domain.ts'
import type { LocaleBinder } from '../../../types/dsh.ts'
import { GraphCell, graphColorValue } from './GraphArtwork.ts'

const h = createElement

/** Props of one commit row. */
export interface GraphRowProps {
  /** Commit record. */
  readonly commit: CommitSummary
  /** Position of the row from the top of the graph. */
  readonly index: number
  /** Laid-out graph row for this commit. */
  readonly row: GraphRowLayout
  /** SVG geometry for the row. */
  readonly geometry: GraphRowGeometry
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Toggle this commit's inline file list. */
  readonly onActivate?: (commit: CommitSummary) => void
  /** Whether the commit's file list is expanded below the row. */
  readonly expanded?: boolean
  /** Host trigger binding. */
  readonly menuTrigger: MenuTriggerFactory | null
  /** Captured target for this row. */
  readonly menuTarget?: MenuTarget
  /** Capture the DOM row before the shared native menu takes focus. */
  readonly onInvoke?: (element: HTMLElement) => void
  /** Report the row under the pointer, or null when it leaves the rows. */
  readonly onHover: (row: number | null) => void
}

/**
 * Icon of one badge.
 * @param icon - badge icon.
 * @returns icon element.
 */
function badgeIconElement(icon: BadgeIcon): React.ReactElement {
  if (icon === 'target') return h(TargetIcon, { size: 16 })
  if (icon === 'cloud') return h(CloudIcon, { size: 16 })
  if (icon === 'tag') return h(TagIcon, { size: 16 })
  return h(GitBranchIcon, { size: 12 })
}

/**
 * One reference badge (Code OSS `div.label`): optional count, icon, optional
 * name, on the reference's color.
 * @param props - badge.
 * @returns badge element.
 */
function Badge(props: { badge: RefBadge }): React.ReactElement {
  const badge = props.badge
  return h(
    'span',
    {
      className: 'dshgg-graphBadge',
      'data-icon': badge.icon,
      'data-color': badge.color,
      style: { backgroundColor: graphColorValue(badge.color) },
      title: badge.refs.map((ref) => ref.name).join(', '),
    },
    badge.count > 1 ? h('span', { className: 'dshgg-graphBadgeCount' }, String(badge.count)) : null,
    h('span', { className: 'dshgg-graphBadgeIcon' }, badgeIconElement(badge.icon)),
    badge.name === null ? null : h('span', { className: 'dshgg-graphBadgeName' }, badge.name),
  )
}

/**
 * One commit row: the node cell, then the subject and dimmed author on one
 * ellipsized line, then the reference badges. Activating the row toggles the
 * commit's inline file list; the row stays a focus stop and keeps its context-menu
 * gesture. The short identifier and relative time live in the tooltip, as in
 * Code OSS's hover. Hovering the row closes its node's gap in the line layer.
 * @param props - row props.
 * @returns commit row element.
 */
export function GraphRow(props: GraphRowProps): React.ReactElement {
  const commit = props.commit
  const row = props.row
  const t = props.t
  const badges = refBadges(row.refs)
  const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
  const open = (): void => {
    if (typeof props.onActivate === 'function') props.onActivate(commit)
  }
  const interactive = {
    role: 'button',
    tabIndex: 0,
    'aria-expanded': props.expanded === true,
    onClick: open,
    onMouseEnter: () => props.onHover(props.index),
    onMouseLeave: () => props.onHover(null),
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
      props.onInvoke?.(event.currentTarget)
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      props.onInvoke?.(event.currentTarget)
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open()
      }
    },
  }
  const rowProps: Record<string, unknown> =
    menuTrigger === null || props.menuTarget === undefined
      ? interactive
      : menuTrigger(props.menuTarget, { ...interactive, 'aria-haspopup': 'menu' })
  const subject = commit.subject === '' ? t('graph.noSubject') : commit.subject
  const ago = formatAgo(t, commit.authoredAt)
  const titlePrefix =
    row.refs.length === 0 ? '' : `${row.refs.map((ref) => ref.name).join(', ')} · `
  return h(
    'div',
    {
      className: 'dshgg-row dshgg-graphRow',
      'data-current': row.kind === 'HEAD' ? 'true' : undefined,
      'data-expanded': props.expanded === true ? 'true' : undefined,
      title: `${titlePrefix}${commit.shortOid} ${subject} · ${commit.author} · ${ago} · ${t('menu.hint')}`,
      ...rowProps,
    },
    h(GraphCell, { geometry: props.geometry }),
    h(
      'span',
      { className: 'dshgg-graphLabel' },
      h('span', { className: 'dshgg-graphSubject' }, subject),
      commit.author === '' ? null : h('span', { className: 'dshgg-graphAuthor' }, commit.author),
    ),
    badges.length === 0
      ? null
      : h(
          'span',
          { className: 'dshgg-graphBadges' },
          badges.map((badge, index) =>
            h(Badge, { key: `${badge.color}:${badge.icon}:${index}`, badge }),
          ),
        ),
  )
}
