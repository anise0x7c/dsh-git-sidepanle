/**
 * Browser half of the Git graph bundle.
 *
 * This is the factory body carried over when the build was introduced; the
 * later stages of docs/REFACTOR-PLAN.md move each section into its own module
 * under src/client/. It registers two right-Sidebar tab types — the
 * source-control panel and its unified diff — plus the guide entry and toggle
 * shortcut. All repository work travels over the bundle's guarded Host route;
 * this file only renders and asks for it.
 */
import { Fragment, createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DIFF_ID, DIFF_KIND, GIT_ID, GIT_KIND, GIT_SHORTCUT, MENU_CONTRIBUTION_ID, MENU_TARGET, NS, POLL_INTERVAL_MS, nextPanelId } from './constants.js'
import { createCaller, makeFailure } from './data/caller.js'
import { DiffPanel } from './diff/DiffPanel.js'
import { errorText, formatAgo, isStaged, isUnstaged, parseRefs, statusLetter } from './git/format.js'
import { buildTree } from './git/tree.js'
import { AlertIcon, CheckCircleIcon, ChevronDownIcon, GitBranchIcon, MinusIcon, PlusIcon, RefreshIcon, UndoIcon } from './icons.js'
import { resolveMenuActions } from './menu/actions.js'
import { panelCommands } from './menu/bus.js'
import { bindMenuTrigger, menuTarget } from './menu/trigger.js'
import { BranchMenu } from './panel/BranchMenu.js'
import { confirmActionLabel, confirmDescription, confirmTitle } from './panel/confirm.js'
import { IconButton } from './panel/controls.js'
import { Banner, EmptyState } from './panel/feedback.js'
import { renderTree } from './panel/rows.js'
import { Section } from './panel/Section.js'
import { DiffTabTitle, GitTabTitle } from './titles.js'
import { en } from './locale/en.js'
import { zh } from './locale/zh.js'
import './styles.js'

const h = createElement

// ------------------------------------------------------------------
// Source-control panel
// ------------------------------------------------------------------

/**
 * The source-control sidebar tab.
 *
 * The body is partitioned the way the module split will cut it into hooks:
 *   1. panel wiring — command caller, menu trigger, per-panel id, bus subscription
 *   2. repository status — initial load, silent refresh, 5 s polling
 *   3. history and branches — load, refresh, branch menu dismissal
 *   4. change actions — stage, unstage, discard, commit, confirm dialog
 *   5. menu commands — dispatch from the overlay, stale/busy guards
 * The render below builds the toolbar, commit box, three change trees and
 * the history section from that state.
 */
