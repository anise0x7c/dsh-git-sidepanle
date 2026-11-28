/**
 * Shared harness for the rendered-UI tests.
 *
 * `loadUiPanel` evaluates the built bundle once per test process, `mountGit`
 * mounts the real panel component over the mini React runtime, and the
 * helpers below read the resolved element tree without reaching into
 * component internals. Every harness and bundle lifetime is registered so a
 * failing assertion still restores the timer, fetch and document globals.
 */

import assert from 'node:assert/strict'
import type { ToastStore } from '../../src/client/toast/notify.ts'
import type {
  BranchesResult,
  CommitDetails,
  GraphReferences,
  HistoryResult,
  RemotesResult,
  StatusResult,
  WatchState,
} from '../../src/shared/git.ts'
import {
  createFakeContext,
  dispatchDocumentKeydown,
  loadClientBundle,
  translate,
} from './fake-ctx.ts'
import { createMenuMock } from './fake-menu.ts'
import { BRANCHES, COMMIT_DETAILS, HISTORY, REMOTES, STATUS } from './fixtures.ts'
import { createHarness as createHarnessRuntime } from './mini-react.ts'
import type {
  CapturedTarget,
  ClientRegistration,
  ContextMenuContribution,
  ContextMenusService,
  DocumentStub,
  FetchResponseLike,
  MenuMock,
  MenuNotification,
  OpenedTab,
  RpcRequestRecord,
  SlotRegistration,
  TestComponent,
  TestContextMenusService,
  TestElement,
  TestEventTarget,
  TestHarness,
  TestMenuActionView,
  TestNode,
  TestProps,
} from './types.ts'

let loader: Promise<void> | undefined

/** The tab fixture the mounted panel reads through `useTabInfo`. */
export interface UiTab {
  id: string
  title: string
  visible: boolean
  signal: AbortSignal
  actions: {
    openTab(kind: string, options: { params: Record<string, unknown> }): void
    openResource(): void
    close(): void
    bindCommands(): () => void
  }
  navigation: { address?: string; params?: Record<string, unknown>; revision: number }
}

/** One tab-info hook stand-in. */
export type UiTabInfo = () => TestProps

/** Mount options a test may override. */
export interface MountOptions {
  status?: StatusResult
  history?: HistoryResult
  /** `history` answers in call order; the last page repeats once exhausted. */
  historyPages?: HistoryResult[]
  /** Zero-based `history` request indexes that answer with a failure. */
  failHistoryPages?: number[]
  branches?: BranchesResult
  commitDetails?: CommitDetails
  /** Default `remotes` response; the fixture carries one `origin`. */
  remotes?: RemotesResult
  /** `remotes` responses in call order; the last repeats. */
  remotesPages?: RemotesResult[]
  /** Zero-based `remotes` request indexes that answer with a failure. */
  failRemotesPages?: number[]
  /** Current `watch` counters; defaults to a watching repository with zero counters. */
  watchState?: () => WatchState
  /** `references` responses in call order; the last repeats. */
  referencePages?: GraphReferences[]
  failOp?: string
  /** Pause one operation before responding so busy controls can be exercised. */
  pending?: { op: string; until: Promise<void> }
  /** `status` answers in call order; the last repeats once exhausted. */
  statusPages?: StatusResult[]
  /** Zero-based `status` request indexes that answer with a failure. */
  failStatusPages?: number[]
  /** Deferred fences awaited before the matching zero-based `status` call answers. */
  statusGates?: (Promise<void> | undefined)[]
  /** Locale override for long translated copy and action labels. */
  t?: typeof translate
  diff?: boolean
  /** Provide the host's context-menu trigger hook; false removes only the trigger. */
  menus?: boolean
  /** Provide the optional shared notification/menu service to `ctx.inject`. */
  menuService?: boolean
  /** Module-table entries beside React the bundle may request. */
  hostModules?: Record<string, unknown>
  tabInfo?: UiTabInfo
}

