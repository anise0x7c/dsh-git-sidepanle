/**
 * The commit-history section: its loading note, retryable failure note, empty note and
 * the commit rows, drawn like Code OSS's Source Control Graph — the swimlane
 * lines of the whole graph in one layer, each row's node, the subject with its
 * dimmed author, and the colored reference badges — plus the rows an expanded
 * commit lists below itself and the copy-menu targets. The section header also
 * carries the remote actions.
 */

import type React from 'react'
import { createElement, useMemo, useState } from 'react'
import { errorText, parseRefs } from '../../git/format.ts'
import {
  bindReferenceTargets,
  computeGraph,
  graphLayer,
  graphPlaceholderWidth,
  graphRowGeometry,
} from '../../git/graph.ts'
import type { MenuTarget, MenuTriggerFactory } from '../../menu/trigger.ts'
import type { CommitFileRow, CommitSummary, Failure, GraphReferences } from '../../types/domain.ts'
import type { LocaleBinder } from '../../types/dsh.ts'
import type { CommitExpansion } from '../hooks/useCommitExpansion.ts'
import { Section } from '../Section.ts'
import type { ChangeRowItem } from './graph/CommitChangeRows.ts'
import { changeRowItems, renderCommitChangeRows } from './graph/CommitChangeRows.ts'
import { GraphRow } from './graph/CommitGraphRow.ts'
import { GraphBody } from './graph/GraphArtwork.ts'

const h = createElement

/** Menu wiring the history section receives from the panel. */
export interface GraphSectionMenu {
  /** Host trigger binding, or null when menus are unavailable. */
  readonly trigger: MenuTriggerFactory | null
  /** Build a group-header target. */
  readonly sectionTarget: (section: string) => MenuTarget
  /** Build a commit-row target. */
  readonly commitTarget: (commit: CommitSummary) => MenuTarget
  /** Build the copy-only target of a file listed under an expanded commit. */
  readonly fileTarget?: (path: string) => MenuTarget
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
  /** Header actions, rendered at the end of the section header. */
  readonly actions?: React.ReactNode
  /** Toggle the section. */
  readonly onToggle: () => void
  /** Retry the history load. */
  readonly onRetry: () => void
  /** Toggle one commit's inline file list. */
  readonly onActivate: (commit: CommitSummary) => void
  /** Expanded commits by full id. */
  readonly expanded?: ReadonlyMap<string, CommitExpansion>
  /** Open one file listed under an expanded commit. */
  readonly onOpenChange?: (commit: CommitSummary, entry: CommitFileRow) => void
  /** Read an expanded commit's file list again. */
  readonly onRetryChanges?: (commit: CommitSummary) => void
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
  const expanded = props.expanded ?? null
  // The rows each expanded commit inserts below itself; the line layer and the
  // rendered rows both read this one list.
  const inserted = useMemo<(readonly ChangeRowItem[])[]>(
    () =>
      (commits ?? []).map((commit) => {
        const expansion = expanded?.get(commit.oid)
        return expansion === undefined ? [] : changeRowItems(expansion)
      }),
    [commits, expanded],
  )
  const layer = useMemo(
    () =>
      graphLayer(
        rowsLayout,
        inserted.map((items) => items.length),
      ),
    [rowsLayout, inserted],
  )
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
    // The failure text and its type icon are the native Toast's job; the pane
    // keeps a compact retry so the read stays reachable after the notice fades.
    rows.push(
      h(
        'div',
        { key: 'error', className: 'dshgg-graphMore' },
        h('span', { className: 'dshgg-graphMoreText' }, t('error.title')),
        h(
          'button',
          { type: 'button', className: 'dshgg-btn dshgg-btnGhost', onClick: props.onRetry },
          t('retry'),
        ),
      ),
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
          onActivate: props.onActivate,
          expanded: expanded?.has(commit.oid) === true,
          menuTrigger: trigger,
          ...(menu === undefined || trigger === null
            ? {}
            : { menuTarget: menu.commitTarget(commit) }),
          ...(menu.onInvoke === undefined ? {} : { onInvoke: menu.onInvoke }),
          onHover: setHovered,
        }),
      )
      const items = inserted[index] ?? []
      if (items.length > 0) {
        rowElements.push(
          ...renderCommitChangeRows({
            items,
            oid: commit.oid,
            graphWidth: graphPlaceholderWidth(row),
            t,
            onOpen: (entry) => props.onOpenChange?.(commit, entry),
            onRetry: () => props.onRetryChanges?.(commit),
            menuTrigger: trigger,
            ...(menu.fileTarget === undefined ? {} : { fileTarget: menu.fileTarget }),
          }),
        )
      }
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
      // The graph is the only section of its pane, so closing it always folds
      // the pane away; its rows stay mounted until that fold is over.
      retainBody: true,
      onToggle: props.onToggle,
      actions: props.actions,
      hover: 'controls',
      menuTrigger: trigger,
      menuHint: t('menu.hint'),
      ...(menu === undefined || trigger === null
        ? {}
        : { menuTarget: menu.sectionTarget('graph') }),
    },
    rows,
  )
}
