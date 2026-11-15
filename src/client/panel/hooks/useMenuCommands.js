/**
 * Menu commands emitted by the host overlay: the shared command-bus
 * subscription, the per-panel ownership guards, the stale/busy notices and the
 * dispatch into the same change actions the inline controls use.
 */

import { useEffect, useRef } from 'react'
import { isStaged, isUnstaged } from '../../git/format.js'
import { panelCommands } from '../../menu/bus.js'

/**
 * Subscribe this panel to the shared command bus once. The panel fills the
 * returned ref with the current command options at the end of every render, so
 * a command always dispatches against fresh state even though the subscription
 * itself never moves.
 * @returns {{current: object|null}} options ref the panel assigns each render.
 */
export function useMenuCommands() {
  const optionsRef = useRef(null)
  useEffect(() => panelCommands.subscribe((command) => {
    const options = optionsRef.current
    if (options !== null) dispatch(options, command)
  }), [])
  return optionsRef
}

/**
 * Execute one menu command. Commands run outside this React tree, so they are
 * checked against the panel that captured the target (Session, then panel id)
 * and dropped when the addressed change has vanished.
 * @param {object} options - command options captured for this render.
 * @param {object} command - command emitted by the overlay.
 */
function dispatch(options, command) {
  const { sessionId, panelId, repo, t, busyRef, files, stagedFiles, changedFiles, mergeFiles } = options
  const { refreshAll, stage, unstage, setConfirm, setNotice, openDiff } = options
  if (command === null || typeof command !== 'object') return
  if (typeof command.sessionId === 'string' && command.sessionId !== sessionId) return
  if (typeof command.panelId === 'string' && command.panelId !== panelId) return
  if (repo === null) return
  const paths = Array.isArray(command.paths) ? command.paths.filter((path) => typeof path === 'string') : []
  const matches = (entry) => paths.includes(entry.path)
  const reportStale = () => setNotice(t('menu.stale'))
  if (command.type === 'refresh') {
    refreshAll()
    return
  }
  if (busyRef.current !== null) {
    setNotice(t('menu.busy'))
    return
  }
  if (command.type === 'open') {
    const pools = { staged: stagedFiles, merge: mergeFiles, changes: changedFiles }
    const preferred = pools[command.section] ?? changedFiles
    let section = command.section === 'staged' ? 'staged' : 'changes'
    let entry = preferred.find((candidate) => candidate.path === command.path)
    if (entry === undefined) {
      for (const [candidateSection, pool] of Object.entries(pools)) {
        entry = pool.find((candidate) => candidate.path === command.path)
        if (entry !== undefined) {
          section = candidateSection === 'staged' ? 'staged' : 'changes'
          break
        }
      }
    }
    if (entry === undefined) {
      reportStale()
      return
    }
    openDiff(entry, section)
    return
  }
  if (command.type === 'stage' || command.type === 'stageSection') {
    const entries = command.type === 'stageSection'
      ? command.section === 'merge' ? mergeFiles : changedFiles
      : files.filter((entry) => matches(entry) && entry.conflict === true)
        .concat(files.filter((entry) => matches(entry) && isUnstaged(entry)))
    if (entries.length === 0) {
      reportStale()
      return
    }
    void stage(entries)
    return
  }
  if (command.type === 'unstage' || command.type === 'unstageSection') {
    const entries = command.type === 'unstageSection'
      ? stagedFiles
      : files.filter((entry) => matches(entry) && isStaged(entry))
    if (entries.length === 0) {
      reportStale()
      return
    }
    void unstage(entries)
    return
  }
  if (command.type === 'discard') {
    const entries = changedFiles.filter(matches)
    if (entries.length === 0) {
      reportStale()
      return
    }
    setConfirm(command.single === true && entries.length === 1
      ? { kind: 'discard', entry: entries[0] }
      : { kind: 'discardAll', entries })
    return
  }
  if (command.type === 'discardSection') {
    if (changedFiles.length === 0) {
      reportStale()
      return
    }
    setConfirm({ kind: 'discardAll', entries: changedFiles })
  }
}
