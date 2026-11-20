/**
 * Change actions: the single-busy-lock wrapper, stage/unstage/discard/commit,
 * the commit message, host Toast feedback, action failures, and the confirmation
 * dialog that guards discards and "commit everything".
 */

import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useState } from 'react'
import { makeFailure, toFailure } from '../../data/caller.ts'
import type { ChangeEntry, CommitResult, Failure, OkResult, RpcCall } from '../../types/domain.ts'
import type { ContextMenusService, LocaleBinder } from '../../types/dsh.ts'
import type { CommitMode } from '../commit-mode.ts'
import type { ConfirmState } from '../confirm.ts'
import type { PanelRefs } from '../menu.ts'

/** Options of one busy-locked action. */
export interface PerformOptions<Result> {
  /** Success Toast shown after the action resolves. */
  readonly notice?: string
  /** Also refresh the commit graph. */
  readonly graph?: boolean
  /** Refresh the status silently after a failure, so partial writes stay visible. */
  readonly refreshOnFailure?: boolean
  /** Extra work after the action resolves, before the status refresh. */
  readonly after?: (result: Result) => void | Promise<void>
}

/**
 * Run one Host write while holding the panel's single busy lock.
 * @param name - operation name shown while the action runs.
 * @param operation - Host write.
 * @param options - toast, graph refresh and follow-up work.
 * @returns the operation value, or undefined when it failed or was locked.
 */
export type Perform = <Result>(
  name: string,
  operation: () => Promise<Result>,
  options?: PerformOptions<Result>,
) => Promise<Result | undefined>

/** Inputs of {@link useChangeActions}. */
export interface UseChangeActionsOptions {
  /** Panel RPC caller. */
  readonly call: RpcCall
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Shared panel refs. */
  readonly refs: PanelRefs
  /** All changed files from the status. */
  readonly files: readonly ChangeEntry[]
  /** Staged files from the status. */
  readonly stagedFiles: readonly ChangeEntry[]
  /** Silent status refresh. */
  readonly loadStatus: (options?: { readonly silent?: boolean }) => Promise<void>
  /** Graph refresh. */
  readonly loadGraph: () => Promise<void>
  /** Host Toast callback, a no-op when the service is unavailable. */
  readonly notify: ContextMenusService['notify']
}

/** Action state and handlers. */
export interface ChangeActionsState {
  /** Failed action. */
  readonly actionFailure: Failure | null
  /** Clear the failed action. */
  readonly setActionFailure: Dispatch<SetStateAction<Failure | null>>
  /** Active action name, or null. */
  readonly busy: string | null
  /** Commit message. */
  readonly message: string
  /** Update the commit message. */
  readonly setMessage: Dispatch<SetStateAction<string>>
  /** Open confirmation dialog. */
  readonly confirm: ConfirmState | null
  /** Set or clear the confirmation dialog. */
  readonly setConfirm: Dispatch<SetStateAction<ConfirmState | null>>
  /** Busy-locked action wrapper. */
  readonly perform: Perform
  /** Stage entries. */
  readonly stage: (entries: readonly ChangeEntry[]) => Promise<OkResult | undefined>
  /** Unstage entries. */
  readonly unstage: (entries: readonly ChangeEntry[]) => Promise<OkResult | undefined>
  /** Add one working-change path to the repository-root ignore file. */
  readonly ignore: (path: string, untracked?: boolean) => Promise<OkResult | undefined>
  /** Commit the typed message in the requested mode; defaults to a plain commit. */
  readonly requestCommit: (mode?: CommitMode) => void
  /** Run the open confirmation. */
  readonly confirmAction: () => void
}

/**
 * Own the panel's mutating actions. Every action runs through `perform` so only
 * one Host write is in flight, the status is refreshed silently afterwards, and
 * failures surface as a dismissible banner.
 * @param options - hook inputs.
 * @returns action state and handlers.
 */
