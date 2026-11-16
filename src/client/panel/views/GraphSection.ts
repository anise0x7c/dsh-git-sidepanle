/**
 * The commit-history section: its loading note, failure banner, empty note and
 * the commit rows, drawn like VS Code's Source Control Graph — the row's
 * swimlane cell, the subject with its dimmed author, and the colored reference
 * badges — plus the copy-menu targets.
 */

import type React from 'react'
import { createElement, useMemo } from 'react'
import { errorText, formatAgo, parseRefs } from '../../git/format.ts'
import type {
  BadgeIcon,
  GraphColor,
  GraphRowGeometry,
  GraphRow as GraphRowLayout,
  RefBadge,
} from '../../git/graph.ts'
import { computeGraph, graphRowGeometry, refBadges } from '../../git/graph.ts'
import { CloudIcon, GitBranchIcon, TagIcon, TargetIcon } from '../../icons.ts'
import type { MenuTarget, MenuTriggerFactory } from '../../menu/trigger.ts'
import type { CommitSummary, Failure, GraphReferences } from '../../types/domain.ts'
import type { LocaleBinder } from '../../types/dsh.ts'
import { Banner } from '../feedback.ts'
import { Section } from '../Section.ts'

const h = createElement

/** Menu wiring the history section receives from the panel. */
export interface GraphSectionMenu {
  /** Host trigger binding, or null when menus are unavailable. */
  readonly trigger: MenuTriggerFactory | null
  /** Build a group-header target. */
  readonly sectionTarget: (section: string) => MenuTarget
  /** Build a commit-row target. */
  readonly commitTarget: (commit: CommitSummary) => MenuTarget
}

/** Props of the history section. */
export interface GraphSectionProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Commits to render. */
  readonly commits: readonly CommitSummary[] | null
  /** Checked-out, upstream and base references, when known. */
  readonly references?: GraphReferences | null
  /** Document-unique prefix for the rows' SVG mask ids. */
  readonly graphId?: string
  /** History loading. */
  readonly loading: boolean
  /** History failure. */
  readonly failure: Failure | null
  /** Whether commits older than the shown rows remain. */
  readonly hasMore?: boolean
  /** Whether an earlier page is loading. */
  readonly moreLoading?: boolean
  /** Failed earlier page; the shown rows stay visible. */
  readonly moreFailure?: Failure | null
  /** Load the next page of earlier commits. */
  readonly onLoadMore?: () => void
  /** Whether the section is expanded. */
  readonly open: boolean
  /** Toggle the section. */
  readonly onToggle: () => void
  /** Retry the history load. */
  readonly onRetry: () => void
  /** Open one commit's details. */
  readonly onSelect: (commit: CommitSummary) => void
  /** Menu wiring. */
  readonly menu: GraphSectionMenu
}

/**
 * CSS value of a graph color identifier.
 * @param color - graph color.
 * @returns `var(--dshgg-scm-…)` reference.
 */
export function graphColorValue(color: GraphColor): string {
  return `var(--dshgg-scm-${color})`
}

/**
 * Render the history section.
 * @param props - graph section props.
 * @returns the history section element.
 */
export function GraphSection(props: GraphSectionProps): React.ReactElement {
  const t = props.t
  const commits = Array.isArray(props.commits) ? props.commits : null
  const references = props.references ?? null
  const rowsLayout = useMemo(
    () =>
      computeGraph(
        (commits ?? []).map((commit) => ({
          oid: commit.oid,
          parents: commit.parents,
          refs: parseRefs(commit.refs),
        })),
        references,
      ),
    [commits, references],
  )
  const graphId = props.graphId ?? 'git-graph'
  const menu = props.menu
  const trigger = menu === undefined ? null : menu.trigger
  const rows: React.ReactNode[] = []
  if (props.loading === true && commits === null) {
    rows.push(h('div', { key: 'loading', className: 'dshgg-note' }, t('graph.loading')))
  } else if (props.failure !== null) {
    rows.push(
      h(Banner, {
        key: 'error',
        title: t('error.title'),
        detail: errorText(t, props.failure),
        retryLabel: t('retry'),
        onRetry: props.onRetry,
      }),
    )
  } else if (commits === null || commits.length === 0) {
    rows.push(h('div', { key: 'empty', className: 'dshgg-note' }, t('graph.empty')))
  } else {
    for (let index = 0; index < commits.length; index += 1) {
      const commit = commits[index]
      const row = rowsLayout[index]
      if (commit === undefined || row === undefined) continue
      rows.push(
        h(GraphRow, {
          key: commit.oid,
          commit,
          row,
          geometry: graphRowGeometry(row),
          maskId: `${graphId}-mask-${index}`,
          t,
          onSelect: props.onSelect,
          menuTrigger: trigger,
          menuTarget:
            menu === undefined || trigger === null ? undefined : menu.commitTarget(commit),
        }),
      )
    }
    const loadMore = typeof props.onLoadMore === 'function' ? props.onLoadMore : null
    const moreFailure = props.moreFailure ?? null
    if (loadMore !== null && moreFailure !== null) {
      rows.push(
        h(
          'div',
          { key: 'moreError', className: 'dshgg-graphMore' },
          h('span', { className: 'dshgg-graphMoreText' }, errorText(t, moreFailure)),
          h(
            'button',
            {
              type: 'button',
              className: 'dshgg-btn dshgg-btnGhost',
              onClick: loadMore,
            },
            t('retry'),
          ),
        ),
      )
    } else if (loadMore !== null && props.hasMore === true) {
      // The control keeps its DOM node and stays enabled while a page loads, so
      // keyboard focus that scrolled it into view survives the automatic load
      // and starts no second request; only the label and the busy state change.
      const loading = props.moreLoading === true
      rows.push(
        h(
          'button',
          {
            key: 'more',
            type: 'button',
            className: 'dshgg-btn dshgg-btnGhost dshgg-graphMoreBtn',
            'data-loading': loading ? 'true' : undefined,
            'aria-busy': loading ? 'true' : undefined,
            'aria-disabled': loading ? 'true' : undefined,
            onClick: loadMore,
          },
          t(loading ? 'graph.loadingMore' : 'graph.loadMore'),
        ),
      )
    }
  }
  return h(
    Section,
    {
      id: 'graph',
      title: t('sections.graph'),
      count: commits === null ? undefined : commits.length,
      open: props.open,
      onToggle: props.onToggle,
      menuTrigger: trigger,
      menuHint: t('menu.hint'),
      menuTarget: menu === undefined || trigger === null ? undefined : menu.sectionTarget('graph'),
    },
    rows,
  )
}