/** Components loaded from one bundle registration. */
export interface LoadedComponents {
  git: TestComponent
  diff: TestComponent
  gitTitle: TestComponent
  diffTitle: TestComponent
  contextMenus: TestContextMenusService
  contributions: ContextMenuContribution[]
  /** Toasts the bundle delivered through the host service. */
  notifications: MenuNotification[]
  /** Slot registrations, including the inject faces the host merges into props. */
  slots: SlotRegistration[]
  /** Dispose every effect the bundle registered, as unloading the plugin would. */
  dispose(): void
}

/** One mounted panel plus its recorders. */
export interface MountedGit {
  harness: TestHarness
  calls: RpcRequestRecord[]
  openedTabs: OpenedTab[]
  components: LoadedComponents
  useTabInfo: UiTabInfo
  menu: MenuMock
}

let registration: ClientRegistration

/**
 * Lifetimes created by the running test. A failing assertion skips the
 * `dispose()` call at the end of a test body, so everything created here is
 * disposed in reverse at the end of the test as a safety net. Explicit
 * disposal stays valid: both the harness and the bundle lifetime are
 * idempotent.
 */
const lifetimes: Array<() => void | Promise<void>> = []

/** Document-level pointerdown listeners registered by the mounted bundle. */
const documentPointerdownListeners = new Set<(event: { target?: unknown }) => void>()

/**
 * Record the pointerdown listeners the bundle adds to the shared document
 * stand-in; `fake-ctx` only forwards keydown. The bundle keeps using the same
 * document API the real page provides.
 */
export function installPointerdownRecorder(): void {
  const doc = (globalThis as unknown as { document?: DocumentStub }).document
  if (doc === undefined) return
  const add = doc.addEventListener.bind(doc)
  const remove = doc.removeEventListener.bind(doc)
  doc.addEventListener = (type: string, listener: unknown): void => {
    if (type === 'pointerdown') {
      documentPointerdownListeners.add(listener as (event: { target?: unknown }) => void)
      return
    }
    add(type, listener)
  }
  doc.removeEventListener = (type: string, listener: unknown): void => {
    if (type === 'pointerdown') {
      documentPointerdownListeners.delete(listener as (event: { target?: unknown }) => void)
      return
    }
    remove(type, listener)
  }
}

/** Dispatch one outside pointerdown to the listeners registered on `document`. */
export function dispatchDocumentPointerdown(target: unknown): void {
  for (const listener of [...documentPointerdownListeners]) listener({ target })
}

/** Register one lifetime for the test's final cleanup. */
export function trackLifetime(dispose: () => void | Promise<void>): void {
  lifetimes.push(dispose)
}

/** Create one mini React harness and register its disposal as a fallback. */
export function createHarness(options: Parameters<typeof createHarnessRuntime>[0]): TestHarness {
  const harness = createHarnessRuntime(options)
  trackLifetime(() => harness.dispose())
  return harness
}

/**
 * Build one harness, load the bundle components against it, and mount a panel.
 * @param options - mount options.
 * @returns mounted test context.
 */
