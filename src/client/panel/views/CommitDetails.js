/**
 * One commit's details inside the Git panel: a back control, the commit
 * metadata, and the flat list of files the commit changed. This view replaces
 * the change list while it is open; the panel returns here with new props for
 * every load, so it only renders.
 */

import { createElement } from 'react'
import { errorText, formatAgo } from '../../git/format.js'
import { ArrowLeftIcon } from '../../icons.js'
import { Banner } from '../feedback.js'
import { IconButton } from '../controls.js'
import { renderFileRows } from '../rows.js'

const h = createElement

/**
 * @param {object} props - commit-details props.
 * @param {Function} props.t - locale binder.
 * @param {object} props.summary - graph row the user activated (`oid`, `shortOid`, ...).
 * @param {object|null} props.details - fetched commit record and file list.
 * @param {boolean} props.loading - file list is loading.
 * @param {object|null} props.failure - failed file-list read.
 * @param {object[]} props.files - sorted changed files with display letters.
 * @param {Function} props.onBack - leave the details view.
 * @param {Function} props.onRetry - retry the failed read.
 * @param {Function} props.onOpenFile - open one changed file's diff.
 * @param {Function|null} props.menuTrigger - host trigger binding.
 * @param {Function} props.rowTarget - build a file-row menu target.
 * @returns {object} the commit-details element.
 */
export function CommitDetails(props) {
  const t = props.t
  const summary = props.summary ?? {}
  const commit = props.details?.commit ?? summary
  const subject = typeof commit.subject === 'string' && commit.subject !== '' ? commit.subject : t('graph.noSubject')
  const author = typeof commit.author === 'string' ? commit.author : ''
  const body = typeof commit.body === 'string' ? commit.body : ''
  const hasDetails = props.details !== null && props.details !== undefined
  const files = props.files

  let filesBody
  if (props.loading === true && !hasDetails) {
    filesBody = h('div', { key: 'loading', className: 'dshgg-commitNote' }, t('commitDetails.loading'))
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

  return h('div', { className: 'dshgg-commitView', 'data-commit': commit.oid ?? '' },
    h('div', { className: 'dshgg-commitToolbar' },
      h(IconButton, {
        label: t('commitDetails.back'),
        title: t('commitDetails.back'),
        onClick: props.onBack,
      }, h(ArrowLeftIcon, { size: 14 })),
      h('span', { className: 'dshgg-commitHash', title: typeof commit.oid === 'string' ? commit.oid : '' }, typeof commit.shortOid === 'string' ? commit.shortOid : ''),
      h('span', { className: 'dshgg-commitSubject', title: subject }, subject)),
    h('div', { className: 'dshgg-commitMeta' },
      author === '' ? null : h('span', { key: 'author' }, author),
      author === '' ? null : h('span', { key: 'dot', className: 'dshgg-dot' }, '\u00b7'),
      h('span', { key: 'time' }, formatAgo(t, Number(commit.authoredAt) || 0))),
    body === '' ? null : h('pre', { className: 'dshgg-commitBody' }, body),
    h('div', { className: 'dshgg-commitFilesHeader' },
      h('span', { className: 'dshgg-sectionTitle' }, t('commitDetails.files')),
      files.length === 0 ? null : h('span', { className: 'dshgg-sectionCount' }, String(files.length))),
    hasDetails && props.details.truncated === true
      ? h('div', { className: 'dshgg-commitNote' }, t('commitDetails.truncated', { n: files.length }))
      : null,
    filesBody)
}