export function useChangeActions(options: UseChangeActionsOptions): ChangeActionsState {
  const { call, t, refs, files, stagedFiles, loadStatus, loadGraph, notify } = options
  const [actionFailure, setActionFailure] = useState<Failure | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  refs.busy.current = busy
  refs.confirm.current = confirm

  const perform = useCallback<Perform>(
    async (name, operation, actionOptions = {}) => {
      if (refs.busy.current !== null) return undefined
      refs.busy.current = name
      setBusy(name)
      setActionFailure(null)
      try {
        const result = await operation()
        if (!refs.mounted.current) return result
        if (actionOptions.notice !== undefined) {
          notify(actionOptions.notice, true)
        }
        if (actionOptions.after !== undefined) await actionOptions.after(result)
        await loadStatus({ silent: true })
        if (actionOptions.graph === true) await loadGraph()
        return result
      } catch (error) {
        if (refs.mounted.current) {
          setActionFailure(toFailure(error))
          if (actionOptions.refreshOnFailure === true) await loadStatus({ silent: true })
        }
        return undefined
      } finally {
        refs.busy.current = null
        if (refs.mounted.current) setBusy(null)
      }
    },
    [refs, loadStatus, loadGraph, notify],
  )

  const stage = (entries: readonly ChangeEntry[]): Promise<OkResult | undefined> =>
    perform('stage', () => call('stage', { paths: entries.map((entry) => entry.path) }))
  const unstage = (entries: readonly ChangeEntry[]): Promise<OkResult | undefined> =>
    perform('unstage', () => call('unstage', { paths: entries.map((entry) => entry.path) }))
  const ignore = (path: string, untracked = false): Promise<OkResult | undefined> =>
    perform('ignore', () => call('ignore', { path }), {
      notice: t(untracked ? 'menu.ignored' : 'menu.ignoredTracked', { path }),
    })

  // One commit write followed by the optional remote step. The remote call runs
  // inside `after`, so a failed push never rethrows: the commit already
  // happened and `perform` must still refresh the status and the graph.
  const runCommit = (mode: CommitMode, stageAll: boolean): void => {
    const amend = mode === 'amend'
    void perform(
      mode,
      () =>
        call('commit', {
          message,
          ...(stageAll ? { stageAll: true } : {}),
          ...(amend ? { amend: true } : {}),
        }),
      {
        graph: true,
        after: async (result: CommitResult) => {
          setMessage('')
          notify(t('commit.done', { hash: result.commit ?? '' }), true)
          if (mode === 'commit-push' || mode === 'commit-sync') {
            try {
              await call(mode === 'commit-push' ? 'push' : 'sync')
              notify(t(mode === 'commit-push' ? 'remote.pushDone' : 'remote.syncDone'), true)
            } catch (error) {
              if (refs.mounted.current) setActionFailure(toFailure(error))
            }
          }
        },
      },
    )
  }

  const requestCommit = (mode: CommitMode = 'commit'): void => {
    if (message.trim() === '' || refs.busy.current !== null) return
    if (mode !== 'amend' && stagedFiles.length === 0) {
      if (files.length === 0) {
        setActionFailure(makeFailure('nothing-staged', t('commit.nothing')))
        return
      }
      setConfirm({ kind: 'commitAll', mode })
      return
    }
    runCommit(mode, false)
  }

  const confirmAction = (): void => {
    const current = refs.confirm.current
    if (current === null) return
    setConfirm(null)
    if (current.kind === 'commitAll') {
      runCommit(current.mode, true)
      return
    }
    if (current.kind === 'discard') {
      void perform('discard', () =>
        call('discard', { path: current.entry.path, untracked: current.entry.untracked === true }),
      )
      return
    }
    if (current.kind === 'discardAll') {
      const entries = current.entries
      void perform('discard', async () => {
        for (const entry of entries)
          await call('discard', { path: entry.path, untracked: entry.untracked === true })
      })
    }
  }

  return {
    actionFailure,
    setActionFailure,
    busy,
    message,
    setMessage,
    confirm,
    setConfirm,
    perform,
    stage,
    unstage,
    ignore,
    requestCommit,
    confirmAction,
  }
}