export async function mountGit(options: MountOptions = {}): Promise<MountedGit> {
  const calls: RpcRequestRecord[] = []
  const statusPages = options.statusPages ?? [options.status ?? STATUS]
  const failedStatusPages = new Set(options.failStatusPages ?? [])
  const responses: Record<string, unknown> = {
    history: options.history ?? HISTORY,
    branches: options.branches ?? BRANCHES,
    'commit-details': options.commitDetails ?? COMMIT_DETAILS,
  }
  let statusPage = 0
  const historyPages = options.historyPages ?? [options.history ?? HISTORY]
  const failedHistoryPages = new Set(options.failHistoryPages ?? [])
  const referencePages = options.referencePages ?? [(options.history ?? HISTORY).references]
  let historyPage = 0
  let referencePage = 0
  let remotesPage = 0
  const failedRemotesPages = new Set(options.failRemotesPages ?? [])
  const remotesPages = options.remotesPages ?? [options.remotes ?? REMOTES]
  const harness = createHarness({
    fetch: async (_url: string, init: { body: string }): Promise<FetchResponseLike> => {
      const request = JSON.parse(init.body) as RpcRequestRecord
      calls.push(request)
      if (request.op === options.pending?.op) await options.pending.until
      if (request.op === 'status') {
        const index = statusPage
        statusPage += 1
        const gate = options.statusGates?.[index]
        if (gate !== undefined) await gate
        if (failedStatusPages.has(index) || options.failOp === 'status') {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              ok: false,
              error: { code: 'git-command-failed', message: 'git said no' },
            }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            value: statusPages[Math.min(index, statusPages.length - 1)],
          }),
        }
      }
      if (request.op === 'watch') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            value: options.watchState?.() ?? { watching: true, worktree: 0, references: 0 },
          }),
        }
      }
      if (request.op === 'references') {
        const index = referencePage
        referencePage += 1
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            value: referencePages[Math.min(index, referencePages.length - 1)],
          }),
        }
      }
      if (request.op === 'remotes') {
        const index = remotesPage
        remotesPage += 1
        if (failedRemotesPages.has(index) || options.failOp === 'remotes') {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              ok: false,
              error: { code: 'git-command-failed', message: 'git said no' },
            }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            value: remotesPages[Math.min(index, remotesPages.length - 1)],
          }),
        }
      }
      if (request.op === 'unwatch') {
        return { ok: true, status: 200, json: async () => ({ ok: true, value: { ok: true } }) }
      }
      if (request.op === 'history') {
        const index = historyPage
        historyPage += 1
        if (failedHistoryPages.has(index)) {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              ok: false,
              error: { code: 'git-command-failed', message: 'git said no' },
            }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            value: historyPages[Math.min(index, historyPages.length - 1)],
          }),
        }
      }
      if (options.failOp !== undefined && request.op === options.failOp) {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            ok: false,
            error: { code: 'git-command-failed', message: 'git said no' },
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, value: responses[request.op] ?? { ok: true } }),
      }
    },
    component: null,
    props: {},
  })
  const openedTabs: OpenedTab[] = []
  const tab: UiTab = {
    id: 'tab-1',
    title: 'Source control',
    visible: true,
    signal: new AbortController().signal,
    actions: {
      openTab: (kind, openOptions) => {
        openedTabs.push({ kind, options: openOptions })
      },
      openResource: () => {},
      close: () => {},
      bindCommands: () => () => {},
    },
    navigation: { address: 'sidebar://git', params: {}, revision: 0 },
  }
  // The panel calls this like a hook, but it is a plain callback closing over
  // this mount's tab, so it cannot live at module scope.
  // biome-ignore lint/correctness/noComponentHookFactories: a per-mount tab-info callback, not a React hook.
  const useTabInfo: UiTabInfo = () => ({
    sidebar: { expanded: true, fullscreen: false },
    panel: { id: 'pane-1', isFloating: false },
    tab,
  })
  const components = loadComponents(harness, {
    ...(options.menuService === undefined ? {} : { contextMenus: options.menuService }),
    ...(options.hostModules === undefined ? {} : { hostModules: options.hostModules }),
  })
  const component = options.diff === true ? components.diff : components.git
  const menu = createMenuMock()
  const panelProps: TestProps = {
    sessionId: 'session-1',
    t: options.t ?? translate,
    useTabInfo: options.tabInfo ?? useTabInfo,
    useSessions: () => undefined,
    ...(options.menus === false ? {} : { useContextMenu: menu.useContextMenu }),
  }
  const toast = nativeToastHost(components)
  if (toast === undefined) {
    harness.setComponent(component, panelProps)
  } else {
    // The bundle adds a frame-wide Toast host next to the panel. Render both
    // as siblings so the native toast surface is exercised alongside the
    // panel it reports for. The seat types are the loaded components
    // themselves, so mounting keeps one stable type per element.
    harness.setComponent(
      () => ({
        type: 'div',
        props: { 'data-test-root': '' },
        children: [
          { type: component, props: panelProps, children: [] },
          { type: toast.component, props: toast.props, children: [] },
        ],
      }),
      {},
    )
  }
  await harness.render()
  return { harness, calls, openedTabs, components, useTabInfo, menu }
}

