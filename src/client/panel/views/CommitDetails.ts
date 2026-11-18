/**
 * One commit's details inside the Git panel: a back control, the commit
 * metadata, and the flat list of files the commit changed. This view replaces
 * the change list while it is open; the panel returns here with new props for
 * every load, so it only renders.
 */

import type React from 'react'
import { createElement } from 'react'
import { errorText, formatAgo } from '../../git/format.ts'
import { ArrowLeftIcon } from '../../icons.ts'
import type {
  MenuTarget,
  MenuTargetDetail,
  MenuTargetKind,
  MenuTriggerFactory,
} from '../../menu/trigger.ts'
import type { CommitFileRow, Failure } from '../../types/domain.ts'
import type { LocaleBinder } from '../../types/dsh.ts'
import { IconButton } from '../controls.ts'
import { Banner } from '../feedback.ts'
import type { CommitSummaryPreview, LoadedCommitDetails } from '../hooks/useCommitDetails.ts'
import { renderFileRows } from '../rows.ts'

const h = createElement

/** Props of the commit-details view. */
export interface CommitDetailsProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Graph row the user activated. */
  readonly summary: CommitSummaryPreview
  /** Fetched commit record and file list. */
  readonly details: LoadedCommitDetails | null
  /** Whether the file list is loading. */
  readonly loading: boolean
  /** Failed file-list read. */
  readonly failure: Failure | null
  /** Sorted changed files with display letters. */
  readonly files: readonly CommitFileRow[]
  /** Leave the details view. */
  readonly onBack: () => void
  /** Retry the failed read. */
  readonly onRetry: () => void
  /** Open one changed file's diff. */
  readonly onOpenFile: (entry: CommitFileRow) => void
  /** Host trigger binding. */
  readonly menuTrigger: MenuTriggerFactory | null
  /** Build a file-row menu target. */
  readonly rowTarget: (kind: MenuTargetKind, detail: MenuTargetDetail) => MenuTarget
}

/**
 * Render one commit's details.
 * @param props - commit-details props.
 * @returns the commit-details element.
 */
export function CommitDetails(props: CommitDetailsProps): React.ReactElement {
  const t = props.t
  const summary = props.summary
  const commit = props.details?.commit ?? summary
  const subject =
    typeof commit.subject === 'string' && commit.subject !== ''
      ? commit.subject
      : t('graph.noSubject')
  const author = typeof commit.author === 'string' ? commit.author : ''
  const body = props.details?.commit?.body ?? ''
  const hasDetails = props.details !== null
  const files = props.files

  let filesBody: React.ReactNode
  if (props.loading === true && !hasDetails) {
    filesBody = h(
      'div',
      { key: 'loading', className: 'dshgg-commitNote' },
      t('commitDetails.loading'),
    )
  } else if (props.failure !== null && props.failure !== undefined) {
    filesBody = h(Banner, {
      key: 'error',
      title: t('error.title'),
      detail: errorText(t, props.failure),
      retryLabel: t('retry'),
      onRetry: props.onRetry,
    })
  } else if (files.length === 0) {
    filesBody = h('div', { key: 'empty', className: 'dshgg-commitNote' }, t('commitDetails.empty'))
  } else {
    filesBody = renderFileRows(files, {
      t,
      busy: false,
      mode: 'commit',
      onOpen: props.onOpenFile,
      onStage: () => {},
      onUnstage: () => {},
      onDiscard: () => {},
      menuTrigger: props.menuTrigger,
      menuTarget: (entry) => props.rowTarget('commitFile', { section: 'commit', path: entry.path }),
    })
  }

  return h(
    'div',
    { className: 'dshgg-commitView', 'data-commit': commit.oid ?? '' },
    h(
      'div',
      { className: 'dshgg-commitToolbar' },
      h(
        IconButton,
        {
          label: t('commitDetails.back'),
          title: t('commitDetails.back'),
          onClick: props.onBack,
        },
        h(ArrowLeftIcon, { size: 14 }),
      ),
      h(
        'span',
        { className: 'dshgg-commitHash', title: typeof commit.oid === 'string' ? commit.oid : '' },
        typeof commit.shortOid === 'string' ? commit.shortOid : '',
      ),
      h('span', { className: 'dshgg-commitSubject', title: subject }, subject),
    ),
    h(
      'div',
      { className: 'dshgg-commitMeta' },
      author === '' ? null : h('span', { key: 'author' }, author),
      author === '' ? null : h('span', { key: 'dot', className: 'dshgg-dot' }, '\u00b7'),
      h('span', { key: 'time' }, formatAgo(t, Number(commit.authoredAt) || 0)),
    ),
    body === '' ? null : h('pre', { className: 'dshgg-commitBody' }, body),
    h(
      'div',
      { className: 'dshgg-commitFilesHeader' },
      h('span', { className: 'dshgg-sectionTitle' }, t('commitDetails.files')),
      files.length === 0
        ? null
        : h('span', { className: 'dshgg-sectionCount' }, String(files.length)),
    ),
    props.details !== null && props.details.truncated === true
      ? h(
          'div',
          { className: 'dshgg-commitNote' },
          t('commitDetails.truncated', { n: files.length }),
        )
      : null,
    filesBody,
  )
}
