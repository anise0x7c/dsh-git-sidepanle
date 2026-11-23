/**
 * The source-control sidebar tab. This module only assembles: the panel wiring
 * and the state machines come from `hooks/`, the markup below the toolbar comes
 * from `views/`, and shared floating prompts render above the assembled body.
 * No Host call is made directly here.
 */

import type React from 'react'
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DETAILS_MOTION_MS,
  DIFF_KIND,
  PROGRESS_MIN_VISIBLE_MS,
  PROMPT_MOTION_MS,
} from '../constants.ts'
import { errorText } from '../git/format.ts'
import { sortChangeEntries } from '../git/list.ts'
import { AlertIcon, GitBranchIcon } from '../icons.ts'
import type { Notify } from '../toast/notify.ts'
import type { ChangeEntry, CommitFileRow, CommitSummary } from '../types/domain.ts'
import type { LocaleBinder, TabInfoHook, UseContextMenu } from '../types/dsh.ts'
import { changeRowLetter, groupChangeEntries, visibleChangeGroups } from './change-groups.ts'
import type { CommitMode } from './commit-mode.ts'
import type { ConfirmState } from './confirm.ts'
import { confirmActionLabel, confirmDescription, confirmTitle } from './confirm.ts'
import { FloatingPanel } from './FloatingPanel.ts'
import { EmptyState } from './feedback.ts'
import { useBranches } from './hooks/useBranches.ts'
import { useChangeActions } from './hooks/useChangeActions.ts'
import { useCommitActionMenu } from './hooks/useCommitActionMenu.ts'
import { useCommitDetails } from './hooks/useCommitDetails.ts'
import { useCommitExpansion } from './hooks/useCommitExpansion.ts'
import { useCommitMenuActions } from './hooks/useCommitMenuActions.ts'
import { useFailureToasts } from './hooks/useFailureToasts.ts'
import { useHistory } from './hooks/useHistory.ts'
import { useLiveUpdates } from './hooks/useLiveUpdates.ts'
import { useMenuCommands } from './hooks/useMenuCommands.ts'
import { useMinimumVisible } from './hooks/useMinimumVisible.ts'
import { usePresence } from './hooks/usePresence.ts'
import { useRemoteActions } from './hooks/useRemoteActions.ts'
import { useRepoStatus } from './hooks/useRepoStatus.ts'
import { createMenuTargets, usePanelRefs } from './menu.ts'
import { isNearEnd } from './scroll.ts'
import { allSectionsCollapsed, DEFAULT_SPLIT_RATIO } from './split.ts'
import { BranchHeader } from './views/BranchHeader.ts'
import { ChangeGroups } from './views/ChangeGroups.ts'
import { CommitBox } from './views/CommitBox.ts'
import { CommitDetails } from './views/CommitDetails.ts'
import { CommitMenuDialog } from './views/CommitMenuDialog.ts'
import { GraphRemoteActions } from './views/GraphRemoteActions.ts'
import { GraphSection } from './views/GraphSection.ts'
import { RemoteDialog } from './views/RemoteDialog.ts'
import { RemoteMenu } from './views/RemoteMenu.ts'
import { SplitView } from './views/SplitView.ts'

const h = createElement

/** Props of the source-control tab body. */
export interface GitPanelProps {
  /** Session the tab is bound to. */
  readonly sessionId: string
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Slot-owned tab information hook. */
  readonly useTabInfo: TabInfoHook
  /** Host context-menu trigger hook from the slot's root props. */
  readonly useContextMenu?: UseContextMenu
  /** Host notification callback injected by this registration's Slot face. */
  readonly notify: Notify
}

/**
 * Render the source-control tab body for one Session.
 * @param props - slot props; `sessionId`, `t`, `useTabInfo` and `notify` are
 *   required, `useContextMenu` is the optional host trigger hook.
 * @returns the panel element.
 */