/** Read one registered slot component, failing loudly when the seat is empty. */
export function slotComponent(seats: Map<string, TestComponent>, seat: string): TestComponent {
  const component = seats.get(seat)
  assert.ok(component !== undefined, `no slot component registered for ${seat}`)
  return component
}

/**
 * Load the bundle's slot components, mirroring the host's Slot composition:
 * each registration's inject face is merged into the props its component sees.
 * @param harness - mini React runtime the bundle requires.
 * @param options - optional host-service and module-table availability.
 * @returns components, service recorders and a lifetime disposer.
 */
export function loadComponents(
  harness: TestHarness,
  options: { contextMenus?: boolean; hostModules?: Record<string, unknown> } = {},
): LoadedComponents {
  const module = registration.factory((specifier) => {
    if (specifier === 'react') return harness.React
    const hostModule = options.hostModules?.[specifier]
    if (hostModule !== undefined) return hostModule
    throw new Error(`unexpected require("${specifier}")`)
  })
  const fake =
    options.contextMenus === undefined
      ? createFakeContext()
      : createFakeContext({ contextMenus: options.contextMenus })
  // Register the bundle lifetime before applying it: a throw in `apply` still
  // leaves registered effects for the file-level cleanup to unwind.
  trackLifetime(() => fake.dispose())
  module.apply(fake.ctx)
  const bySeat = new Map(
    fake.records.slots.map(({ options: slot, component }) => {
      const face = slot.inject?.() ?? {}
      const injected: TestComponent = (props) => component({ ...props, ...face })
      return [`${slot.name}:${slot.key}`, injected]
    }),
  )
  return {
    git: slotComponent(bySeat, 'sidebar.right.pane.tab:@local/dsh-git-graph/git'),
    diff: slotComponent(bySeat, 'sidebar.right.pane.tab:@local/dsh-git-graph/diff'),
    gitTitle: slotComponent(bySeat, 'sidebar.right.pane.tab.title:@local/dsh-git-graph/git'),
    diffTitle: slotComponent(bySeat, 'sidebar.right.pane.tab.title:@local/dsh-git-graph/diff'),
    contextMenus: fake.menu.contextMenus,
    contributions: fake.menu.contributions,
    notifications: fake.menu.notifications,
    slots: fake.records.slots,
    dispose: () => fake.dispose(),
  }
}

/** The Toast callback the Git pane's Slot registration injects. */
export function slotNotify(components: LoadedComponents): ContextMenusService['notify'] {
  const gitBody = components.slots.find(
    ({ options }) =>
      options.name === 'sidebar.right.pane.tab' && options.key === '@local/dsh-git-graph/git',
  )
  assert.ok(gitBody, 'the Git pane body was not registered')
  const notify = gitBody.options.inject?.().notify
  assert.equal(typeof notify, 'function', 'the Git pane registration injects notify')
  return notify as ContextMenusService['notify']
}

/** Whether a rendered node is an element object. */
export function isElement(node: TestNode): node is TestElement {
  return typeof node === 'object' && node !== null && !Array.isArray(node)
}

/** Narrow one rendered node to an element. */
export function elementOf(node: TestNode): TestElement {
  assert.ok(isElement(node), 'expected a rendered element')
  return node
}

export function buttonByLabel(harness: TestHarness, label: string): TestElement {
  const buttons = harness.findAll(
    (element) => element.type === 'button' && element.props['aria-label'] === label,
  )
  assert.ok(buttons.length > 0, `no button labelled "${label}"`)
  const button = buttons[0]
  assert.ok(button)
  return button
}

