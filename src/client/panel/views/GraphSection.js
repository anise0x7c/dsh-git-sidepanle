/**
 * The commit-history section: its loading note, failure banner, empty note and
 * the commit rows with their copy-menu targets.
 */

import { createElement } from 'react'
import { errorText, formatAgo, parseRefs } from '../../git/format.js'
import { Banner } from '../feedback.js'
import { Section } from '../Section.js'

const h = createElement

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
  const commits = props.commits
  const menu = props.menu
  const trigger = menu === undefined ? null : menu.trigger
  const rows = []
  if (props.loading === true && commits === null) {
    rows.push(h('div', { key: 'loading', className: 'dshgg-menuNote' }, t('graph.loading')))
  } else if (props.failure !== null) {
    rows.push(h(Banner, {
      key: 'error',
      title: t('error.title'),
      detail: errorText(t, props.failure),
      retryLabel: t('retry'),
      onRetry: props.onRetry,
    }))
  } else if (commits === null || commits.length === 0) {
    rows.push(h('div', { key: 'empty', className: 'dshgg-menuNote' }, t('graph.empty')))
  } else {
    for (const commit of commits) {
      rows.push(h(GraphRow, {
        key: commit.oid,
        commit,
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
 * One commit row: graph prefix, subject, meta line and ref labels.
 * Activating the row opens the commit's details; the row stays a focus stop and
 * keeps its context-menu gesture.
 * @param {object} props - row props.
 * @param {object} props.commit - commit record.
 * @param {Function} props.t - locale binder.
 * @param {Function} [props.onSelect] - open this commit's details.
 * @param {Function|null} props.menuTrigger - host trigger binding.
 * @param {object} [props.menuTarget] - captured target for this row.
 * @returns {object} commit row element.
 */
function GraphRow(props) {
  const commit = props.commit
  const t = props.t
  const refs = parseRefs(commit.refs)
  const visibleRefs = refs.slice(0, 3)
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
  return h('div', {
    className: 'dshgg-graphRow',
    title: `${commit.shortOid} ${commit.subject} \u00b7 ${t('menu.hint')}`,
    ...rowProps,
  },
  h('pre', { className: 'dshgg-graphPrefix' }, commit.graph === '' ? '*' : commit.graph),
  h('div', { className: 'dshgg-graphBody' },
    h('div', { className: 'dshgg-graphSubject' }, commit.subject === '' ? t('graph.noSubject') : commit.subject),
    h('div', { className: 'dshgg-graphMeta' },
      h('span', { className: 'dshgg-graphHash' }, commit.shortOid),
      h('span', { className: 'dshgg-dot' }, '\u00b7'),
      h('span', null, commit.author),
      h('span', { className: 'dshgg-dot' }, '\u00b7'),
      h('span', null, formatAgo(t, commit.authoredAt)),
      visibleRefs.length === 0 ? null : h('span', { className: 'dshgg-refs' },
        visibleRefs.map((ref, index) => h('span', { key: `${ref.label}:${index}`, className: 'dshgg-ref', 'data-kind': ref.kind, title: ref.label }, ref.label)),
        hidden > 0 ? h('span', { key: 'more', className: 'dshgg-ref', title: refs.slice(3).map((ref) => ref.label).join(', ') }, `+${hidden}`) : null))))
}