function GitPanel(props) {
  const sessionId = props.sessionId
  const t = props.t
  const useTabInfo = props.useTabInfo
  const tabInfo = useTabInfo()
  const tab = tabInfo.tab
  const visible = tab.visible !== false
  const call = useMemo(() => createCaller(sessionId), [sessionId])
  const menuTrigger = useMemo(
    () => (typeof sessionId === 'string' && sessionId !== '' ? bindMenuTrigger(props.useContextMenu) : null),
    [props.useContextMenu, sessionId],
  )
  const panelId = useMemo(() => `git-panel-${nextPanelId()}`, [])

  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState(null)
  const [actionFailure, setActionFailure] = useState(null)
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [openSections, setOpenSections] = useState({ merge: true, staged: true, changes: true, graph: true })
  const [collapsed, setCollapsed] = useState({})
  const [graph, setGraph] = useState(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphFailure, setGraphFailure] = useState(null)
  const [branchMenu, setBranchMenu] = useState(false)
  const [branches, setBranches] = useState(null)
  const [branchLoading, setBranchLoading] = useState(false)
  const [branchFailure, setBranchFailure] = useState(null)

  const inFlight = useRef(false)
  const busyRef = useRef(null)
  const confirmRef = useRef(null)
  const mounted = useRef(true)
  const wrapRef = useRef(null)
  const commandRef = useRef(null)
  busyRef.current = busy
  confirmRef.current = confirm

  useEffect(() => () => { mounted.current = false }, [])

  useEffect(() => panelCommands.subscribe((command) => {
    const handler = commandRef.current
    if (typeof handler === 'function') handler(command)
  }), [])

  const loadStatus = useCallback(async (options = {}) => {
    if (inFlight.current) return
    inFlight.current = true
    if (options.silent !== true) setLoading(true)
    try {
      const value = await call('status')
      if (!mounted.current) return
      setStatus(value)
      setLoadFailure(null)
    } catch (error) {
      if (!mounted.current) return
      setLoadFailure(error)
    } finally {
      inFlight.current = false
      if (mounted.current) setLoading(false)
    }
  }, [call])

  const loadGraph = useCallback(async () => {
    if (mounted.current) setGraphLoading(true)
    try {
      const value = await call('history')
      if (!mounted.current) return
      setGraph(Array.isArray(value?.commits) ? value.commits : [])
      setGraphFailure(null)
    } catch (error) {
      if (!mounted.current) return
      if (error.code === 'not-a-repository') setGraph([])
      else setGraphFailure(error)
    } finally {
      if (mounted.current) setGraphLoading(false)
    }
  }, [call])

  const loadBranches = useCallback(async () => {
    if (mounted.current) setBranchLoading(true)
    try {
      const value = await call('branches')
      if (!mounted.current) return
      setBranches(Array.isArray(value?.branches) ? value.branches : [])
      setBranchFailure(null)
    } catch (error) {
      if (!mounted.current) return
      setBranchFailure(error)
    } finally {
      if (mounted.current) setBranchLoading(false)
    }
  }, [call])

  useEffect(() => {
    void loadStatus()
    void loadGraph()
  }, [loadStatus, loadGraph])

  useEffect(() => {
    if (!visible) return undefined
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (inFlight.current || busyRef.current !== null || confirmRef.current !== null) return
      void loadStatus({ silent: true })
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [visible, loadStatus])

  useEffect(() => {
    if (notice === null) return undefined
    const timer = setTimeout(() => { if (mounted.current) setNotice(null) }, 4000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!branchMenu) return undefined
    const onPointerDown = (event) => {
      const wrap = wrapRef.current
      if (wrap !== null && wrap.contains(event.target)) return
      setBranchMenu(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setBranchMenu(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [branchMenu])

  const perform = useCallback(async (name, operation, options = {}) => {
    if (busyRef.current !== null) return undefined
    busyRef.current = name
    setBusy(name)
    setActionFailure(null)
    try {
      const result = await operation()
      if (!mounted.current) return result
      if (options.notice !== undefined) setNotice(options.notice)
      if (options.after !== undefined) await options.after(result)
      await loadStatus({ silent: true })
      if (options.graph === true) await loadGraph()
      return result
    } catch (error) {
      if (mounted.current) setActionFailure(error)
      return undefined
    } finally {
      busyRef.current = null
      if (mounted.current) setBusy(null)
    }
  }, [loadStatus, loadGraph])

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
  const treeCache = useMemo(() => ({
    merge: buildTree(mergeFiles.map((entry) => ({ ...entry, letter: '!' }))),
    staged: buildTree(stagedFiles.map((entry) => ({ ...entry, letter: statusLetter(entry.x) }))),
    changes: buildTree(changedFiles.map((entry) => ({ ...entry, letter: entry.untracked === true ? 'U' : statusLetter(entry.y) }))),
  }), [mergeFiles, stagedFiles, changedFiles])
  const clean = repo !== null && mergeFiles.length === 0 && stagedFiles.length === 0 && changedFiles.length === 0

  const toggleSection = (id) => setOpenSections((current) => ({ ...current, [id]: current[id] !== true }))
  const toggleFolder = (path) => setCollapsed((current) => ({ ...current, [path]: current[path] !== true }))

  const stage = (entries) => perform('stage', () => call('stage', { paths: entries.map((entry) => entry.path) }))
  const unstage = (entries) => perform('unstage', () => call('unstage', { paths: entries.map((entry) => entry.path) }))
  const openDiff = useCallback((entry, mode) => {
    tab.actions.openTab(DIFF_KIND, {
      params: {
        path: entry.path,
        staged: mode === 'staged',
        untracked: entry.untracked === true,
        status: mode === 'staged' ? statusLetter(entry.x) : entry.untracked === true ? 'U' : statusLetter(entry.y),
        origPath: entry.origPath,
        cwd: repoRoot ?? undefined,
      },
    })
  }, [tab.actions, repoRoot])

  const requestCommit = () => {
    if (message.trim() === '' || busyRef.current !== null) return
    if (stagedFiles.length === 0) {
      if (files.length === 0) {
        setActionFailure(makeFailure('nothing-staged', t('commit.nothing')))
        return
      }
      setConfirm({ kind: 'commitAll' })
      return
    }
    void perform('commit', () => call('commit', { message }), {
      graph: true,
      after: (result) => {
        setMessage('')
        setNotice(t('commit.done', { hash: result?.commit ?? '' }))
      },
    })
  }

  const confirmAction = () => {
    const current = confirmRef.current
    if (current === null) return
    setConfirm(null)
    if (current.kind === 'commitAll') {
      void perform('commit', () => call('commit', { message, stageAll: true }), {
        graph: true,
        after: (result) => {
          setMessage('')
          setNotice(t('commit.done', { hash: result?.commit ?? '' }))
        },
      })
      return
    }
    if (current.kind === 'discard') {
      void perform('discard', () => call('discard', { path: current.entry.path, untracked: current.entry.untracked === true }))
      return
    }
    if (current.kind === 'discardAll') {
      const entries = current.entries
      void perform('discard', async () => {
        for (const entry of entries) await call('discard', { path: entry.path, untracked: entry.untracked === true })
      })
    }
  }

  const toggleBranchMenu = () => {
    const next = !branchMenu
    setBranchMenu(next)
    if (next && branches === null && branchFailure === null) void loadBranches()
  }

  const checkout = (branch) => {
    setBranchMenu(false)
    void perform('checkout', () => call('checkout', { branch }), {
      graph: true,
      after: () => {
        setBranches(null)
        setBranchFailure(null)
      },
    })
  }

  const refreshAll = () => {
    setActionFailure(null)
    void loadStatus({ silent: true })
    void loadGraph()
  }

  // Menu actions run in the host overlay, outside this tree. Executing their
  // commands here keeps confirmation, busy state, errors, and refresh shared
  // with the equivalent inline controls.
  const reportStale = () => setNotice(t('menu.stale'))
  commandRef.current = (command) => {
    if (command === null || typeof command !== 'object') return
    if (typeof command.sessionId === 'string' && command.sessionId !== sessionId) return
    if (typeof command.panelId === 'string' && command.panelId !== panelId) return
    if (repo === null) return
    const paths = Array.isArray(command.paths) ? command.paths.filter((path) => typeof path === 'string') : []
    const matches = (entry) => paths.includes(entry.path)
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

  const menuSection = (section) => menuTarget(sessionId, 'section', { section, busy: busy !== null, panelId })
  const menuCommit = (commit) => menuTarget(sessionId, 'commit', {
    oid: commit.oid,
    shortOid: commit.shortOid,
    subject: commit.subject,
  })
  const menuTreeTarget = (kind, detail) => menuTarget(sessionId, kind, { ...detail, cwd: repoRoot, busy: busy !== null, panelId })
  const menu = { trigger: menuTrigger, sectionTarget: menuSection, commitTarget: menuCommit }

  const branchLabel = repo === null
    ? null
    : repo.detached === true
      ? t('branch.detached')
      : repo.unborn === true
        ? t('branch.unborn')
        : repo.branch
  const ahead = repo?.ahead ?? 0
  const behind = repo?.behind ?? 0
  const canAct = repo !== null && busy === null

  const sectionActions = {
    merge: null,
    staged: stagedFiles.length === 0 ? null : h(IconButton, {
      label: t('actions.unstageAll'),
      title: t('actions.unstageAll'),
      disabled: !canAct,
      onClick: () => { void unstage(stagedFiles) },
    }, h(MinusIcon, { size: 14 })),
    changes: changedFiles.length === 0 ? null : [
      h(IconButton, {
        key: 'stage-all',
        label: t('actions.stageAll'),
        title: t('actions.stageAll'),
        disabled: !canAct,
        onClick: () => { void stage(changedFiles) },
      }, h(PlusIcon, { size: 14 })),
      h(IconButton, {
        key: 'discard-all',
        label: t('actions.discardAll'),
        title: t('actions.discardAll'),
        disabled: !canAct,
        onClick: () => setConfirm({ kind: 'discardAll', entries: changedFiles }),
      }, h(UndoIcon, { size: 14 })),
    ],
  }

  const treeContext = {
    collapsed,
    t,
    busy: busy !== null,
    onToggleFolder: toggleFolder,
    onOpen: (entry) => openDiff(entry, 'changes'),
    onStage: (entry) => { void stage([entry]) },
    onUnstage: (entry) => { void unstage([entry]) },
    onDiscard: (entry) => setConfirm({ kind: 'discard', entry }),
    menuTrigger,
    menuTarget: menuTreeTarget,
    menuHint: t('menu.hint'),
    mode: 'changes',
  }

  const renderState = () => {
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
          action: h('button', { type: 'button', className: 'dshgg-btn dshgg-btnGhost', onClick: () => { void loadStatus() } }, t('retry')),
        })
      }
      return h(EmptyState, {
        icon: h(AlertIcon, { size: 26 }),
        title: t('error.title'),
        desc: errorText(t, loadFailure),
        action: h('button', { type: 'button', className: 'dshgg-btn dshgg-btnGhost', onClick: () => { void loadStatus() } }, t('retry')),
      })
    }
    if (status !== null && repo === null) {
      return h(EmptyState, {
        icon: h(GitBranchIcon, { size: 26 }),
        title: t('noRepo.title'),
        desc: t('noRepo.desc', { path: sessionDirectory ?? '' }),
        action: h('button', { type: 'button', className: 'dshgg-btn dshgg-btnGhost', onClick: refreshAll }, t('refresh')),
      })
    }
    return null
  }

  const stateView = renderState()
  const body = stateView !== null ? stateView : h(Fragment, null,
    mergeFiles.length === 0 ? null : h(Section, {
      id: 'merge', title: t('sections.merge'), count: mergeFiles.length,
      open: openSections.merge === true, onToggle: () => toggleSection('merge'), actions: sectionActions.merge,
      menuTrigger, menuHint: t('menu.hint'), menuTarget: menuSection('merge'),
    }, renderTree(treeCache.merge, 0, { ...treeContext, mode: 'merge', onOpen: (entry) => openDiff(entry, 'changes') })),
    stagedFiles.length === 0 ? null : h(Section, {
      id: 'staged', title: t('sections.staged'), count: stagedFiles.length,
      open: openSections.staged === true, onToggle: () => toggleSection('staged'), actions: sectionActions.staged,
      menuTrigger, menuHint: t('menu.hint'), menuTarget: menuSection('staged'),
    }, renderTree(treeCache.staged, 0, {
      ...treeContext,
      mode: 'staged',
      onOpen: (entry) => openDiff(entry, 'staged'),
      onStage: (entry) => { void stage([entry]) },
      onUnstage: (entry) => { void unstage([entry]) },
    })),
    changedFiles.length === 0 ? null : h(Section, {
      id: 'changes', title: t('sections.changes'), count: changedFiles.length,
      open: openSections.changes === true, onToggle: () => toggleSection('changes'), actions: sectionActions.changes,
      menuTrigger, menuHint: t('menu.hint'), menuTarget: menuSection('changes'),
    }, renderTree(treeCache.changes, 0, { ...treeContext, onOpen: (entry) => openDiff(entry, 'changes') })),
    clean ? h('div', { className: 'dshgg-clean' },
      h('span', { className: 'dshgg-cleanIcon' }, h(CheckCircleIcon, { size: 26 })),
      h('span', { className: 'dshgg-cleanTitle' }, t('clean.title')),
      h('span', { className: 'dshgg-cleanDesc' }, t('clean.desc'))) : null,
    graphRows(t, graph, graphLoading, graphFailure, openSections.graph === true, () => toggleSection('graph'), () => { void loadGraph() }, menu),
  )

  const commitHint = stagedFiles.length > 0 ? t('commit.hint') : t('commit.hintNone')
  const placeholder = repo === null ? t('commit.placeholder', { branch: '' }) : t('commit.placeholder', { branch: branchLabel ?? '' })

  return h('div', { className: 'dshgg-root', 'data-dsh-git-graph': '' },
    h('div', { className: 'dshgg-toolbar' },
      h('div', { className: 'dshgg-branchWrap', ref: wrapRef },
        h('button', {
          type: 'button',
          className: 'dshgg-branchChip',
          onClick: toggleBranchMenu,
          disabled: repo === null || busy !== null,
          'aria-haspopup': 'menu',
          'aria-expanded': branchMenu,
          title: repo === null ? t('noRepo.title') : t('branch.menu'),
        },
        h(GitBranchIcon, { size: 14 }),
        h('span', { className: 'dshgg-branchName' }, branchLabel ?? t('loading')),
        ahead > 0 ? h('span', { className: 'dshgg-sync', title: t('branch.ahead', { n: ahead }) }, h('span', null, '\u2191'), String(ahead)) : null,
        behind > 0 ? h('span', { className: 'dshgg-sync', title: t('branch.behind', { n: behind }) }, h('span', null, '\u2193'), String(behind)) : null,
        repo?.upstream !== undefined && repo?.upstream !== null
          ? h('span', { className: 'dshgg-upstream', title: t('branch.upstream', { name: repo.upstream }) }, repo.upstream)
          : null,
        h(ChevronDownIcon, { size: 12 })),
        branchMenu ? h(BranchMenu, {
          t,
          branches,
          loading: branchLoading,
          failure: branchFailure,
          onPick: checkout,
          onRetry: () => { void loadBranches() },
        }) : null),
      h('span', { className: 'dshgg-spacer' }),
      h(IconButton, {
        label: t('refresh'),
        title: t('refresh'),
        disabled: busy !== null,
        spinning: busy === 'refresh',
        onClick: refreshAll,
      }, h(RefreshIcon, { size: 14 }))),
    repo === null ? null : h('div', { className: 'dshgg-commitBox' },
      h('textarea', {
        className: 'dshgg-commitMessage',
        value: message,
        rows: 3,
        spellCheck: false,
        placeholder,
        'aria-label': t('commit.action'),
        disabled: busy !== null,
        onChange: (event) => setMessage(event.target.value),
        onKeyDown: (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault()
            requestCommit()
          }
        },
      }),
      h('div', { className: 'dshgg-commitRow' },
        h('span', { className: 'dshgg-commitHint', title: commitHint }, commitHint),
        h('button', {
          type: 'button',
          className: 'dshgg-btn dshgg-btnPrimary',
          disabled: message.trim() === '' || busy !== null,
          onClick: requestCommit,
        }, busy === 'commit' ? t('commit.committing') : t('commit.action')))),
    loadFailure !== null && status !== null ? h(Banner, {
      title: t('error.title'),
      detail: errorText(t, loadFailure),
      retryLabel: t('retry'),
      onRetry: () => { void loadStatus() },
      dismissLabel: t('action.dismiss'),
      onDismiss: () => setLoadFailure(null),
    }) : null,
    actionFailure !== null ? h(Banner, {
      title: t('error.title'),
      detail: errorText(t, actionFailure),
      dismissLabel: t('action.dismiss'),
      onDismiss: () => setActionFailure(null),
    }) : null,
    notice !== null ? h('div', { className: 'dshgg-notice', role: 'status' }, notice) : null,
    h('div', { className: 'dshgg-scroll' }, body),
    confirm !== null ? h('div', { className: 'dshgg-confirm', role: 'alertdialog', 'aria-label': confirmTitle(t, confirm) },
      h('div', { className: 'dshgg-confirmText' },
        h('div', { className: 'dshgg-confirmTitle' }, confirmTitle(t, confirm)),
        confirmDescription(t, confirm) === '' ? null : h('div', { className: 'dshgg-confirmDesc' }, confirmDescription(t, confirm))),
      h('div', { className: 'dshgg-confirmActions' },
        h('button', { type: 'button', className: 'dshgg-btn dshgg-btnGhost', disabled: busy !== null, onClick: () => setConfirm(null) }, t('action.cancel')),
        h('button', { type: 'button', className: 'dshgg-btn dshgg-btnPrimary', disabled: busy !== null, onClick: confirmAction }, confirmActionLabel(t, confirm)))) : null,
  )
}

function graphRows(t, commits, loading, failure, open, onToggle, onRetry, menu) {
  const rows = []
  const trigger = menu === undefined ? null : menu.trigger
  if (loading === true && commits === null) {
    rows.push(h('div', { key: 'loading', className: 'dshgg-menuNote' }, t('graph.loading')))
  } else if (failure !== null) {
    rows.push(h(Banner, {
      key: 'error',
      title: t('error.title'),
      detail: errorText(t, failure),
      retryLabel: t('retry'),
      onRetry,
    }))
  } else if (commits === null || commits.length === 0) {
    rows.push(h('div', { key: 'empty', className: 'dshgg-menuNote' }, t('graph.empty')))
  } else {
    for (const commit of commits) {
      rows.push(h(GraphRow, {
        key: commit.oid,
        commit,
        t,
        menuTrigger: trigger,
        menuTarget: menu === undefined || trigger === null ? undefined : menu.commitTarget(commit),
      }))
    }
  }
  return h(Section, {
    id: 'graph',
    title: t('sections.graph'),
    count: commits === null ? undefined : commits.length,
    open: open,
    onToggle,
    menuTrigger: trigger,
    menuHint: t('menu.hint'),
    menuTarget: menu === undefined || trigger === null ? undefined : menu.sectionTarget('graph'),
  }, rows)
}

function GraphRow(props) {
  const commit = props.commit
  const t = props.t
  const refs = parseRefs(commit.refs)
  const visibleRefs = refs.slice(0, 3)
  const hidden = refs.length - visibleRefs.length
  const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
  const menuProps = menuTrigger === null || props.menuTarget === undefined
    ? null
    : menuTrigger(props.menuTarget, { tabIndex: 0, 'aria-haspopup': 'menu' })
  return h('div', {
    className: 'dshgg-graphRow',
    title: `${commit.shortOid} ${commit.subject} \u00b7 ${t('menu.hint')}`,
    ...(menuProps ?? {}),
  },
    h('pre', { className: 'dshgg-graphPrefix' }, commit.graph === '' ? '*' : commit.graph),
    h('div', { className: 'dshgg-graphBody' },
      h('div', { className: 'dshgg-graphSubject' }, commit.subject === '' ? t('graph.noSubject') : commit.subject),
      h('div', { className: 'dshgg-graphMeta' },
        h('span', { className: 'dshgg-graphHash' }, commit.shortOid),
        h('span', { className: 'dshgg-dot' }, '\u00b7'),
        h('span', null, commit.author),
        h('span', { className: 'dshgg-dot' }, '\u00b7'),
        h('span', null, formatAgo(t, commit.authoredAt)),
        visibleRefs.length === 0 ? null : h('span', { className: 'dshgg-refs' },
          visibleRefs.map((ref, index) => h('span', { key: `${ref.label}:${index}`, className: 'dshgg-ref', 'data-kind': ref.kind, title: ref.label }, ref.label)),
          hidden > 0 ? h('span', { key: 'more', className: 'dshgg-ref', title: refs.slice(3).map((ref) => ref.label).join(', ') }, `+${hidden}`) : null))))
}

// ------------------------------------------------------------------
// Plugin
// ------------------------------------------------------------------

const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight']

function apply(ctx) {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'git-graph: dictionaries')

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: GIT_ID,
    kind: GIT_KIND,
    priority: 'extension',
    title: () => t('title'),
    guide: [{
      id: 'source-control',
      commandId: GIT_SHORTCUT,
      order: 20,
      title: () => t('guideTitle'),
      description: () => t('guideDescription'),
      icon: GitBranchIcon,
    }],
  }), 'git-graph: git tab type')

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: DIFF_ID,
    kind: DIFF_KIND,
    title: () => t('diff.title'),
  }), 'git-graph: diff tab type')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: GIT_ID,
    locale: NS,
  }, GitPanel)), 'git-graph: git tab body')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: GIT_ID,
    locale: NS,
  }, GitTabTitle)), 'git-graph: git tab title')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: DIFF_ID,
    locale: NS,
  }, DiffPanel)), 'git-graph: diff tab body')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: DIFF_ID,
    locale: NS,
  }, DiffTabTitle)), 'git-graph: diff tab title')

  try {
    ctx.inject(['shortcuts'], (shortcutCtx) => {
      try {
        shortcutCtx.effect(() => shortcutCtx.shortcuts.register({
        id: GIT_SHORTCUT,
        label: () => t('title'),
        aliases: ['git', 'source control', 'source-control'],
        defaults: {
          'desktop:macos': { code: 'KeyG', modifiers: ['primary', 'shift'] },
          'desktop:windows': { code: 'KeyG', modifiers: ['primary', 'shift'] },
          'desktop:linux': { code: 'KeyG', modifiers: ['primary', 'shift'] },
          'web:macos': { code: 'KeyG', modifiers: ['primary', 'shift'] },
          'web:windows': { code: 'KeyG', modifiers: ['primary', 'shift'] },
        },
        regions: ['page', 'editable', 'terminal'],
        modals: [],
        resolve: ({ target }) => {
          const resolved = ctx.sidebarRight.commandTarget(target)
          if (resolved === undefined) return { status: 'blocked', reason: t('shortcut.noSession') }
          return {
            status: 'handled',
            run: () => { ctx.sidebarRight.openTabFromTarget(GIT_KIND, resolved) },
          }
        },
        }), 'git-graph: toggle shortcut')
      } catch (error) {
        console.warn('[git-graph] shortcut registration failed', error)
      }
    })
  } catch (error) {
    console.warn('[git-graph] shortcut registration failed', error)
  }

  try {
    ctx.inject(['contextMenus'], (menuCtx) => {
      try {
        // The shared registry calls a contribution with the value captured
        // by the trigger, not with the { kind, value } target the trigger
        // received. Unwrapping again here leaves every menu empty.
        menuCtx.effect(() => menuCtx.contextMenus.register({
          id: MENU_CONTRIBUTION_ID,
          target: MENU_TARGET,
          order: 10,
          resolve: (value) => resolveMenuActions(
            value,
            t,
            (text, success) => menuCtx.contextMenus.notify(text, success),
          ),
        }), 'git-graph: context menu actions')
      } catch (error) {
        console.warn('[git-graph] context menu registration failed', error)
      }
    })
  } catch (error) {
    console.warn('[git-graph] context menu binding failed', error)
  }
}

export { inject, apply }