export function collectElements(
  element: TestNode,
  predicate: (element: TestElement) => boolean,
): TestElement[] {
  const found: TestElement[] = []
  const visit = (node: TestNode): void => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (!isElement(node)) return
    if (predicate(node)) found.push(node)
    for (const child of node.children) visit(child)
  }
  visit(element)
  return found
}

export function elementText(element: TestNode): string {
  const parts: string[] = []
  const walk = (node: TestNode): void => {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') {
      parts.push(String(node))
      return
    }
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    for (const child of node.children) walk(child)
  }
  walk(element)
  return parts.join(' ').trim()
}

export function buttonContaining(harness: TestHarness, label: string): TestElement {
  const buttons = harness.findAll(
    (element) => element.type === 'button' && elementText(element) === label,
  )
  assert.ok(buttons.length > 0, `no button containing "${label}"`)
  const button = buttons[0]
  assert.ok(button)
  return button
}

export function remoteMenuItem(mounted: MountedGit, label: string): TestElement {
  const [item] = mounted.harness.findAll(
    (element) =>
      element.type === 'button' &&
      hasClass(element, 'dshgg-menuItem') &&
      elementText(element) === label,
  )
  assert.ok(item, `no remote menu item labelled "${label}"`)
  return item
}

/** Expand the Remote disclosure inside an open overflow menu. */
export async function openRemoteGroup(mounted: MountedGit): Promise<void> {
  mounted.harness.click(remoteMenuItem(mounted, 'remote.group'))
  await mounted.harness.flush()
}

/** Find one labelled text input in the open remote form. */
export function dialogInput(mounted: MountedGit, label: string): TestElement | undefined {
  return mounted.harness.findAll(
    (element) => element.type === 'input' && element.props['aria-label'] === label,
  )[0]
}

/** Count the `remotes` reads the panel has made. */
export function remotesCalls(mounted: MountedGit): number {
  return mounted.calls.filter((call) => call.op === 'remotes').length
}

/** Open the commit graph header's overflow menu and let its remote read settle. */
export async function openRemoteMenu(mounted: MountedGit): Promise<void> {
  mounted.harness.click(buttonByLabel(mounted.harness, 'remote.menu'))
  await mounted.harness.flush()
}

export function buttonInside(element: TestElement, label: string): TestElement {
  const buttons: TestElement[] = []
  const walk = (node: TestNode): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!isElement(node)) return
    if (node.type === 'button' && node.props?.['aria-label'] === label) buttons.push(node)
    for (const child of node.children) walk(child)
  }
  walk(element.children)
  assert.ok(buttons.length > 0, `no button labelled "${label}" inside the row`)
  const button = buttons[0]
  assert.ok(button)
  return button
}

/** Find the commit graph section so a control can be checked inside it. */
export function graphSection(mounted: MountedGit): TestElement {
  const [section] = mounted.harness.findAll(
    (element) => element.type === 'section' && element.props['data-section'] === 'graph',
  )
  assert.ok(section, 'no commit graph section rendered')
  return section
}

/** Find one button inside the commit graph section header. */
export function graphHeaderButton(mounted: MountedGit, label: string): TestElement {
  return buttonInside(graphSection(mounted), label)
}

export function buttonByText(harness: TestHarness, text: string): TestElement {
  const buttons = harness.findAll((element) => {
    if (element.type !== 'button' && element.type !== 'div') return false
    return element.children.some((child) => child === text)
  })
  assert.ok(buttons.length > 0, `no control with text "${text}"`)
  const button = buttons[0]
  assert.ok(button)
  return button
}

/** Open the split commit button's action menu. */
export async function openCommitMenu(mounted: MountedGit): Promise<void> {
  mounted.harness.click(buttonByLabel(mounted.harness, 'commit.menu'))
  await mounted.harness.flush()
}

