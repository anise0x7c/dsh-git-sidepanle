/**
 * The source-control sidebar tab. This module only assembles: the panel wiring
 * and the state machines come from `hooks/`, the markup below the toolbar comes
 * from `views/`, and shared floating prompts render above the assembled body.
 * No Host call is made directly here.
 */

import type React from 'react'
import { createElement, useCallback, useMemo, useRef, useState } from 'react'
import { DIFF_KIND } from '../constants.ts'
import { errorText, isStaged, isUnstaged, statusLetter } from '../git/format.ts'
import { sortChangeEntries } from '../git/list.ts'
import { AlertIcon, GitBranchIcon } from '../icons.ts'
import type { ChangeEntry, ChangeRow, CommitFileRow } from '../types/domain.ts'
import type { LocaleBinder, TabInfoHook, UseContextMenu } from '../types/dsh.ts'
import type { ConfirmState } from './confirm.ts'
import { confirmActionLabel, confirmDescription, confirmTitle } from './confirm.ts'
import { FloatingPanel } from './FloatingPanel.ts'
import { Banner, EmptyState } from './feedback.ts'
import { useBranches } from './hooks/useBranches.ts'
import { useChangeActions } from './hooks/useChangeActions.ts'
import { useCommitDetails } from './hooks/useCommitDetails.ts'
import { useCommitMenuActions } from './hooks/useCommitMenuActions.ts'
import { useHistory } from './hooks/useHistory.ts'
import { useLiveUpdates } from './hooks/useLiveUpdates.ts'
import { useMenuCommands } from './hooks/useMenuCommands.ts'
import { useRepoStatus } from './hooks/useRepoStatus.ts'
import { createMenuTargets, usePanelRefs } from './menu.ts'
import { isNearEnd } from './scroll.ts'
import { DEFAULT_SPLIT_RATIO } from './split.ts'
import { BranchHeader } from './views/BranchHeader.ts'
import { ChangeGroups } from './views/ChangeGroups.ts'
import { CommitBox } from './views/CommitBox.ts'
import { CommitDetails } from './views/CommitDetails.ts'
import { CommitMenuDialog } from './views/CommitMenuDialog.ts'
import { GraphSection } from './views/GraphSection.ts'
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
}

