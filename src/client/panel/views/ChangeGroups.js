/**
 * The three change groups — merge conflicts, staged files, unstaged changes —
 * with their folder trees and section actions, plus the clean-workspace mark.
 */

import { Fragment, createElement } from 'react'
import { CheckCircleIcon, MinusIcon, PlusIcon, UndoIcon } from '../../icons.js'
import { renderTree } from '../rows.js'
import { IconButton } from '../controls.js'
import { Section } from '../Section.js'

const h = createElement

/**
 * @param {object} props - change-group props.
 * @param {Function} props.t - locale binder.
 * @param {boolean} props.clean - repository exists and has no changes.
 * @param {object[]} props.mergeFiles - conflicted files.
 * @param {object[]} props.stagedFiles - staged files.
 * @param {object[]} props.changedFiles - unstaged files.
 * @param {object} props.treeCache - prebuilt trees per group.
 * @param {object} props.openSections - open state per section id.
 * @param {object} props.collapsed - collapsed folder paths.
 * @param {boolean} props.busy - an action is running.
 * @param {boolean} props.canAct - the repository exists and no action is running.
 * @param {Function} props.onToggleSection - toggle a section.
 * @param {Function} props.onToggleFolder - toggle a folder.
 * @param {Function} props.onStage - stage file entries.
 * @param {Function} props.onUnstage - unstage file entries.
 * @param {Function} props.onOpenDiff - open the diff tab for an entry/mode.
 * @param {Function} props.onDiscard - ask to discard one entry.
 * @param {Function} props.onDiscardAll - ask to discard the changed group.
 * @param {Function|null} props.menuTrigger - host trigger binding.
 * @param {Function} props.sectionTarget - build a group-header menu target.
 * @param {Function} props.treeTarget - build a folder/file menu target.
 * @returns {object} the three groups plus the clean mark, as one fragment.
 */
export function ChangeGroups(props) {
  const t = props.t
  const sectionActions = {
    merge: null,
    staged: props.stagedFiles.length === 0 ? null : h(IconButton, {
      label: t('actions.unstageAll'),
      title: t('actions.unstageAll'),
      disabled: !props.canAct,
      onClick: () => { void props.onUnstage(props.stagedFiles) },
    }, h(MinusIcon, { size: 14 })),
    changes: props.changedFiles.length === 0 ? null : [
      h(IconButton, {
        key: 'stage-all',
        label: t('actions.stageAll'),
        title: t('actions.stageAll'),
        disabled: !props.canAct,
        onClick: () => { void props.onStage(props.changedFiles) },
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
  const treeContext = {
    collapsed: props.collapsed,
    t,
    busy: props.busy,
    onToggleFolder: props.onToggleFolder,
    onOpen: (entry) => props.onOpenDiff(entry, 'changes'),
    onStage: (entry) => { void props.onStage([entry]) },
    onUnstage: (entry) => { void props.onUnstage([entry]) },
    onDiscard: (entry) => props.onDiscard(entry),
    menuTrigger: props.menuTrigger,
    menuTarget: props.treeTarget,
    menuHint: t('menu.hint'),
    mode: 'changes',
  }
  return h(Fragment, null,
    props.mergeFiles.length === 0 ? null : h(Section, {
      id: 'merge', title: t('sections.merge'), count: props.mergeFiles.length,
      open: props.openSections.merge === true, onToggle: () => props.onToggleSection('merge'), actions: sectionActions.merge,
      menuTrigger: props.menuTrigger, menuHint: t('menu.hint'), menuTarget: props.sectionTarget('merge'),
    }, renderTree(props.treeCache.merge, 0, { ...treeContext, mode: 'merge', onOpen: (entry) => props.onOpenDiff(entry, 'changes') })),
    props.stagedFiles.length === 0 ? null : h(Section, {
      id: 'staged', title: t('sections.staged'), count: props.stagedFiles.length,
      open: props.openSections.staged === true, onToggle: () => props.onToggleSection('staged'), actions: sectionActions.staged,
      menuTrigger: props.menuTrigger, menuHint: t('menu.hint'), menuTarget: props.sectionTarget('staged'),
    }, renderTree(props.treeCache.staged, 0, {
      ...treeContext,
      mode: 'staged',
      onOpen: (entry) => props.onOpenDiff(entry, 'staged'),
      onStage: (entry) => { void props.onStage([entry]) },
      onUnstage: (entry) => { void props.onUnstage([entry]) },
    })),
    props.changedFiles.length === 0 ? null : h(Section, {
      id: 'changes', title: t('sections.changes'), count: props.changedFiles.length,
      open: props.openSections.changes === true, onToggle: () => props.onToggleSection('changes'), actions: sectionActions.changes,
      menuTrigger: props.menuTrigger, menuHint: t('menu.hint'), menuTarget: props.sectionTarget('changes'),
    }, renderTree(props.treeCache.changes, 0, { ...treeContext, onOpen: (entry) => props.onOpenDiff(entry, 'changes') })),
    props.clean ? h('div', { className: 'dshgg-clean' },
      h('span', { className: 'dshgg-cleanIcon' }, h(CheckCircleIcon, { size: 26 })),
      h('span', { className: 'dshgg-cleanTitle' }, t('clean.title')),
      h('span', { className: 'dshgg-cleanDesc' }, t('clean.desc'))) : null)
}