/** Every rendered commit-menu entry, in menu order, without the separator. */
export function commitMenuItems(mounted: MountedGit): TestElement[] {
  return mounted.harness.findAll(
    (element) => element.type === 'button' && element.props['data-action'] !== undefined,
  )
}

/** Find one commit-menu entry by its `data-action`. */
export function commitMenuItem(mounted: MountedGit, action: string): TestElement {
  const item = commitMenuItems(mounted).find((element) => element.props['data-action'] === action)
  assert.ok(item, `no commit menu item "${action}"`)
  return item
}

/** Check the shared accessible content/footer contract, not component internals. */
export function floatingPanel(
  harness: TestHarness,
  description = true,
): {
  dialog: TestElement
  body: TestElement
  footer: TestElement
} {
  const dialogs = harness.findAll((element) => element.props.role === 'alertdialog')
  assert.equal(dialogs.length, 1, 'exactly one operation prompt is visible')
  const [dialog] = dialogs
  assert.ok(dialog)
  assert.ok(hasClass(dialog, 'dshgg-floating-panel'), 'the prompt uses the shared floating card')
  assert.equal(dialog.props['aria-modal'], undefined, 'the operation prompt stays nonmodal')
  assert.equal(typeof dialog.props['aria-label'], 'string')
  assert.notEqual(String(dialog.props['aria-label']).trim(), '', 'the dialog has a name')
  const [body] = collectElements(dialog, (element) =>
    hasClass(element, 'dshgg-floating-panel-body'),
  )
  const [footer] = collectElements(dialog, (element) =>
    hasClass(element, 'dshgg-floating-panel-footer'),
  )
  assert.ok(body, 'the prompt has its own scroll body')
  assert.ok(footer, 'the prompt has a separate action footer')
  assert.ok(dialog.children.includes(body) && dialog.children.includes(footer))
  assert.ok(dialog.children.indexOf(body) < dialog.children.indexOf(footer))
  assert.equal(collectElements(body, (element) => element === footer).length, 0)
  assert.equal(collectElements(footer, (element) => element.type === 'button').length, 2)
  const describedBy = dialog.props['aria-describedby']
  if (description) {
    assert.equal(typeof describedBy, 'string', 'copy is associated with the dialog')
    const descriptions = collectElements(body, (element) => element.props.id === describedBy)
    assert.equal(descriptions.length, 1, 'description resolves inside the scrolling content')
    assert.notEqual(elementText(descriptions[0]).trim(), '', 'description is not empty')
  } else {
    assert.equal(describedBy, undefined, 'a title-only prompt has no dangling description id')
    assert.equal(
      collectElements(body, (element) => hasClass(element, 'dshgg-confirmDesc')).length,
      0,
      'a title-only prompt has no empty description block',
    )
  }
  return { dialog, body, footer }
}

/** Whether one public DOM class is present. */
export function hasClass(element: TestElement, name: string): boolean {
  return String(element.props.className ?? '')
    .split(/\s+/)
    .includes(name)
}

/**
 * Finish any exit animation and render what it was hiding. A dismissed prompt
 * and a returning details view stay mounted while they leave, so a test that
 * wants the surface gone runs the pending motion timer and flushes again.
 */
export async function finishMotion(harness: TestHarness): Promise<void> {
  // The close renders first: its effect is what schedules the exit timer.
  await harness.flush()
  harness.runTimeouts()
  await harness.flush()
}

/** Dispatch one Escape keydown to the listeners registered on `document`. */
export function escapeKeydown(defaultPrevented = false): { prevented: boolean; stopped: boolean } {
  const result = { prevented: false, stopped: false }
  dispatchDocumentKeydown({
    key: 'Escape',
    defaultPrevented,
    preventDefault: () => {
      result.prevented = true
    },
    stopPropagation: () => {
      result.stopped = true
    },
    target: {},
  })
  return result
}