/**
 * Render the source-control tab body for one Session.
 * @param props - slot props; `sessionId`, `t` and `useTabInfo` are required,
 *   `useContextMenu` is the optional host trigger hook.
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
  const repo = status?.repo ?? null
  // The change list uses repository-relative paths, so the directory that
  // makes them absolute is the repository root, not the Session directory.
  // A no-repository status carries only the Session directory.
  const sessionDirectory = status?.cwd ?? status?.repo?.cwd
  const repoRoot = repo?.root ?? sessionDirectory
  const files = status?.files ?? []
  const mergeFiles = useMemo(() => files.filter((entry) => entry.conflict === true), [files])
  const stagedFiles = useMemo(() => files.filter((entry) => isStaged(entry)), [files])
  const changedFiles = useMemo(() => files.filter((entry) => isUnstaged(entry)), [files])
  // Each group is one flat list in path order. The display letter depends on
  // the group (an unstaged row takes its worktree half, a conflicted row is
  // always `!`), so the rows the views receive are copies with that letter.
  const mergeRows = useMemo<ChangeRow[]>(
    () => sortChangeEntries(mergeFiles).map((entry) => ({ ...entry, letter: '!' })),
    [mergeFiles],
  )
  const stagedRows = useMemo<ChangeRow[]>(
    () =>
      sortChangeEntries(stagedFiles).map((entry) => ({ ...entry, letter: statusLetter(entry.x) })),
    [stagedFiles],
  )
  const changedRows = useMemo<ChangeRow[]>(
    () =>
      sortChangeEntries(changedFiles).map((entry) => ({
        ...entry,
        letter: entry.untracked === true ? 'U' : statusLetter(entry.y),
      })),
    [changedFiles],
  )
  const clean =
    repo !== null &&
    mergeFiles.length === 0 &&
    stagedFiles.length === 0 &&
    changedFiles.length === 0

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
    stagedFiles,
    loadStatus,
    loadGraph: reloadHistory,
  })
  const {
    busy,
    message,
    setMessage,
    notice,
    setNotice,
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
    branchLoading,
    branchFailure,
    loadBranches,
    toggleBranchMenu,
    checkout,
    resetBranches,
  } = useBranches({ call, refs, perform })
  const commitMenuActions = useCommitMenuActions({
    call,
    t,
    refs,
    perform,
    onReferencesChanged: resetBranches,
  })
  // Replace the other idle prompt at its entry point, rather than hiding it
  // behind a render priority that could reveal stale forms after cancellation.
  const requestConfirmation = (next: ConfirmState | null): void => {
    if (refs.busy.current !== null) return
    if (next !== null) {
      if (commitMenuActions.dialog !== null) commitMenuActions.closeDialog(false)
      setActionFailure(null)
    }
    rawSetConfirm(next)
  }
  const requestReference = (open: () => void): void => {
    if (refs.busy.current !== null) return
    rawSetConfirm(null)
    setActionFailure(null)
    open()
  }
  const requestCommit = (): void => {
    if (refs.busy.current !== null || message.trim() === '') return
    if (commitMenuActions.dialog !== null) commitMenuActions.closeDialog(false)
    rawSetConfirm(null)
    setActionFailure(null)
    rawRequestCommit()
  }
  const commitState = useCommitDetails({ call, refs })
  const selectedCommit = commitState.selected
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
          status:
            mode === 'staged'
              ? statusLetter(entry.x)
              : entry.untracked === true
                ? 'U'
                : statusLetter(entry.y),
          origPath: entry.origPath,
          cwd: repoRoot ?? undefined,
        },
      })
    },
    [tab.actions, repoRoot],
  )

  const openCommitDiff = useCallback(
    (entry: CommitFileRow): void => {
      if (selectedCommit === null) return
      tab.actions.openTab(DIFF_KIND, {
        params: {
          path: entry.path,
          commit: selectedCommit.oid,
          shortOid: selectedCommit.shortOid,
          status: entry.letter,
          origPath: entry.origPath,
          cwd: repoRoot ?? undefined,
        },
      })
    },
    [tab.actions, repoRoot, selectedCommit],
  )

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

  const targets = createMenuTargets({ sessionId: props.sessionId, panelId, busy, cwd: repoRoot })
  const graphMenu = {
    trigger: menuTrigger,
    sectionTarget: targets.sectionTarget,
    commitTarget: targets.commitTarget,
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
    stagedFiles,
    changedFiles,
    mergeFiles,
    refreshAll,
    stage,
    unstage,
    ignore,
    checkout,
    checkoutDetached: commitMenuActions.checkoutDetached,
    createBranch: (oid) => requestReference(() => commitMenuActions.createBranch(oid)),
    createTag: (oid) => requestReference(() => commitMenuActions.createTag(oid)),
    deleteBranch: (branch) => requestReference(() => commitMenuActions.deleteBranch(branch)),
    setConfirm: requestConfirmation,
    setNotice,
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

  const commitBody =
    selectedCommit === null
      ? null
      : h(CommitDetails, {
          t,
          summary: selectedCommit,
          details: commitState.details,
          loading: commitState.loading,
          failure: commitState.failure,
          files: commitRows,
          onBack: commitState.closeCommit,
          onRetry: commitState.retryCommit,
          onOpenFile: openCommitDiff,
          menuTrigger,
          rowTarget: targets.rowTarget,
        })

  const singlePane = renderState() ?? commitBody
  const body =
    singlePane !== null
      ? h('div', { className: 'dshgg-scroll' }, singlePane)
      : h(SplitView, {
          ratio: splitRatio,
          onRatioChange: setSplitRatio,
          label: t('split.label'),
          hint: t('split.hint'),
          onGraphScroll: handleGraphScroll,
          graphRef: graphPane,
          changes: h(ChangeGroups, {
            t,
            clean,
            mergeRows,
            stagedRows,
            changedRows,
            openSections,
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
            onSelect: commitState.selectCommit,
            onToggle: () => toggleSection('graph'),
            onRetry: () => {
              void reloadHistory()
            },
            menu: graphMenu,
          }),
        })

  const commitHint = stagedFiles.length > 0 ? t('commit.hint') : t('commit.hintNone')
  const placeholder =
    repo === null
      ? t('commit.placeholder', { branch: '' })
      : t('commit.placeholder', { branch: branchLabel ?? '' })

  const actionFeedback =
    actionFailure === null
      ? null
      : h(Banner, {
          title: t('error.title'),
          detail: errorText(t, actionFailure),
          dismissLabel: t('action.dismiss'),
          onDismiss: () => setActionFailure(null),
        })

  return h(
    'div',
    { className: 'dshgg-root', 'data-dsh-git-graph': '' },
    h(BranchHeader, {
      t,
      wrapRef: refs.wrap,
      repo,
      branchLabel,
      ahead,
      behind,
      busy,
      branchMenu,
      branches,
      branchLoading,
      branchFailure,
      onToggleMenu: toggleBranchMenu,
      onPickBranch: checkout,
      onRetryBranches: () => {
        void loadBranches()
      },
      onRefresh: refreshAll,
    }),
    repo === null || selectedCommit !== null
      ? null
      : h(CommitBox, {
          t,
          message,
          hint: commitHint,
          placeholder,
          busy,
          onChange: setMessage,
          onCommit: requestCommit,
        }),
    loadFailure !== null && status !== null
      ? h(Banner, {
          title: t('error.title'),
          detail: errorText(t, loadFailure),
          retryLabel: t('retry'),
          onRetry: () => {
            void loadStatus()
          },
          dismissLabel: t('action.dismiss'),
          onDismiss: () => setLoadFailure(null),
        })
      : null,
    commitMenuActions.dialog === null && confirm === null ? actionFeedback : null,
    notice !== null ? h('div', { className: 'dshgg-notice', role: 'status' }, notice) : null,
    body,
    commitMenuActions.dialog === null
      ? null
      : h(CommitMenuDialog, {
          key:
            commitMenuActions.dialog.kind === 'deleteBranch'
              ? `delete:${commitMenuActions.dialog.branch}`
              : `${commitMenuActions.dialog.kind}:${commitMenuActions.dialog.oid}`,
          dialog: commitMenuActions.dialog,
          t,
          busy: busy !== null,
          feedback: actionFeedback,
          onNameChange: commitMenuActions.setName,
          onMessageChange: commitMenuActions.setMessage,
          onCancel: () => commitMenuActions.closeDialog(),
          onSubmit: commitMenuActions.submitDialog,
        }),
    confirm === null
      ? null
      : h(FloatingPanel, {
          key: confirm.kind === 'discard' ? `discard:${confirm.entry.path}` : confirm.kind,
          title: confirmTitle(t, confirm),
          description: confirmDescription(t, confirm),
          cancelLabel: t('action.cancel'),
          submitLabel: confirmActionLabel(t, confirm),
          busy: busy !== null,
          feedback: actionFeedback,
          onCancel: () => requestConfirmation(null),
          onSubmit: () => {
            if (refs.busy.current === null) confirmAction()
          },
        }),
  )
}
