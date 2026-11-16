/**
 * The three change groups — merge conflicts, staged files, unstaged changes —
 * as flat, path-sorted file lists with their section actions, plus the
 * clean-workspace mark.
 */

import { Fragment, createElement } from 'react'
import { CheckCircleIcon, MinusIcon, PlusIcon, UndoIcon } from '../../icons.js'
import { renderFileRows } from '../rows.js'
import { IconButton } from '../controls.js'
import { Section } from '../Section.js'

const h = createElement

/**
 * @param {object} props - change-group props.
 * @param {Function} props.t - locale binder.
 * @param {boolean} props.clean - repository exists and has no changes.
 * @param {object[]} props.mergeRows - sorted conflicted files with display letters.
 * @param {object[]} props.stagedRows - sorted staged files with display letters.
 * @param {object[]} props.changedRows - sorted unstaged files with display letters.
 * @param {object} props.openSections - open state per section id.
 * @param {boolean} props.busy - an action is running.
 * @param {boolean} props.canAct - the repository exists and no action is running.
 * @param {Function} props.onToggleSection - toggle a section.
 * @param {Function} props.onStage - stage file entries.
 * @param {Function} props.onUnstage - unstage file entries.
 * @param {Function} props.onOpenDiff - open the diff tab for an entry/mode.
 * @param {Function} props.onDiscard - ask to discard one entry.
 * @param {Function} props.onDiscardAll - ask to discard the changed group.
 * @param {Function|null} props.menuTrigger - host trigger binding.
 * @param {Function} props.sectionTarget - build a group-header menu target.
 * @param {Function} props.rowTarget - build a file-row menu target.
 * @returns {object} the three groups plus the clean mark, as one fragment.
 */
export function ChangeGroups(props) {
  const t = props.t
  const sectionActions = {
    merge: null,
    staged: props.stagedRows.length === 0 ? null : h(IconButton, {
      label: t('actions.unstageAll'),
      title: t('actions.unstageAll'),
      disabled: !props.canAct,
      onClick: () => { void props.onUnstage(props.stagedRows) },
    }, h(MinusIcon, { size: 14 })),
    changes: props.changedRows.length === 0 ? null : [
      h(IconButton, {
        key: 'stage-all',
        label: t('actions.stageAll'),
        title: t('actions.stageAll'),
        disabled: !props.canAct,
        onClick: () => { void props.onStage(props.changedRows) },
      }, h(PlusIcon, { size: 14 })),
      h(IconButton, {
        key: 'discard-all',
        label: t('actions.discardAll'),
        title: t('actions.discardAll'),
        disabled: !props.canAct,
        onClick: () => props.onDiscardAll(),
      }, h(UndoIcon, { size: 14 })),
    ],
  }
  /**
   * Render one group's flat file list with its per-row actions and menu target.
   * @param {string} mode - group id (`merge`, `staged`, `changes`).
   * @param {object[]} rows - the group's sorted rows.
   * @returns {object[]} file-row elements.
   */
  const rowsFor = (mode, rows) => renderFileRows(rows, {
    t,
    busy: props.busy,
    mode,
    onOpen: (entry) => props.onOpenDiff(entry, mode === 'staged' ? 'staged' : 'changes'),
    onStage: (entry) => { void props.onStage([entry]) },
    onUnstage: (entry) => { void props.onUnstage([entry]) },
    onDiscard: (entry) => props.onDiscard(entry),
    menuTrigger: props.menuTrigger,
    menuTarget: (entry) => props.rowTarget('file', { section: mode, path: entry.path }),
  })
  return h(Fragment, null,
    props.mergeRows.length === 0 ? null : h(Section, {
      id: 'merge', title: t('sections.merge'), count: props.mergeRows.length,
      open: props.openSections.merge === true, onToggle: () => props.onToggleSection('merge'), actions: sectionActions.merge,
      menuTrigger: props.menuTrigger, menuHint: t('menu.hint'), menuTarget: props.sectionTarget('merge'),
    }, rowsFor('merge', props.mergeRows)),
    props.stagedRows.length === 0 ? null : h(Section, {
      id: 'staged', title: t('sections.staged'), count: props.stagedRows.length,
      open: props.openSections.staged === true, onToggle: () => props.onToggleSection('staged'), actions: sectionActions.staged,
      menuTrigger: props.menuTrigger, menuHint: t('menu.hint'), menuTarget: props.sectionTarget('staged'),
    }, rowsFor('staged', props.stagedRows)),
    props.changedRows.length === 0 ? null : h(Section, {
      id: 'changes', title: t('sections.changes'), count: props.changedRows.length,
      open: props.openSections.changes === true, onToggle: () => props.onToggleSection('changes'), actions: sectionActions.changes,
      menuTrigger: props.menuTrigger, menuHint: t('menu.hint'), menuTarget: props.sectionTarget('changes'),
    }, rowsFor('changes', props.changedRows)),
    props.clean ? h('div', { className: 'dshgg-clean' },
      h('span', { className: 'dshgg-cleanIcon' }, h(CheckCircleIcon, { size: 26 })),
      h('span', { className: 'dshgg-cleanTitle' }, t('clean.title')),
      h('span', { className: 'dshgg-cleanDesc' }, t('clean.desc'))) : null)
}
