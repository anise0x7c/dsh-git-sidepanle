/**
 * Commit-row mutations and their name/deletion dialogs. Menu commands only
 * choose an operation; every Git write uses the same busy and refresh wrapper as
 * the change actions, and dialog text and focus survive a failed operation.
 */

import { useRef, useState } from 'react'
import type { RpcCall } from '../../types/domain.ts'
import type { LocaleBinder } from '../../types/dsh.ts'
import type { PanelRefs } from '../menu.ts'
import type { Perform } from './useChangeActions.ts'

/** Open dialog for a graph operation, with editable fields where applicable. */
export type CommitMenuDialog =
  | { readonly kind: 'createBranch'; readonly oid: string; readonly name: string }
  | {
      readonly kind: 'createTag'
      readonly oid: string
      readonly name: string
      readonly message: string
    }
  | { readonly kind: 'deleteBranch'; readonly branch: string }

/** A commit row that can regain focus after its dialog closes. */
export interface CommitMenuInvoker {
  /** Bring the originating row back into the keyboard order. */
  focus(): void
  /** Detached rows cannot be focused after a graph refresh. */
  readonly isConnected?: boolean
}

/** Inputs of {@link useCommitMenuActions}. */
export interface UseCommitMenuActionsOptions {
  /** Panel RPC caller. */
  readonly call: RpcCall
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Shared panel refs. */
  readonly refs: PanelRefs
  /** Busy-locked action wrapper. */
  readonly perform: Perform
  /** Invalidate the lazy branch list after a successful reference change. */
  readonly onReferencesChanged: () => void
}

/** Commit actions and the current dialog's state. */
export interface CommitMenuActionsState {
  /** Open dialog, or null while only the graph is shown. */
  readonly dialog: CommitMenuDialog | null
  /** Remember the row that opened its native context menu. */
  readonly rememberTrigger: (element: CommitMenuInvoker) => void
  /** Check out a full commit id with detached HEAD. */
  readonly checkoutDetached: (oid: string) => void
  /** Ask for a new branch name at this commit. */
  readonly createBranch: (oid: string) => void
  /** Ask for a new tag name and optional annotation at this commit. */
  readonly createTag: (oid: string) => void
  /** Ask before deleting a non-current local branch. */
  readonly deleteBranch: (branch: string) => void
  /** Edit the branch or tag name. */
  readonly setName: (name: string) => void
  /** Edit the optional tag annotation. */
  readonly setMessage: (message: string) => void
  /** Cancel without Git; replacements can skip restoring the previous row. */
  readonly closeDialog: (restoreFocus?: boolean) => void
  /** Submit the validated dialog through the busy-locked action wrapper. */
  readonly submitDialog: () => void
}

/**
 * Own graph mutations and their dialog state. Branch creation checks out the
 * new branch; an empty tag message makes a lightweight tag, otherwise an
 * annotated one. Deletes use Git's safe, non-forced branch deletion.
 * @param options - RPC, shared wrappers and lazy-list invalidation.
 * @returns command entry points and dialog state.
 */
export function useCommitMenuActions(options: UseCommitMenuActionsOptions): CommitMenuActionsState {
  const { call, t, refs, perform, onReferencesChanged } = options
  const [dialog, setDialog] = useState<CommitMenuDialog | null>(null)
  const invoker = useRef<CommitMenuInvoker | null>(null)

  const rememberTrigger = (element: CommitMenuInvoker): void => {
    invoker.current = element
  }

  const openDialog = (next: CommitMenuDialog): void => {
    if (invoker.current === null && typeof document !== 'undefined') {
      const active = document.activeElement
      if (active instanceof HTMLElement) invoker.current = active
    }
    setDialog(next)
  }

  const restoreTriggerFocus = (): void => {
    const element = invoker.current
    invoker.current = null
    if (element === null) return
    queueMicrotask(() => {
      if (refs.mounted.current && element.isConnected !== false) element.focus()
    })
  }

  const closeDialog = (restoreFocus = true): void => {
    setDialog(null)
    if (restoreFocus) restoreTriggerFocus()
    else invoker.current = null
  }

  const finishDialog = (): void => {
    setDialog(null)
    restoreTriggerFocus()
    onReferencesChanged()
  }

  const checkoutDetached = (oid: string): void => {
    void perform('checkout', () => call('checkout-detached', { oid }), {
      graph: true,
      notice: t('menu.detached'),
      after: onReferencesChanged,
    })
  }

  const createBranch = (oid: string): void => {
    openDialog({ kind: 'createBranch', oid, name: '' })
  }

  const createTag = (oid: string): void => {
    openDialog({ kind: 'createTag', oid, name: '', message: '' })
  }

  const deleteBranch = (branch: string): void => {
    openDialog({ kind: 'deleteBranch', branch })
  }

  const setName = (name: string): void => {
    setDialog((current) =>
      current === null || current.kind === 'deleteBranch' ? current : { ...current, name },
    )
  }

  const setMessage = (message: string): void => {
    setDialog((current) => (current?.kind === 'createTag' ? { ...current, message } : current))
  }

  const submitDialog = (): void => {
    if (dialog === null || refs.busy.current !== null) return
    if (dialog.kind === 'deleteBranch') {
      const branch = dialog.branch
      void perform('deleteBranch', () => call('delete-branch', { branch }), {
        graph: true,
        notice: t('menu.branchDeleted', { name: branch }),
        after: finishDialog,
      })
      return
    }
    const name = dialog.name.trim()
    if (name === '') return
    if (dialog.kind === 'createBranch') {
      const oid = dialog.oid
      void perform('createBranch', () => call('create-branch', { oid, name }), {
        graph: true,
        notice: t('menu.branchCreated', { name }),
        after: finishDialog,
      })
      return
    }
    const oid = dialog.oid
    const message = dialog.message.trim()
    void perform('createTag', () => call('create-tag', { oid, name, message }), {
      graph: true,
      notice: t('menu.tagCreated', { name }),
      after: finishDialog,
    })
  }

  return {
    dialog,
    rememberTrigger,
    checkoutDetached,
    createBranch,
    createTag,
    deleteBranch,
    setName,
    setMessage,
    closeDialog,
    submitDialog,
  }
}
