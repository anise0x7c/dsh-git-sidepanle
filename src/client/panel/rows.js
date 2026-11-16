/**
 * One changed-file row and the flat-list renderer shared by the change groups
 * and the commit-details view.
 */

import { createElement } from 'react'
import { splitPath, statusKey } from '../git/format.js'
import { MinusIcon, PlusIcon, UndoIcon } from '../icons.js'
import { IconButton } from './controls.js'

const h = createElement

/**
 * Render the file name with its parent directory on one line: the name keeps
 * the primary weight, and the dimmed directory keeps two equally named files
 * distinguishable without reintroducing folder rows. The full path stays in
 * the row tooltip and in its accessible label.
 * @param {object} props - file-row props.
 * @returns {object} the row element.
 */
export function FileRow(props) {
  const entry = props.entry
  const letter = props.letter
  const { dir, name } = splitPath(entry.path)
  const actionButtons = []
  if (props.mode === 'commit') {
    // Historical rows have no staging or discarding actions: the commit is
    // already recorded, so the row only opens its diff.
  } else if (props.mode === 'staged') {
    actionButtons.push(h(IconButton, {
      key: 'unstage',
      label: props.t('actions.unstage'),
      title: props.t('actions.unstage'),
      disabled: props.busy === true,
      onClick: (event) => { event.stopPropagation(); props.onUnstage(entry) },
    }, h(MinusIcon, { size: 14 })))
  } else {
    actionButtons.push(h(IconButton, {
      key: 'stage',
      label: props.t('actions.stage'),
      title: props.t('actions.stage'),
      disabled: props.busy === true,
      onClick: (event) => { event.stopPropagation(); props.onStage(entry) },
    }, h(PlusIcon, { size: 14 })))
    if (props.mode !== 'merge' && typeof props.onDiscard === 'function') {
      actionButtons.push(h(IconButton, {
        key: 'discard',
        label: props.t('actions.discard'),
        title: props.t('actions.discard'),
        disabled: props.busy === true,
        onClick: (event) => { event.stopPropagation(); props.onDiscard(entry) },
      }, h(UndoIcon, { size: 14 })))
    }
  }
  const title = entry.origPath === undefined ? entry.path : `${entry.origPath} → ${entry.path}`
  const keyboard = {
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        props.onOpen(entry)
      }
    },
  }
  const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
  const rowProps = menuTrigger === null || props.menuTarget === undefined
    ? keyboard
    : menuTrigger(props.menuTarget, { ...keyboard, 'aria-haspopup': 'menu' })
  return h('div', {
    className: 'dshgg-row dshgg-fileRow',
    role: 'button',
    tabIndex: 0,
    'aria-label': `${props.t(statusKey(letter))} ${entry.path}`,
    title,
    onClick: () => props.onOpen(entry),
    ...rowProps,
  },
  h('span', { className: 'dshgg-status', 'data-status': letter }, letter),
  h('span', { className: 'dshgg-fileName' }, name),
  entry.origPath === undefined ? null : h('span', { className: 'dshgg-fileArrow', title: entry.origPath }, `\u2190 ${splitPath(entry.origPath).name}`),
  dir === '' ? null : h('span', { className: 'dshgg-fileDir', title: entry.path }, dir),
  h('span', { className: 'dshgg-fileActions' }, actionButtons))
}

/**
 * Render one flat list of changed-file rows.
 * @param {object[]} entries - rows in display order, carrying the display `letter` where one applies.
 * @param {object} context - row wiring:
 *   `t` (locale binder), `busy` (action running), `mode` (`merge`, `staged`,
 *   `changes`, or `commit`), `onOpen`, `onStage`, `onUnstage`, `onDiscard`,
 *   `menuTrigger` (host trigger binding or null), and `menuTarget(entry)`.
 * @returns {object[]} one file-row element per entry.
 */
export function renderFileRows(entries, context) {
  return entries.map((entry) => h(FileRow, {
    key: `file:${entry.kind}:${entry.path}:${entry.x}:${entry.y}:${entry.letter ?? ''}`,
    entry,
    letter: entry.letter ?? '',
    t: context.t,
    busy: context.busy,
    mode: context.mode,
    onOpen: context.onOpen,
    onStage: context.onStage,
    onUnstage: context.onUnstage,
    onDiscard: context.onDiscard,
    menuTrigger: context.menuTrigger,
    menuTarget: context.menuTarget === undefined ? undefined : context.menuTarget(entry),
  }))
}