export function GitPanel(props: GitPanelProps): React.ReactElement {
  const t = props.t
  const tab = props.useTabInfo().tab
  const visible = tab.visible !== false
  const refs = usePanelRefs()
  const commandOptions = useMenuCommands()
  const statusState = useRepoStatus({
    sessionId: props.sessionId,
    useContextMenu: props.useContextMenu,
    visible,
    refs,
  })
  const { call, menuTrigger, panelId, status, loading, loadFailure, setLoadFailure, loadStatus } =
    statusState
  const history = useHistory({ call, refs })
  const { graph, references, graphLoading, graphFailure, loadGraph, refreshReferences } = history
  const rootPane = useRef<HTMLDivElement | null>(null)
  const graphPane = useRef<HTMLDivElement | null>(null)

  // A history refresh starts a new first page and returns the pane to the top,
  // so the shorter list cannot page further by clamping its scroll position.
  const reloadHistory = useCallback(async (): Promise<void> => {
    await loadGraph()
    if (graphPane.current !== null) graphPane.current.scrollTop = 0
  }, [loadGraph])

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    merge: true,
    staged: true,
    changes: true,
    graph: true,
  })
  // The split outlives the commit-details view so returning restores the ratio.
  const [splitRatio, setSplitRatio] = useState(DEFAULT_SPLIT_RATIO)
  // A surface that is leaving keeps rendering the element it rendered last, so
  // its content does not blink out before its exit animation is over.
  const lastDetails = useRef<React.ReactNode>(null)
  const lastPrompt = useRef<React.ReactNode>(null)
  const repo = status?.repo ?? null
  // The change list uses repository-relative paths, so the directory that
  // makes them absolute is the repository root, not the Session directory.
  // A no-repository status carries only the Session directory.
  const sessionDirectory = status?.cwd ?? status?.repo?.cwd
  const repoRoot = repo?.root ?? sessionDirectory
  const files = status?.files ?? []
  const groups = useMemo(() => groupChangeEntries(files), [files])
  const { mergeRows, stagedRows, changedRows } = groups
  const clean =
    repo !== null && mergeRows.length === 0 && stagedRows.length === 0 && changedRows.length === 0
  // The change pane keeps only its headers once every group it renders is
  // collapsed; a clean workspace renders no group, so its pane keeps its share.
  const changeGroups = useMemo(() => visibleChangeGroups(groups), [groups])

  // Watched repository updates are scoped: a working-tree or index change only
  // needs the status, while a reference move re-reads the fixed-color
  // references and reloads the newest page only when the checked-out commit is
  // not among the loaded rows.
  const handleWorktreeChange = useCallback((): void => {
    void loadStatus({ silent: true })
  }, [loadStatus])
  const handleReferencesChange = useCallback(async (): Promise<void> => {
    const next = await refreshReferences()
    await loadStatus({ silent: true })
    const revision = next?.current?.revision
    if (revision === undefined || graph === null) return
    if (graph.some((commit) => commit.oid === revision)) return
    await reloadHistory()
  }, [refreshReferences, loadStatus, graph, reloadHistory])
  useLiveUpdates({
    call,
    panelId,
    visible,
    repoRoot: repo?.root ?? null,
    refs,
    onWorktreeChange: handleWorktreeChange,
    onReferencesChange: handleReferencesChange,
  })

  const actions = useChangeActions({
    call,
    t,
    refs,
    files,
    stagedFiles: stagedRows,
    loadStatus,
    loadGraph: reloadHistory,
    notify: props.notify,
  })
  const {
    busy,
    message,
    setMessage,
    actionFailure,
    setActionFailure,
    confirm,
    setConfirm: rawSetConfirm,
    perform,
    stage,
    unstage,
    ignore,
    requestCommit: rawRequestCommit,
    confirmAction,
  } = actions
  const {
    branchMenu,
    branches,
    remoteBranches,
    branchLoading,
    branchFailure,
    loadBranches,
    toggleBranchMenu,
    closeBranchMenu,
    checkout,
    checkoutRemote,
    resetBranches,
  } = useBranches({ call, t, refs, perform })
  const commitMenuActions = useCommitMenuActions({
    call,
    t,
    refs,
    perform,
    onReferencesChanged: resetBranches,
  })
  // The remote form is mutually exclusive with the idle prompts: opening it
  // replaces whichever form was showing instead of stacking another surface.
  const closePromptsForRemote = (): void => {
    rawSetConfirm(null)
    if (commitMenuActions.dialog !== null) commitMenuActions.closeDialog(false)
    closeBranchMenu()
    setActionFailure(null)
  }
  const remoteActions = useRemoteActions({
    call,
    t,
    refs,
    repo,
    perform,
    setActionFailure,
    onOpenDialog: closePromptsForRemote,
  })
  const actionMenu = useCommitActionMenu({
    enabled: busy === null && message.trim() !== '',
  })
  const toggleBranchPicker = (): void => {
    actionMenu.close()
    remoteActions.closeMenu()
    toggleBranchMenu()
  }
  const toggleRemoteMenu = (): void => {
    actionMenu.close()
    closeBranchMenu()
    remoteActions.toggleMenu()
  }
  const toggleCommitActionMenu = (): void => {
    closeBranchMenu()
    remoteActions.closeMenu()
    actionMenu.toggle()
  }
  // Replace the other idle prompt at its entry point, rather than hiding it
  // behind a render priority that could reveal stale forms after cancellation.
  const requestConfirmation = (next: ConfirmState | null): void => {
    if (refs.busy.current !== null) return
    if (next !== null) {
      if (commitMenuActions.dialog !== null) commitMenuActions.closeDialog(false)
      remoteActions.closeDialog()
      setActionFailure(null)
    }
    rawSetConfirm(next)
  }
  const requestReference = (open: () => void): void => {
    if (refs.busy.current !== null) return
    rawSetConfirm(null)
    remoteActions.closeDialog()
    setActionFailure(null)
    open()
  }
  const requestCommit = (mode: CommitMode = 'commit'): void => {
    if (refs.busy.current !== null || message.trim() === '') return
    actionMenu.close()
    if (commitMenuActions.dialog !== null) commitMenuActions.closeDialog(false)
    rawSetConfirm(null)
    remoteActions.closeDialog()
    setActionFailure(null)
    rawRequestCommit(mode)
  }
  const commitState = useCommitDetails({ call, refs })
  const expansion = useCommitExpansion({ call, refs })
  // One generation per retryable failure. An explicit retry bumps the entry's
  // generation so a retry that fails again reports a fresh notice even when
  // the previous failure never cleared first; repeated poll failures with the
  // same text stay suppressed.
  const retryGenerations = useRef<Record<string, number>>({})
  const [, setRetryTick] = useState(0)
  const retry = (key: string, run: () => void): void => {
    retryGenerations.current[key] = (retryGenerations.current[key] ?? 0) + 1
    setRetryTick((value) => value + 1)
    run()
  }
  // Every failure the panel already tracks is reported once through the
  // native Toast; a cleared failure re-arms its notice for a later failure.
  useFailureToasts(
    [
      {
        key: 'status',
        failure: status === null ? null : loadFailure,
        text: errorText(t, loadFailure),
        generation: retryGenerations.current.status ?? 0,
        action: {
          label: t('retry'),
          run: () =>
            retry('status', () => {
              setLoadFailure(null)
              void loadStatus()
            }),
        },
      },
      { key: 'action', failure: actionFailure, text: errorText(t, actionFailure) },
      {
        key: 'history',
        failure: graphFailure,
        text: errorText(t, graphFailure),
        generation: retryGenerations.current.history ?? 0,
        action: {
          label: t('retry'),
          run: () => retry('history', () => void reloadHistory()),
        },
      },
      {
        key: 'details',
        failure: commitState.failure,
        text: errorText(t, commitState.failure),
        generation: retryGenerations.current.details ?? 0,
        action: {
          label: t('retry'),
          run: () => retry('details', commitState.retryCommit),
        },
      },
    ],
    props.notify,
  )
  const selectedCommit = commitState.selected
  // Escape leaves the details card like its back control. A prompt or the
  // branch menu owns the key while it is open, and a hidden tab must not react
  // to keys pressed in another tab.
  useEffect(() => {
    if (!visible || selectedCommit === null) return undefined
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (
        branchMenu ||
        confirm !== null ||
        commitMenuActions.dialog !== null ||
        remoteActions.menuOpen ||
        remoteActions.dialog !== null
      )
        return
      // A panel that is merely visible must not react to Escape pressed in
      // another pane. The focused body counts as in-panel because inerting the
      // underlay can move focus there.
      const root = rootPane.current
      const focus = document.activeElement ?? event.target
      const focusIsInside =
        focus === document.body ||
        (root !== null && focus instanceof Element && root.contains(focus))
      if (!focusIsInside && root !== null) return
      event.preventDefault()
      event.stopPropagation()
      commitState.closeCommit()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [
    visible,
    selectedCommit,
    branchMenu,
    confirm,
    commitMenuActions.dialog,
    remoteActions.menuOpen,
    remoteActions.dialog,
    commitState.closeCommit,
  ])
  const commitRows = useMemo<CommitFileRow[]>(
    () =>
      sortChangeEntries(commitState.details?.files ?? []).map((file) => ({
        ...file,
        kind: 'commit',
      })),
    [commitState.details],
  )

  const openDiff = useCallback(
    (entry: ChangeEntry, mode: 'staged' | 'changes'): void => {
      tab.actions.openTab(DIFF_KIND, {
        params: {
          path: entry.path,
          staged: mode === 'staged',
          untracked: entry.untracked === true,
          status: changeRowLetter(entry, mode),
          origPath: entry.origPath,
          cwd: repoRoot ?? undefined,
        },
      })
    },
    [tab.actions, repoRoot],
  )

  const openFileAtCommit = useCallback(
    (commit: Pick<CommitSummary, 'oid' | 'shortOid'>, entry: CommitFileRow): void => {
      tab.actions.openTab(DIFF_KIND, {
        params: {
          path: entry.path,
          commit: commit.oid,
          shortOid: commit.shortOid,
          status: entry.letter,
          origPath: entry.origPath,
          cwd: repoRoot ?? undefined,
        },
      })
    },
    [tab.actions, repoRoot],
  )
  const openCommitDiff = useCallback(
    (entry: CommitFileRow): void => {
      if (selectedCommit !== null) openFileAtCommit(selectedCommit, entry)
    },
    [openFileAtCommit, selectedCommit],
  )
  // The details view opens from the commit row's menu; the command names the
  // commit by id, so it resolves against the rows the graph currently lists.
  const viewCommit = (oid: string): boolean => {
    const commit = graph?.find((candidate) => candidate.oid === oid)
    if (commit === undefined) return false
    commitState.selectCommit(commit)
    return true
  }

  const toggleSection = (id: string): void =>
    setOpenSections((current) => ({ ...current, [id]: current[id] !== true }))

  // Reaching the end of the graph pane appends the next page of earlier
  // commits. The loader ignores a request while a page is already on its way.
  const handleGraphScroll = (event: React.UIEvent<HTMLDivElement>): void => {
    if (!isNearEnd(event.currentTarget)) return
    void history.loadMore()
  }

  const refreshAll = (): void => {
    setActionFailure(null)
    void loadStatus({ silent: true })
    void reloadHistory()
    if (selectedCommit !== null) commitState.retryCommit()
  }

  const branchLabel =
    repo === null
      ? loading && status === null
        ? t('loading')
        : null
      : repo.detached === true
        ? t('branch.detached')
        : repo.unborn === true
          ? t('branch.unborn')
          : repo.branch
  const ahead = repo?.ahead ?? 0
  const behind = repo?.behind ?? 0
  const canAct = repo !== null && busy === null
  // The toolbar's activity bar covers the visible status load, graph reads and
  // any operation holding the busy lock. A silent watcher refresh keeps the
  // bar still, so an external edit does not flash it. The minimum visible time
  // keeps a fast read from showing the bar for only one frame.
  const toolbarActivity = loading || graphLoading || history.moreLoading || busy !== null
  const toolbarProgress = useMinimumVisible(toolbarActivity, PROGRESS_MIN_VISIBLE_MS)

  const targets = createMenuTargets({
    sessionId: props.sessionId,
    panelId,
    busy,
    ...(repoRoot === undefined ? {} : { cwd: repoRoot }),
  })
  const graphMenu = {
    trigger: menuTrigger,
    sectionTarget: targets.sectionTarget,
    commitTarget: targets.commitTarget,
    fileTarget: (path: string) => targets.rowTarget('commitFile', { section: 'commit', path }),
    onInvoke: commitMenuActions.rememberTrigger,
  }
  // The command bus subscription mounts before the handlers exist, so the
  // panel hands it the current options at the end of every render.
  commandOptions.current = {
    sessionId: props.sessionId,
    panelId,
    repo,
    busyRef: refs.busy,
    t,
    files,
    stagedFiles: stagedRows,
    changedFiles: changedRows,
    mergeFiles: mergeRows,
    refreshAll,
    stage,
    unstage,
    ignore,
    checkout,
    checkoutDetached: commitMenuActions.checkoutDetached,
    createBranch: (oid) => requestReference(() => commitMenuActions.createBranch(oid)),
    createTag: (oid) => requestReference(() => commitMenuActions.createTag(oid)),
    deleteBranch: (branch) => requestReference(() => commitMenuActions.deleteBranch(branch)),
    viewCommit,
    setConfirm: requestConfirmation,
    notify: props.notify,
    openDiff,
  }

  const renderState = (): React.ReactNode => {
    if (loading && status === null) {
      return h(EmptyState, {
        icon: h(GitBranchIcon, { size: 26 }),
        title: t('loading'),
      })
    }
    if (loadFailure !== null && status === null) {
      if (loadFailure.code === 'git-unavailable') {
        return h(EmptyState, {
          icon: h(AlertIcon, { size: 26 }),
          title: t('gitUnavailable.title'),
          desc: t('gitUnavailable.desc'),
          action: h(
            'button',
            {
              type: 'button',
              className: 'dshgg-btn dshgg-btnGhost',
              onClick: () => {
                void loadStatus()
              },
            },
            t('retry'),
          ),
        })
      }
      return h(EmptyState, {
        icon: h(AlertIcon, { size: 26 }),
        title: t('error.title'),
        desc: errorText(t, loadFailure),
        action: h(
          'button',
          {
            type: 'button',
            className: 'dshgg-btn dshgg-btnGhost',
            onClick: () => {
              void loadStatus()
            },
          },
          t('retry'),
        ),
      })
    }
    if (status !== null && repo === null) {
      return h(EmptyState, {
        icon: h(GitBranchIcon, { size: 26 }),
        title: t('noRepo.title'),
        desc: t('noRepo.desc', { path: sessionDirectory ?? '' }),
        action: h(
          'button',
          { type: 'button', className: 'dshgg-btn dshgg-btnGhost', onClick: refreshAll },
          t('refresh'),
        ),
      })
    }
    return null
  }

  // The details view slides in from the pane's right edge; the presence keeps
  // the last rendered commit visible while the view slides back out.
  const detailsNode =
    selectedCommit === null
      ? null
      : h(CommitDetails, {
          t,
          summary: selectedCommit,
          details: commitState.details,
          loading: commitState.loading,
          failure: commitState.failure,
          files: commitRows,
          collapsedFolders: commitState.collapsedFolders,
          onToggleFolder: commitState.toggleFolder,
          onBack: commitState.closeCommit,
          onRetry: commitState.retryCommit,
          onOpenFile: openCommitDiff,
          menuTrigger,
          rowTarget: targets.rowTarget,
        })
  const detailsPresence = usePresence(detailsNode !== null, DETAILS_MOTION_MS)
  if (detailsNode !== null) lastDetails.current = detailsNode
  const shownDetails = detailsNode ?? (detailsPresence.mounted ? lastDetails.current : null)
  const detailsMotion =
    shownDetails === null
      ? null
      : h(
          'div',
          { className: 'dshgg-commitMotion', 'data-phase': detailsPresence.phase },
          h('div', { className: 'dshgg-scroll dshgg-commitCard' }, shownDetails),
        )

  const remoteMenuNode = remoteActions.menuOpen
    ? h(RemoteMenu, {
        t,
        remotes: remoteActions.remotes,
        loading: remoteActions.remotesLoading,
        failure: remoteActions.remotesFailure,
        busy: busy !== null,
        usable: remoteActions.canUseBranch,
        hasUpstream: remoteActions.hasUpstream,
        onPullRebase: remoteActions.pullRebase,
        onPublish: remoteActions.publish,
        onSync: remoteActions.sync,
        onAddRemote: remoteActions.openAddRemote,
        onRemoveRemote: remoteActions.openRemoveRemote,
        onRetry: () => {
          void remoteActions.loadRemotes()
        },
      })
    : null
  // The graph header owns the remote controls: Fetch/Pull/Push as icon buttons
  // and the overflow menu under the ellipsis.
  const graphActions = h(GraphRemoteActions, {
    t,
    hasRepo: repo !== null,
    busy: busy !== null,
    canUseBranch: remoteActions.canUseBranch,
    hasUpstream: remoteActions.hasUpstream,
    onFetch: remoteActions.fetch,
    onPull: remoteActions.pull,
    onPush: remoteActions.push,
    menuOpen: remoteActions.menuOpen,
    menuNode: remoteMenuNode,
    wrapRef: refs.remoteWrap,
    onToggleMenu: toggleRemoteMenu,
  })

  // A pane folds away only when it keeps its headers and the other pane is not
  // already holding the split; only then do its closing rows outlive its bodies.
  const changesCollapsed = allSectionsCollapsed(changeGroups, openSections)
  const graphCollapsed = openSections.graph !== true
  const singlePane = renderState()
  const body =
    singlePane !== null
      ? h('div', { className: 'dshgg-scroll' }, singlePane)
      : h(SplitView, {
          ratio: splitRatio,
          onRatioChange: setSplitRatio,
          label: t('split.label'),
          hint: t('split.hint'),
          changeSections: changeGroups.length,
          changesCollapsed,
          graphCollapsed,
          onGraphScroll: handleGraphScroll,
          graphRef: graphPane,
          changes: h(ChangeGroups, {
            t,
            clean,
            mergeRows,
            stagedRows,
            changedRows,
            openSections,
            foldBodies: changesCollapsed && !graphCollapsed,
            busy: busy !== null,
            canAct,
            onToggleSection: toggleSection,
            onStage: stage,
            onUnstage: unstage,
            onOpenDiff: openDiff,
            onDiscard: (entry) => requestConfirmation({ kind: 'discard', entry }),
            onDiscardAll: () => requestConfirmation({ kind: 'discardAll', entries: changedRows }),
            menuTrigger,
            sectionTarget: targets.sectionTarget,
            rowTarget: targets.rowTarget,
          }),
          graph: h(GraphSection, {
            t,
            commits: graph,
            references,
            graphId: panelId,
            loading: graphLoading,
            failure: graphFailure,
            hasMore: history.hasMore,
            moreLoading: history.moreLoading,
            moreFailure: history.moreFailure,
            onLoadMore: () => {
              void history.loadMore()
            },
            open: openSections.graph === true,
            actions: graphActions,
            onActivate: expansion.toggleCommit,
            expanded: expansion.expanded,
            onOpenChange: openFileAtCommit,
            onRetryChanges: expansion.retryCommit,
            onToggle: () => toggleSection('graph'),
            onRetry: () => {
              void reloadHistory()
            },
            menu: graphMenu,
          }),
        })

  const commitHint = stagedRows.length > 0 ? t('commit.hint') : t('commit.hintNone')
  // A clean workspace whose branch is ahead of a tracked upstream has nothing
  // to commit and everything to sync, so the primary action becomes that sync
  // and names the commits waiting to leave.
  const syncCount = clean && ahead > 0 && remoteActions.hasUpstream ? ahead : 0
  const placeholder =
    repo === null
      ? t('commit.placeholder', { branch: '' })
      : t('commit.placeholder', { branch: branchLabel ?? '' })

  // The operation prompt rises from the pane's bottom edge and lowers away
  // again before it is removed; the last rendered prompt stays on screen while
  // it leaves. A reference form replaces an idle confirmation outright, so the
  // new prompt enters on its own instead of crossfading with the old one.
  const promptNode =
    remoteActions.dialog !== null
      ? h(RemoteDialog, {
          key: `remote:${remoteActions.dialog.kind}`,
          t,
          branch: branchLabel ?? repo?.branch ?? '',
          remotes: remoteActions.remotes ?? [],
          dialog: remoteActions.dialog,
          busyName: busy,
          onSelect: remoteActions.setName,
          onNameChange: remoteActions.setName,
          onUrlChange: remoteActions.setUrl,
          onCancel: remoteActions.closeDialog,
          onSubmit: remoteActions.submitDialog,
        })
      : commitMenuActions.dialog !== null
        ? h(CommitMenuDialog, {
            key:
              commitMenuActions.dialog.kind === 'deleteBranch'
                ? `delete:${commitMenuActions.dialog.branch}`
                : `${commitMenuActions.dialog.kind}:${commitMenuActions.dialog.oid}`,
            dialog: commitMenuActions.dialog,
            t,
            busy: busy !== null,
            onNameChange: commitMenuActions.setName,
            onMessageChange: commitMenuActions.setMessage,
            onCancel: () => commitMenuActions.closeDialog(),
            onSubmit: commitMenuActions.submitDialog,
          })
        : confirm !== null
          ? h(FloatingPanel, {
              key: confirm.kind === 'discard' ? `discard:${confirm.entry.path}` : confirm.kind,
              title: confirmTitle(t, confirm),
              description: confirmDescription(t, confirm),
              cancelLabel: t('action.cancel'),
              submitLabel: confirmActionLabel(t, confirm),
              busy: busy !== null,
              onCancel: () => requestConfirmation(null),
              onSubmit: () => {
                if (refs.busy.current === null) confirmAction()
              },
            })
          : null
  const promptPresence = usePresence(promptNode !== null, PROMPT_MOTION_MS)
  if (promptNode !== null) lastPrompt.current = promptNode
  const shownPrompt = promptNode ?? (promptPresence.mounted ? lastPrompt.current : null)
  const promptMotion =
    shownPrompt === null
      ? null
      : h(
          'div',
          { className: 'dshgg-promptMotion', 'data-phase': promptPresence.phase },
          shownPrompt,
        )

  // The details card overlays content that stays mounted and visible beneath
  // it. Marking that content inert and hidden keeps keyboard and assistive
  // technology users in the card; React 18's types do not know `inert`.
  const underlayProps: React.HTMLAttributes<HTMLDivElement> = detailsPresence.mounted
    ? ({ 'aria-hidden': 'true', inert: '' } as React.HTMLAttributes<HTMLDivElement>)
    : {}

  return h(
    'div',
    { className: 'dshgg-root', 'data-dsh-git-graph': '', ref: rootPane },
    h(BranchHeader, {
      t,
      wrapRef: refs.wrap,
      repo,
      branchLabel,
      ahead,
      behind,
      busy,
      progress: toolbarProgress,
      branchMenu,
      branches,
      remoteBranches,
      branchLoading,
      branchFailure,
      onToggleMenu: toggleBranchPicker,
      onPickBranch: checkout,
      onPickRemote: checkoutRemote,
      onRetryBranches: () => {
        void loadBranches()
      },
      onRefresh: refreshAll,
    }),
    h(
      'div',
      { className: 'dshgg-stage' },
      h(
        'div',
        { className: 'dshgg-content', ...underlayProps },
        repo === null
          ? null
          : h(CommitBox, {
              t,
              message,
              hint: commitHint,
              placeholder,
              busy,
              menuOpen: actionMenu.open,
              menuWrapRef: actionMenu.wrap,
              onToggleMenu: toggleCommitActionMenu,
              onChoose: requestCommit,
              syncCount,
              onSync: remoteActions.sync,
              canPush: remoteActions.hasUpstream,
              onChange: setMessage,
            }),
        body,
      ),
      detailsMotion,
    ),
    promptMotion,
  )
}