/** Capture a fresh graph-row target through the host-shaped context menu. */
export function graphMenuTarget(mounted: MountedGit, invoker?: TestEventTarget): CapturedTarget {
  const [row] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-graphRow'))
  assert.ok(row)
  mounted.harness.contextmenu(row, invoker === undefined ? {} : { currentTarget: invoker })
  return lastTarget(mounted.menu)
}

/** Open an inline discard without executing the repository operation. */
export async function openDiscard(mounted: MountedGit, path = 'src/app.js'): Promise<void> {
  const row = mounted.harness
    .findAll((element) => hasClass(element, 'dshgg-fileRow') && element.props.title === path)
    .at(-1)
  assert.ok(row, `no changed-file row rendered for ${path}`)
  mounted.harness.click(buttonInside(row, 'actions.discard'))
  await mounted.harness.flush()
}

/**
 * Build a two-page history: two recent commits on the first page and the root
 * commit on the second.
 * @returns the first and last `history` responses.
 */
export function pagedHistory(): { first: HistoryResult; second: HistoryResult } {
  const now = Math.floor(Date.now() / 1000)
  const oid = (character: string): string => character.repeat(40)
  const commit = (
    character: string,
    parents: string[],
    subject: string,
    authoredAt: number,
  ): HistoryResult['commits'][number] => ({
    oid: oid(character),
    shortOid: character.repeat(7),
    author: 'Ann',
    authoredAt,
    refs: character === 'c' ? 'HEAD -> refs/heads/main' : '',
    parents,
    subject,
  })
  const references: HistoryResult['references'] = {
    current: { id: 'refs/heads/main', name: 'main', revision: oid('c') },
    remote: null,
    base: null,
  }
  return {
    first: {
      commits: [
        commit('c', [oid('b')], 'Recent work', now - 60),
        commit('b', [oid('a')], 'Older work', now - 3600),
      ],
      hasMore: true,
      references,
    },
    second: {
      commits: [commit('a', [], 'Root commit', now - 7200)],
      hasMore: false,
      references,
    },
  }
}

/** Find the rendered commit rows of the graph. */
export function graphRows(harness: TestHarness): TestElement[] {
  return harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )
}

/** Find the rows an expanded commit lists below itself. */
export function changeRows(harness: TestHarness): TestElement[] {
  return harness.findAll((element) =>
    String(element.props?.className ?? '')
      .split(' ')
      .includes('dshgg-graphChange'),
  )
}

/** Find the details card that overlays the still-mounted panel content. */
export function commitCard(harness: TestHarness): TestElement {
  const [card] = harness.findAll((element) => hasClass(element, 'dshgg-commitCard'))
  assert.ok(card, 'no commit details card rendered')
  return card
}

/** Open one commit's details view through its row's View Details menu action. */
export async function openCommitDetails(mounted: MountedGit, index = 0): Promise<void> {
  const row = graphRows(mounted.harness)[index]
  assert.ok(row, 'no graph row rendered')
  mounted.harness.contextmenu(row, { clientX: 1, clientY: 2 })
  await mounted.harness.flush()
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'view-details')
  await mounted.harness.flush()
}

/** Contribution id of the bundle's context-menu provider. */
export const MENU_ID = 'git-graph.actions'

/** A resolved action id as the shared registry publishes it. */
export const menuActionId = (id: string): string => `${MENU_ID}/${id}`

/** Resolve the actions the shared overlay would show for a captured trigger target.
 *
 * The stand-in mirrors the shipped registry, which calls a contribution with the
 * captured target's value rather than the `{ kind, value }` wrapper the trigger
 * received. Calling the contribution directly with the wrapper would hide the
 * contract mismatch that opened empty menus in the real page.
 */
export function menuActions(
  components: LoadedComponents,
  target: CapturedTarget,
): TestMenuActionView[] {
  assert.equal(components.contributions.length, 1, 'no context-menu contribution was registered')
  return components.contextMenus.resolve(target).source.getSnapshot()
}

