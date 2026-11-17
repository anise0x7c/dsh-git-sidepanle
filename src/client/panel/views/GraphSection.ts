/**
 * The commit-history section: its loading note, failure banner, empty note and
 * the commit rows, drawn like VS Code's Source Control Graph — the swimlane
 * lines of the whole graph in one layer, each row's node, the subject with its
 * dimmed author, and the colored reference badges — plus the copy-menu targets.
 */

import type React from 'react'
import { createElement, useMemo, useState } from 'react'
import { errorText, formatAgo, parseRefs } from '../../git/format.ts'
import type {
  BadgeIcon,
  GraphColor,
  GraphLayer,
  GraphRowGeometry,
  GraphRow as GraphRowLayout,
  RefBadge,
} from '../../git/graph.ts'
import {
  bindReferenceTargets,
  computeGraph,
  graphLayer,
  graphRowGeometry,
  refBadges,
} from '../../git/graph.ts'
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
  /** Remember the DOM row that invoked its native menu for focus restoration. */
  readonly onInvoke?: (element: HTMLElement) => void
}

/** Props of the history section. */
export interface GraphSectionProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Commits to render. */
  readonly commits: readonly CommitSummary[] | null
  /** Checked-out, upstream and base references, when known. */
  readonly references?: GraphReferences | null
  /** Document-unique prefix for the line layer's mask id. */
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
        bindReferenceTargets(
          (commits ?? []).map((commit) => ({
            oid: commit.oid,
            parents: commit.parents,
            refs: parseRefs(commit.refs),
          })),
          references,
        ),
        references,
      ),
    [commits, references],
  )
  const graphId = props.graphId ?? 'git-graph'
  const layer = useMemo(() => graphLayer(rowsLayout), [rowsLayout])
  // The node gap that closes while a row is hovered lives in the line layer's
  // mask, so the row cannot reach it with a stylesheet rule: the section holds
  // the hovered row and passes its index down to the layer.
  const [hovered, setHovered] = useState<number | null>(null)
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
    const rowElements: React.ReactNode[] = []
    for (let index = 0; index < commits.length; index += 1) {
      const commit = commits[index]
      const row = rowsLayout[index]
      if (commit === undefined || row === undefined) continue
      rowElements.push(
        h(GraphRow, {
          key: commit.oid,
          index,
          commit,
          row,
          geometry: graphRowGeometry(row),
          t,
          onSelect: props.onSelect,
          menuTrigger: trigger,
          menuTarget:
            menu === undefined || trigger === null ? undefined : menu.commitTarget(commit),
          onInvoke: menu.onInvoke,
          onHover: setHovered,
        }),
      )
    }
    rows.push(
      h(
        GraphBody,
        {
          key: 'body',
          layer,
          maskId: `${graphId}-lines-mask`,
          hovered,
        },
        rowElements,
      ),
    )
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
  /** Position of the row from the top of the graph. */
  readonly index: number
  /** Laid-out graph row for this commit. */
  readonly row: GraphRowLayout
  /** SVG geometry for the row. */
  readonly geometry: GraphRowGeometry
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Open this commit's details. */
  readonly onSelect?: (commit: CommitSummary) => void
  /** Host trigger binding. */
  readonly menuTrigger: MenuTriggerFactory | null
  /** Captured target for this row. */
  readonly menuTarget?: MenuTarget
  /** Capture the DOM row before the shared native menu takes focus. */
  readonly onInvoke?: (element: HTMLElement) => void
  /** Report the row under the pointer, or null when it leaves the rows. */
  readonly onHover: (row: number | null) => void
}

/** Props of the rows' shared line layer. */
export interface GraphBodyProps {
  /** The whole graph's lines and node gaps. */
  readonly layer: GraphLayer
  /** Document-unique id of the layer's mask. */
  readonly maskId: string
  /** Row whose node gap is closed, if any. */
  readonly hovered: number | null
  /** The commit rows. */
  readonly children?: React.ReactNode
}

/**
 * The graph's rows and the one layer that draws their lines. The layer takes the
 * rows as children so a hover only re-renders the layer and its mask, never the
 * rows themselves.
 * @param props - layer, hovered row and rows.
 * @returns the rows with their line layer.
 */
function GraphBody(props: GraphBodyProps): React.ReactElement {
  const layer = props.layer
  return h(
    'div',
    { className: 'dshgg-graphBody' },
    h(
      'svg',
      {
        className: 'dshgg-graphLayer',
        width: layer.width,
        height: layer.height,
        viewBox: `0 0 ${layer.width} ${layer.height}`,
        'aria-hidden': 'true',
        focusable: false,
      },
      h(
        'defs',
        null,
        h(
          'mask',
          {
            id: props.maskId,
            maskUnits: 'userSpaceOnUse',
            x: 0,
            y: 0,
            width: layer.width,
            height: layer.height,
          },
          h('rect', { x: 0, y: 0, width: layer.width, height: layer.height, fill: 'white' }),
          layer.gaps.map((gap) =>
            h('circle', {
              key: `gap:${gap.row}`,
              className: 'dshgg-graphGap',
              cx: gap.cx,
              cy: gap.cy,
              r: props.hovered === gap.row ? gap.hoverGap : gap.gap,
              fill: 'black',
            }),
          ),
        ),
      ),
      h(
        'g',
        { className: 'dshgg-graphLines', mask: `url(#${props.maskId})` },
        layer.paths.map((path, index) =>
          h('path', {
            key: `${path.color}:${index}`,
            className: 'dshgg-graphEdge',
            'data-color': path.color,
            d: path.d,
            style: { stroke: graphColorValue(path.color) },
          }),
        ),
      ),
    ),
    props.children,
  )
}

/**
 * The row's cell (VS Code `renderSCMHistoryItemGraph`): the node on top of the
 * section's line layer, sized to the row's graph width so the text starts right
 * after it. The node circles carry their hover radii as custom properties for
 * the stylesheet.
 * @param props - row geometry.
 * @returns the SVG cell.
 */
function GraphCell(props: { geometry: GraphRowGeometry }): React.ReactElement {
  const geometry = props.geometry
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
 * One commit row: the node cell, then the subject and dimmed author on one
 * ellipsized line, then the reference badges. Activating the row opens the
 * commit's details; the row stays a focus stop and keeps its context-menu
 * gesture. The short identifier and relative time live in the tooltip, as in
 * VS Code's hover. Hovering the row closes its node's gap in the line layer.
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
      className: 'dshgg-graphRow',
      'data-current': row.kind === 'HEAD' ? 'true' : undefined,
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
