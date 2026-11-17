/**
 * Menu commands emitted by the host overlay: the shared command-bus
 * subscription, the per-panel ownership guards, the stale/busy host feedback
 * and the dispatch into the same change actions the inline controls use.
 */

import type { MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'
import { isStaged, isUnstaged } from '../../git/format.ts'
import type { PanelCommand } from '../../menu/bus.ts'
import { panelCommands } from '../../menu/bus.ts'
import type { ChangeEntry, RepositoryStatus } from '../../types/domain.ts'
import type { ContextMenusService, LocaleBinder } from '../../types/dsh.ts'
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
  /** Add a repository-relative path to .gitignore. */
  readonly ignore: (path: string, untracked?: boolean) => Promise<unknown>
  /** Check out one local branch head. */
  readonly checkout: (branch: string) => void
  /** Check out a commit without attaching a branch. */
  readonly checkoutDetached: (oid: string) => void
  /** Ask for a new branch name at a commit. */
  readonly createBranch: (oid: string) => void
  /** Ask for a new tag name at a commit. */
  readonly createTag: (oid: string) => void
  /** Open the branch-deletion confirmation. */
  readonly deleteBranch: (branch: string) => void
  /** Open the confirmation dialog. */
  readonly setConfirm: (confirm: ConfirmState | null) => void
  /** Report a stale or busy command through the host's shared feedback. */
  readonly notify: ContextMenusService['notify']
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
  const {
    refreshAll,
    stage,
    unstage,
    ignore,
    checkout,
    checkoutDetached,
    createBranch,
    createTag,
    deleteBranch,
    setConfirm,
    notify,
    openDiff,
  } = options
  if (command === null || typeof command !== 'object') return
  if (typeof command.sessionId === 'string' && command.sessionId !== sessionId) return
  if (typeof command.panelId === 'string' && command.panelId !== panelId) return
  if (repo === null) return
  const paths = Array.isArray(command.paths)
    ? command.paths.filter((path): path is string => typeof path === 'string')
    : []
  const matches = (entry: ChangeEntry): boolean => paths.includes(entry.path)
  const reportStale = (): void => notify(t('menu.stale'), false)
  if (command.type === 'refresh') {
    refreshAll()
    return
  }
  if (busyRef.current !== null) {
    notify(t('menu.busy'), false)
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
  if (command.type === 'ignore') {
    const entry = files.find((candidate) => candidate.path === command.path)
    if (entry === undefined) {
      reportStale()
      return
    }
    void ignore(entry.path, entry.untracked === true)
    return
  }
  if (command.type === 'checkout' && typeof command.branch === 'string' && command.branch !== '') {
    checkout(command.branch)
    return
  }
  if (
    command.type === 'checkoutDetached' &&
    typeof command.oid === 'string' &&
    /^[0-9a-f]{40}$/.test(command.oid)
  ) {
    checkoutDetached(command.oid)
    return
  }
  if (
    (command.type === 'createBranch' || command.type === 'createTag') &&
    typeof command.oid === 'string' &&
    /^[0-9a-f]{40}$/.test(command.oid)
  ) {
    if (command.type === 'createBranch') createBranch(command.oid)
    else createTag(command.oid)
    return
  }
  if (
    command.type === 'deleteBranch' &&
    typeof command.branch === 'string' &&
    command.branch !== ''
  ) {
    deleteBranch(command.branch)
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