/** Props of one commit row. */
export interface GraphRowProps {
  /** Commit record. */
  readonly commit: CommitSummary
  /** Laid-out graph row for this commit. */
  readonly row: GraphRowLayout
  /** SVG geometry for the row. */
  readonly geometry: GraphRowGeometry
  /** Document-unique id of the row's node-gap mask. */
  readonly maskId: string
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Open this commit's details. */
  readonly onSelect?: (commit: CommitSummary) => void
  /** Host trigger binding. */
  readonly menuTrigger: MenuTriggerFactory | null
  /** Captured target for this row. */
  readonly menuTarget?: MenuTarget
}

/**
 * The row's swimlane cell (VS Code `renderSCMHistoryItemGraph`). Lines are
 * cut around the node by a mask, so the gap shows whatever surface lies
 * behind the row; the mask circle and the node circles carry their hover radii
 * as custom properties for the stylesheet.
 * @param props - geometry and mask id.
 * @returns the SVG cell.
 */
function GraphCell(props: { geometry: GraphRowGeometry; maskId: string }): React.ReactElement {
  const { geometry, maskId } = props
  const node = geometry.node
  return h(
    'svg',
    {
      className: 'dshgg-graphSvg',
      width: geometry.width,
      height: geometry.height,
      viewBox: `0 0 ${geometry.width} ${geometry.height}`,
      'aria-hidden': 'true',
      focusable: false,
    },
    h(
      'defs',
      null,
      h(
        'mask',
        {
          id: maskId,
          maskUnits: 'userSpaceOnUse',
          x: 0,
          y: 0,
          width: geometry.width,
          height: geometry.height,
        },
        h('rect', { x: 0, y: 0, width: geometry.width, height: geometry.height, fill: 'white' }),
        h('circle', {
          className: 'dshgg-graphGap',
          cx: node.cx,
          cy: node.cy,
          r: node.gap,
          fill: 'black',
          style: { '--dshgg-gap-hover': `${node.hoverGap}px` },
        }),
      ),
    ),
    h(
      'g',
      { className: 'dshgg-graphLines', mask: `url(#${maskId})` },
      geometry.paths.map((path, index) =>
        h('path', {
          key: `path:${index}`,
          className: 'dshgg-graphEdge',
          'data-color': path.color,
          d: path.d,
          style: { stroke: graphColorValue(path.color) },
        }),
      ),
    ),
    node.circles.map((circle, index) =>
      h('circle', {
        key: `node:${index}`,
        className: 'dshgg-graphNode',
        'data-shape': node.shape,
        'data-paint': circle.paint,
        'data-color': node.color,
        cx: node.cx,
        cy: node.cy,
        r: circle.r,
        ...(circle.paint === 'ring'
          ? {
              fill: 'none',
              strokeWidth: circle.strokeWidth,
              style: {
                stroke: graphColorValue(node.color),
                '--dshgg-node-hover-r': `${circle.hoverR}px`,
                '--dshgg-node-hover-stroke': `${circle.hoverStrokeWidth}px`,
              },
            }
          : {
              style: {
                fill: graphColorValue(node.color),
                '--dshgg-node-hover-r': `${circle.hoverR}px`,
              },
            }),
      }),
    ),
  )
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
 * One reference badge (VS Code `div.label`): optional count, icon, optional
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
 * One commit row: the swimlane cell, then the subject and dimmed author on one
 * ellipsized line, then the reference badges. Activating the row opens the
 * commit's details; the row stays a focus stop and keeps its context-menu
 * gesture. The short identifier and relative time live in the tooltip, as in
 * VS Code's hover.
 * @param props - row props.
 * @returns commit row element.
 */
function GraphRow(props: GraphRowProps): React.ReactElement {
  const commit = props.commit
  const row = props.row
  const t = props.t
  const badges = refBadges(row.refs)
  const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
  const open = (): void => {
    if (typeof props.onSelect === 'function') props.onSelect(commit)
  }
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
      className: 'dshgg-graphRow',
      'data-current': row.kind === 'HEAD' ? 'true' : undefined,
      title: `${titlePrefix}${commit.shortOid} ${subject} · ${commit.author} · ${ago} · ${t('menu.hint')}`,
      ...rowProps,
    },
    h(GraphCell, { geometry: props.geometry, maskId: props.maskId }),
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
