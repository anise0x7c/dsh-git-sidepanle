/**
 * Remote management and synchronization: the toolbar overflow menu, the lazy
 * remote list, the add/remove/publish forms, and the
 * fetch/pull/push/sync/publish actions.
 */

import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { makeFailure, toFailure } from '../../data/caller.ts'
import type {
  Failure,
  OkResult,
  RemoteInfo,
  RemotesResult,
  RepositoryStatus,
  RpcCall,
} from '../../types/domain.ts'
import type { ContextMenusService, LocaleBinder } from '../../types/dsh.ts'
import type { PanelRefs } from '../menu.ts'
import type { Perform } from './useChangeActions.ts'

/** Kinds of remote form the overflow menu can open. */
export type RemoteDialogKind = 'add' | 'remove' | 'publish'

/** Open remote form and the values it is editing. */
export interface RemoteDialogState {
  /** Which form is open. */
  readonly kind: RemoteDialogKind
  /** New remote name for add; the chosen configured remote for remove/publish. */
  readonly name: string
  /** URL typed into the Add Remote form; empty for the other forms. */
  readonly url: string
}

/** Inputs of {@link useRemoteActions}. */
export interface UseRemoteActionsOptions {
  /** Panel RPC caller. */
  readonly call: RpcCall
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Shared panel refs. */
  readonly refs: PanelRefs
  /** Repository summary, or null outside a repository. */
  readonly repo: RepositoryStatus | null
  /** Busy-locked action wrapper. */
  readonly perform: Perform
  /** Host Toast callback, a no-op when the service is unavailable. */
  readonly notify: ContextMenusService['notify']
  /** Record a failure in the panel's inline banner. */
  readonly setActionFailure: Dispatch<SetStateAction<Failure | null>>
  /** Close the other idle prompts before a remote form opens. */
  readonly onOpenDialog?: () => void
}

/** Remote menu, remote list and remote form state and handlers. */
export interface RemoteActionsState {
  /** Whether the overflow menu is open. */
  readonly menuOpen: boolean
  /** Configured remotes, or null before the first successful read. */
  readonly remotes: RemoteInfo[] | null
  /** Whether the remote list is loading. */
  readonly remotesLoading: boolean
  /** Failed remote-list read. */
  readonly remotesFailure: Failure | null
  /** Open add/remove/publish form, or null. */
  readonly dialog: RemoteDialogState | null
  /** Whether the current branch can start a remote operation. */
  readonly canUseBranch: boolean
  /** Whether the current branch tracks an upstream. */
  readonly hasUpstream: boolean
  /** Open or close the overflow menu. */
  readonly toggleMenu: () => void
  /** Close the overflow menu. */
  readonly closeMenu: () => void
  /** Close the open remote form without running Git. */
  readonly closeDialog: () => void
  /** Sync when the branch has an upstream, otherwise start the publish flow. */
  readonly statusAction: () => void
  /** Fetch from every configured remote, even on a detached or unborn HEAD. */
  readonly fetch: () => void
  /** Merge the upstream into the current branch. */
  readonly pull: () => void
  /** Rebase the current branch onto its upstream. */
  readonly pullRebase: () => void
  /** Push the current branch to its upstream. */
  readonly push: () => void
  /** Sync (pull by merging, then push). */
  readonly sync: () => void
  /** Start the publish flow. */
  readonly publish: () => void
  /** Open the Add Remote form. */
  readonly openAddRemote: () => void
  /** Read the remotes, then open the Remove Remote form. */
  readonly openRemoveRemote: () => void
  /** Change the remote name of the open form. */
  readonly setName: (name: string) => void
  /** Change the URL of the open Add Remote form. */
  readonly setUrl: (url: string) => void
  /** Submit the open form. */
  readonly submitDialog: () => void
  /** Read the configured remotes, reusing one in-flight read. */
  readonly loadRemotes: () => Promise<RemoteInfo[] | null>
}

/**
 * Own the remote controls. The menu closes as soon as an action starts, every
 * action runs through the shared busy lock with a graph refresh and a status
 * refresh on failure, and add/remove/publish forms stay open until they succeed.
 * @param options - hook inputs.
 * @returns remote state and handlers.
 */
