/**
 * The commit-history section: its loading note, failure banner, empty note and
 * the commit rows with their tree graph, ref labels and copy-menu targets.
 */

import type React from 'react'
import { createElement, useMemo } from 'react'
import { distinctRefs, errorText, formatAgo, parseRefs } from '../../git/format.ts'
import type { GraphRowGeometry, GraphRow as GraphRowLayout } from '../../git/graph.ts'
import { computeGraph, graphRowGeometry } from '../../git/graph.ts'
import type { MenuTarget, MenuTriggerFactory } from '../../menu/trigger.ts'
import type { CommitSummary, Failure } from '../../types/domain.ts'
import type { LocaleBinder } from '../../types/dsh.ts'
import { Banner } from '../feedback.ts'
import { Section } from '../Section.ts'

const h = createElement

/** Ref labels shown before the rest collapse into a count chip. */
const VISIBLE_REFS = 2

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
  /** History loading. */
  readonly loading: boolean
  /** History failure. */
  readonly failure: Failure | null
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
 * Render the history section.
 * @param props - graph section props.
 * @returns the history section element.
 */
export function GraphSection(props: GraphSectionProps): React.ReactElement {
  const t = props.t
  const commits = Array.isArray(props.commits) ? props.commits : null
  const layout = useMemo(() => computeGraph(commits ?? []), [commits])
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
      const row = layout.rows[index]
      rows.push(
        h(GraphRow, {
          key: commit.oid,
          commit,
          row,
          geometry: graphRowGeometry(row, layout.laneCount),
          t,
          onSelect: props.onSelect,
          menuTrigger: trigger,
          menuTarget:
            menu === undefined || trigger === null ? undefined : menu.commitTarget(commit),
        }),
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
 * One commit row: the tree-graph cell, then the subject, ref labels, hash,
 * author and relative time on a single line beside this row's own node.
 * Activating the row opens the commit's details; the row stays a focus stop and
 * keeps its context-menu gesture.
 * @param props - row props.
 * @returns commit row element.
 */
function GraphRow(props: GraphRowProps): React.ReactElement {
  const commit = props.commit
  const geometry = props.geometry
  const t = props.t
  const refs = distinctRefs(parseRefs(commit.refs))
  const visibleRefs = refs.slice(0, VISIBLE_REFS)
  const hidden = refs.length - visibleRefs.length
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
  const titlePrefix = refs.length === 0 ? '' : `${refs.map((ref) => ref.label).join(', ')} · `
  return h(
    'div',
    {
      className: 'dshgg-graphRow',
      title: `${titlePrefix}${commit.shortOid} ${subject} · ${commit.author} · ${ago} · ${t('menu.hint')}`,
      ...rowProps,
    },
    h(
      'svg',
      {
        className: 'dshgg-graphSvg',
        width: geometry.width,
        height: geometry.height,
        viewBox: `0 0 ${geometry.width} ${geometry.height}`,
        'aria-hidden': 'true',
        focusable: false,
      },
      geometry.edges.map((edge, index) =>
        h('path', {
          key: `edge:${index}`,
          className: 'dshgg-graphEdge',
          'data-lane': String(edge.color),
          d: edge.d,
        }),
      ),
      h('circle', {
        className: 'dshgg-graphNode',
        'data-lane': String(props.row.color),
        cx: geometry.node.cx,
        cy: geometry.node.cy,
        r: geometry.node.r,
      }),
    ),
    h(
      'div',
      {
        className: 'dshgg-graphBody',
        style: { marginLeft: `${geometry.textOffset - geometry.width}px` },
      },
      h(
        'div',
        { className: 'dshgg-graphSubjectLine' },
        h('span', { className: 'dshgg-graphSubject' }, subject),
        visibleRefs.length === 0
          ? null
          : h(
              'span',
              { className: 'dshgg-refs' },
              visibleRefs.map((ref, index) =>
                h(
                  'span',
                  {
                    key: `${ref.label}:${index}`,
                    className: 'dshgg-ref',
                    'data-kind': ref.kind,
                    title: ref.label,
                  },
                  ref.label,
                ),
              ),
              hidden > 0
                ? h(
                    'span',
                    {
                      key: 'more',
                      className: 'dshgg-ref',
                      'data-kind': 'more',
                      title: refs
                        .slice(VISIBLE_REFS)
                        .map((ref) => ref.label)
                        .join(', '),
                    },
                    `+${hidden}`,
                  )
                : null,
            ),
        h(
          'span',
          { className: 'dshgg-graphMeta' },
          h('span', { className: 'dshgg-graphHash' }, commit.shortOid),
          h('span', { className: 'dshgg-dot dshgg-graphAuthorDot' }, '·'),
          h('span', { className: 'dshgg-graphAuthor' }, commit.author),
          h('span', { className: 'dshgg-dot dshgg-graphTimeDot' }, '·'),
          h('span', { className: 'dshgg-graphTime' }, ago),
        ),
      ),
    ),
  )
}
