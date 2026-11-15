/**
 * Describe the commands available for one menu target; the overlay renders them and the panel runs them.
 */

import { panelCommands } from './bus.js'
import { absolutePath, copyAndReport } from './clipboard.js'

export function menuAction(id, label, run, extra = {}) {
  return { id, label, run, ...extra }
}

/**
 * Resolve the actions for one captured context-menu target.
 * @param value - the captured target value: the row data the trigger was
 *   bound with, as the shared registry hands it to a contribution.
 * @param t - locale binder.
 * @param notify - host toast for clipboard feedback.
 * @returns ordered actions for the shared overlay.
 */
export function resolveMenuActions(value, t, notify) {
  if (value === null || value === undefined || typeof value !== 'object') return []
  const sessionId = value.sessionId
  if (typeof sessionId !== 'string' || sessionId === '') return []
  const command = (payload) => () => panelCommands.emit({ sessionId, panelId: value.panelId, ...payload })
  const copy = (text, successKey) => () => copyAndReport(t, notify, text, successKey)
  const blocked = value.busy === true ? { disabled: true } : {}

  if (value.kind === 'file') {
    const path = value.path
    if (typeof path !== 'string' || path === '') return []
    const section = value.section === 'staged' || value.section === 'merge' ? value.section : 'changes'
    const actions = [menuAction('open', t('menu.openDiff'), command({ type: 'open', section, path }), blocked)]
    if (section === 'staged') {
      actions.push(menuAction('unstage', t('actions.unstage'), command({ type: 'unstage', paths: [path] }), { separatorBefore: true, ...blocked }))
    } else {
      actions.push(menuAction('stage', t('actions.stage'), command({ type: 'stage', paths: [path] }), { separatorBefore: true, ...blocked }))
      if (section !== 'merge') actions.push(menuAction('discard', t('actions.discard'), command({ type: 'discard', paths: [path], single: true }), { danger: true, ...blocked }))
    }
    actions.push(menuAction('copy-relative', t('menu.copyRelativePath'), copy(path, 'menu.copiedRelativePath'), { separatorBefore: true }))
    if (typeof value.cwd === 'string' && value.cwd !== '') {
      actions.push(menuAction('copy-path', t('menu.copyPath'), copy(absolutePath(value.cwd, path), 'menu.copiedPath')))
    }
    return actions
  }

  if (value.kind === 'folder') {
    const folder = value.path
    const paths = Array.isArray(value.paths) ? value.paths.filter((entry) => typeof entry === 'string' && entry !== '') : []
    if (typeof folder !== 'string' || folder === '' || paths.length === 0) return []
    const section = value.section === 'staged' || value.section === 'merge' ? value.section : 'changes'
    const actions = []
    if (section === 'staged') {
      actions.push(menuAction('unstage-all', t('actions.unstage'), command({ type: 'unstage', paths }), blocked))
    } else {
      actions.push(menuAction('stage-all', t('actions.stage'), command({ type: 'stage', paths }), blocked))
      if (section !== 'merge') actions.push(menuAction('discard-all', t('actions.discard'), command({ type: 'discard', paths }), { danger: true, ...blocked }))
    }
    actions.push(menuAction('copy-relative', t('menu.copyRelativePath'), copy(folder, 'menu.copiedRelativePath'), { separatorBefore: true }))
    if (typeof value.cwd === 'string' && value.cwd !== '') {
      actions.push(menuAction('copy-path', t('menu.copyPath'), copy(absolutePath(value.cwd, folder), 'menu.copiedPath')))
    }
    return actions
  }

  if (value.kind === 'section') {
    const section = value.section
    if (section === 'changes') {
      return [
        menuAction('stage-all', t('actions.stageAll'), command({ type: 'stageSection', section }), blocked),
        menuAction('discard-all', t('actions.discardAll'), command({ type: 'discardSection', section }), { danger: true, ...blocked }),
        menuAction('refresh', t('refresh'), command({ type: 'refresh' }), { separatorBefore: true, ...blocked }),
      ]
    }
    if (section === 'staged') {
      return [
        menuAction('unstage-all', t('actions.unstageAll'), command({ type: 'unstageSection', section }), blocked),
        menuAction('refresh', t('refresh'), command({ type: 'refresh' }), { separatorBefore: true, ...blocked }),
      ]
    }
    if (section === 'merge') {
      return [menuAction('stage-all', t('actions.stageAll'), command({ type: 'stageSection', section }), blocked)]
    }
    if (section === 'graph') {
      return [menuAction('refresh', t('menu.refreshHistory'), command({ type: 'refresh' }), blocked)]
    }
    return []
  }

  if (value.kind === 'commit') {
    const actions = []
    if (typeof value.oid === 'string' && value.oid !== '') {
      actions.push(menuAction('copy-id', t('menu.copyCommitId'), copy(value.oid, 'menu.copiedCommitId')))
    }
    if (typeof value.subject === 'string' && value.subject !== '') {
      actions.push(menuAction('copy-message', t('menu.copyCommitSubject'), copy(value.subject, 'menu.copiedCommitSubject')))
    }
    return actions
  }

  if (value.kind === 'diff') {
    const path = value.path
    if (typeof path !== 'string' || path === '') return []
    const actions = [menuAction('copy-relative', t('menu.copyRelativePath'), copy(path, 'menu.copiedRelativePath'))]
    if (typeof value.cwd === 'string' && value.cwd !== '') {
      actions.push(menuAction('copy-path', t('menu.copyPath'), copy(absolutePath(value.cwd, path), 'menu.copiedPath')))
    }
    return actions
  }

  return []
}