export function useRemoteActions(options: UseRemoteActionsOptions): RemoteActionsState {
  const { call, t, refs, repo, perform, notify, setActionFailure, onOpenDialog } = options
  const [menuOpen, setMenuOpen] = useState(false)
  const [remotes, setRemotes] = useState<RemoteInfo[] | null>(null)
  const [remotesLoading, setRemotesLoading] = useState(false)
  const [remotesFailure, setRemotesFailure] = useState<Failure | null>(null)
  const [dialog, setDialog] = useState<RemoteDialogState | null>(null)
  const pendingLoad = useRef<Promise<RemoteInfo[] | null> | null>(null)
  const lastFailure = useRef<Failure | null>(null)

  const canUseBranch = repo !== null && repo.detached !== true && repo.unborn !== true
  const hasUpstream = repo?.upstream !== null && repo?.upstream !== undefined

  const loadRemotes = useCallback(async (): Promise<RemoteInfo[] | null> => {
    const active = pendingLoad.current
    if (active !== null) return active
    const task = (async (): Promise<RemoteInfo[] | null> => {
      if (refs.mounted.current) {
        setRemotesLoading(true)
        setRemotesFailure(null)
      }
      lastFailure.current = null
      try {
        const value: RemotesResult = await call('remotes')
        const list = Array.isArray(value.remotes) ? value.remotes : []
        lastFailure.current = null
        if (refs.mounted.current) {
          setRemotes(list)
          setRemotesFailure(null)
        }
        return list
      } catch (error) {
        const raw = toFailure(error)
        const failure: Failure =
          raw.message === undefined ? { code: 'remotes', message: t('remote.loadFailed') } : raw
        lastFailure.current = failure
        if (refs.mounted.current) setRemotesFailure(failure)
        return null
      } finally {
        if (refs.mounted.current) setRemotesLoading(false)
        pendingLoad.current = null
      }
    })()
    pendingLoad.current = task
    return task
  }, [call, refs, t])

  useEffect(() => {
    if (!menuOpen) return undefined
    const onPointerDown = (event: PointerEvent): void => {
      const wrap = refs.remoteWrap.current
      if (
        wrap !== null &&
        typeof Node !== 'undefined' &&
        event.target instanceof Node &&
        wrap.contains(event.target)
      )
        return
      setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [menuOpen, refs])

  const toggleMenu = (): void => {
    const next = !menuOpen
    setMenuOpen(next)
    if (next && remotes === null && remotesFailure === null && !remotesLoading) {
      void loadRemotes()
    }
  }

  const closeMenu = (): void => {
    setMenuOpen(false)
  }

  const closeDialog = (): void => {
    setDialog(null)
  }

  const run = (name: string, operation: () => Promise<OkResult>, notice: string): void => {
    setMenuOpen(false)
    setDialog(null)
    onOpenDialog?.()
    void perform(name, operation, { graph: true, refreshOnFailure: true, notice })
  }

  const runPublish = (remote: string): void => {
    void perform('publish', () => call('publish', { remote }), {
      graph: true,
      refreshOnFailure: true,
      notice: t('remote.publishDone'),
      after: () => {
        setDialog(null)
      },
    })
  }

  const fetch = (): void => {
    // Fetching needs neither a branch nor an upstream, so a detached or unborn
    // HEAD can still update the remote-tracking refs.
    if (repo === null || refs.busy.current !== null) return
    run('fetch', () => call('fetch'), t('remote.fetchDone'))
  }

  const pull = (): void => {
    if (!canUseBranch || !hasUpstream || refs.busy.current !== null) return
    run('pull', () => call('pull', { rebase: false }), t('remote.pullDone'))
  }

  const pullRebase = (): void => {
    if (!canUseBranch || !hasUpstream || refs.busy.current !== null) return
    run('pull', () => call('pull', { rebase: true }), t('remote.pullRebaseDone'))
  }

  const push = (): void => {
    if (!canUseBranch || !hasUpstream || refs.busy.current !== null) return
    run('push', () => call('push'), t('remote.pushDone'))
  }

  const sync = (): void => {
    if (!canUseBranch || !hasUpstream || refs.busy.current !== null) return
    run('sync', () => call('sync'), t('remote.syncDone'))
  }

  const publish = (): void => {
    if (!canUseBranch || refs.busy.current !== null) return
    setMenuOpen(false)
    setDialog(null)
    onOpenDialog?.()
    void (async (): Promise<void> => {
      const list = remotes ?? (await loadRemotes())
      if (!refs.mounted.current) return
      if (list === null) {
        setActionFailure(lastFailure.current ?? makeFailure('remotes', t('remote.loadFailed')))
        return
      }
      const [only] = list
      if (list.length === 0) {
        const failure = makeFailure('no-remotes', t('remote.noRemotes'))
        setActionFailure(failure)
        notify(t('remote.noRemotes'), false)
        return
      }
      if (list.length === 1 && only !== undefined) {
        runPublish(only.name)
        return
      }
      const first = list[0]
      if (first === undefined) return
      const preferred = list.find((remote) => remote.name === 'origin')?.name ?? first.name
      setDialog({ kind: 'publish', name: preferred, url: '' })
    })()
  }

  const openAddRemote = (): void => {
    if (refs.busy.current !== null) return
    setMenuOpen(false)
    onOpenDialog?.()
    setDialog({ kind: 'add', name: '', url: '' })
  }

  const openRemoveRemote = (): void => {
    if (refs.busy.current !== null) return
    setMenuOpen(false)
    onOpenDialog?.()
    void (async (): Promise<void> => {
      // Read the list again: a remote may have been configured elsewhere since
      // the menu opened, and Remove must only offer a configured remote.
      const list = await loadRemotes()
      if (!refs.mounted.current) return
      if (list === null) {
        setActionFailure(lastFailure.current ?? makeFailure('remotes', t('remote.loadFailed')))
        return
      }
      const first = list[0]
      if (first === undefined) {
        setActionFailure(makeFailure('no-remotes', t('remote.noRemotes')))
        notify(t('remote.noRemotes'), false)
        return
      }
      setDialog({ kind: 'remove', name: first.name, url: '' })
    })()
  }

  const setName = (name: string): void => {
    setDialog((current) => (current === null ? current : { ...current, name }))
  }

  const setUrl = (url: string): void => {
    setDialog((current) => (current === null ? current : { ...current, url }))
  }

  const runAddRemote = (name: string, url: string): void => {
    void perform('add-remote', () => call('add-remote', { name, url }), {
      graph: true,
      refreshOnFailure: true,
      notice: t('remote.addDone', { name }),
      after: async () => {
        setDialog(null)
        await loadRemotes()
      },
    })
  }

  const runRemoveRemote = (name: string): void => {
    void perform(
      'remove-remote',
      async (): Promise<OkResult> => {
        try {
          return await call('remove-remote', { name })
        } catch (error) {
          // The form stays open with its values, but the list it offers must
          // match the repository after a refusal.
          await loadRemotes()
          throw error
        }
      },
      {
        graph: true,
        refreshOnFailure: true,
        notice: t('remote.removeDone', { name }),
        after: async () => {
          setDialog(null)
          await loadRemotes()
        },
      },
    )
  }

  const submitDialog = (): void => {
    const current = dialog
    if (current === null || refs.busy.current !== null) return
    if (current.kind === 'publish') {
      if (current.name === '') return
      runPublish(current.name)
      return
    }
    if (current.kind === 'add') {
      const name = current.name.trim()
      const url = current.url.trim()
      if (name === '' || url === '') return
      runAddRemote(name, url)
      return
    }
    if (current.name === '') return
    runRemoveRemote(current.name)
  }

  const statusAction = (): void => {
    if (!canUseBranch || refs.busy.current !== null) return
    if (hasUpstream) sync()
    else publish()
  }

  return {
    menuOpen,
    remotes,
    remotesLoading,
    remotesFailure,
    dialog,
    canUseBranch,
    hasUpstream,
    toggleMenu,
    closeMenu,
    closeDialog,
    statusAction,
    fetch,
    pull,
    pullRebase,
    push,
    sync,
    publish,
    openAddRemote,
    openRemoveRemote,
    setName,
    setUrl,
    submitDialog,
    loadRemotes,
  }
}