/** Read the most recently bound target, failing when no menu opened. */
export function lastTarget(menu: MenuMock): CapturedTarget {
  const open = menu.opens.at(-1)
  assert.ok(open, 'no context-menu target was bound')
  return open.target
}

/** Resolve and run one root or nested action from a captured menu target. */
export async function runMenuAction(
  components: LoadedComponents,
  target: CapturedTarget,
  ...ids: readonly [string, ...string[]]
): Promise<void> {
  const resolution = components.contextMenus.resolve(target)
  let candidates: readonly TestMenuActionView[] = resolution.source.getSnapshot()
  let published = MENU_ID
  for (const [index, id] of ids.entries()) {
    published += `/${encodeURIComponent(id)}`
    const action = candidates.find((candidate: TestMenuActionView) => candidate.id === published)
    assert.ok(action, `no context-menu action "${published}"`)
    if (index === ids.length - 1) {
      resolution.select(action.id)
      await new Promise<void>((resolve) => {
        setImmediate(resolve)
      })
      return
    }
    candidates = action.children ?? []
  }
}

/** Badge elements rendered inside one row. */
export function badgesIn(row: TestElement | undefined): TestElement[] {
  assert.ok(row, 'the row is rendered')
  return collectElements(row, (element) =>
    String(element.props?.className ?? '')
      .split(' ')
      .includes('dshgg-graphBadge'),
  )
}

/** Count recorded calls of one operation. */
export function opCount(mounted: MountedGit, op: string): number {
  return mounted.calls.filter((call) => call.op === op).length
}

/** One externally released await used to hold a Host answer open. */
export function deferred(): { readonly promise: Promise<void>; readonly release: () => void } {
  let release = (): void => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

/** The commit box textarea, whose disabled state follows the busy lock. */
export function commitBox(harness: TestHarness): TestElement | undefined {
  return harness.findAll((element) => element.type === 'textarea')[0]
}

/** Hold a status poll open, so a write lands while the old snapshot is in flight. */
export async function holdSlowStatusPoll(mounted: MountedGit, counters: () => void): Promise<void> {
  counters()
  mounted.harness.runIntervals()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2, 'the poll status read is in flight')
}

/**
 * Read the native Toast host registration the bundle adds to the frame overlay.
 * @param components - loaded bundle components.
 * @returns the host component, its injected store face, and the store.
 */
export function nativeToastHost(
  components: LoadedComponents,
): { component: TestComponent; props: TestProps; store: ToastStore } | undefined {
  const overlay = components.slots.find(({ options }) => options.name === 'shell.overlay')
  if (overlay === undefined) return undefined
  const props = overlay.options.inject?.() ?? {}
  const store = props.store as ToastStore | undefined
  if (store === undefined || typeof store.getSnapshot !== 'function') return undefined
  return { component: overlay.component, props, store }
}

/** Native Toast stand-in that records the props the plugin host passes. */
export function recordingToast(seen: TestProps[]): TestComponent {
  return (props: TestProps): TestNode => {
    seen.push(props)
    return { type: 'div', props: { 'data-native-toast': '' }, children: [] }
  }
}

/** Resolve the built bundle once per test process, then record its listeners. */
export async function loadUiPanel(): Promise<void> {
  loader ??= loadClientBundle().then((loaded) => {
    registration = loaded.registration
    assert.equal(typeof registration.factory, 'function')
    installPointerdownRecorder()
  })
  await loader
}

/** Dispose every harness and bundle lifetime the running test created. */
export async function disposeUiLifetimes(): Promise<void> {
  const errors: unknown[] = []
  for (const dispose of lifetimes.splice(0).reverse()) {
    try {
      await dispose()
    } catch (error) {
      // Keep disposing: one broken cleanup must not leave the next test with
      // this test's timer and fetch globals. The failures surface below.
      errors.push(error)
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, 'UI test lifetime cleanup failed')
}
