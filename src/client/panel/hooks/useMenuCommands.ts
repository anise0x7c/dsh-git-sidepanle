/**
 * Menu commands emitted by the host overlay: the shared command-bus
 * subscription, the per-panel ownership guards, the stale/busy notices and the
 * dispatch into the same change actions the inline controls use.
 */

import type { MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'
import { isStaged, isUnstaged } from '../../git/format.ts'
import type { PanelCommand } from '../../menu/bus.ts'
import { panelCommands } from '../../menu/bus.ts'
import type { ChangeEntry, RepositoryStatus } from '../../types/domain.ts'
import type { LocaleBinder } from '../../types/dsh.ts'
import type { ConfirmState } from '../confirm.ts'

/** Command options the panel refreshes at the end of every render. */
export interface MenuCommandOptions {
  /** Session the panel is bound to. */
  readonly sessionId: string
  /** Per-panel id used to keep commands addressed to this panel. */
  readonly panelId: string
  /** Repository summary, or null outside a repository. */
  readonly repo: RepositoryStatus | null
  /** Current busy operation name. */
  readonly busyRef: MutableRefObject<string | null>
  /** Locale binder. */
  readonly t: LocaleBinder
  /** All changed files. */
  readonly files: readonly ChangeEntry[]
  /** Staged files. */
  readonly stagedFiles: readonly ChangeEntry[]
  /** Unstaged files. */
  readonly changedFiles: readonly ChangeEntry[]
  /** Conflicted files. */
  readonly mergeFiles: readonly ChangeEntry[]
  /** Refresh status and history. */
  readonly refreshAll: () => void
  /** Stage entries. */
  readonly stage: (entries: readonly ChangeEntry[]) => Promise<unknown>
  /** Unstage entries. */
  readonly unstage: (entries: readonly ChangeEntry[]) => Promise<unknown>
  /** Open the confirmation dialog. */
  readonly setConfirm: (confirm: ConfirmState | null) => void
  /** Show a transient notice. */
  readonly setNotice: (notice: string | null) => void
  /** Open one file's diff. */
  readonly openDiff: (entry: ChangeEntry, mode: 'staged' | 'changes') => void
}

/**
 * Subscribe this panel to the shared command bus once. The panel fills the
 * returned ref with the current command options at the end of every render, so
 * a command always dispatches against fresh state even though the subscription
 * itself never moves.
 * @returns options ref the panel assigns each render.
 */
export function useMenuCommands(): MutableRefObject<MenuCommandOptions | null> {
  const optionsRef = useRef<MenuCommandOptions | null>(null)
  useEffect(
    () =>
      panelCommands.subscribe((command) => {
        const options = optionsRef.current
        if (options !== null) dispatch(options, command)
      }),
    [],
  )
  return optionsRef
}

/**
 * Execute one menu command. Commands run outside this React tree, so they are
 * checked against the panel that captured the target (Session, then panel id)
 * and dropped when the addressed change has vanished.
 * @param options - command options captured for this render.
 * @param command - command emitted by the overlay.
 */
function dispatch(options: MenuCommandOptions, command: PanelCommand): void {
  const { sessionId, panelId, repo, t, busyRef, files, stagedFiles, changedFiles, mergeFiles } =
    options
  const { refreshAll, stage, unstage, setConfirm, setNotice, openDiff } = options
  if (command === null || typeof command !== 'object') return
  if (typeof command.sessionId === 'string' && command.sessionId !== sessionId) return
  if (typeof command.panelId === 'string' && command.panelId !== panelId) return
  if (repo === null) return
  const paths = Array.isArray(command.paths)
    ? command.paths.filter((path): path is string => typeof path === 'string')
    : []
  const matches = (entry: ChangeEntry): boolean => paths.includes(entry.path)
  const reportStale = (): void => setNotice(t('menu.stale'))
  if (command.type === 'refresh') {
    refreshAll()
    return
  }
  if (busyRef.current !== null) {
    setNotice(t('menu.busy'))
    return
  }
  if (command.type === 'open') {
    const pools: Readonly<Record<string, readonly ChangeEntry[]>> = {
      staged: stagedFiles,
      merge: mergeFiles,
      changes: changedFiles,
    }
    const preferred =
      (command.section === undefined ? undefined : pools[command.section]) ?? changedFiles
    let section: 'staged' | 'changes' = command.section === 'staged' ? 'staged' : 'changes'
    let entry: ChangeEntry | undefined = preferred.find(
      (candidate) => candidate.path === command.path,
    )
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
    const entries =
      command.type === 'stageSection'
        ? command.section === 'merge'
          ? mergeFiles
          : changedFiles
        : files
            .filter((entry) => matches(entry) && entry.conflict === true)
            .concat(files.filter((entry) => matches(entry) && isUnstaged(entry)))
    if (entries.length === 0) {
      reportStale()
      return
    }
    void stage(entries)
    return
  }
  if (command.type === 'unstage' || command.type === 'unstageSection') {
    const entries: readonly ChangeEntry[] =
      command.type === 'unstageSection'
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
    setConfirm(
      command.single === true && entries.length === 1
        ? { kind: 'discard', entry: entries[0] }
        : { kind: 'discardAll', entries },
    )
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
