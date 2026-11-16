/**
 * The commit-history section: its loading note, failure banner, empty note and
 * the commit rows with their tree graph, ref labels and copy-menu targets.
 */

import { createElement, useMemo } from 'react'
import { computeGraph, graphRowGeometry } from '../../git/graph.js'
import { distinctRefs, errorText, formatAgo, parseRefs } from '../../git/format.js'
import { Banner } from '../feedback.js'
import { Section } from '../Section.js'

const h = createElement

/** Ref labels shown before the rest collapse into a count chip. */
const VISIBLE_REFS = 2

/**
 * @param {object} props - graph section props.
 * @param {Function} props.t - locale binder.
 * @param {object[]|null} props.commits - commits to render.
 * @param {boolean} props.loading - history loading.
 * @param {object|null} props.failure - history failure.
 * @param {boolean} props.open - whether the section is expanded.
 * @param {Function} props.onToggle - toggle the section.
 * @param {Function} props.onRetry - retry the history load.
 * @param {Function} props.onSelect - open one commit's details.
 * @param {object} props.menu - menu wiring: trigger, sectionTarget, commitTarget.
 * @returns {object} the history section element.
 */
export function GraphSection(props) {
  const t = props.t
  const commits = Array.isArray(props.commits) ? props.commits : null
  const layout = useMemo(() => computeGraph(commits ?? []), [commits])
  const menu = props.menu
  const trigger = menu === undefined ? null : menu.trigger
  const rows = []
  if (props.loading === true && commits === null) {
    rows.push(h('div', { key: 'loading', className: 'dshgg-note' }, t('graph.loading')))
  } else if (props.failure !== null) {
    rows.push(h(Banner, {
      key: 'error',
      title: t('error.title'),
      detail: errorText(t, props.failure),
      retryLabel: t('retry'),
      onRetry: props.onRetry,
    }))
  } else if (commits === null || commits.length === 0) {
    rows.push(h('div', { key: 'empty', className: 'dshgg-note' }, t('graph.empty')))
  } else {
    for (let index = 0; index < commits.length; index += 1) {
      const commit = commits[index]
      const row = layout.rows[index]
      rows.push(h(GraphRow, {
        key: commit.oid,
        commit,
        row,
        geometry: graphRowGeometry(row, layout.laneCount),
        t,
        onSelect: props.onSelect,
        menuTrigger: trigger,
        menuTarget: menu === undefined || trigger === null ? undefined : menu.commitTarget(commit),
      }))
    }
  }
  return h(Section, {
    id: 'graph',
    title: t('sections.graph'),
    count: commits === null ? undefined : commits.length,
    open: props.open,
    onToggle: props.onToggle,
    menuTrigger: trigger,
    menuHint: t('menu.hint'),
    menuTarget: menu === undefined || trigger === null ? undefined : menu.sectionTarget('graph'),
  }, rows)
}

/**
 * One commit row: the tree-graph cell, then the subject, ref labels, hash,
 * author and relative time on a single line beside this row's own node.
 * Activating the row opens the commit's details; the row stays a focus stop and
 * keeps its context-menu gesture.
 * @param {object} props - row props.
 * @param {object} props.commit - commit record.
 * @param {object} props.row - laid-out graph row for this commit.
 * @param {object} props.geometry - SVG geometry for the row.
 * @param {Function} props.t - locale binder.
 * @param {Function} [props.onSelect] - open this commit's details.
 * @param {Function|null} props.menuTrigger - host trigger binding.
 * @param {object} [props.menuTarget] - captured target for this row.
 * @returns {object} commit row element.
 */
function GraphRow(props) {
  const commit = props.commit
  const geometry = props.geometry
  const t = props.t
  const refs = distinctRefs(parseRefs(commit.refs))
  const visibleRefs = refs.slice(0, VISIBLE_REFS)
  const hidden = refs.length - visibleRefs.length
  const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
  const open = () => {
    if (typeof props.onSelect === 'function') props.onSelect(commit)
  }
  const interactive = {
    role: 'button',
    tabIndex: 0,
    onClick: open,
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open()
      }
    },
  }
  const rowProps = menuTrigger === null || props.menuTarget === undefined
    ? interactive
    : menuTrigger(props.menuTarget, { ...interactive, 'aria-haspopup': 'menu' })
  const subject = commit.subject === '' ? t('graph.noSubject') : commit.subject
  const ago = formatAgo(t, commit.authoredAt)
  const titlePrefix = refs.length === 0 ? '' : `${refs.map((ref) => ref.label).join(', ')} · `
  return h('div', {
    className: 'dshgg-graphRow',
    title: `${titlePrefix}${commit.shortOid} ${subject} · ${commit.author} · ${ago} · ${t('menu.hint')}`,
    ...rowProps,
  },
  h('svg', {
    className: 'dshgg-graphSvg',
    width: geometry.width,
    height: geometry.height,
    viewBox: `0 0 ${geometry.width} ${geometry.height}`,
    'aria-hidden': 'true',
    focusable: false,
  },
  geometry.edges.map((edge, index) => h('path', {
    key: `edge:${index}`,
    className: 'dshgg-graphEdge',
    'data-lane': String(edge.color),
    d: edge.d,
  })),
  h('circle', {
    className: 'dshgg-graphNode',
    'data-lane': String(props.row.color),
    cx: geometry.node.cx,
    cy: geometry.node.cy,
    r: geometry.node.r,
  })),
  h('div', {
    className: 'dshgg-graphBody',
    style: { marginLeft: `${geometry.textOffset - geometry.width}px` },
  },
  h('div', { className: 'dshgg-graphSubjectLine' },
    h('span', { className: 'dshgg-graphSubject' }, subject),
    visibleRefs.length === 0 ? null : h('span', { className: 'dshgg-refs' },
      visibleRefs.map((ref, index) => h('span', { key: `${ref.label}:${index}`, className: 'dshgg-ref', 'data-kind': ref.kind, title: ref.label }, ref.label)),
      hidden > 0 ? h('span', { key: 'more', className: 'dshgg-ref', 'data-kind': 'more', title: refs.slice(VISIBLE_REFS).map((ref) => ref.label).join(', ') }, `+${hidden}`) : null),
    h('span', { className: 'dshgg-graphMeta' },
      h('span', { className: 'dshgg-graphHash' }, commit.shortOid),
      h('span', { className: 'dshgg-dot dshgg-graphAuthorDot' }, '·'),
      h('span', { className: 'dshgg-graphAuthor' }, commit.author),
      h('span', { className: 'dshgg-dot dshgg-graphTimeDot' }, '·'),
      h('span', { className: 'dshgg-graphTime' }, ago)))))
}
