/**
 * Browser-half behavior tests over a tiny React renderer.
 *
 * These mount the real panel and diff components, feed them canned Host
 * responses, click the same controls a user clicks, and assert the requests the
 * Host receives.
 */

import assert from 'node:assert/strict'
import { afterEach, before, test } from 'node:test'
import type { ToastStore } from '../src/client/toast/notify.ts'
import type {
  BranchesResult,
  ChangeEntry,
  CommitDetails,
  GraphReferences,
  HistoryResult,
  RemotesResult,
  StatusResult,
  WatchState,
} from '../src/shared/git.ts'
import {
  createFakeContext,
  dispatchDocumentKeydown,
  loadClientBundle,
  translate,
} from './support/fake-ctx.ts'
import { createMenuMock } from './support/fake-menu.ts'
import {
  BRANCHES,
  COMMIT_DETAILS,
  createBranches,
  createRepo,
  createStatus,
  HISTORY,
  REMOTES,
  STATUS,
} from './support/fixtures.ts'
import { createHarness as createHarnessRuntime } from './support/mini-react.ts'
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
} from './support/types.ts'

/** The tab fixture the mounted panel reads through `useTabInfo`. */
interface UiTab {
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
type UiTabInfo = () => TestProps

/** Mount options a test may override. */
interface MountOptions {
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
interface LoadedComponents {
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
interface MountedGit {
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
function installPointerdownRecorder(): void {
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
function dispatchDocumentPointerdown(target: unknown): void {
  for (const listener of [...documentPointerdownListeners]) listener({ target })
}

/** Register one lifetime for the test's final cleanup. */
function trackLifetime(dispose: () => void | Promise<void>): void {
  lifetimes.push(dispose)
}

/** Create one mini React harness and register its disposal as a fallback. */
function createHarness(options: Parameters<typeof createHarnessRuntime>[0]): TestHarness {
  const harness = createHarnessRuntime(options)
  trackLifetime(() => harness.dispose())
  return harness
}

afterEach(async () => {
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
  if (errors.length > 0) {
    throw new AggregateError(errors, 'UI test lifetime cleanup failed')
  }
})

before(async () => {
  ;({ registration } = await loadClientBundle())
  installPointerdownRecorder()
  assert.equal(typeof registration?.factory, 'function')
})

/**
 * Build one harness, load the bundle components against it, and mount a panel.
 * @param options - mount options.
 * @returns mounted test context.
 */
async function mountGit(options: MountOptions = {}): Promise<MountedGit> {
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
    // as sibling seats so the native toast surface is exercised alongside the
    // panel it reports for.
    const PanelSeat: TestComponent = () => ({ type: component, props: panelProps, children: [] })
    const ToastSeat: TestComponent = () => ({
      type: toast.component,
      props: toast.props,
      children: [],
    })
    harness.setComponent(
      () => ({
        type: 'div',
        props: { 'data-test-root': '' },
        children: [
          { type: PanelSeat, props: {}, children: [] },
          { type: ToastSeat, props: {}, children: [] },
        ],
      }),
      {},
    )
  }
  await harness.render()
  return { harness, calls, openedTabs, components, useTabInfo, menu }
}

/** Read one registered slot component, failing loudly when the seat is empty. */
function slotComponent(seats: Map<string, TestComponent>, seat: string): TestComponent {
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
function loadComponents(
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
function slotNotify(components: LoadedComponents): ContextMenusService['notify'] {
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
function isElement(node: TestNode): node is TestElement {
  return typeof node === 'object' && node !== null && !Array.isArray(node)
}

/** Narrow one rendered node to an element. */
function elementOf(node: TestNode): TestElement {
  assert.ok(isElement(node), 'expected a rendered element')
  return node
}

function buttonByLabel(harness: TestHarness, label: string): TestElement {
  const buttons = harness.findAll(
    (element) => element.type === 'button' && element.props['aria-label'] === label,
  )
  assert.ok(buttons.length > 0, `no button labelled "${label}"`)
  const button = buttons[0]
  assert.ok(button)
  return button
}

function collectElements(
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

function elementText(element: TestNode): string {
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

function buttonContaining(harness: TestHarness, label: string): TestElement {
  const buttons = harness.findAll(
    (element) => element.type === 'button' && elementText(element) === label,
  )
  assert.ok(buttons.length > 0, `no button containing "${label}"`)
  const button = buttons[0]
  assert.ok(button)
  return button
}

function remoteMenuItem(mounted: MountedGit, label: string): TestElement {
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
async function openRemoteGroup(mounted: MountedGit): Promise<void> {
  mounted.harness.click(remoteMenuItem(mounted, 'remote.group'))
  await mounted.harness.flush()
}

/** Find one labelled text input in the open remote form. */
function dialogInput(mounted: MountedGit, label: string): TestElement | undefined {
  return mounted.harness.findAll(
    (element) => element.type === 'input' && element.props['aria-label'] === label,
  )[0]
}

/** Count the `remotes` reads the panel has made. */
function remotesCalls(mounted: MountedGit): number {
  return mounted.calls.filter((call) => call.op === 'remotes').length
}

/** Open the toolbar's remote overflow menu and let its remote read settle. */
async function openRemoteMenu(mounted: MountedGit): Promise<void> {
  mounted.harness.click(buttonByLabel(mounted.harness, 'remote.menu'))
  await mounted.harness.flush()
}

/** Find the toolbar's remote status control by its current label. */
function cloudButton(mounted: MountedGit): TestElement {
  const labels = ['remote.statusSync', 'remote.statusPublish']
  for (const label of labels) {
    const [button] = mounted.harness.findAll(
      (element) => element.type === 'button' && element.props['aria-label'] === label,
    )
    if (button !== undefined) return button
  }
  assert.fail('no remote status control rendered')
}

function buttonInside(element: TestElement, label: string): TestElement {
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

function buttonByText(harness: TestHarness, text: string): TestElement {
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
async function openCommitMenu(mounted: MountedGit): Promise<void> {
  mounted.harness.click(buttonByLabel(mounted.harness, 'commit.menu'))
  await mounted.harness.flush()
}

/** Every rendered commit-menu entry, in menu order, without the separator. */
function commitMenuItems(mounted: MountedGit): TestElement[] {
  return mounted.harness.findAll(
    (element) => element.type === 'button' && element.props['data-action'] !== undefined,
  )
}

/** Find one commit-menu entry by its `data-action`. */
function commitMenuItem(mounted: MountedGit, action: string): TestElement {
  const item = commitMenuItems(mounted).find((element) => element.props['data-action'] === action)
  assert.ok(item, `no commit menu item "${action}"`)
  return item
}

/** Check the shared accessible content/footer contract, not component internals. */
function floatingPanel(
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
function hasClass(element: TestElement, name: string): boolean {
  return String(element.props.className ?? '')
    .split(/\s+/)
    .includes(name)
}

/**
 * Finish any exit animation and render what it was hiding. A dismissed prompt
 * and a returning details view stay mounted while they leave, so a test that
 * wants the surface gone runs the pending motion timer and flushes again.
 */
async function finishMotion(harness: TestHarness): Promise<void> {
  // The close renders first: its effect is what schedules the exit timer.
  await harness.flush()
  harness.runTimeouts()
  await harness.flush()
}

/** Dispatch one Escape keydown to the listeners registered on `document`. */
function escapeKeydown(defaultPrevented = false): { prevented: boolean; stopped: boolean } {
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
function graphMenuTarget(mounted: MountedGit, invoker?: TestEventTarget): CapturedTarget {
  const [row] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-graphRow'))
  assert.ok(row)
  mounted.harness.contextmenu(row, invoker === undefined ? {} : { currentTarget: invoker })
  return lastTarget(mounted.menu)
}

/** Open an inline discard without executing the repository operation. */
async function openDiscard(mounted: MountedGit, path = 'src/app.js'): Promise<void> {
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
function pagedHistory(): { first: HistoryResult; second: HistoryResult } {
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

test('the panel renders branch, change groups, status letters, and the graph', async () => {
  const mounted = await mountGit()
  const text = mounted.harness.text()
  assert.match(text, /main/)
  assert.match(text, /origin\/main/)
  assert.match(text, /sections\.merge/)
  assert.match(text, /sections\.staged/)
  assert.match(text, /sections\.changes/)
  assert.match(text, /sections\.graph/)
  assert.match(text, /Fix the sidebar/)
  assert.match(text, /Initial commit/)
  const badges = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphBadge',
  )
  assert.deepEqual(
    badges.map((badge) => [
      badge.props['data-icon'],
      badge.props['data-color'],
      elementText(badge),
    ]),
    [
      ['target', 'ref', 'main'],
      ['cloud', 'remote', ''],
      ['tag', 'ref', 'v1.0'],
    ],
    'the checked-out branch is named, its upstream collapses into an icon badge',
  )
  assert.match(text, /app\.js/)
  assert.match(text, /README\.md/)
  assert.match(text, /merge\.txt/)
  assert.match(text, /\bU\b/)
  assert.match(text, /\bM\b/)
  assert.match(text, /!/)
  assert.ok(buttonByLabel(mounted.harness, 'refresh'))
  assert.ok(mounted.harness.findAll((element) => element.type === 'textarea').length === 1)
  const initial = mounted.calls.filter((call) => call.op === 'status')
  assert.ok(initial.length >= 1)
  assert.equal(typeof mounted.harness.hookStoreSize(), 'number')
  await mounted.harness.dispose()
})

test('change groups and graph are independent scroll panes with a resizable divider', async () => {
  const mounted = await mountGit()
  const panes = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-pane'),
  )
  assert.equal(panes.length, 2, 'the changes and graph each get a scroll pane')
  const [changesPane, graphPane] = panes
  assert.ok(changesPane)
  assert.ok(graphPane)
  for (const pane of panes) {
    assert.ok(String(pane.props.className).includes('dshgg-scroll'))
  }
  const sectionsIn = (pane: TestElement): unknown[] =>
    collectElements(pane, (element) => element.props['data-section'] !== undefined).map(
      (element) => element.props['data-section'],
    )
  assert.deepEqual(sectionsIn(changesPane), ['merge', 'staged', 'changes'])
  assert.deepEqual(sectionsIn(graphPane), ['graph'])
  assert.equal(changesPane.props.style?.flexBasis, '50%')
  const divider = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) => candidate.props.role === 'separator')
    assert.ok(element, 'no split divider rendered')
    return element
  }
  assert.equal(divider().props['aria-orientation'], 'horizontal')
  assert.equal(divider().props['aria-valuemin'], 20)
  assert.equal(divider().props['aria-valuemax'], 80)
  assert.equal(divider().props['aria-valuenow'], 50)
  assert.equal(divider().props.tabIndex, 0)
  assert.match(String(divider().props['aria-label']), /split\.label/)
  mounted.harness.keydown(divider(), { key: 'ArrowDown' })
  await mounted.harness.flush()
  assert.equal(divider().props['aria-valuenow'], 55)
  const paneTop = (): TestElement | undefined =>
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-paneTop'),
    )[0]
  assert.equal(paneTop()?.props.style?.flexBasis, '55%')

  const rect = { left: 0, top: 100, width: 320, height: 400, bottom: 500 }
  const target: TestEventTarget = {
    getBoundingClientRect: () => rect,
    focus() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => true,
    parentElement: { getBoundingClientRect: () => rect },
  }
  mounted.harness.pointer(divider(), 'down', {
    pointerId: 7,
    clientY: 200,
    currentTarget: target,
  })
  await mounted.harness.flush()
  assert.equal(divider().props['data-dragging'], 'true')
  mounted.harness.pointer(divider(), 'move', {
    pointerId: 7,
    clientY: 240,
    currentTarget: target,
  })
  await mounted.harness.flush()
  assert.equal(divider().props['aria-valuenow'], 65, 'a 40px drag over 400px moves 10%')
  assert.equal(paneTop()?.props.style?.flexBasis, '65%')
  mounted.harness.pointer(divider(), 'move', {
    pointerId: 7,
    clientY: 900,
    currentTarget: target,
  })
  await mounted.harness.flush()
  assert.equal(divider().props['aria-valuenow'], 80, 'a drag beyond the edge clamps')
  mounted.harness.pointer(divider(), 'up', {
    pointerId: 7,
    clientY: 900,
    currentTarget: target,
  })
  await mounted.harness.flush()
  assert.equal(divider().props['data-dragging'], undefined)
  await mounted.harness.dispose()
})

test('each section header belongs to its own section so only one can stick', async () => {
  const mounted = await mountGit()
  const sections = mounted.harness.findAll((element) => element.props['data-section'] !== undefined)
  assert.deepEqual(
    sections.map((section) => section.props['data-section']),
    ['merge', 'staged', 'changes', 'graph'],
  )
  for (const section of sections) {
    // A header only pins while its own section is in view when the section is
    // its containing block: the header is a direct child, never a sibling
    // shared by a stack of sections.
    const header = elementOf(section.children[0])
    assert.equal(
      header.props.className,
      'dshgg-sectionHeader',
      `${String(section.props['data-section'])} must lead with its own header`,
    )
  }
  await mounted.harness.dispose()
})

test('the graph header shows no commit count while group headers keep theirs', async () => {
  const mounted = await mountGit()
  const section = (id: string): TestElement => {
    const [element] = mounted.harness.findAll(
      (candidate) => candidate.props?.['data-section'] === id,
    )
    assert.ok(element, `no ${id} section rendered`)
    return element
  }
  const countChips = (id: string): TestElement[] =>
    collectElements(section(id), (element) =>
      String(element.props?.className ?? '')
        .split(' ')
        .includes('dshgg-sectionCount'),
    )
  assert.equal(
    countChips('graph').length,
    0,
    'the graph header shows no count of the loaded commits',
  )
  assert.deepEqual(
    countChips('staged').map((chip) => elementText(chip)),
    ['1'],
    'the staged group keeps its file count',
  )
  assert.deepEqual(
    countChips('changes').map((chip) => elementText(chip)),
    ['2'],
    'the changes group keeps its file count',
  )
  await mounted.harness.dispose()
})

test('scrolling the graph pane to its end appends the next page of commits', async () => {
  const pages = pagedHistory()
  const mounted = await mountGit({ historyPages: [pages.first, pages.second] })
  const rows = (): TestElement[] =>
    mounted.harness.findAll(
      (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
    )
  const graphPane = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) =>
      String(candidate.props?.className ?? '').includes('dshgg-paneBottom'),
    )
    assert.ok(element, 'no graph pane rendered')
    return element
  }
  assert.equal(rows().length, 2)
  // A scroll far from the end keeps the loaded page.
  mounted.harness.scroll(graphPane(), { scrollTop: 0, clientHeight: 400, scrollHeight: 1000 })
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((request) => request.op === 'history').length, 1)
  // Reaching the end loads the next page with the offset of the loaded rows.
  mounted.harness.scroll(graphPane(), { scrollTop: 580, clientHeight: 400, scrollHeight: 1000 })
  await mounted.harness.flush()
  const historyCalls = mounted.calls.filter((request) => request.op === 'history')
  assert.equal(historyCalls.length, 2)
  assert.equal(historyCalls[1]?.offset, 2)
  assert.equal(rows().length, 3)
  assert.match(mounted.harness.text(), /Root commit/)
  assert.equal(
    mounted.harness.findAll(
      (element) => element.type === 'button' && elementText(element) === 'graph.loadMore',
    ).length,
    0,
    'the last page offers no further loading',
  )
  await mounted.harness.dispose()
})

test('the end of the graph offers the next page as a control', async () => {
  const pages = pagedHistory()
  const mounted = await mountGit({ historyPages: [pages.first, pages.second] })
  const loadMore = (): TestElement[] =>
    mounted.harness.findAll(
      (element) => element.type === 'button' && elementText(element) === 'graph.loadMore',
    )
  assert.equal(loadMore().length, 1)
  const [button] = loadMore()
  assert.ok(button)
  mounted.harness.click(button)
  await mounted.harness.flush()
  const historyCalls = mounted.calls.filter((request) => request.op === 'history')
  assert.equal(historyCalls[1]?.offset, 2)
  assert.match(mounted.harness.text(), /Root commit/)
  assert.equal(loadMore().length, 0)
  await mounted.harness.dispose()
})

test('a failed earlier page keeps the loaded rows and can be retried', async () => {
  const pages = pagedHistory()
  const mounted = await mountGit({
    historyPages: [pages.first, pages.second],
    failHistoryPages: [1],
  })
  const rows = (): TestElement[] =>
    mounted.harness.findAll(
      (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
    )
  const graphPane = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) =>
      String(candidate.props?.className ?? '').includes('dshgg-paneBottom'),
    )
    assert.ok(element, 'no graph pane rendered')
    return element
  }
  mounted.harness.scroll(graphPane(), { scrollTop: 580, clientHeight: 400, scrollHeight: 1000 })
  await mounted.harness.flush()
  assert.equal(rows().length, 2, 'the loaded rows stay visible')
  assert.match(mounted.harness.text(), /git said no/)
  const retry = mounted.harness.findAll(
    (element) => element.type === 'button' && elementText(element) === 'retry',
  )
  assert.equal(retry.length, 1)
  const [button] = retry
  assert.ok(button)
  mounted.harness.click(button)
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((request) => request.op === 'history').length, 3)
  assert.equal(rows().length, 3)
  assert.match(mounted.harness.text(), /Root commit/)
  await mounted.harness.dispose()
})

test('refresh returns the graph to the first page', async () => {
  const pages = pagedHistory()
  const mounted = await mountGit({ historyPages: [pages.first, pages.second, pages.first] })
  const rows = (): TestElement[] =>
    mounted.harness.findAll(
      (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
    )
  const graphPane = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) =>
      String(candidate.props?.className ?? '').includes('dshgg-paneBottom'),
    )
    assert.ok(element, 'no graph pane rendered')
    return element
  }
  mounted.harness.scroll(graphPane(), { scrollTop: 580, clientHeight: 400, scrollHeight: 1000 })
  await mounted.harness.flush()
  assert.equal(rows().length, 3)
  mounted.harness.click(buttonByLabel(mounted.harness, 'refresh'))
  await mounted.harness.flush()
  const historyCalls = mounted.calls.filter((request) => request.op === 'history')
  assert.equal(historyCalls.length, 3)
  assert.equal(historyCalls[2]?.offset, undefined, 'a refresh asks for the first page')
  assert.equal(rows().length, 2)
  assert.equal(
    mounted.harness.findAll(
      (element) => element.type === 'button' && elementText(element) === 'graph.loadMore',
    ).length,
    1,
    'the refreshed first page can load earlier commits again',
  )
  await mounted.harness.dispose()
})

test('commit details overlay the split and keep the chosen ratio', async () => {
  const mounted = await mountGit()
  const divider = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) => candidate.props.role === 'separator')
    assert.ok(element, 'no split divider rendered')
    return element
  }
  mounted.harness.keydown(divider(), { key: 'PageDown' })
  await mounted.harness.flush()
  assert.equal(divider().props['aria-valuenow'], 60)
  await openCommitDetails(mounted)
  assert.equal(
    divider().props['aria-valuenow'],
    60,
    'the split stays mounted beneath the details card at the chosen ratio',
  )
  assert.match(mounted.harness.text(), /commitDetails\.files/)
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await finishMotion(mounted.harness)
  assert.equal(divider().props['aria-valuenow'], 60)
  await mounted.harness.dispose()
})

test('commit details render the changed files as a collapsed folder tree', async () => {
  const treeDetails: CommitDetails = {
    ...COMMIT_DETAILS,
    files: [
      { path: 'src/app.js', letter: 'M' },
      { path: 'src/util/deep/b.ts', letter: 'A' },
      { path: 'docs/gone.md', letter: 'D' },
      { path: 'top.md', letter: 'M' },
    ],
  }
  const mounted = await mountGit({ commitDetails: treeDetails })
  await openCommitDetails(mounted)
  const card = commitCard(mounted.harness)
  const rows = collectElements(
    card,
    (element) => hasClass(element, 'dshgg-folderRow') || hasClass(element, 'dshgg-fileRow'),
  )
  assert.deepEqual(
    rows.map((row) =>
      hasClass(row, 'dshgg-folderRow')
        ? `folder:${String(row.props.title)}`
        : `file:${String(row.props.title)}`,
    ),
    [
      'folder:docs',
      'file:docs/gone.md',
      'folder:src',
      'folder:src/util/deep',
      'file:src/util/deep/b.ts',
      'file:src/app.js',
      'file:top.md',
    ],
    'folders precede files at every level and unused folder chains collapse',
  )
  assert.deepEqual(
    rows.map((row) => row.props.style?.paddingLeft),
    ['6px', '20px', '6px', '20px', '34px', '20px', '6px'],
    'each rendered nesting step indents the row another fourteen pixels',
  )
  const folderRows = rows.filter((row) => hasClass(row, 'dshgg-folderRow'))
  const fileRows = rows.filter((row) => hasClass(row, 'dshgg-fileRow'))
  assert.equal(folderRows.length, 3, 'docs, src and the collapsed src/util/deep chain')
  assert.equal(fileRows.length, 4, 'every changed file keeps exactly one row')
  const chain = folderRows.find((row) => row.props.title === 'src/util/deep')
  assert.ok(chain, 'the unbranched src/util chain renders as src/util/deep')
  assert.equal(chain.props.style?.paddingLeft, '20px', 'the collapsed chain takes one nesting step')
  assert.deepEqual(
    fileRows.map((row) => row.props.title),
    ['docs/gone.md', 'src/util/deep/b.ts', 'src/app.js', 'top.md'],
    'file rows keep their full repository-relative path as the tooltip',
  )
  assert.deepEqual(
    fileRows.map((row) => {
      const [status] = collectElements(row, (element) => hasClass(element, 'dshgg-status'))
      assert.ok(status, 'every file row keeps its status letter')
      return status.props['data-status']
    }),
    ['D', 'A', 'M', 'M'],
    'file rows keep the status letters their change entries carry',
  )
  const [count] = collectElements(card, (element) => hasClass(element, 'dshgg-sectionCount'))
  assert.ok(count, 'the files header keeps its count')
  assert.equal(elementText(count), '4', 'the header counts the changed files, not the tree rows')
  const openedTabsBefore = mounted.openedTabs.length
  const callsBefore = mounted.calls.length
  for (const folder of folderRows) {
    assert.equal(folder.props.role, 'button', 'folder rows are disclosure controls')
    assert.equal(folder.props.tabIndex, 0, 'folder rows take keyboard focus')
    assert.equal(folder.props['aria-expanded'], true, 'folders start expanded')
    const [toggle] = collectElements(folder, (element) => hasClass(element, 'dshgg-folderToggle'))
    assert.ok(toggle, 'every folder row reserves the disclosure slot')
    const [chevron] = collectElements(toggle, (element) => hasClass(element, 'dshgg-chevron'))
    assert.ok(chevron, 'the disclosure slot holds the expansion arrow')
    assert.equal(chevron.props['data-open'], 'true', 'an expanded folder points its arrow down')
    assert.equal(
      collectElements(folder, (element) => element.type === 'svg').length,
      1,
      'the folder row draws only its expansion arrow, not a folder glyph',
    )
  }
  await mounted.harness.flush()
  assert.equal(mounted.openedTabs.length, openedTabsBefore, 'rendering a folder row opens no diff')
  assert.equal(mounted.calls.length, callsBefore, 'rendering a folder row requests nothing')
  await mounted.harness.dispose()
})

test('a details folder collapses and expands by pointer and keyboard', async () => {
  const treeDetails: CommitDetails = {
    ...COMMIT_DETAILS,
    files: [
      { path: 'src/app.js', letter: 'M' },
      { path: 'src/util/deep/b.ts', letter: 'A' },
      { path: 'docs/gone.md', letter: 'D' },
      { path: 'top.md', letter: 'M' },
    ],
  }
  const mounted = await mountGit({ commitDetails: treeDetails })
  await openCommitDetails(mounted)
  const rows = (): TestElement[] =>
    collectElements(
      commitCard(mounted.harness),
      (element) => hasClass(element, 'dshgg-folderRow') || hasClass(element, 'dshgg-fileRow'),
    )
  const titles = (): unknown[] => rows().map((row) => row.props.title)
  const folder = (path: string): TestElement => {
    const [row] = rows().filter(
      (candidate) => hasClass(candidate, 'dshgg-folderRow') && candidate.props.title === path,
    )
    assert.ok(row, `no folder row rendered for ${path}`)
    return row
  }
  const arrow = (path: string): TestElement => {
    const [chevron] = collectElements(folder(path), (element) => hasClass(element, 'dshgg-chevron'))
    assert.ok(chevron, `no expansion arrow rendered for ${path}`)
    return chevron
  }
  const openedTabs = mounted.openedTabs.length
  const calls = mounted.calls.length

  mounted.harness.click(folder('src'))
  await mounted.harness.flush()
  assert.equal(folder('src').props['aria-expanded'], false, 'a pointer click collapses the folder')
  assert.equal(arrow('src').props['data-open'], 'false', 'the collapsed arrow points right')
  assert.deepEqual(
    titles(),
    ['docs', 'docs/gone.md', 'src', 'top.md'],
    'the collapsed folder keeps its row and hides every nested row',
  )
  assert.equal(
    collectElements(commitCard(mounted.harness), (element) => hasClass(element, 'dshgg-fileRow'))
      .length,
    2,
    'only the files outside the collapsed subtree remain',
  )

  mounted.harness.click(folder('src'))
  await mounted.harness.flush()
  assert.equal(folder('src').props['aria-expanded'], true, 'a second click expands the folder')
  assert.equal(arrow('src').props['data-open'], 'true', 'the expanded arrow points down')
  assert.deepEqual(
    titles(),
    ['docs', 'docs/gone.md', 'src', 'src/util/deep', 'src/util/deep/b.ts', 'src/app.js', 'top.md'],
    'expanding restores the subtree where it was',
  )

  mounted.harness.click(folder('src/util/deep'))
  await mounted.harness.flush()
  assert.equal(folder('src').props['aria-expanded'], true, 'the parent stays expanded')
  assert.deepEqual(
    titles(),
    ['docs', 'docs/gone.md', 'src', 'src/util/deep', 'src/app.js', 'top.md'],
    'collapsing a nested folder hides only its own descendants',
  )
  mounted.harness.click(folder('src/util/deep'))
  await mounted.harness.flush()

  let prevented = false
  mounted.harness.keydown(folder('docs'), {
    key: 'Enter',
    preventDefault: () => {
      prevented = true
    },
  })
  await mounted.harness.flush()
  assert.equal(prevented, true, 'keyboard activation consumes the key')
  assert.equal(folder('docs').props['aria-expanded'], false, 'Enter collapses the folder')
  assert.deepEqual(titles(), [
    'docs',
    'src',
    'src/util/deep',
    'src/util/deep/b.ts',
    'src/app.js',
    'top.md',
  ])
  mounted.harness.keydown(folder('docs'), { key: ' ' })
  await mounted.harness.flush()
  assert.equal(folder('docs').props['aria-expanded'], true, 'Space expands the folder')
  assert.equal(folder('docs').props.tabIndex, 0, 'the activated row stays focusable')
  assert.equal(mounted.openedTabs.length, openedTabs, 'toggling a folder opens no diff tab')
  assert.equal(mounted.calls.length, calls, 'toggling a folder requests nothing')

  mounted.harness.click(folder('src'))
  await mounted.harness.flush()
  assert.equal(folder('src').props['aria-expanded'], false)
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await finishMotion(mounted.harness)
  await openCommitDetails(mounted, 1)
  const reopened = collectElements(commitCard(mounted.harness), (element) =>
    hasClass(element, 'dshgg-folderRow'),
  )
  assert.equal(reopened.length, 3, 'the newly opened details render the same tree')
  for (const row of reopened) {
    assert.equal(
      row.props['aria-expanded'],
      true,
      'another commit opens every folder expanded again',
    )
  }
  await mounted.harness.dispose()
})

test('the change lists and commit details draw the host file-type icon for every file', async () => {
  const mounted = await mountGit({
    hostModules: {
      '@deepseek-ai/dsh-client-ui-primitives': {
        FileTypeIcon: (props: { path: string; size: number }) => ({
          type: 'svg',
          props: { 'data-file-type': props.path },
          children: [],
        }),
      },
    },
  })
  const fileRows = (): TestElement[] =>
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow'),
    )
  const glyphs = (rows: TestElement[]): string[] =>
    collectElements(rows, (element) => element.props['data-file-type'] !== undefined).map(
      (element) => String(element.props['data-file-type']),
    )
  const lists = fileRows()
  assert.equal(lists.length, 4)
  assert.deepEqual(
    glyphs(lists).sort(),
    ['README.md', 'merge.txt', 'src/app.js', 'src/app.js'],
    'every change-list row passes its path to the host icon',
  )
  await openCommitDetails(mounted)
  assert.equal(fileRows().length, 8, 'the underlay change rows stay mounted beneath the card')
  const details = collectElements(commitCard(mounted.harness), (element) =>
    hasClass(element, 'dshgg-fileRow'),
  )
  assert.equal(details.length, 4)
  assert.deepEqual(
    glyphs(details).sort(),
    ['docs/gone.md', 'src/added.js', 'src/app.js', 'src/renamed.js'],
    'every details row passes its path to the host icon',
  )
  await mounted.harness.dispose()
})

test('every flat file row puts its status letter at the row end', async () => {
  const mounted = await mountGit()
  const fileRows = (scope?: TestElement): TestElement[] =>
    scope === undefined
      ? mounted.harness.findAll((element) => hasClass(element, 'dshgg-fileRow'))
      : collectElements(scope, (element) => hasClass(element, 'dshgg-fileRow'))
  const assertStatusTrails = (row: TestElement, label: string): TestElement => {
    const children = row.children.filter(isElement)
    const first = children[0]
    assert.ok(first, `${label} renders element children`)
    assert.ok(hasClass(first, 'dshgg-rowIcon'), `${label} starts with its file icon`)
    const last = children[children.length - 1]
    assert.ok(last, `${label} renders a final element`)
    assert.ok(hasClass(last, 'dshgg-status'), `${label} ends with its status letter`)
    const actions = children.findIndex((child) => hasClass(child, 'dshgg-fileActions'))
    assert.ok(actions >= 0, `${label} renders its action slot`)
    assert.ok(actions < children.length - 1, `${label} keeps its actions before the status letter`)
    return last
  }

  const rows = fileRows()
  assert.equal(rows.length, 4, 'the three change groups render one row per file')
  for (const [index, row] of rows.entries()) {
    const status = assertStatusTrails(row, `change row ${index}`)
    assert.equal(
      status.props['data-status'],
      elementText(status),
      `change row ${index} keeps its status letter in the data attribute and the text`,
    )
  }

  await openCommitDetails(mounted)
  const details = fileRows(commitCard(mounted.harness))
  assert.equal(details.length, 4, 'the commit details list one row per file')
  for (const [index, row] of details.entries()) {
    const status = assertStatusTrails(row, `details row ${index}`)
    assert.equal(
      status.props['data-status'],
      elementText(status),
      `details row ${index} keeps its status letter in the data attribute and the text`,
    )
  }
  const app = details.find((row) => row.props.title === 'src/app.js')
  assert.ok(app, 'the modified app.js details row is rendered')
  const appStatus = assertStatusTrails(app, 'the app.js details row')
  assert.equal(appStatus.props['data-status'], 'M')
  assert.equal(elementText(appStatus), 'M')
  await mounted.harness.dispose()
})

test('the change lists and commit details keep the plain icon without a usable host icon', async () => {
  const mounted = await mountGit()
  const plainIcons = (scope?: TestElement): number => {
    const icons =
      scope === undefined
        ? mounted.harness.findAll((element) => hasClass(element, 'dshgg-rowIcon'))
        : collectElements(scope, (element) => hasClass(element, 'dshgg-rowIcon'))
    return icons.flatMap((icon) =>
      collectElements(
        icon,
        (element) => element.type === 'svg' && element.props.viewBox === '0 0 16 16',
      ),
    ).length
  }
  assert.equal(plainIcons(), 4, 'every change-list row falls back to the document icon')
  await openCommitDetails(mounted)
  assert.equal(
    plainIcons(commitCard(mounted.harness)),
    4,
    'every details row falls back to the document icon',
  )
  await mounted.harness.dispose()
})

test('a clean repository shows the clean text without a check icon', async () => {
  const mounted = await mountGit({ status: createStatus({ files: [] }) })
  const clean = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-clean',
  )[0]
  assert.ok(clean, 'no clean-workspace state rendered')
  assert.match(elementText(clean), /clean\.title/)
  assert.match(elementText(clean), /clean\.desc/)
  assert.equal(
    collectElements(clean, (element) => element.type === 'svg').length,
    0,
    'the clean state carries no icon',
  )
  assert.equal(
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-cleanIcon'),
    ).length,
    0,
  )
  await mounted.harness.dispose()
})

test('the commit graph draws one line layer and a node per row', async () => {
  const mounted = await mountGit()
  const layers = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphLayer',
  )
  assert.equal(layers.length, 1, 'the rows share one layer')
  const [layer] = layers
  assert.ok(layer)
  assert.equal(layer.props['aria-hidden'], 'true')
  assert.equal(layer.props.width, 22, 'one lane plus one position')
  assert.equal(layer.props.height, 44, 'two rows')
  assert.equal(layer.props.viewBox, '0 0 22 44')
  const [mask] = collectElements(layer, (element) => element.type === 'mask')
  assert.ok(mask)
  assert.equal(mask.props.maskUnits, 'userSpaceOnUse')
  assert.equal(mask.props.height, 44, 'the mask covers the whole layer')
  const gaps = collectElements(mask, (element) => element.type === 'circle')
  assert.deepEqual(
    gaps.map((gap) => [
      gap.props.className,
      gap.props.cx,
      gap.props.cy,
      gap.props.r,
      gap.props.fill,
    ]),
    [
      ['dshgg-graphGap', 11, 11, 8, 'black'],
      ['dshgg-graphGap', 11, 33, 6, 'black'],
    ],
    'the gap cuts the lines around each node',
  )
  const [lines] = collectElements(layer, (element) => element.type === 'g')
  assert.ok(lines)
  assert.equal(lines.props.mask, `url(#${String(mask.props.id)})`)
  const cells = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphSvg',
  )
  assert.equal(cells.length, 2, 'one graph cell per commit row')
  for (const cell of cells) {
    assert.equal(cell.props.height, 22, 'a cell is one row high')
    assert.equal(
      collectElements(cell, (element) => element.type === 'path').length,
      0,
      'the cell holds no lines',
    )
  }
  assert.deepEqual(
    cells.map((cell) => cell.props.viewBox),
    ['0 0 22 22', '0 0 22 22'],
  )
  const nodes = mounted.harness.findAll(
    (element) => element.type === 'circle' && element.props.className === 'dshgg-graphNode',
  )
  assert.deepEqual(
    nodes.map((node) => [
      node.props['data-shape'],
      node.props['data-paint'],
      node.props.cx,
      node.props.cy,
      node.props.r,
    ]),
    [
      ['head', 'ring', 11, 11, 5],
      ['node', 'fill', 11, 11, 4],
    ],
    'the checked-out commit is a ring and the root a filled dot',
  )
  assert.equal(nodes[0]?.props.style?.stroke, 'var(--dshgg-scm-ref)')
  assert.equal(nodes[1]?.props.style?.fill, 'var(--dshgg-scm-ref)')
  const paths = mounted.harness.findAll(
    (element) => element.type === 'path' && element.props.className === 'dshgg-graphEdge',
  )
  assert.deepEqual(
    paths.map((path) => [path.props.d, path.props.style?.stroke]),
    [['M 11 11 V 22 M 11 21 V 22 M 11 22 V 33', 'var(--dshgg-scm-ref)']],
    'both rows are one path, and the second row also covers the pixel above it',
  )
  const rows = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
  )
  assert.deepEqual(
    rows.map((row) => row.props['data-current']),
    ['true', undefined],
    'only the checked-out commit renders bold',
  )
  await mounted.harness.dispose()
})

test('hovering a row closes its node gap in the line layer', async () => {
  const mounted = await mountGit()
  const body = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphBody',
  )[0]
  assert.ok(body)
  const gaps = (): [unknown, unknown][] =>
    mounted.harness
      .findAll(
        (element) => element.type === 'circle' && element.props.className === 'dshgg-graphGap',
      )
      .map((gap) => [gap.props.cy, gap.props.r])
  assert.deepEqual(gaps(), [
    [11, 8],
    [33, 6],
  ])
  const rows = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
  )
  const enter = rows[1]?.props.onMouseEnter as (() => void) | undefined
  assert.equal(typeof enter, 'function', 'the row reports the pointer')
  enter?.()
  await mounted.harness.flush()
  assert.deepEqual(
    gaps(),
    [
      [11, 8],
      [33, 5],
    ],
    'the hovered row keeps the smaller gap',
  )
  const leave = rows[1]?.props.onMouseLeave as (() => void) | undefined
  leave?.()
  await mounted.harness.flush()
  assert.deepEqual(
    gaps(),
    [
      [11, 8],
      [33, 6],
    ],
    'the gap restores when the pointer leaves',
  )
  await mounted.harness.dispose()
})

test('a merge fans out to the right and joins its fork point like VS Code', async () => {
  const now = Math.floor(Date.now() / 1000)
  const history: HistoryResult = {
    commits: [
      {
        oid: 'd'.repeat(40),
        shortOid: 'ddddddd',
        author: 'Ann',
        authoredAt: now,
        refs: 'HEAD -> refs/heads/main',
        subject: 'Merge feature',
        parents: ['c'.repeat(40), 'b'.repeat(40)],
      },
      {
        oid: 'c'.repeat(40),
        shortOid: 'ccccccc',
        author: 'Ann',
        authoredAt: now - 60,
        refs: '',
        subject: 'Main work',
        parents: ['a'.repeat(40)],
      },
      {
        oid: 'b'.repeat(40),
        shortOid: 'bbbbbbb',
        author: 'Bob',
        authoredAt: now - 120,
        refs: 'refs/heads/feature/x, refs/remotes/origin/feature/x',
        subject: 'Feature work',
        parents: ['a'.repeat(40)],
      },
      {
        oid: 'a'.repeat(40),
        shortOid: 'aaaaaaa',
        author: 'Bob',
        authoredAt: now - 180,
        refs: 'tag: refs/tags/v1.0',
        subject: 'Initial commit',
        parents: [],
      },
    ],
    hasMore: false,
    references: {
      current: { id: 'refs/heads/main', name: 'main', revision: 'd'.repeat(40) },
      remote: null,
      base: null,
    },
  }
  const mounted = await mountGit({ history })
  const rows = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
  )
  assert.equal(rows.length, 4)
  const cells = rows.map((row) => elementOf(row.children[0]))
  assert.deepEqual(
    cells.map((cell) => cell.props.width),
    [33, 33, 33, 33],
  )
  const nodeOf = (cell: TestElement): TestElement => {
    const [node] = collectElements(cell, (element) => element.props.className === 'dshgg-graphNode')
    assert.ok(node)
    return node
  }
  assert.deepEqual(
    cells.map((cell) => [nodeOf(cell).props['data-shape'], nodeOf(cell).props['data-color']]),
    [
      ['head', 'ref'],
      ['node', 'ref'],
      ['node', 'lane1'],
      ['node', 'ref'],
    ],
  )
  assert.equal(nodeOf(cells[2] as TestElement).props.cx, 22, 'the side branch sits on lane 1')
  assert.equal(
    collectElements(cells[0] as TestElement, (element) => element.type === 'path').length,
    0,
    'the row cell holds only its node',
  )
  const [layer] = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphLayer',
  )
  assert.ok(layer)
  const layerPaths = collectElements(layer, (element) => element.type === 'path')
  assert.deepEqual(
    layerPaths.map((path) => path.props['data-color']),
    ['lane1', 'ref'],
    'one path per color for the whole graph',
  )
  assert.match(
    String(layerPaths[0]?.props.d),
    /^M 11 11 A 11 11 0 0 1 22 22 M 11 11 H 11 /,
    'the merge opens its second parent on the first row',
  )
  assert.match(
    String(layerPaths[0]?.props.d),
    /M 22 66 A 11 11 0 0 1 11 77 H 11$/,
    'the branch joins the fork point three rows below',
  )
  assert.match(
    String(layerPaths[1]?.props.d),
    /^M 11 11 V 22 M 11 21 V 22 M 11 22 V 33 M 11 33 V 44 M 11 43 V 44 M 11 44 V 66 /,
    'the checked-out lane runs through every row, bridging the row edges',
  )
  const labels = mounted.harness.findAll(
    (element) => element.props.className === 'dshgg-graphLabel',
  )
  assert.deepEqual(
    labels.map((label) =>
      label.children.filter(isElement).map((child) => [child.props.className, elementText(child)]),
    ),
    [
      [
        ['dshgg-graphSubject', 'Merge feature'],
        ['dshgg-graphAuthor', 'Ann'],
      ],
      [
        ['dshgg-graphSubject', 'Main work'],
        ['dshgg-graphAuthor', 'Ann'],
      ],
      [
        ['dshgg-graphSubject', 'Feature work'],
        ['dshgg-graphAuthor', 'Bob'],
      ],
      [
        ['dshgg-graphSubject', 'Initial commit'],
        ['dshgg-graphAuthor', 'Bob'],
      ],
    ],
    'each row shows the subject and the author, like VS Code',
  )
  const featureBadges = collectElements(
    rows[2] as TestElement,
    (element) => element.props.className === 'dshgg-graphBadge',
  )
  assert.deepEqual(
    featureBadges.map((badge) => [
      badge.props['data-icon'],
      badge.props.style?.backgroundColor,
      elementText(badge),
    ]),
    [
      ['branch', 'var(--dshgg-scm-lane1)', 'feature/x'],
      ['cloud', 'var(--dshgg-scm-lane1)', ''],
    ],
    'ordinary references take their node color',
  )
  assert.equal(
    mounted.harness.findAll((element) =>
      /dshgg-graph(Hash|Time|Meta)/.test(String(element.props?.className ?? '')),
    ).length,
    0,
    'identifier and time move to the tooltip',
  )
  const title = rows[2]?.props.title
  assert.ok(typeof title === 'string')
  assert.match(title, /feature\/x, origin\/feature\/x/)
  assert.match(title, /bbbbbbb Feature work/)
  assert.match(title, /Bob/)
  assert.match(title, /time\./)
  await mounted.harness.dispose()
})

test('lanes right of a joined lane shift left with VS Code curves', async () => {
  const now = Math.floor(Date.now() / 1000)
  const oid = (char: string): string => char.repeat(40)
  const entry = (id: string, parents: string[], refs = '') => ({
    oid: oid(id),
    shortOid: id.repeat(7),
    author: 'Ann',
    authoredAt: now,
    refs,
    subject: `commit ${id}`,
    parents: parents.map(oid),
  })
  const history: HistoryResult = {
    commits: [
      entry('a', ['d']),
      entry('b', ['d']),
      entry('c', ['e']),
      entry('d', ['f']),
      entry('e', ['f']),
      entry('f', []),
    ],
    hasMore: false,
    references: { current: null, remote: null, base: null },
  }
  const mounted = await mountGit({ history })
  const cells = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphSvg',
  )
  assert.deepEqual(
    cells.map((cell) => cell.props.width),
    [22, 33, 44, 44, 33, 33],
    'text begins after each row’s own graph cell',
  )
  const joinRow = cells[3]
  assert.ok(joinRow)
  assert.equal(
    collectElements(joinRow, (element) => element.type === 'path').length,
    0,
    'the row cell holds only its node',
  )
  const [layer] = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphLayer',
  )
  assert.ok(layer)
  const layerPaths = collectElements(layer, (element) => element.type === 'path')
  assert.deepEqual(
    layerPaths.map((path) => path.props['data-color']),
    ['lane1', 'lane2', 'lane3'],
  )
  assert.match(
    String(layerPaths[2]?.props.d),
    /M 33 66 V 72 A 5 5 0 0 1 28 77 H 27 A 5 5 0 0 0 22 82 V 88/,
    'the lane right of the ended one turns into its new position on the join row',
  )
  assert.match(
    String(layerPaths[1]?.props.d),
    /M 22 66 A 11 11 0 0 1 11 77 H 11/,
    'the fork point curve sits on the join row, not on the row below',
  )
  const gaps = collectElements(layer, (element) => element.props.className === 'dshgg-graphGap')
  assert.deepEqual(
    gaps.map((gap) => [gap.props.cy, gap.props.r]),
    [
      [11, 6],
      [33, 6],
      [55, 6],
      [77, 6],
      [99, 6],
      [121, 6],
    ],
    'one node gap per row, in the layer coordinates',
  )
  await mounted.harness.dispose()
})

test('a conflicted file is listed directly under merge changes', async () => {
  const status = createStatus({
    files: [
      {
        kind: 'unmerged',
        x: 'U',
        y: 'U',
        path: 'src/deep/conflicted.txt',
        conflict: true,
        untracked: false,
      },
    ],
  })
  const mounted = await mountGit({ status })
  const text = mounted.harness.text()
  assert.match(text, /sections\.merge/)
  assert.match(text, /conflicted\.txt/)
  assert.match(text, /src\/deep/)
  assert.match(text, /!/)
  assert.equal(
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-folderRow'),
    ).length,
    0,
    'no folder rows are rendered',
  )
})

test('nested changed files stay in one flat path-sorted layer', async () => {
  const modified = (path: string): ChangeEntry => ({
    kind: 'ordinary',
    x: '.',
    y: 'M',
    path,
    conflict: false,
    untracked: false,
  })
  const status = createStatus({
    files: [
      modified('src/z/deep.js'),
      modified('src/a.js'),
      modified('docs/readme.md'),
      modified('a10.js'),
      modified('a2.js'),
    ],
  })
  const mounted = await mountGit({ status })
  const fileRows = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-fileRow'),
  )
  assert.deepEqual(
    fileRows.map((row) => row.props.title),
    ['a2.js', 'a10.js', 'docs/readme.md', 'src/a.js', 'src/z/deep.js'],
    'one row per file in path order, with no folder rows between them',
  )
  assert.equal(
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-folderRow'),
    ).length,
    0,
  )
  const texts = fileRows.map(elementText)
  const readmeRowText = texts[2]
  const deepRowText = texts[4]
  assert.ok(readmeRowText, 'the docs file row rendered no text')
  assert.ok(deepRowText, 'the nested file row rendered no text')
  assert.ok(
    readmeRowText.includes('readme.md') && readmeRowText.includes('docs'),
    'the row shows the file name and its parent directory',
  )
  assert.ok(
    deepRowText.includes('deep.js') && deepRowText.includes('src/z'),
    'a nested file keeps its whole parent path on one line',
  )
  for (const row of fileRows)
    assert.equal(row.props.style, undefined, 'a flat row needs no indentation')
  await mounted.harness.dispose()
})

test('row actions stage and unstage through the Host', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  assert.equal(rows.length, 2, 'the file appears staged and again unstaged')
  const stagedRow = rows[0]
  const unstagedRow = rows[1]
  assert.ok(stagedRow, 'the staged file row is missing')
  assert.ok(unstagedRow, 'the unstaged file row is missing')
  mounted.harness.click(buttonInside(unstagedRow, 'actions.stage'))
  await mounted.harness.flush()
  const stageCall = mounted.calls.find((call) => call.op === 'stage')
  assert.deepEqual(stageCall?.paths, ['src/app.js'])
  mounted.harness.click(buttonInside(stagedRow, 'actions.unstage'))
  await mounted.harness.flush()
  const unstageCall = mounted.calls.find((call) => call.op === 'unstage')
  assert.deepEqual(unstageCall?.paths, ['src/app.js'])
  await mounted.harness.dispose()
})

test('the commit button follows the message and posts a commit', async () => {
  const mounted = await mountGit()
  const commitButton = () => buttonByText(mounted.harness, 'commit.action')
  assert.equal(commitButton().props.disabled, true)
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  const emptyBox = messageBox()
  assert.equal(emptyBox?.props.rows, 1, 'the message box starts one line high')
  assert.equal(emptyBox?.props.className, 'dshgg-commitMessage')
  mounted.harness.change(emptyBox, 'feat: git sidebar')
  await mounted.harness.flush()
  assert.equal(commitButton().props.disabled, false)
  mounted.harness.click(commitButton())
  await mounted.harness.flush()
  const commitCall = mounted.calls.find((call) => call.op === 'commit')
  assert.equal(commitCall?.message, 'feat: git sidebar')
  assert.notEqual(commitCall?.stageAll, true)
  assert.deepEqual(
    mounted.components.notifications,
    [{ text: 'commit.done', success: true }],
    'one shared success Toast confirms the commit',
  )
  assert.equal(mounted.harness.text().includes('commit.done'), false, 'the panel keeps no notice')
  assert.equal(messageBox()?.props.value, '', 'a committed message leaves the box empty')
  await mounted.harness.dispose()
})

test('committing with nothing staged offers to stage everything', async () => {
  const status = createStatus({
    files: [
      { kind: 'ordinary', x: '.', y: 'M', path: 'src/app.js', conflict: false, untracked: false },
    ],
  })
  const mounted = await mountGit({ status })
  const textarea = mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(textarea, 'commit everything')
  await mounted.harness.flush()
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /commit\.emptyConfirm/)
  mounted.harness.click(buttonByText(mounted.harness, 'commit.stageAll'))
  await mounted.harness.flush()
  const commitCall = mounted.calls.find((call) => call.op === 'commit')
  assert.equal(commitCall?.stageAll, true)
  assert.deepEqual(mounted.components.notifications, [{ text: 'commit.done', success: true }])
  assert.equal(
    mounted.harness.findAll((element) => element.type === 'textarea')[0]?.props.value,
    '',
    'stage-all commit still clears the message',
  )
  await mounted.harness.dispose()
})

test('a failed commit keeps its message and reports no success Toast', async () => {
  const mounted = await mountGit({ failOp: 'commit' })
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'fix: will fail')
  await mounted.harness.flush()
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
  assert.equal(messageBox()?.props.value, 'fix: will fail', 'a failed commit keeps its message')
  assert.equal(
    mounted.components.notifications.some((notification) => notification.success),
    false,
    'a Git failure emits no success Toast',
  )
  await mounted.harness.dispose()
})

test('an empty message disables both halves of the split commit button', async () => {
  const mounted = await mountGit()
  const [wrapper] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitActions'))
  assert.ok(wrapper, 'the commit box renders the split commit actions')
  assert.equal(wrapper.props['data-disabled'], 'true', 'the split control uses one disabled state')
  const main = buttonByText(mounted.harness, 'commit.action')
  assert.equal(
    collectElements(wrapper, (element) => element === main).length,
    1,
    'the main commit control sits inside the split wrapper',
  )
  assert.equal(main.props.disabled, true)
  const expand = buttonInside(wrapper, 'commit.menu')
  assert.equal(expand.props.disabled, true, 'the expand control shares the commit button state')
  assert.equal(expand.props['aria-haspopup'], 'menu')
  assert.equal(expand.props['aria-expanded'], false)
  mounted.harness.click(expand)
  await mounted.harness.flush()
  assert.equal(
    commitMenuItems(mounted).length,
    0,
    'the menu cannot open while the message is empty',
  )
  await mounted.harness.dispose()
})

test('a typed message enables both halves and the menu lists the commit variants', async () => {
  const mounted = await mountGit()
  mounted.harness.change(
    mounted.harness.findAll((element) => element.type === 'textarea')[0],
    'feat: menu',
  )
  await mounted.harness.flush()
  const [wrapper] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitActions'))
  assert.ok(wrapper, 'the commit box renders the split commit actions')
  assert.equal(
    wrapper.props['data-disabled'],
    undefined,
    'a typed message enables the split control',
  )
  assert.equal(buttonByText(mounted.harness, 'commit.action').props.disabled, false)
  assert.equal(buttonInside(wrapper, 'commit.menu').props.disabled, false)
  await openCommitMenu(mounted)
  assert.equal(buttonByLabel(mounted.harness, 'commit.menu').props['aria-expanded'], true)
  const [menu] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMenu'))
  assert.ok(menu, 'the split button opens the commit action menu')
  assert.equal(menu.props.role, 'menu')
  assert.equal(menu.props['aria-label'], 'commit.menu')
  const elements = menu.children.filter(isElement)
  assert.deepEqual(
    elements.map((element) =>
      element.props.role === 'separator' ? 'separator' : element.props['data-action'],
    ),
    ['commit', 'amend', 'separator', 'commit-push', 'commit-sync'],
  )
  assert.deepEqual(
    elements.map((element) =>
      element.props.role === 'separator' ? 'separator' : elementText(element),
    ),
    ['commit.action', 'commit.amend', 'separator', 'commit.push', 'commit.sync'],
  )
  for (const element of elements) {
    if (element.props.role === 'separator') continue
    assert.equal(
      element.props.disabled,
      false,
      'every entry is available with a message and an upstream',
    )
  }
  await mounted.harness.dispose()
})

test('Escape and an outside press dismiss the commit action menu', async () => {
  const mounted = await mountGit()
  mounted.harness.change(
    mounted.harness.findAll((element) => element.type === 'textarea')[0],
    'feat: dismiss',
  )
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  assert.equal(commitMenuItems(mounted).length, 4, 'the menu starts open')
  const escapeResult = escapeKeydown()
  assert.equal(escapeResult.prevented, false, 'the menu does not consume Escape')
  await mounted.harness.flush()
  assert.equal(commitMenuItems(mounted).length, 0, 'Escape closes the menu')
  await openCommitMenu(mounted)
  assert.equal(commitMenuItems(mounted).length, 4, 'the menu reopens')
  dispatchDocumentPointerdown({})
  await mounted.harness.flush()
  assert.equal(commitMenuItems(mounted).length, 0, 'an outside pointerdown closes the menu')
  await mounted.harness.dispose()
})

test('a running action disables both halves of the split commit button', async (t) => {
  let release = (): void => {}
  const until = new Promise<void>((resolve) => {
    release = resolve
  })
  const mounted = await mountGit({ pending: { op: 'commit', until } })
  t.after(async () => {
    release()
    await mounted.harness.flush()
    await mounted.harness.dispose()
  })
  mounted.harness.change(
    mounted.harness.findAll((element) => element.type === 'textarea')[0],
    'feat: busy',
  )
  await mounted.harness.flush()
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  const [wrapper] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitActions'))
  assert.equal(wrapper?.props['data-disabled'], 'true', 'a running action dims the split control')
  const [main] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMain'))
  assert.equal(main?.props.disabled, true, 'the commit control is unavailable')
  assert.match(mounted.harness.text(), /commit\.committing/, 'the label shows the running commit')
  assert.equal(buttonByLabel(mounted.harness, 'commit.menu').props.disabled, true)
  assert.equal(commitMenuItems(mounted).length, 0, 'no menu opens over a running action')
})

test('the menu can amend HEAD with the typed message and no staging', async () => {
  const mounted = await mountGit()
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'fix: amend me')
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  mounted.harness.click(commitMenuItem(mounted, 'amend'))
  await mounted.harness.flush()
  const commitCall = mounted.calls.find((call) => call.op === 'commit')
  assert.equal(commitCall?.message, 'fix: amend me')
  assert.equal(commitCall?.amend, true, 'Amend replaces HEAD')
  assert.equal(commitCall?.stageAll, undefined, 'Amend never stages every change')
  assert.equal(messageBox()?.props.value, '', 'the amended message leaves the box empty')
  assert.deepEqual(mounted.components.notifications, [{ text: 'commit.done', success: true }])
  await mounted.harness.dispose()
})

test('Commit and Push commits and then pushes in that order', async () => {
  const mounted = await mountGit()
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'feat: ship it')
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  mounted.harness.click(commitMenuItem(mounted, 'commit-push'))
  await mounted.harness.flush()
  assert.deepEqual(
    mounted.calls
      .filter((call) => call.op === 'commit' || call.op === 'push')
      .map((call) => call.op),
    ['commit', 'push'],
    'the commit lands before the push',
  )
  const commitCall = mounted.calls.find((call) => call.op === 'commit')
  assert.equal(commitCall?.message, 'feat: ship it')
  assert.notEqual(commitCall?.amend, true)
  assert.deepEqual(mounted.components.notifications, [
    { text: 'commit.done', success: true },
    { text: 'remote.pushDone', success: true },
  ])
  assert.equal(messageBox()?.props.value, '', 'the committed message leaves the box empty')
  await mounted.harness.dispose()
})

test('a failed push keeps the completed commit and reports the failure', async () => {
  const mounted = await mountGit({ failOp: 'push' })
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'fix: push fails')
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  mounted.harness.click(commitMenuItem(mounted, 'commit-push'))
  await mounted.harness.flush()
  assert.ok(
    mounted.calls.some((call) => call.op === 'commit'),
    'the commit still reaches the Host',
  )
  assert.equal(messageBox()?.props.value, '', 'the committed message stays cleared')
  assert.ok(
    mounted.components.notifications.some(
      (notification) => notification.text === 'commit.done' && notification.success,
    ),
  )
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the push failure is reported as a non-success notification',
  )
  await mounted.harness.dispose()
})

test('the combined commit entries need an upstream', async () => {
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null }) }),
  })
  mounted.harness.change(
    mounted.harness.findAll((element) => element.type === 'textarea')[0],
    'feat: no upstream',
  )
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  for (const action of ['commit-push', 'commit-sync']) {
    const item = commitMenuItem(mounted, action)
    assert.equal(item.props.disabled, true, `${action} is blocked without an upstream`)
    assert.equal(item.props.title, 'remote.noUpstream')
  }
  for (const action of ['commit', 'amend']) {
    assert.equal(
      commitMenuItem(mounted, action).props.disabled,
      false,
      `${action} stays available without an upstream`,
    )
  }
  await mounted.harness.dispose()
})

test('Commit and Sync stages everything first when nothing is staged', async () => {
  const stagedStatus = createStatus({
    files: [
      { kind: 'ordinary', x: '.', y: 'M', path: 'src/app.js', conflict: false, untracked: false },
    ],
  })
  const mounted = await mountGit({ status: stagedStatus })
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'chore: sync everything')
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  mounted.harness.click(commitMenuItem(mounted, 'commit-sync'))
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /commit\.emptyConfirm/)
  assert.equal(
    mounted.calls.filter((call) => call.op === 'commit' || call.op === 'sync').length,
    0,
    'no repository write happens before the confirmation',
  )
  mounted.harness.click(buttonByText(mounted.harness, 'commit.stageAll'))
  await mounted.harness.flush()
  assert.deepEqual(
    mounted.calls
      .filter((call) => call.op === 'commit' || call.op === 'sync')
      .map((call) => call.op),
    ['commit', 'sync'],
    'the staged commit lands before the sync',
  )
  const commitCall = mounted.calls.find((call) => call.op === 'commit')
  assert.equal(commitCall?.stageAll, true)
  assert.notEqual(commitCall?.amend, true)
  assert.equal(messageBox()?.props.value, '')
  await mounted.harness.dispose()
})

test('Commit and Push with no changes reports that there is nothing to commit', async () => {
  const mounted = await mountGit({ status: createStatus({ files: [] }) })
  mounted.harness.change(
    mounted.harness.findAll((element) => element.type === 'textarea')[0],
    'feat: nothing',
  )
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  mounted.harness.click(commitMenuItem(mounted, 'commit-push'))
  await mounted.harness.flush()
  assert.equal(
    mounted.calls.filter((call) => call.op === 'commit' || call.op === 'push' || call.op === 'sync')
      .length,
    0,
    'an empty change list runs no repository write',
  )
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'commit.nothing',
    ),
    'the refusal is reported as a non-success notification',
  )
  await mounted.harness.dispose()
})

test('discard asks for confirmation before calling the Host', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  const row = rows.at(-1)
  assert.ok(row, 'no changed-file row rendered')
  mounted.harness.click(buttonInside(row, 'actions.discard'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'discard').length, 0)
  assert.match(mounted.harness.text(), /confirm\.discardTitle/)
  mounted.harness.click(buttonByText(mounted.harness, 'confirm.discard'))
  await mounted.harness.flush()
  const discardCall = mounted.calls.find((call) => call.op === 'discard')
  assert.equal(discardCall?.path, 'src/app.js')
  assert.notEqual(discardCall?.untracked, true)
  await mounted.harness.dispose()
})

test('floating discard focuses Cancel and Escape preserves the split without Git', async (t) => {
  const mounted = await mountGit()
  t.after(() => mounted.harness.dispose())
  const [splitter] = mounted.harness.findAll((element) => element.props.role === 'separator')
  assert.ok(splitter)
  mounted.harness.keydown(splitter, { key: 'ArrowDown' })
  await mounted.harness.flush()
  const geometry = () =>
    mounted.harness
      .findAll(
        (element) =>
          hasClass(element, 'dshgg-split') ||
          hasClass(element, 'dshgg-paneTop') ||
          hasClass(element, 'dshgg-paneBottom') ||
          element.props.role === 'separator',
      )
      .map((element) => [
        element.props.className,
        element.props.style,
        element.props['aria-valuenow'],
      ])
  const beforeGeometry = geometry()
  const beforeCalls = [...mounted.calls]
  await openDiscard(mounted)
  const { dialog, footer } = floatingPanel(mounted.harness)
  assert.equal(buttonByText(mounted.harness, 'action.cancel').props.autoFocus, true)
  assert.match(elementText(footer), /confirm\.discard/)
  const [split] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-split'))
  assert.equal(collectElements(split, (element) => element === dialog).length, 0)
  assert.deepEqual(geometry(), beforeGeometry, 'opening a card keeps both pane allocations')
  let prevented = false
  let stopped = false
  mounted.harness.keydown(dialog, {
    key: 'Escape',
    preventDefault: () => {
      prevented = true
    },
    stopPropagation: () => {
      stopped = true
    },
  })
  await mounted.harness.flush()
  assert.ok(prevented && stopped, 'Escape is handled here, not by the surrounding tab')
  await finishMotion(mounted.harness)
  assert.equal(mounted.harness.findAll((element) => element.props.role === 'alertdialog').length, 0)
  assert.deepEqual(mounted.calls, beforeCalls, 'opening and cancelling do not call Git')
  assert.deepEqual(geometry(), beforeGeometry)
})

test('the operation prompt rises into place and lowers away before it is removed', async (t) => {
  const status = createStatus({
    files: [
      { kind: 'ordinary', x: '.', y: 'M', path: 'src/app.js', conflict: false, untracked: false },
    ],
  })
  const mounted = await mountGit({ status })
  t.after(() => mounted.harness.dispose())
  const wrappers = (): TestElement[] =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-promptMotion'))
  assert.equal(wrappers().length, 0, 'no prompt motion is rendered while the pane is idle')
  await openDiscard(mounted)
  floatingPanel(mounted.harness)
  assert.equal(wrappers().length, 1, 'the prompt is wrapped in the surface that moves')
  assert.equal(
    wrappers()[0]?.props['data-phase'],
    'enter',
    'an opening prompt rises from the bottom',
  )
  mounted.harness.click(buttonByText(mounted.harness, 'action.cancel'))
  await mounted.harness.flush()
  assert.equal(wrappers().length, 1, 'a dismissed prompt stays mounted while it leaves')
  const [leaving] = wrappers()
  assert.ok(leaving)
  assert.equal(leaving.props['data-phase'], 'leave', 'a dismissed prompt lowers away')
  assert.match(
    mounted.harness.text(),
    /confirm\.discardTitle/,
    'the card keeps its content while it leaves',
  )
  assert.equal(
    collectElements(leaving, (element) => element.props.role === 'alertdialog').length,
    1,
  )
  await finishMotion(mounted.harness)
  assert.equal(wrappers().length, 0, 'the prompt is removed once its exit animation ends')
  assert.equal(mounted.harness.findAll((element) => element.props.role === 'alertdialog').length, 0)
})

test('floating stage-all confirmation has no empty or dangling description', async (t) => {
  const status = createStatus({
    files: [
      { kind: 'ordinary', x: '.', y: 'M', path: 'src/app.js', conflict: false, untracked: false },
    ],
  })
  const mounted = await mountGit({ status })
  t.after(() => mounted.harness.dispose())
  const [message] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMessage'))
  mounted.harness.change(message, 'commit everything')
  await mounted.harness.flush()
  const beforeCalls = [...mounted.calls]
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  const { body, footer } = floatingPanel(mounted.harness, false)
  assert.match(elementText(body), /commit\.emptyConfirm/)
  assert.match(elementText(footer), /commit\.stageAll/)
  assert.equal(buttonByText(mounted.harness, 'action.cancel').props.autoFocus, true)
  mounted.harness.click(buttonByText(mounted.harness, 'action.cancel'))
  await mounted.harness.flush()
  assert.deepEqual(mounted.calls, beforeCalls)
})

test('floating prompts replace each other in both directions and never resurface on cancel', async (t) => {
  const mounted = await mountGit({
    status: createStatus({
      files: [
        { kind: 'ordinary', x: '.', y: 'M', path: 'src/app.js', conflict: false, untracked: false },
      ],
    }),
  })
  t.after(() => mounted.harness.dispose())
  const beforeCalls = [...mounted.calls]
  let focusRestores = 0
  const invoker: TestEventTarget = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 80, height: 22, bottom: 22 }),
    isConnected: true,
    focus: () => {
      focusRestores += 1
    },
  }
  const createTag = async () => {
    await runMenuAction(mounted.components, graphMenuTarget(mounted, invoker), 'create-tag')
    await mounted.harness.flush()
  }
  const commitAll = async () => {
    const [message] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMessage'))
    mounted.harness.change(message, 'not submitted')
    await mounted.harness.flush()
    mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
    await mounted.harness.flush()
  }
  const cancel = async () => {
    mounted.harness.click(buttonByText(mounted.harness, 'action.cancel'))
    await finishMotion(mounted.harness)
    assert.equal(
      mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
      0,
    )
  }
  await openDiscard(mounted)
  await createTag()
  assert.equal(floatingPanel(mounted.harness).dialog.props['aria-label'], 'menu.createTag')
  await cancel()
  await createTag()
  const focusBeforeReplacement = focusRestores
  await openDiscard(mounted)
  assert.equal(
    focusRestores,
    focusBeforeReplacement,
    'replacement must not focus the old graph row over the new Cancel',
  )
  assert.equal(floatingPanel(mounted.harness).dialog.props['aria-label'], 'confirm.discardTitle')
  await cancel()
  await createTag()
  await commitAll()
  assert.equal(
    floatingPanel(mounted.harness, false).dialog.props['aria-label'],
    'commit.emptyConfirm',
  )
  await cancel()
  await commitAll()
  await createTag()
  assert.equal(floatingPanel(mounted.harness).dialog.props['aria-label'], 'menu.createTag')
  await cancel()
  assert.deepEqual(mounted.calls, beforeCalls, 'replaced operations are never submitted')
})

test('floating content retains long filenames, branch names, annotations and translated actions', async (t) => {
  const filename = `${'very-long-unbroken-filename'.repeat(15)}.ts`
  const branch = `feature/${'long-unbroken-branch'.repeat(10)}`
  const cancelLabel = '取消这个尚未提交的操作'.repeat(8)
  const discardLabel = '确认放弃这个文件的全部更改'.repeat(8)
  const head = HISTORY.commits[0]
  assert.ok(head)
  const mounted = await mountGit({
    status: createStatus({
      files: [
        { kind: 'ordinary', x: '.', y: 'M', path: filename, conflict: false, untracked: false },
      ],
    }),
    history: {
      ...HISTORY,
      commits: [{ ...head, refs: `HEAD -> refs/heads/main, refs/heads/${branch}` }],
    },
    t: (key, params) => {
      if (key === 'confirm.discardTitle' || key === 'menu.deleteBranchConfirm')
        return `${key}: ${params?.name}`
      if (key === 'action.cancel') return cancelLabel
      if (key === 'confirm.discard') return discardLabel
      return translate(key, params)
    },
  })
  t.after(() => mounted.harness.dispose())
  await openDiscard(mounted, filename)
  let panel = floatingPanel(mounted.harness)
  assert.ok(elementText(panel.body).includes(filename), 'long copy is preserved in the scroll body')
  assert.ok(elementText(panel.footer).includes(cancelLabel))
  assert.ok(elementText(panel.footer).includes(discardLabel))
  mounted.harness.click(buttonContaining(mounted.harness, cancelLabel))
  await mounted.harness.flush()
  await runMenuAction(mounted.components, graphMenuTarget(mounted), 'delete-branch', branch)
  await mounted.harness.flush()
  panel = floatingPanel(mounted.harness)
  assert.ok(elementText(panel.body).includes(branch), 'deletion copy keeps the full branch name')
  mounted.harness.click(buttonContaining(mounted.harness, cancelLabel))
  await mounted.harness.flush()
  await runMenuAction(mounted.components, graphMenuTarget(mounted), 'create-tag')
  await mounted.harness.flush()
  const annotation = 'Long annotation\n'.repeat(120)
  const [message] = mounted.harness.findAll(
    (element) => element.props['aria-label'] === 'menu.tagMessage',
  )
  mounted.harness.change(message, annotation)
  await mounted.harness.flush()
  panel = floatingPanel(mounted.harness)
  const [field] = collectElements(
    panel.body,
    (element) => element.props['aria-label'] === 'menu.tagMessage',
  )
  assert.equal(field?.props.value, annotation)
  assert.equal(collectElements(panel.footer, (element) => element.type === 'textarea').length, 0)
})

for (const operation of ['create-branch', 'create-tag', 'delete-branch']) {
  test(`floating pending ${operation} rejects cancellation and duplicate submission`, async (t) => {
    let release = () => {}
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const head = HISTORY.commits[0]
    assert.ok(head)
    const mounted = await mountGit({
      pending: { op: operation, until: pending },
      history: {
        ...HISTORY,
        commits: [{ ...head, refs: 'HEAD -> refs/heads/main, refs/heads/feature/graph' }],
      },
    })
    t.after(async () => {
      release()
      await mounted.harness.flush()
      await mounted.harness.dispose()
    })
    const target = graphMenuTarget(mounted)
    if (operation === 'delete-branch') {
      await runMenuAction(mounted.components, target, operation, 'feature/graph')
    } else {
      await runMenuAction(mounted.components, target, operation)
    }
    await mounted.harness.flush()
    const [name] = mounted.harness.findAll(
      (element) => element.props['aria-label'] === 'menu.referenceName',
    )
    if (operation !== 'delete-branch') {
      assert.equal(name?.props.autoFocus, true, 'reference creation keeps focus on its name')
      mounted.harness.change(name, 'new-reference')
      await mounted.harness.flush()
    } else {
      assert.equal(buttonByText(mounted.harness, 'action.cancel').props.autoFocus, true)
    }
    const label =
      operation === 'create-branch'
        ? 'menu.createBranch'
        : operation === 'create-tag'
          ? 'menu.createTag'
          : 'menu.deleteBranch'
    const submit = buttonContaining(mounted.harness, label)
    mounted.harness.click(submit)
    mounted.harness.click(submit)
    await mounted.harness.flush()
    const { dialog, body } = floatingPanel(mounted.harness)
    assert.equal(dialog.props['aria-busy'], true)
    assert.ok(collectElements(body, (element) => element.props.role === 'status').length > 0)
    const cancel = buttonByText(mounted.harness, 'action.cancel')
    const busySubmit = buttonContaining(mounted.harness, label)
    assert.equal(cancel.props['aria-disabled'], 'true')
    assert.equal(busySubmit.props['aria-disabled'], 'true')
    assert.notEqual(cancel.props.disabled, true, 'busy state does not steal keyboard focus')
    let stopped = false
    mounted.harness.keydown(dialog, {
      key: 'Escape',
      stopPropagation: () => {
        stopped = true
      },
    })
    mounted.harness.click(cancel)
    mounted.harness.click(busySubmit)
    if (name !== undefined) {
      const [busyName] = mounted.harness.findAll(
        (element) => element.props['aria-label'] === 'menu.referenceName',
      )
      mounted.harness.keydown(busyName, { key: 'Enter' })
    }
    await mounted.harness.flush()
    assert.ok(stopped, 'busy Escape is consumed instead of dismissing the containing tab')
    assert.equal(mounted.calls.filter((call) => call.op === operation).length, 1)
    floatingPanel(mounted.harness)
    release()
    await finishMotion(mounted.harness)
    assert.equal(
      mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
      0,
    )
  })
}

test('floating reference inputs keep IME Enter and ordinary annotation Enter out of submit', async (t) => {
  const mounted = await mountGit()
  t.after(() => mounted.harness.dispose())
  await runMenuAction(mounted.components, graphMenuTarget(mounted), 'create-tag')
  await mounted.harness.flush()
  const [name] = mounted.harness.findAll(
    (element) => element.props['aria-label'] === 'menu.referenceName',
  )
  mounted.harness.change(name, 'composition-tag')
  await mounted.harness.flush()
  const [currentName] = mounted.harness.findAll(
    (element) => element.props['aria-label'] === 'menu.referenceName',
  )
  const [message] = mounted.harness.findAll(
    (element) => element.props['aria-label'] === 'menu.tagMessage',
  )
  mounted.harness.keydown(currentName, { key: 'Enter', nativeEvent: { isComposing: true } })
  mounted.harness.keydown(message, { key: 'Enter' })
  mounted.harness.keydown(message, {
    key: 'Enter',
    ctrlKey: true,
    nativeEvent: { isComposing: true },
  })
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'create-tag').length, 0)
  floatingPanel(mounted.harness)
})

test('a floating branch failure keeps the retained form and reports the failure', async (t) => {
  const mounted = await mountGit({ failOp: 'create-branch' })
  t.after(() => mounted.harness.dispose())
  await runMenuAction(mounted.components, graphMenuTarget(mounted), 'create-branch')
  await mounted.harness.flush()
  const [name] = mounted.harness.findAll(
    (element) => element.props['aria-label'] === 'menu.referenceName',
  )
  mounted.harness.change(name, 'existing-branch')
  await mounted.harness.flush()
  mounted.harness.click(buttonContaining(mounted.harness, 'menu.createBranch'))
  await mounted.harness.flush()
  const { body, dialog } = floatingPanel(mounted.harness)
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
  assert.equal(
    collectElements(body, (element) => element.props['aria-label'] === 'menu.referenceName')[0]
      ?.props.value,
    'existing-branch',
  )
  assert.notEqual(dialog.props['aria-busy'], true)
  mounted.harness.click(buttonByText(mounted.harness, 'action.cancel'))
  await finishMotion(mounted.harness)
  assert.equal(mounted.harness.findAll((element) => element.props.role === 'alertdialog').length, 0)
  assert.equal(mounted.calls.filter((call) => call.op === 'create-branch').length, 1)
})

test('the branch menu loads local branches and checks one out', async () => {
  const mounted = await mountGit()
  const chip = mounted.harness.findAll(
    (element) =>
      element.type === 'button' && String(element.props.className).includes('dshgg-branchChip'),
  )[0]
  assert.ok(chip)
  mounted.harness.click(chip)
  await mounted.harness.flush()
  assert.ok(mounted.calls.some((call) => call.op === 'branches'))
  const feature = buttonContaining(mounted.harness, 'feature/sidebar')
  mounted.harness.click(feature)
  await mounted.harness.flush()
  const checkoutCall = mounted.calls.find((call) => call.op === 'checkout')
  assert.equal(checkoutCall?.branch, 'feature/sidebar')
  await mounted.harness.dispose()
})

test('the remote menu opens, fetches, and reports success', async () => {
  const mounted = await mountGit({ menuService: true })
  await openRemoteMenu(mounted)
  assert.ok(
    mounted.calls.some((call) => call.op === 'remotes'),
    'opening the overflow menu reads the configured remotes',
  )
  assert.equal(remoteMenuItem(mounted, 'remote.fetch').props.disabled, false)
  const statusBefore = mounted.calls.filter((call) => call.op === 'status').length
  mounted.harness.click(remoteMenuItem(mounted, 'remote.fetch'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'fetch').length, 1)
  assert.equal(
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-menuItem')).length,
    0,
    'starting an action closes the menu',
  )
  assert.deepEqual(mounted.components.notifications, [{ text: 'remote.fetchDone', success: true }])
  assert.ok(
    mounted.calls.filter((call) => call.op === 'status').length > statusBefore,
    'a successful remote action refreshes the status',
  )
  await mounted.harness.dispose()
})

test('the remote menu runs pull, rebase pull, push and sync', async () => {
  const mounted = await mountGit()
  const run = async (label: string): Promise<void> => {
    await openRemoteMenu(mounted)
    mounted.harness.click(remoteMenuItem(mounted, label))
    await mounted.harness.flush()
  }
  await run('remote.pull')
  const pull = mounted.calls.filter((call) => call.op === 'pull').at(-1)
  assert.equal(pull?.rebase, false, 'Pull merges the upstream')
  await run('remote.pullRebase')
  assert.equal(
    mounted.calls.filter((call) => call.op === 'pull').at(-1)?.rebase,
    true,
    'Pull (Rebase) asks Git to rebase',
  )
  await run('remote.push')
  assert.equal(mounted.calls.filter((call) => call.op === 'push').length, 1)
  await run('remote.sync')
  assert.equal(mounted.calls.filter((call) => call.op === 'sync').length, 1)
  assert.deepEqual(mounted.components.notifications, [
    { text: 'remote.pullDone', success: true },
    { text: 'remote.pullRebaseDone', success: true },
    { text: 'remote.pushDone', success: true },
    { text: 'remote.syncDone', success: true },
  ])
  await mounted.harness.dispose()
})

test('Push becomes Publish Branch when the branch has no upstream', async () => {
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null }) }),
  })
  await openRemoteMenu(mounted)
  assert.equal(
    mounted.harness.findAll(
      (element) => element.type === 'button' && elementText(element) === 'remote.push',
    ).length,
    0,
    'no Push item without an upstream',
  )
  assert.equal(remoteMenuItem(mounted, 'remote.publishBranch').props.disabled, false)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.publishBranch'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'publish').length, 1)
  assert.equal(mounted.calls.filter((call) => call.op === 'publish').at(-1)?.remote, 'origin')
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    0,
    'one configured remote publishes without asking',
  )
  await mounted.harness.dispose()
})

test('the remote status control syncs with an upstream and spins while busy', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const mounted = await mountGit({ pending: { op: 'sync', until: pending } })
  assert.equal(cloudButton(mounted).props['aria-label'], 'remote.statusSync')
  mounted.harness.click(cloudButton(mounted))
  await mounted.harness.flush()
  const spinning = cloudButton(mounted)
  assert.equal(spinning.props['data-spinning'], 'true', 'the cloud spins while syncing')
  assert.equal(spinning.props.disabled, true)
  release()
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'sync').length, 1)
  assert.deepEqual(mounted.components.notifications, [{ text: 'remote.syncDone', success: true }])
  await mounted.harness.dispose()
})

test('the remote status control publishes a branch without an upstream', async () => {
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null }) }),
  })
  assert.equal(cloudButton(mounted).props['aria-label'], 'remote.statusPublish')
  mounted.harness.click(cloudButton(mounted))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'publish').length, 1)
  assert.equal(mounted.calls.filter((call) => call.op === 'publish').at(-1)?.remote, 'origin')
  assert.deepEqual(mounted.components.notifications, [
    { text: 'remote.publishDone', success: true },
  ])
  await mounted.harness.dispose()
})

test('publish with several remotes asks for one and prefers origin', async () => {
  const many: RemotesResult = {
    remotes: [
      {
        name: 'upstream',
        fetchUrl: 'https://example.test/up.git',
        pushUrl: 'https://example.test/up.git',
      },
      {
        name: 'origin',
        fetchUrl: 'https://example.test/repo.git',
        pushUrl: 'https://example.test/repo.git',
      },
    ],
  }
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null }), files: STATUS.files }),
    remotes: many,
  })
  await openRemoteMenu(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.publishBranch'))
  await mounted.harness.flush()
  const { dialog } = floatingPanel(mounted.harness)
  assert.match(elementText(dialog), /remote\.publishTitle/)
  const [select] = mounted.harness.findAll((element) => element.type === 'select')
  assert.ok(select, 'the publish form offers a remote select')
  assert.equal(select.props.value, 'origin', 'origin is preferred when it exists')
  mounted.harness.change(select, 'upstream')
  await mounted.harness.flush()
  assert.equal(
    mounted.harness.findAll((element) => element.type === 'select')[0]?.props.value,
    'upstream',
  )
  mounted.harness.click(buttonContaining(mounted.harness, 'remote.publishAction'))
  await mounted.harness.flush()
  const publish = mounted.calls.filter((call) => call.op === 'publish').at(-1)
  assert.equal(publish?.remote, 'upstream', 'the chosen remote reaches the Host')
  assert.deepEqual(mounted.components.notifications, [
    { text: 'remote.publishDone', success: true },
  ])
  await finishMotion(mounted.harness)
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    0,
    'a successful publish closes the form',
  )
  await mounted.harness.dispose()
})

test('a failed publish keeps the form and its selected remote', async () => {
  const many: RemotesResult = {
    remotes: [
      {
        name: 'origin',
        fetchUrl: 'https://example.test/repo.git',
        pushUrl: 'https://example.test/repo.git',
      },
      {
        name: 'upstream',
        fetchUrl: 'https://example.test/up.git',
        pushUrl: 'https://example.test/up.git',
      },
    ],
  }
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null }) }),
    remotes: many,
    failOp: 'publish',
  })
  await openRemoteMenu(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.publishBranch'))
  await mounted.harness.flush()
  const select = (): TestElement | undefined =>
    mounted.harness.findAll((element) => element.type === 'select')[0]
  assert.ok(select())
  mounted.harness.change(select(), 'upstream')
  await mounted.harness.flush()
  const statusBefore = mounted.calls.filter((call) => call.op === 'status').length
  mounted.harness.click(buttonContaining(mounted.harness, 'remote.publishAction'))
  await mounted.harness.flush()
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    1,
    'the failed publish keeps the form open',
  )
  assert.equal(select()?.props.value, 'upstream', 'the chosen remote stays selected')
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
  assert.ok(
    mounted.calls.filter((call) => call.op === 'status').length > statusBefore,
    'a failed remote action still refreshes the status',
  )
  assert.equal(
    mounted.components.notifications.some((notification) => notification.success),
    false,
    'a failure emits no success notice',
  )
  await mounted.harness.dispose()
})

test('publish with no configured remote reports it without calling Git', async () => {
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null }) }),
    remotes: { remotes: [] },
  })
  await openRemoteMenu(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.publishBranch'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'publish').length, 0)
  assert.deepEqual(mounted.components.notifications, [{ text: 'remote.noRemotes', success: false }])
  await mounted.harness.dispose()
})

test('the remote menu shows the remote-list loading and failure notes with retry', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const loading = await mountGit({ pending: { op: 'remotes', until: pending } })
  loading.harness.click(buttonByLabel(loading.harness, 'remote.menu'))
  await loading.harness.flush()
  assert.match(loading.harness.text(), /remote\.loading/)
  release()
  await loading.harness.flush()
  assert.equal(remoteMenuItem(loading, 'remote.fetch').props.disabled, false)
  await loading.harness.dispose()

  const failing = await mountGit({ failRemotesPages: [0] })
  await openRemoteMenu(failing)
  assert.match(failing.harness.text(), /git said no/)
  assert.equal(failing.calls.filter((call) => call.op === 'remotes').length, 1)
  failing.harness.click(buttonContaining(failing.harness, 'retry'))
  await failing.harness.flush()
  assert.equal(failing.calls.filter((call) => call.op === 'remotes').length, 2)
  assert.doesNotMatch(failing.harness.text(), /git said no/)
  assert.equal(remoteMenuItem(failing, 'remote.fetch').props.disabled, false)
  await failing.harness.dispose()
})

test('Escape and an outside pointerdown close the remote menu', async () => {
  const mounted = await mountGit()
  const items = (): number =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-menuItem')).length
  await openRemoteMenu(mounted)
  assert.equal(items(), 6, 'five actions plus the Remote disclosure')
  const escapeResult = escapeKeydown()
  await mounted.harness.flush()
  assert.equal(escapeResult.prevented, false, 'the menu does not consume the key')
  assert.equal(items(), 0)
  await openRemoteMenu(mounted)
  assert.equal(items(), 6)
  dispatchDocumentPointerdown({})
  await mounted.harness.flush()
  assert.equal(items(), 0, 'an outside pointerdown closes the menu')
  await mounted.harness.dispose()
})

test('the branch picker and remote menu never stay open together', async () => {
  const mounted = await mountGit()
  const chip = (): TestElement => {
    const [element] = mounted.harness.findAll(
      (element) => element.type === 'button' && hasClass(element, 'dshgg-branchChip'),
    )
    assert.ok(element, 'no branch chip rendered')
    return element
  }
  mounted.harness.click(chip())
  await mounted.harness.flush()
  assert.equal(chip().props['aria-expanded'], true)
  await openRemoteMenu(mounted)
  assert.equal(chip().props['aria-expanded'], false, 'the remote menu closes the branch picker')
  assert.ok(mounted.harness.findAll((element) => hasClass(element, 'dshgg-menuItem')).length > 0)
  mounted.harness.click(chip())
  await mounted.harness.flush()
  assert.equal(chip().props['aria-expanded'], true)
  assert.equal(
    mounted.harness.findAll(
      (element) => element.type === 'button' && elementText(element) === 'remote.fetch',
    ).length,
    0,
    'the branch picker closes the remote menu',
  )
  await mounted.harness.dispose()
})

test('a busy panel disables every remote action', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const mounted = await mountGit({ pending: { op: 'fetch', until: pending } })
  await openRemoteMenu(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.fetch'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'fetch').length, 1)
  await openRemoteMenu(mounted)
  for (const label of [
    'remote.fetch',
    'remote.pull',
    'remote.pullRebase',
    'remote.push',
    'remote.sync',
  ]) {
    assert.equal(remoteMenuItem(mounted, label).props.disabled, true, `${label} is disabled`)
  }
  assert.equal(cloudButton(mounted).props.disabled, true, 'the cloud is disabled while busy')
  release()
  await mounted.harness.flush()
  for (const label of [
    'remote.fetch',
    'remote.pull',
    'remote.pullRebase',
    'remote.push',
    'remote.sync',
  ]) {
    assert.equal(remoteMenuItem(mounted, label).props.disabled, false, `${label} is enabled again`)
  }
  await mounted.harness.dispose()
})

test('the publish form replaces an open confirmation and a confirmation replaces it', async () => {
  const many: RemotesResult = {
    remotes: [
      {
        name: 'origin',
        fetchUrl: 'https://example.test/repo.git',
        pushUrl: 'https://example.test/repo.git',
      },
      {
        name: 'upstream',
        fetchUrl: 'https://example.test/up.git',
        pushUrl: 'https://example.test/up.git',
      },
    ],
  }
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null }), files: STATUS.files }),
    remotes: many,
  })
  await openDiscard(mounted)
  assert.match(mounted.harness.text(), /confirm\.discardTitle/)
  await openRemoteMenu(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.publishBranch'))
  await mounted.harness.flush()
  const dialogs = (): TestElement[] =>
    mounted.harness.findAll((element) => element.props.role === 'alertdialog')
  assert.equal(dialogs().length, 1)
  assert.match(elementText(elementOf(dialogs()[0])), /remote\.publishTitle/)
  assert.equal(
    elementText(elementOf(dialogs()[0])).includes('confirm.discardTitle'),
    false,
    'the publish form replaced the confirmation',
  )
  await openDiscard(mounted)
  assert.equal(dialogs().length, 1)
  assert.match(elementText(elementOf(dialogs()[0])), /confirm\.discardTitle/)
  assert.equal(
    elementText(elementOf(dialogs()[0])).includes('remote.publishTitle'),
    false,
    'the confirmation replaced the publish form',
  )
  await mounted.harness.dispose()
})

test('Add Remote submits the name and URL, closes and refreshes the list', async () => {
  const mounted = await mountGit({ menuService: true })
  await openRemoteMenu(mounted)
  await openRemoteGroup(mounted)
  const before = remotesCalls(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.add'))
  await mounted.harness.flush()
  const { dialog } = floatingPanel(mounted.harness)
  assert.match(elementText(dialog), /remote\.addTitle/)
  const name = dialogInput(mounted, 'remote.nameField')
  const url = dialogInput(mounted, 'remote.urlField')
  assert.ok(name, 'the form shows the name field')
  assert.ok(url, 'the form shows the URL field')
  assert.equal(name.props.autoFocus, true, 'the name field takes focus')
  const submit = buttonContaining(mounted.harness, 'remote.addAction')
  assert.equal(submit.props.disabled, true, 'empty fields cannot be submitted')
  mounted.harness.change(name, 'upstream')
  mounted.harness.change(url, 'https://example.test/up.git')
  await mounted.harness.flush()
  assert.equal(buttonContaining(mounted.harness, 'remote.addAction').props.disabled, false)
  mounted.harness.click(buttonContaining(mounted.harness, 'remote.addAction'))
  await mounted.harness.flush()
  const added = mounted.calls.filter((call) => call.op === 'add-remote').at(-1)
  assert.equal(added?.name, 'upstream')
  assert.equal(added?.url, 'https://example.test/up.git')
  assert.deepEqual(mounted.components.notifications, [{ text: 'remote.addDone', success: true }])
  assert.ok(remotesCalls(mounted) > before, 'the remotes list reloads after a successful add')
  await finishMotion(mounted.harness)
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    0,
    'a successful add closes the form',
  )
  await mounted.harness.dispose()
})

test('a failed add keeps the form and its values and reports the failure', async () => {
  const mounted = await mountGit({ failOp: 'add-remote' })
  await openRemoteMenu(mounted)
  await openRemoteGroup(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.add'))
  await mounted.harness.flush()
  const name = dialogInput(mounted, 'remote.nameField')
  const url = dialogInput(mounted, 'remote.urlField')
  assert.ok(name)
  assert.ok(url)
  mounted.harness.change(name, 'upstream')
  mounted.harness.change(url, 'https://example.test/up.git')
  await mounted.harness.flush()
  mounted.harness.click(buttonContaining(mounted.harness, 'remote.addAction'))
  await mounted.harness.flush()
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    1,
    'the failed add keeps the form open',
  )
  assert.equal(dialogInput(mounted, 'remote.nameField')?.props.value, 'upstream')
  assert.equal(dialogInput(mounted, 'remote.urlField')?.props.value, 'https://example.test/up.git')
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
  assert.equal(
    mounted.components.notifications.some((notification) => notification.success),
    false,
    'a failure emits no success notice',
  )
  await mounted.harness.dispose()
})

test('Remove Remote lists the remotes, confirms and refreshes', async () => {
  const mounted = await mountGit({ menuService: true })
  await openRemoteMenu(mounted)
  await openRemoteGroup(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.remove'))
  await mounted.harness.flush()
  const { dialog, footer } = floatingPanel(mounted.harness)
  assert.match(elementText(dialog), /remote\.removeTitle/)
  assert.match(elementText(dialog), /remote\.removeDesc/)
  const select = mounted.harness.findAll((element) => element.type === 'select')[0]
  assert.ok(select, 'the remove form offers a remote select')
  assert.equal(select.props.value, 'origin', 'the first configured remote is selected')
  const footerButtons = collectElements(footer, (element) => element.type === 'button')
  assert.equal(footerButtons[0]?.props.autoFocus, true, 'Cancel takes focus on a destructive form')
  const before = remotesCalls(mounted)
  mounted.harness.click(buttonContaining(mounted.harness, 'remote.removeAction'))
  await mounted.harness.flush()
  const removed = mounted.calls.filter((call) => call.op === 'remove-remote').at(-1)
  assert.equal(removed?.name, 'origin')
  assert.deepEqual(mounted.components.notifications, [{ text: 'remote.removeDone', success: true }])
  assert.ok(remotesCalls(mounted) > before, 'the remotes list reloads after a successful remove')
  await finishMotion(mounted.harness)
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    0,
    'a successful remove closes the form',
  )
  await mounted.harness.dispose()
})

test('Remove reports no remotes after reading the list again', async () => {
  const mounted = await mountGit({
    remotesPages: [REMOTES, { remotes: [] }],
  })
  await openRemoteMenu(mounted)
  await openRemoteGroup(mounted)
  assert.equal(remoteMenuItem(mounted, 'remote.remove').props.disabled, false)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.remove'))
  await mounted.harness.flush()
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    0,
    'no remove form opens without a configured remote',
  )
  assert.deepEqual(mounted.components.notifications, [{ text: 'remote.noRemotes', success: false }])
  await mounted.harness.dispose()
})

test('Remove stays disabled until a non-empty remote list is loaded', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const loading = await mountGit({ pending: { op: 'remotes', until: pending } })
  loading.harness.click(buttonByLabel(loading.harness, 'remote.menu'))
  await loading.harness.flush()
  await openRemoteGroup(loading)
  assert.equal(
    remoteMenuItem(loading, 'remote.add').props.disabled,
    false,
    'Add works while loading',
  )
  assert.equal(remoteMenuItem(loading, 'remote.remove').props.disabled, true)
  release()
  await loading.harness.flush()
  assert.equal(remoteMenuItem(loading, 'remote.remove').props.disabled, false)
  await loading.harness.dispose()

  const failing = await mountGit({ failRemotesPages: [0] })
  await openRemoteMenu(failing)
  await openRemoteGroup(failing)
  assert.equal(remoteMenuItem(failing, 'remote.remove').props.disabled, true)
  assert.match(failing.harness.text(), /git said no/)
  failing.harness.click(buttonContaining(failing.harness, 'retry'))
  await failing.harness.flush()
  assert.equal(remoteMenuItem(failing, 'remote.remove').props.disabled, false)
  await failing.harness.dispose()
})

test('Escape closes the add-remote form without running Git', async () => {
  const mounted = await mountGit()
  await openRemoteMenu(mounted)
  await openRemoteGroup(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.add'))
  await mounted.harness.flush()
  const { dialog } = floatingPanel(mounted.harness)
  mounted.harness.keydown(dialog, { key: 'Escape' })
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'add-remote').length, 0)
  await finishMotion(mounted.harness)
  assert.equal(mounted.harness.findAll((element) => element.props.role === 'alertdialog').length, 0)
  await mounted.harness.dispose()
})

test('fetch and remote configuration work without a current branch', async () => {
  const detached = await mountGit({
    status: createStatus({
      repo: createRepo({
        branch: null,
        detached: true,
        upstream: null,
        ahead: 0,
        behind: 0,
        headOid: 'a'.repeat(40),
      }),
    }),
  })
  await openRemoteMenu(detached)
  assert.equal(remoteMenuItem(detached, 'remote.fetch').props.disabled, false)
  detached.harness.click(remoteMenuItem(detached, 'remote.fetch'))
  await detached.harness.flush()
  assert.equal(detached.calls.filter((call) => call.op === 'fetch').length, 1)
  await openRemoteMenu(detached)
  await openRemoteGroup(detached)
  assert.equal(remoteMenuItem(detached, 'remote.add').props.disabled, false)
  assert.equal(remoteMenuItem(detached, 'remote.remove').props.disabled, false)
  detached.harness.click(remoteMenuItem(detached, 'remote.add'))
  await detached.harness.flush()
  floatingPanel(detached.harness)
  const name = dialogInput(detached, 'remote.nameField')
  const url = dialogInput(detached, 'remote.urlField')
  assert.ok(name)
  assert.ok(url)
  detached.harness.change(name, 'upstream')
  detached.harness.change(url, 'https://example.test/up.git')
  await detached.harness.flush()
  detached.harness.click(buttonContaining(detached.harness, 'remote.addAction'))
  await detached.harness.flush()
  assert.equal(detached.calls.filter((call) => call.op === 'add-remote').length, 1)
  await detached.harness.dispose()

  const unborn = await mountGit({
    status: createStatus({
      repo: createRepo({ unborn: true, upstream: null, ahead: 0, behind: 0, headOid: null }),
    }),
  })
  await openRemoteMenu(unborn)
  assert.equal(remoteMenuItem(unborn, 'remote.fetch').props.disabled, false)
  unborn.harness.click(remoteMenuItem(unborn, 'remote.fetch'))
  await unborn.harness.flush()
  assert.equal(unborn.calls.filter((call) => call.op === 'fetch').length, 1)
  await unborn.harness.dispose()
})

test('the branch picker lists remote branches and checks one out', async () => {
  const remotes = [
    { name: 'origin/main', remote: 'origin', branch: 'main' },
    { name: 'origin/release/1.0', remote: 'origin', branch: 'release/1.0' },
  ]
  const mounted = await mountGit({
    branches: createBranches(['main', 'feature/sidebar'], 'main', remotes),
  })
  const chip = (): TestElement => {
    const [element] = mounted.harness.findAll(
      (candidate) => candidate.type === 'button' && hasClass(candidate, 'dshgg-branchChip'),
    )
    assert.ok(element, 'no branch chip rendered')
    return element
  }
  const items = (): TestElement[] =>
    mounted.harness.findAll(
      (element) => element.type === 'button' && hasClass(element, 'dshgg-menuItem'),
    )
  mounted.harness.click(chip())
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /branch\.remoteHeading/)
  assert.deepEqual(
    items().map((item) => elementText(item)),
    ['main', 'feature/sidebar', 'origin/main', 'origin/release/1.0'],
    'local branches come first, then the remote group',
  )
  const remoteItem = items()[2]
  assert.ok(remoteItem)
  assert.equal(
    collectElements(remoteItem, (element) => element.type === 'svg').length,
    1,
    'remote branches carry the cloud icon',
  )
  const historyBefore = mounted.calls.filter((call) => call.op === 'history').length
  const branchReads = mounted.calls.filter((call) => call.op === 'branches').length
  mounted.harness.click(remoteItem)
  await mounted.harness.flush()
  const checkedOut = mounted.calls.filter((call) => call.op === 'checkout-remote').at(-1)
  assert.equal(checkedOut?.remote, 'origin')
  assert.equal(checkedOut?.branch, 'main')
  assert.deepEqual(mounted.components.notifications, [
    { text: 'branch.checkedOutRemote', success: true },
  ])
  assert.ok(
    mounted.calls.filter((call) => call.op === 'history').length > historyBefore,
    'a remote checkout refreshes the graph',
  )
  mounted.harness.click(chip())
  await mounted.harness.flush()
  assert.ok(
    mounted.calls.filter((call) => call.op === 'branches').length > branchReads,
    'the branch list is read again after a remote checkout',
  )
  await mounted.harness.dispose()
})

test('an empty local branch group still shows the remote group', async () => {
  const mounted = await mountGit({
    branches: createBranches([], '', [{ name: 'origin/main', remote: 'origin', branch: 'main' }]),
  })
  mounted.harness.click(
    mounted.harness.findAll(
      (element) => element.type === 'button' && hasClass(element, 'dshgg-branchChip'),
    )[0],
  )
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /branch\.remoteHeading/)
  assert.ok(buttonContaining(mounted.harness, 'origin/main'))
  assert.match(mounted.harness.text(), /branch\.empty/)
  await mounted.harness.dispose()
})

test('a changed file opens a diff tab with its addressing parameters', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  assert.ok(rows.length >= 2)
  mounted.harness.click(rows[rows.length - 1])
  const opened = mounted.openedTabs[0]
  assert.ok(opened, 'no diff tab was opened')
  assert.equal(opened.kind, 'git-diff')
  assert.equal(opened.options.params.path, 'src/app.js')
  assert.equal(opened.options.params.staged, false)
  await mounted.harness.dispose()
})

/** Find the rendered commit rows of the graph. */
function graphRows(harness: TestHarness): TestElement[] {
  return harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )
}

/** Find the rows an expanded commit lists below itself. */
function changeRows(harness: TestHarness): TestElement[] {
  return harness.findAll((element) =>
    String(element.props?.className ?? '')
      .split(' ')
      .includes('dshgg-graphChange'),
  )
}

/** Find the details card that overlays the still-mounted panel content. */
function commitCard(harness: TestHarness): TestElement {
  const [card] = harness.findAll((element) => hasClass(element, 'dshgg-commitCard'))
  assert.ok(card, 'no commit details card rendered')
  return card
}

/** Open one commit's details view through its row's View Details menu action. */
async function openCommitDetails(mounted: MountedGit, index = 0): Promise<void> {
  const row = graphRows(mounted.harness)[index]
  assert.ok(row, 'no graph row rendered')
  mounted.harness.contextmenu(row, { clientX: 1, clientY: 2 })
  await mounted.harness.flush()
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'view-details')
  await mounted.harness.flush()
}

test('View Details shows a commit and a file opens the commit diff', async () => {
  const mounted = await mountGit()
  await openCommitDetails(mounted)

  const detailsCall = mounted.calls.find((call) => call.op === 'commit-details')
  assert.equal(detailsCall?.oid, 'a'.repeat(40))
  const card = commitCard(mounted.harness)
  const text = elementText(card)
  assert.match(text, /commitDetails\.files/)
  assert.match(text, /Fix the sidebar/)
  assert.match(text, /Ann/)
  assert.match(text, /A longer explanation of the fix\./)
  assert.match(text, /\.js/)
  assert.match(text, /app\.js/)
  assert.match(text, /added\.js/)
  assert.match(text, /renamed\.js/)
  assert.match(text, /old\.js/)
  assert.match(text, /gone\.md/)
  const folderRows = collectElements(card, (element) => hasClass(element, 'dshgg-folderRow'))
  assert.deepEqual(
    folderRows.map((row) => row.props.title),
    ['docs', 'src'],
    'commit files are grouped into folder rows',
  )
  assert.deepEqual(
    folderRows.map((row) => {
      const [label] = collectElements(row, (element) => hasClass(element, 'dshgg-folderName'))
      assert.ok(label, 'every folder row renders its name')
      return elementText(label)
    }),
    ['docs', 'src'],
    'each folder row shows its collapsed chain label',
  )
  for (const row of folderRows) {
    assert.deepEqual(
      row.props.style,
      { paddingLeft: '6px' },
      'root folder rows sit at the first nesting level',
    )
    assert.equal(row.props.role, 'button', 'folder rows are disclosure controls')
    assert.equal(row.props.tabIndex, 0, 'folder rows take keyboard focus')
    assert.equal(row.props['aria-expanded'], true, 'folders start expanded')
    assert.equal(hasClass(row, 'dshgg-fileRow'), false, 'folder rows are not file rows')
  }
  const commitTitles = collectElements(card, (element) => hasClass(element, 'dshgg-fileRow')).map(
    (row) => row.props.title,
  )
  assert.deepEqual(
    commitTitles,
    ['docs/gone.md', 'src/added.js', 'src/app.js', 'src/old.js → src/renamed.js'],
    'commit files are listed once each in path order',
  )
  assert.ok(buttonByLabel(mounted.harness, 'commitDetails.back'))
  assert.ok(commitBox(mounted.harness), 'the commit box stays mounted beneath the card')
  assert.equal(
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-split')).length,
    1,
    'the split stays mounted beneath the card',
  )
  const content = mounted.harness.findAll((element) => hasClass(element, 'dshgg-content'))[0]
  assert.ok(content, 'the panel content stays mounted beneath the card')
  assert.equal(content.props['aria-hidden'], 'true', 'the underlay is hidden from the tree')
  assert.equal(content.props.inert, '', 'the underlay takes no focus or input')

  const fileRows = collectElements(
    card,
    (element) => hasClass(element, 'dshgg-fileRow') && element.props?.title === 'src/app.js',
  )
  assert.equal(fileRows.length, 1, 'the changed file is listed once')
  mounted.harness.click(fileRows[0])
  const opened = mounted.openedTabs.at(-1)
  assert.ok(opened)
  assert.equal(opened.kind, 'git-diff')
  assert.equal(opened.options.params.path, 'src/app.js')
  assert.equal(opened.options.params.commit, 'a'.repeat(40))
  assert.equal(opened.options.params.shortOid, 'aaaaaaa')
  assert.equal(opened.options.params.status, 'M')

  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await finishMotion(mounted.harness)
  const after = mounted.harness.text()
  assert.match(after, /sections\.changes/)
  assert.doesNotMatch(after, /commitDetails\.files/)
  await mounted.harness.dispose()
})

test('the commit details view slides in from the right edge and back out', async (t) => {
  const mounted = await mountGit()
  t.after(() => mounted.harness.dispose())
  const wrappers = (): TestElement[] =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMotion'))
  const content = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) => hasClass(candidate, 'dshgg-content'))
    assert.ok(element, 'no panel content rendered')
    return element
  }
  const splitCount = (): number =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-split')).length
  assert.equal(wrappers().length, 0, 'no details motion is rendered while the split shows')
  assert.equal(splitCount(), 1)
  assert.equal(content().props['aria-hidden'], undefined)
  assert.equal(content().props.inert, undefined)
  await openCommitDetails(mounted)
  const [arriving] = wrappers()
  assert.ok(arriving, 'the details view has a motion surface')
  assert.equal(arriving.props['data-phase'], 'enter', 'the details view slides in')
  assert.equal(
    collectElements(arriving, (element) => hasClass(element, 'dshgg-commitView')).length,
    1,
    'the details view itself is the surface that moves',
  )
  const [card] = collectElements(arriving, (element) => hasClass(element, 'dshgg-commitCard'))
  assert.ok(card, 'the details view sits on the card surface')
  assert.equal(splitCount(), 1, 'the split stays mounted beneath the entering card')
  assert.equal(content().props['aria-hidden'], 'true', 'the entering card hides the underlay')
  assert.equal(content().props.inert, '', 'the entering card makes the underlay inert')
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await mounted.harness.flush()
  const [leaving] = wrappers()
  assert.ok(leaving)
  assert.equal(leaving.props['data-phase'], 'leave', 'returning slides the details view out')
  assert.match(
    elementText(leaving),
    /commitDetails\.files/,
    'the details content is still shown while it slides away',
  )
  assert.equal(splitCount(), 1, 'the split stays mounted while the card leaves')
  assert.equal(content().props['aria-hidden'], 'true', 'the leaving card still hides the underlay')
  assert.equal(content().props.inert, '', 'the leaving card still makes the underlay inert')
  await finishMotion(mounted.harness)
  assert.equal(wrappers().length, 0, 'the details view is removed once it has slid away')
  assert.equal(content().props['aria-hidden'], undefined)
  assert.equal(content().props.inert, undefined)
  assert.equal(splitCount(), 1, 'the change list remains mounted after the details view has left')
})

test('Escape closes the commit details without calling Git', async (t) => {
  const mounted = await mountGit()
  t.after(() => mounted.harness.dispose())
  const wrappers = (): TestElement[] =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMotion'))
  await openCommitDetails(mounted)
  const callCount = mounted.calls.length
  const escapeResult = escapeKeydown()
  await mounted.harness.flush()
  assert.deepEqual(escapeResult, { prevented: true, stopped: true }, 'the panel owns the key')
  const [leaving] = wrappers()
  assert.ok(leaving)
  assert.equal(leaving.props['data-phase'], 'leave', 'Escape uses the back-control transition')
  assert.match(elementText(leaving), /commitDetails\.files/, 'the content leaves before removal')
  assert.equal(mounted.calls.length, callCount, 'Escape runs no Git command')
  await finishMotion(mounted.harness)
  assert.equal(wrappers().length, 0, 'the card is removed after it slides away')
  assert.match(mounted.harness.text(), /sections\.changes/, 'the split is revealed in place')
})

test('Escape leaves an owned branch menu and a consumed host key alone', async (t) => {
  const mounted = await mountGit()
  t.after(() => mounted.harness.dispose())
  const wrappers = (): TestElement[] =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMotion'))
  const branchChip = (): TestElement => {
    const [chip] = mounted.harness.findAll(
      (element) => element.type === 'button' && hasClass(element, 'dshgg-branchChip'),
    )
    assert.ok(chip, 'no branch chip rendered')
    return chip
  }
  await openCommitDetails(mounted)
  mounted.harness.click(branchChip())
  await mounted.harness.flush()
  assert.equal(branchChip().props['aria-expanded'], true, 'the branch menu is open')

  const branchEscape = escapeKeydown()
  await mounted.harness.flush()
  assert.equal(branchEscape.prevented, false, 'the details card does not consume this Escape')
  assert.equal(branchChip().props['aria-expanded'], false, 'the branch menu closes instead')
  assert.equal(wrappers().length, 1, 'the details card stays open')
  assert.equal(wrappers()[0]?.props['data-phase'], 'enter')

  const consumed = escapeKeydown(true)
  await mounted.harness.flush()
  assert.deepEqual(consumed, { prevented: false, stopped: false }, 'a handled Escape is ignored')
  assert.equal(wrappers()[0]?.props['data-phase'], 'enter', 'the card is still open')

  const detailsEscape = escapeKeydown()
  await mounted.harness.flush()
  assert.equal(detailsEscape.prevented, true)
  assert.equal(wrappers()[0]?.props['data-phase'], 'leave', 'a later Escape closes the card')
})

test('Escape without details leaves the panel alone', async (t) => {
  const mounted = await mountGit()
  t.after(() => mounted.harness.dispose())
  const escapeResult = escapeKeydown()
  await mounted.harness.flush()
  assert.deepEqual(escapeResult, { prevented: false, stopped: false })
  assert.equal(
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMotion')).length,
    0,
    'no details view is opened',
  )
})

test('View Details stays available while an operation runs', async () => {
  let release = (): void => {}
  const until = new Promise<void>((resolve) => {
    release = resolve
  })
  const mounted = await mountGit({ pending: { op: 'stage', until } })
  const row = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.contextmenu(row[row.length - 1], { clientX: 1, clientY: 2 })
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'stage')
  await mounted.harness.flush()
  const graphRow = graphRows(mounted.harness)[0]
  assert.ok(graphRow)
  mounted.harness.contextmenu(graphRow, { clientX: 1, clientY: 2 })
  const target = lastTarget(mounted.menu)
  assert.equal(target.value.busy, true)
  const actions = menuActions(mounted.components, target)
  assert.equal(actions[0]?.id, menuActionId('view-details'))
  assert.notEqual(actions[0]?.disabled, true)
  assert.equal(
    actions.find((action) => action.id === menuActionId('checkout-detached'))?.disabled,
    true,
  )
  await runMenuAction(mounted.components, target, 'view-details')
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /commitDetails\.files/)
  release()
  await mounted.harness.flush()
  await mounted.harness.dispose()
})

test('a stale View Details reports the target instead of opening', async () => {
  const mounted = await mountGit()
  const graphRow = graphRows(mounted.harness)[0]
  assert.ok(graphRow)
  mounted.harness.contextmenu(graphRow, { clientX: 1, clientY: 2 })
  const target = lastTarget(mounted.menu)
  const stale = { ...target, value: { ...target.value, oid: 'c'.repeat(40) } }
  await runMenuAction(mounted.components, stale, 'view-details')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'commit-details').length, 0)
  assert.doesNotMatch(mounted.harness.text(), /commitDetails\.files/)
  assert.deepEqual(mounted.components.notifications.pop(), { text: 'menu.stale', success: false })
  await mounted.harness.dispose()
})

test('clicking a commit expands its files inline and a file opens the commit diff', async () => {
  const mounted = await mountGit()
  const graphRow = graphRows(mounted.harness)[0]
  assert.ok(graphRow, 'no graph row rendered')
  assert.equal(graphRow.props['aria-expanded'], false)
  mounted.harness.click(graphRow)
  await mounted.harness.flush()

  assert.equal(mounted.calls.find((call) => call.op === 'commit-details')?.oid, 'a'.repeat(40))
  const text = mounted.harness.text()
  assert.doesNotMatch(text, /commitDetails\.files/, 'the details view does not open')
  assert.ok(
    mounted.harness.findAll((element) => element.props.role === 'separator').length > 0,
    'the split stays in place',
  )
  assert.equal(mounted.harness.findAll((element) => element.type === 'textarea').length, 1)
  assert.equal(graphRows(mounted.harness)[0]?.props['aria-expanded'], true)
  const rows = changeRows(mounted.harness)
  assert.deepEqual(
    rows.map((row) => row.props.title),
    ['docs/gone.md', 'src/added.js', 'src/app.js', 'src/old.js → src/renamed.js'],
    'the changed files follow the commit row in path order',
  )
  const app = rows[2]
  assert.ok(app)
  assert.match(elementText(app), /app\.js/)
  assert.match(elementText(app), /src/)
  assert.match(elementText(app), /M/)
  assert.equal(
    collectElements(app, (element) =>
      String(element.props?.className ?? '').includes('dshgg-graphChangeIcon'),
    ).length,
    1,
    'every file row carries its file icon',
  )
  const statuses = collectElements(app, (element) =>
    String(element.props?.className ?? '').includes('dshgg-graphChangeStatus'),
  )
  assert.equal(statuses[0]?.props['data-status'], 'M')

  // Rows render in document order: the first commit, its files, then the next commit.
  const order = mounted.harness
    .findAll((element) => {
      const name = String(element.props?.className ?? '')
      return name
        .split(' ')
        .some((token) => ['dshgg-graphRow', 'dshgg-graphChange'].includes(token))
    })
    .map((element) =>
      String(element.props.className).includes('dshgg-graphRow') ? 'commit' : 'file',
    )
  assert.deepEqual(order, ['commit', 'file', 'file', 'file', 'file', 'commit'])

  mounted.harness.click(app)
  const opened = mounted.openedTabs.at(-1)
  assert.ok(opened)
  assert.equal(opened.kind, 'git-diff')
  assert.equal(opened.options.params.path, 'src/app.js')
  assert.equal(opened.options.params.commit, 'a'.repeat(40))
  assert.equal(opened.options.params.shortOid, 'aaaaaaa')
  assert.equal(opened.options.params.status, 'M')

  const renamed = changeRows(mounted.harness)[3]
  assert.ok(renamed)
  mounted.harness.keydown(renamed, { key: 'Enter' })
  assert.equal(mounted.openedTabs.at(-1)?.options.params.origPath, 'src/old.js')

  mounted.harness.click(graphRows(mounted.harness)[0])
  await mounted.harness.flush()
  assert.equal(changeRows(mounted.harness).length, 0, 'activating again collapses the list')
  assert.equal(graphRows(mounted.harness)[0]?.props['aria-expanded'], false)
  assert.equal(
    mounted.calls.filter((call) => call.op === 'commit-details').length,
    1,
    'collapsing reads nothing',
  )
  await mounted.harness.dispose()
})

test('the expanded file rows draw the host file-type icon for their path', async () => {
  const requested: Array<{ path: string; size: number }> = []
  const mounted = await mountGit({
    hostModules: {
      '@deepseek-ai/dsh-client-ui-primitives': {
        FileTypeIcon: (props: { path: string; size: number }) => {
          requested.push({ path: props.path, size: props.size })
          return { type: 'svg', props: { 'data-file-type': props.path }, children: [] }
        },
      },
    },
  })
  mounted.harness.click(graphRows(mounted.harness)[0])
  await mounted.harness.flush()
  const icons = collectElements(
    changeRows(mounted.harness),
    (element) => element.props['data-file-type'] !== undefined,
  )
  assert.deepEqual(
    icons.map((element) => element.props['data-file-type']),
    ['docs/gone.md', 'src/added.js', 'src/app.js', 'src/renamed.js'],
    'each expanded row passes the changed file path to the host icon',
  )
  assert.ok(
    requested.length >= icons.length && requested.every((props) => props.size === 16),
    'the host icon keeps the row 16-pixel slot',
  )
  await mounted.harness.dispose()
})

test('the file rows keep the plain icon without a usable host icon', async () => {
  const plain = (mounted: MountedGit): TestElement[] =>
    collectElements(changeRows(mounted.harness), (element) =>
      String(element.props?.className ?? '').includes('dshgg-graphChangeIcon'),
    ).flatMap((icon) =>
      collectElements(
        icon,
        (element) => element.type === 'svg' && element.props.viewBox === '0 0 16 16',
      ),
    )
  const cases: Array<Record<string, unknown> | undefined> = [
    undefined,
    { '@deepseek-ai/dsh-client-ui-primitives': { FileTypeIcon: 'nope' } },
  ]
  for (const hostModules of cases) {
    const mounted = hostModules === undefined ? await mountGit() : await mountGit({ hostModules })
    mounted.harness.click(graphRows(mounted.harness)[0])
    await mounted.harness.flush()
    assert.equal(changeRows(mounted.harness).length, 4)
    assert.equal(plain(mounted).length, 4, 'every row falls back to the document icon')
    assert.equal(
      mounted.harness.findAll((element) => element.props['data-file-type'] !== undefined).length,
      0,
      'no host icon is drawn',
    )
    await mounted.harness.dispose()
  }
})

test('the line layer runs the expanded commit lanes through its file rows', async () => {
  const mounted = await mountGit()
  const layer = (): TestElement => {
    const [element] = mounted.harness.findAll(
      (candidate) => candidate.props?.className === 'dshgg-graphLayer',
    )
    assert.ok(element, 'no line layer rendered')
    return element
  }
  assert.equal(layer().props.height, 44)
  mounted.harness.click(graphRows(mounted.harness)[0])
  await mounted.harness.flush()
  assert.equal(layer().props.height, 44 + 4 * 22, 'every file row adds one row height')
  const wide = collectElements(layer(), (element) => element.props?.['data-width'] === '3')
  assert.equal(wide.length, 1, 'the node lane is wide in its own row and through the file rows')
  assert.match(String(wide[0]?.props.d), /^M 11 11 V 22 M 11 22 V 44 M 11 44 V 66/)
  const lanes = collectElements(changeRows(mounted.harness)[0] as TestElement, (element) =>
    String(element.props?.className ?? '').includes('dshgg-graphChangeLanes'),
  )
  assert.equal(lanes[0]?.props.style?.width, '22px', 'one lane leaves the commit')
  await mounted.harness.dispose()
})

test('several commits stay expanded and the keyboard toggles a row', async () => {
  const mounted = await mountGit()
  const [first] = graphRows(mounted.harness)
  assert.ok(first)
  mounted.harness.keydown(first, { key: 'Enter' })
  await mounted.harness.flush()
  assert.equal(changeRows(mounted.harness).length, 4)
  const second = graphRows(mounted.harness)[1]
  assert.ok(second)
  mounted.harness.keydown(second, { key: ' ' })
  await mounted.harness.flush()
  assert.equal(changeRows(mounted.harness).length, 8, 'both commits list their files')
  assert.deepEqual(
    mounted.calls.filter((call) => call.op === 'commit-details').map((call) => call.oid),
    ['a'.repeat(40), 'b'.repeat(40)],
  )
  mounted.harness.keydown(graphRows(mounted.harness)[0] as TestElement, { key: 'Enter' })
  await mounted.harness.flush()
  assert.equal(changeRows(mounted.harness).length, 4, 'only the toggled commit collapses')
  assert.doesNotMatch(mounted.harness.text(), /commitDetails\.files/)
  await mounted.harness.dispose()
})

test('a commit without file changes says so in its expanded row and its details', async () => {
  const commitDetails = {
    commit: COMMIT_DETAILS.commit,
    files: [],
    truncated: false,
  }
  const mounted = await mountGit({ commitDetails })
  mounted.harness.click(graphRows(mounted.harness)[0] as TestElement)
  await mounted.harness.flush()
  const rows = changeRows(mounted.harness)
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.props['data-note'], 'empty')
  assert.match(elementText(rows[0] as TestElement), /commitDetails\.empty/)

  await openCommitDetails(mounted)
  assert.match(elementText(commitCard(mounted.harness)), /commitDetails\.empty/)
  assert.equal(
    collectElements(commitCard(mounted.harness), (element) => hasClass(element, 'dshgg-fileRow'))
      .length,
    0,
  )
  await mounted.harness.dispose()
})

test('a capped commit list ends with a note row', async () => {
  const mounted = await mountGit({ commitDetails: { ...COMMIT_DETAILS, truncated: true } })
  mounted.harness.click(graphRows(mounted.harness)[0] as TestElement)
  await mounted.harness.flush()
  const rows = changeRows(mounted.harness)
  assert.equal(rows.length, 5)
  assert.equal(rows.at(-1)?.props['data-note'], 'truncated')
  await mounted.harness.dispose()
})

test('a failed expanded read reports the failure and retries in place', async () => {
  const mounted = await mountGit({ failOp: 'commit-details' })
  mounted.harness.click(graphRows(mounted.harness)[0] as TestElement)
  await mounted.harness.flush()
  const rows = changeRows(mounted.harness)
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.props['data-note'], 'failure')
  assert.match(elementText(rows[0] as TestElement), /git said no/)
  mounted.harness.click(buttonByText(mounted.harness, 'retry'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'commit-details').length, 2)
  assert.doesNotMatch(mounted.harness.text(), /commitDetails\.files/)
  await mounted.harness.dispose()
})

test('a failed commit read reports the failure and retries', async () => {
  const mounted = await mountGit({ failOp: 'commit-details' })
  await openCommitDetails(mounted)
  assert.match(mounted.harness.text(), /error\.title/)
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
  const before = mounted.calls.filter((call) => call.op === 'commit-details').length
  mounted.harness.click(buttonByText(mounted.harness, 'retry'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'commit-details').length, before + 1)
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await finishMotion(mounted.harness)
  assert.match(mounted.harness.text(), /sections\.changes/)
  await mounted.harness.dispose()
})

test('returning from details keeps the expanded commits', async () => {
  const mounted = await mountGit()
  mounted.harness.click(graphRows(mounted.harness)[0] as TestElement)
  await mounted.harness.flush()
  assert.equal(changeRows(mounted.harness).length, 4)
  await openCommitDetails(mounted, 1)
  assert.equal(mounted.calls.at(-1)?.oid, 'b'.repeat(40))
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await finishMotion(mounted.harness)
  assert.equal(changeRows(mounted.harness).length, 4)
  assert.equal(graphRows(mounted.harness)[0]?.props['aria-expanded'], true)
  await mounted.harness.dispose()
})

test('past-commit files offer copy-only context menus', async () => {
  const mounted = await mountGit()
  await openCommitDetails(mounted)
  const fileRows = collectElements(
    commitCard(mounted.harness),
    (element) => hasClass(element, 'dshgg-fileRow') && element.props?.title === 'src/app.js',
  )
  assert.equal(fileRows.length, 1)
  mounted.harness.contextmenu(fileRows[0], { clientX: 7, clientY: 8 })
  const open = mounted.menu.opens.at(-1)
  assert.ok(open, 'no past-commit menu target was bound')
  const target = open.target
  assert.equal(target.value.kind, 'commitFile')
  assert.equal(target.value.path, 'src/app.js')
  assert.equal(target.value.cwd, '/repo')
  assert.deepEqual(
    menuActions(mounted.components, target).map((action) => action.id),
    [menuActionId('copy-relative'), menuActionId('copy-path')],
  )
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await finishMotion(mounted.harness)

  mounted.harness.click(graphRows(mounted.harness)[0] as TestElement)
  await mounted.harness.flush()
  const inline = changeRows(mounted.harness).find((row) => row.props.title === 'src/app.js')
  assert.ok(inline)
  assert.equal(inline.props['aria-haspopup'], 'menu')
  const before = mounted.calls.length
  mounted.harness.contextmenu(inline, { clientX: 3, clientY: 4 })
  const inlineTarget = lastTarget(mounted.menu)
  assert.equal(inlineTarget.value.kind, 'commitFile')
  assert.equal(inlineTarget.value.path, 'src/app.js')
  assert.equal(inlineTarget.value.cwd, '/repo')
  assert.deepEqual(
    menuActions(mounted.components, inlineTarget).map((action) => action.id),
    [menuActionId('copy-relative'), menuActionId('copy-path')],
  )
  assert.equal(mounted.calls.length, before, 'opening the menu calls nothing')
  await mounted.harness.dispose()
})

test('a missing repository renders the explanation instead of actions', async () => {
  const mounted = await mountGit({
    status: createStatus({ repo: null, cwd: '/tmp/plain', files: [] }),
  })
  const text = mounted.harness.text()
  assert.match(text, /noRepo\.title/)
  assert.match(text, /noRepo\.desc/)
  assert.equal(mounted.harness.findAll((element) => element.type === 'textarea').length, 0)
  await mounted.harness.dispose()
})

test('a Host failure surfaces a retryable state', async () => {
  const mounted = await mountGit({ failOp: 'status' })
  const text = mounted.harness.text()
  assert.match(text, /error\.title/)
  assert.match(text, /git said no/)
  assert.ok(buttonByText(mounted.harness, 'retry'))
  await mounted.harness.dispose()
})

test('the diff tab renders unified diff hunks from the Host', async () => {
  const diffPayload = {
    path: 'src/app.js',
    staged: false,
    untracked: false,
    binary: false,
    truncated: false,
    additions: 1,
    deletions: 1,
    hunks: [
      {
        header: '@@ -1,2 +1,2 @@',
        oldStart: 1,
        oldCount: 2,
        newStart: 1,
        newCount: 2,
        lines: [
          { t: ' ', text: 'one' },
          { t: '-', text: 'two' },
          { t: '+', text: 'TWO' },
        ],
      },
    ],
  }
  const calls: RpcRequestRecord[] = []
  const harness = createHarness({
    fetch: async (_url: string, init: { body: string }): Promise<FetchResponseLike> => {
      const request = JSON.parse(init.body) as RpcRequestRecord
      calls.push(request)
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, value: request.op === 'diff' ? diffPayload : STATUS }),
      }
    },
    component: null,
    props: {},
  })
  const components = loadComponents(harness)
  const params = { path: 'src/app.js', staged: false, untracked: false, status: 'M' }
  const tab = {
    id: 'tab-2',
    title: 'Diff',
    visible: true,
    signal: new AbortController().signal,
    actions: {
      openTab: () => {},
      openResource: () => {},
      close: () => {},
      bindCommands: () => () => {},
    },
    navigation: { address: 'sidebar://git-diff', params, revision: 1 },
  }
  harness.setComponent(components.diff, {
    sessionId: 'session-1',
    t: translate,
    useTabInfo: () => ({
      sidebar: { expanded: true },
      panel: { id: 'pane-1', isFloating: false },
      tab,
    }),
  })
  await harness.render()
  const text = harness.text()
  assert.match(text, /app\.js/)
  assert.match(text, /diff\.unstaged/)
  assert.match(text, /@@ -1,2 \+1,2 @@/)
  assert.match(text, /TWO/)
  assert.ok(calls.some((call) => call.op === 'diff' && call.path === 'src/app.js'))
  await harness.dispose()
})

test('the diff tab is scoped to a commit and labels it', async () => {
  const commit = 'a'.repeat(40)
  const diffPayload = {
    path: 'src/app.js',
    commit,
    binary: false,
    truncated: false,
    additions: 1,
    deletions: 0,
    hunks: [
      {
        header: '@@ -1,1 +1,2 @@',
        oldStart: 1,
        oldCount: 1,
        newStart: 1,
        newCount: 2,
        lines: [
          { t: ' ', text: 'one' },
          { t: '+', text: 'TWO' },
        ],
      },
    ],
  }
  const calls: RpcRequestRecord[] = []
  const harness = createHarness({
    fetch: async (_url: string, init: { body: string }): Promise<FetchResponseLike> => {
      const request = JSON.parse(init.body) as RpcRequestRecord
      calls.push(request)
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, value: request.op === 'diff' ? diffPayload : STATUS }),
      }
    },
    component: null,
    props: {},
  })
  const components = loadComponents(harness)
  const tab = {
    id: 'tab-3',
    title: 'Diff',
    visible: true,
    signal: new AbortController().signal,
    actions: {
      openTab: () => {},
      openResource: () => {},
      close: () => {},
      bindCommands: () => () => {},
    },
    navigation: {
      params: { path: 'src/app.js', commit, shortOid: 'aaaaaaa', status: 'M', cwd: '/repo' },
      revision: 1,
    },
  }
  harness.setComponent(components.diff, {
    sessionId: 'session-1',
    t: translate,
    useTabInfo: () => ({
      sidebar: { expanded: true },
      panel: { id: 'pane-1', isFloating: false },
      tab,
    }),
  })
  await harness.render()
  const text = harness.text()
  assert.match(text, /diff\.commit/)
  assert.match(text, /TWO/)
  assert.equal(
    harness.findAll((element) => element.props?.['data-kind'] === 'commit').length,
    1,
    'the badge identifies the commit scope',
  )
  const diffCall = calls.find((call) => call.op === 'diff')
  assert.equal(diffCall?.commit, commit)
  assert.equal(diffCall?.path, 'src/app.js')
  assert.notEqual(diffCall?.staged, true)
  await harness.dispose()
})

test('a pure rename diff explains the rename instead of showing an empty diff', async () => {
  const diffPayload = {
    path: 'src/renamed.js',
    commit: 'a'.repeat(40),
    binary: false,
    truncated: false,
    additions: 0,
    deletions: 0,
    renameFrom: 'src/old.js',
    renameTo: 'src/renamed.js',
    hunks: [],
  }
  const harness = createHarness({
    fetch: async () => {
      return { ok: true, status: 200, json: async () => ({ ok: true, value: diffPayload }) }
    },
    component: null,
    props: {},
  })
  const components = loadComponents(harness)
  const tab = {
    id: 'tab-4',
    title: 'Diff',
    visible: true,
    signal: new AbortController().signal,
    actions: {
      openTab: () => {},
      openResource: () => {},
      close: () => {},
      bindCommands: () => () => {},
    },
    navigation: {
      params: {
        path: 'src/renamed.js',
        commit: 'a'.repeat(40),
        shortOid: 'aaaaaaa',
        origPath: 'src/old.js',
        status: 'R',
      },
      revision: 1,
    },
  }
  harness.setComponent(components.diff, {
    sessionId: 'session-1',
    t: translate,
    useTabInfo: () => ({
      sidebar: { expanded: true },
      panel: { id: 'pane-1', isFloating: false },
      tab,
    }),
  })
  await harness.render()
  const text = harness.text()
  assert.match(text, /diff\.renamed/)
  assert.match(text, /diff\.from/, 'the header still names the original path')
  await harness.dispose()
})

/** Contribution id of the bundle's context-menu provider. */
const MENU_ID = 'git-graph.actions'

/** A resolved action id as the shared registry publishes it. */
const menuActionId = (id: string): string => `${MENU_ID}/${id}`

/** Resolve the actions the shared overlay would show for a captured trigger target.
 *
 * The stand-in mirrors the shipped registry, which calls a contribution with the
 * captured target's value rather than the `{ kind, value }` wrapper the trigger
 * received. Calling the contribution directly with the wrapper would hide the
 * contract mismatch that opened empty menus in the real page.
 */
function menuActions(components: LoadedComponents, target: CapturedTarget): TestMenuActionView[] {
  assert.equal(components.contributions.length, 1, 'no context-menu contribution was registered')
  return components.contextMenus.resolve(target).source.getSnapshot()
}

/** Read the most recently bound target, failing when no menu opened. */
function lastTarget(menu: MenuMock): CapturedTarget {
  const open = menu.opens.at(-1)
  assert.ok(open, 'no context-menu target was bound')
  return open.target
}

/** Resolve and run one root or nested action from a captured menu target. */
async function runMenuAction(
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

test('right-clicking a change binds its target without calling the Host', async () => {
  const mounted = await mountGit()
  const before = mounted.calls.length
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.contextmenu(rows[rows.length - 1], { clientX: 40, clientY: 60 })
  assert.equal(mounted.menu.opens.length, 1)
  const open = mounted.menu.opens[0]
  assert.ok(open, 'no context-menu target was bound')
  assert.deepEqual(open.point, { x: 40, y: 60 })
  const target = open.target
  assert.equal(target.kind, 'gitGraphItem')
  assert.equal(target.value.sessionId, 'session-1')
  assert.equal(target.value.kind, 'file')
  assert.equal(target.value.section, 'changes')
  assert.equal(target.value.path, 'src/app.js')
  assert.equal(target.value.cwd, '/repo')
  assert.equal(mounted.calls.length, before, 'opening a menu must not call the Host')
  assert.deepEqual(
    menuActions(mounted.components, target).map((action) => action.id),
    [
      menuActionId('open'),
      menuActionId('stage'),
      menuActionId('discard'),
      menuActionId('ignore'),
      menuActionId('copy-relative'),
      menuActionId('copy-path'),
    ],
  )
  await mounted.harness.dispose()
})

test('every listed object resolves at least one menu command', async () => {
  const mounted = await mountGit()
  const byClass = (name: string): TestElement[] =>
    mounted.harness.findAll((element) => String(element.props?.className ?? '').includes(name))
  const changedFile = mounted.harness
    .findAll(
      (element) =>
        String(element.props?.className ?? '').includes('dshgg-fileRow') &&
        element.props?.title === 'src/app.js',
    )
    .at(-1)
  assert.ok(changedFile, 'no changed file rendered')
  const group = mounted.harness.findAll(
    (element) => element.props?.['data-section'] === 'changes',
  )[0]
  assert.ok(group, 'no change group rendered')
  const commitRow = byClass('dshgg-graphRow')[0]
  assert.ok(commitRow, 'no commit row rendered')
  const surfaces: Array<[label: string, element: TestElement]> = [
    ['changed file', changedFile],
    ['change group header', elementOf(group.children[0])],
    ['commit', commitRow],
  ]
  for (const [label, element] of surfaces) {
    const before = mounted.menu.opens.length
    mounted.harness.contextmenu(element, { clientX: 5, clientY: 6 })
    assert.equal(mounted.menu.opens.length, before + 1, `${label} did not bind a menu target`)
    const ids = menuActions(mounted.components, lastTarget(mounted.menu)).map((action) => action.id)
    assert.ok(ids.length > 0, `${label} resolved an empty menu`)
  }
  await mounted.harness.dispose()
})

test('a menu command stages through the panel like the inline control', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.contextmenu(rows[rows.length - 1])
  const target = lastTarget(mounted.menu)
  await runMenuAction(mounted.components, target, 'stage')
  await mounted.harness.flush()
  const stageCall = mounted.calls.find((call) => call.op === 'stage')
  assert.deepEqual(stageCall?.paths, ['src/app.js'])
  assert.ok(
    mounted.calls.filter((call) => call.op === 'status').length >= 2,
    'the panel refreshes after a menu command',
  )
  await mounted.harness.dispose()
})

test('a changed-file menu ignores its path through the shared action refresh', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.contextmenu(rows[rows.length - 1])
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'ignore')
  await mounted.harness.flush()
  const ignore = mounted.calls.find((call) => call.op === 'ignore')
  assert.equal(ignore?.path, 'src/app.js')
  assert.ok(mounted.calls.filter((call) => call.op === 'status').length >= 2)
  assert.deepEqual(mounted.components.notifications.pop(), {
    text: 'menu.ignoredTracked',
    success: true,
  })
  assert.equal(
    mounted.harness.text().includes('menu.ignored'),
    false,
    'no inline notice is rendered',
  )
  const untracked = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'README.md',
  )[0]
  assert.ok(untracked)
  mounted.harness.contextmenu(untracked)
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'ignore')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'ignore').at(-1)?.path, 'README.md')
  assert.deepEqual(mounted.components.notifications.pop(), {
    text: 'menu.ignored',
    success: true,
  })
  await mounted.harness.dispose()
})

test('a failed ignore refreshes no success Toast and reports its error', async () => {
  const mounted = await mountGit({ failOp: 'ignore' })
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.contextmenu(rows[rows.length - 1])
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'ignore')
  await mounted.harness.flush()
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
  assert.equal(
    mounted.components.notifications.some((notification) => notification.success),
    false,
    'a failed ignore emits no success Toast',
  )
  await mounted.harness.dispose()
})

test('an ignored path is notified again when the same message repeats', async () => {
  const mounted = await mountGit()
  const target = {
    kind: 'gitGraphItem',
    value: {
      sessionId: 'session-1',
      kind: 'file',
      section: 'changes',
      path: 'src/app.js',
      cwd: '/repo',
    },
  }
  await runMenuAction(mounted.components, target, 'ignore')
  await mounted.harness.flush()
  await runMenuAction(mounted.components, target, 'ignore')
  await mounted.harness.flush()
  assert.deepEqual(mounted.components.notifications, [
    { text: 'menu.ignoredTracked', success: true },
    { text: 'menu.ignoredTracked', success: true },
  ])
  await mounted.harness.dispose()
})

test('commit submenus run checkout, creation and confirmed deletion', async () => {
  const head = HISTORY.commits[0]
  assert.ok(head)
  const history: HistoryResult = {
    ...HISTORY,
    commits: [
      {
        ...head,
        refs: 'HEAD -> refs/heads/main, refs/heads/feature/graph, refs/remotes/origin/main, tag: refs/tags/v1',
      },
      ...HISTORY.commits.slice(1),
    ],
  }
  const mounted = await mountGit({ history })
  let focusRestores = 0
  const invoker: TestEventTarget = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 80, height: 22, bottom: 22 }),
    isConnected: true,
    focus: () => {
      focusRestores += 1
    },
  }
  const openMenu = async (): Promise<CapturedTarget> => {
    const row = mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-graphRow'),
    )[0]
    assert.ok(row, 'no graph row rendered')
    mounted.harness.contextmenu(row, { clientX: 1, clientY: 2, currentTarget: invoker })
    await mounted.harness.flush()
    return lastTarget(mounted.menu)
  }
  const target = await openMenu()
  assert.deepEqual(target.value.branchHeads, [
    { name: 'feature/graph', current: false },
    { name: 'main', current: true },
  ])
  await runMenuAction(mounted.components, target, 'checkout', 'feature/graph')
  await mounted.harness.flush()
  assert.equal(mounted.calls.find((call) => call.op === 'checkout')?.branch, 'feature/graph')

  await runMenuAction(mounted.components, await openMenu(), 'checkout-detached')
  await mounted.harness.flush()
  assert.equal(mounted.calls.find((call) => call.op === 'checkout-detached')?.oid, 'a'.repeat(40))
  assert.deepEqual(mounted.components.notifications.pop(), {
    text: 'menu.detached',
    success: true,
  })

  await runMenuAction(mounted.components, await openMenu(), 'create-branch')
  await mounted.harness.flush()
  let nameInput = mounted.harness.findAll(
    (element) => element.type === 'input' && element.props['aria-label'] === 'menu.referenceName',
  )[0]
  assert.ok(nameInput)
  assert.equal(buttonContaining(mounted.harness, 'menu.createBranch').props.disabled, true)
  mounted.harness.change(nameInput, 'feature/from-menu')
  await mounted.harness.flush()
  mounted.harness.click(buttonContaining(mounted.harness, 'menu.createBranch'))
  await mounted.harness.flush()
  const branch = mounted.calls.find((call) => call.op === 'create-branch')
  assert.equal(branch?.oid, 'a'.repeat(40))
  assert.equal(branch?.name, 'feature/from-menu')
  assert.deepEqual(mounted.components.notifications.pop(), {
    text: 'menu.branchCreated',
    success: true,
  })
  await finishMotion(mounted.harness)
  assert.equal(mounted.harness.text().includes('menu.createBranchAt'), false)

  await runMenuAction(mounted.components, await openMenu(), 'create-tag')
  await mounted.harness.flush()
  nameInput = mounted.harness.findAll(
    (element) => element.type === 'input' && element.props['aria-label'] === 'menu.referenceName',
  )[0]
  const messageInput = mounted.harness.findAll(
    (element) => element.type === 'textarea' && element.props['aria-label'] === 'menu.tagMessage',
  )[0]
  assert.ok(nameInput)
  assert.ok(messageInput)
  mounted.harness.change(nameInput, 'v2.0')
  mounted.harness.change(messageInput, 'release\n\nnotes')
  await mounted.harness.flush()
  mounted.harness.click(buttonContaining(mounted.harness, 'menu.createTag'))
  await mounted.harness.flush()
  const tag = mounted.calls.find((call) => call.op === 'create-tag')
  assert.equal(tag?.oid, 'a'.repeat(40))
  assert.equal(tag?.name, 'v2.0')
  assert.equal(tag?.message, 'release\n\nnotes')
  assert.deepEqual(mounted.components.notifications.pop(), {
    text: 'menu.tagCreated',
    success: true,
  })
  assert.equal(focusRestores, 2, 'successful creation restores its triggering row')

  await runMenuAction(mounted.components, await openMenu(), 'delete-branch', 'feature/graph')
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /menu\.deleteBranchConfirm/)
  assert.equal(
    mounted.calls.some((call) => call.op === 'delete-branch'),
    false,
  )
  const cancel = buttonByText(mounted.harness, 'action.cancel')
  assert.equal(cancel.props.autoFocus, true)
  const dialog = mounted.harness.findAll((element) => element.props.role === 'alertdialog')[0]
  assert.ok(dialog)
  const describedBy = dialog.props['aria-describedby']
  assert.equal(typeof describedBy, 'string')
  assert.equal(mounted.harness.findAll((element) => element.props.id === describedBy).length, 1)
  const focusBeforeEscape = focusRestores
  mounted.harness.keydown(dialog, { key: 'Escape' })
  await finishMotion(mounted.harness)
  assert.equal(mounted.harness.text().includes('menu.deleteBranchConfirm'), false)
  assert.equal(focusRestores, focusBeforeEscape + 1)
  assert.equal(
    mounted.calls.some((call) => call.op === 'delete-branch'),
    false,
  )

  await runMenuAction(mounted.components, await openMenu(), 'delete-branch', 'feature/graph')
  await mounted.harness.flush()
  const focusBeforeCancel = focusRestores
  mounted.harness.click(buttonByText(mounted.harness, 'action.cancel'))
  await finishMotion(mounted.harness)
  assert.equal(focusRestores, focusBeforeCancel + 1)
  await runMenuAction(mounted.components, await openMenu(), 'delete-branch', 'feature/graph')
  await mounted.harness.flush()
  mounted.harness.click(buttonContaining(mounted.harness, 'menu.deleteBranch'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.find((call) => call.op === 'delete-branch')?.branch, 'feature/graph')
  assert.deepEqual(mounted.components.notifications.pop(), {
    text: 'menu.branchDeleted',
    success: true,
  })
  assert.ok(mounted.calls.filter((call) => call.op === 'history').length >= 6)
  await mounted.harness.dispose()
})

test('a failed tag creation keeps the dialog text and reports the failure', async () => {
  const mounted = await mountGit({ failOp: 'create-tag' })
  const row = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )[0]
  assert.ok(row)
  mounted.harness.contextmenu(row)
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'create-tag')
  await mounted.harness.flush()
  const name = mounted.harness.findAll(
    (element) => element.type === 'input' && element.props['aria-label'] === 'menu.referenceName',
  )[0]
  const message = mounted.harness.findAll(
    (element) => element.type === 'textarea' && element.props['aria-label'] === 'menu.tagMessage',
  )[0]
  assert.ok(name)
  assert.ok(message)
  mounted.harness.change(name, 'existing-tag')
  mounted.harness.change(message, 'keep this text')
  await mounted.harness.flush()
  mounted.harness.keydown(message, { key: 'Enter' })
  await mounted.harness.flush()
  assert.equal(
    mounted.calls.some((call) => call.op === 'create-tag'),
    false,
  )
  mounted.harness.change(message, 'keep this text\non two lines')
  await mounted.harness.flush()
  const currentMessage = mounted.harness.findAll(
    (element) => element.type === 'textarea' && element.props['aria-label'] === 'menu.tagMessage',
  )[0]
  assert.ok(currentMessage)
  mounted.harness.keydown(currentMessage, { key: 'Enter', ctrlKey: true })
  await mounted.harness.flush()
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
  assert.equal(
    mounted.harness.findAll(
      (element) => element.type === 'input' && element.props['aria-label'] === 'menu.referenceName',
    )[0]?.props.value,
    'existing-tag',
  )
  assert.equal(
    mounted.harness.findAll(
      (element) => element.type === 'textarea' && element.props['aria-label'] === 'menu.tagMessage',
    )[0]?.props.value,
    'keep this text\non two lines',
  )
  assert.match(mounted.harness.text(), /menu\.createTagAt/)
  const { dialog } = floatingPanel(mounted.harness)
  assert.notEqual(dialog.props['aria-busy'], true)
  assert.equal(mounted.calls.filter((call) => call.op === 'create-tag').length, 1)
  assert.equal(
    mounted.components.notifications.some((notification) => notification.success),
    false,
    'a failed reference creation emits no success Toast',
  )
  await mounted.harness.dispose()
})

test('a menu discard keeps the panel confirmation before calling the Host', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.contextmenu(rows[rows.length - 1])
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'discard')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'discard').length, 0)
  assert.match(mounted.harness.text(), /confirm\.discardTitle/)
  mounted.harness.click(buttonByText(mounted.harness, 'confirm.discard'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.find((call) => call.op === 'discard')?.path, 'src/app.js')
  await mounted.harness.dispose()
})

test('a group header menu stages every change in the group', async () => {
  const mounted = await mountGit()
  const section = mounted.harness.findAll(
    (element) => element.props?.['data-section'] === 'changes',
  )[0]
  assert.ok(section, 'no changes group rendered')
  mounted.harness.contextmenu(elementOf(section.children[0]))
  const target = lastTarget(mounted.menu)
  assert.equal(target.value.kind, 'section')
  assert.equal(target.value.section, 'changes')
  assert.deepEqual(
    menuActions(mounted.components, target).map((action) => action.id),
    [menuActionId('stage-all'), menuActionId('discard-all'), menuActionId('refresh')],
  )
  await runMenuAction(mounted.components, target, 'stage-all')
  await mounted.harness.flush()
  const stageCall = mounted.calls.find((call) => call.op === 'stage')
  assert.ok(stageCall?.paths)
  assert.deepEqual([...stageCall.paths].sort(), ['README.md', 'src/app.js'])
  await mounted.harness.dispose()
})

test('the keyboard context-menu gesture binds the focused row', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.keydown(rows[rows.length - 1], { key: 'F10', shiftKey: true })
  assert.equal(mounted.menu.opens.length, 1)
  const open = mounted.menu.opens[0]
  assert.ok(open, 'the keyboard gesture bound no menu target')
  assert.equal(open.target.value.path, 'src/app.js')
  assert.equal(open.target.value.kind, 'file')
  // Enter still opens the diff instead of a menu.
  mounted.harness.keydown(rows[rows.length - 1], { key: 'Enter' })
  assert.equal(mounted.menu.opens.length, 1)
  assert.equal(mounted.openedTabs.length, 1)
  await mounted.harness.dispose()
})

test('a menu command for another session is ignored', async () => {
  const mounted = await mountGit()
  const target = {
    kind: 'gitGraphItem',
    value: {
      sessionId: 'other-session',
      kind: 'file',
      section: 'changes',
      path: 'src/app.js',
      cwd: '/repo',
    },
  }
  await runMenuAction(mounted.components, target, 'stage')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'stage').length, 0)
  await mounted.harness.dispose()
})

test('commit rows and the diff header bind their copy targets', async () => {
  const mounted = await mountGit()
  const graphRow = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )[0]
  assert.ok(graphRow, 'no graph row rendered')
  mounted.harness.contextmenu(graphRow, { clientX: 1, clientY: 2 })
  const commitTarget = lastTarget(mounted.menu)
  assert.equal(commitTarget.value.kind, 'commit')
  assert.equal(commitTarget.value.oid, 'a'.repeat(40))
  assert.equal(commitTarget.value.subject, 'Fix the sidebar')
  assert.deepEqual(commitTarget.value.branchHeads, [{ name: 'main', current: true }])
  assert.deepEqual(
    menuActions(mounted.components, commitTarget).map((action) => action.id),
    [
      menuActionId('view-details'),
      menuActionId('checkout'),
      menuActionId('checkout-detached'),
      menuActionId('create-branch'),
      menuActionId('create-tag'),
      menuActionId('copy-id'),
      menuActionId('copy-message'),
    ],
  )
  await mounted.harness.dispose()

  const harness = createHarness({
    fetch: async (_url, init) => {
      const request = JSON.parse(init.body)
      const value =
        request.op === 'diff'
          ? {
              path: 'src/app.js',
              staged: false,
              untracked: false,
              binary: false,
              truncated: false,
              additions: 0,
              deletions: 0,
              hunks: [],
            }
          : STATUS
      return { ok: true, status: 200, json: async () => ({ ok: true, value }) }
    },
    component: null,
    props: {},
  })
  const components = loadComponents(harness)
  const menu = createMenuMock()
  const tab = {
    id: 'tab-2',
    title: 'Diff',
    visible: true,
    signal: new AbortController().signal,
    actions: {
      openTab: () => {},
      openResource: () => {},
      close: () => {},
      bindCommands: () => () => {},
    },
    navigation: {
      address: 'sidebar://git-diff',
      params: { path: 'src/app.js', staged: false, untracked: false, status: 'M', cwd: '/repo' },
      revision: 1,
    },
  }
  harness.setComponent(components.diff, {
    sessionId: 'session-1',
    t: translate,
    useTabInfo: () => ({
      sidebar: { expanded: true },
      panel: { id: 'pane-1', isFloating: false },
      tab,
    }),
    useContextMenu: menu.useContextMenu,
  })
  await harness.render()
  const header = harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-diffHeader'),
  )[0]
  assert.ok(header, 'no diff header rendered')
  harness.contextmenu(header, { clientX: 3, clientY: 4 })
  const diffTarget = lastTarget(menu)
  assert.equal(diffTarget.value.kind, 'diff')
  assert.equal(diffTarget.value.path, 'src/app.js')
  assert.equal(diffTarget.value.cwd, '/repo')
  assert.deepEqual(
    menuActions(components, diffTarget).map((action) => action.id),
    [menuActionId('copy-relative'), menuActionId('copy-path')],
  )
  await harness.dispose()
})

test('without host context menus the inline controls keep working', async () => {
  const mounted = await mountGit({ menus: false })
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  const row = rows[rows.length - 1]
  assert.ok(row, 'the unstaged file row is missing')
  assert.equal(row.props.onContextMenu, undefined)
  mounted.harness.click(buttonInside(row, 'actions.stage'))
  await mounted.harness.flush()
  assert.deepEqual(mounted.calls.find((call) => call.op === 'stage')?.paths, ['src/app.js'])
  assert.deepEqual(mounted.components.notifications, [], 'staging has no new success feedback')
  await mounted.harness.dispose()
})

test('without the host notification service the pane still registers and commits', async () => {
  const mounted = await mountGit({ menuService: false })
  assert.equal(
    mounted.components.slots.length,
    4,
    'the Git pane is registered once without its service',
  )
  assert.equal(
    mounted.components.contributions.length,
    0,
    'no menu contribution without the service',
  )
  assert.equal(
    typeof slotNotify(mounted.components),
    'function',
    'the pane still gets a safe callback',
  )
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'fix: no toast service')
  await mounted.harness.flush()
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.find((call) => call.op === 'commit')?.message, 'fix: no toast service')
  assert.equal(messageBox()?.props.value, '', 'the commit still clears its message')
  assert.equal(mounted.calls.filter((call) => call.op === 'status').length >= 2, true)
  assert.deepEqual(mounted.components.notifications, [], 'a missing service stays silent')
  assert.doesNotMatch(mounted.harness.text(), /error\.title/)
  await mounted.harness.dispose()
})

test('a busy panel rejects a menu command without a second write', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const mounted = await mountGit({ pending: { op: 'stage', until: pending } })
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  const row = rows[rows.length - 1]
  assert.ok(row)
  mounted.harness.click(buttonInside(row, 'actions.stage'))
  mounted.harness.contextmenu(row)
  const target = lastTarget(mounted.menu)
  await runMenuAction(mounted.components, target, 'stage')
  assert.deepEqual(mounted.components.notifications, [{ text: 'menu.busy', success: false }])
  assert.equal(
    mounted.calls.filter((call) => call.op === 'stage').length,
    1,
    'the busy refusal never starts a second write',
  )
  release()
  await mounted.harness.flush()
  assert.deepEqual(mounted.components.notifications, [{ text: 'menu.busy', success: false }])
  await mounted.harness.dispose()
})

test('a failing host notification does not interrupt a commit', async () => {
  const mounted = await mountGit()
  mounted.components.contextMenus.notify = () => {
    throw new Error('toast offline')
  }
  const originalWarn = console.warn
  let warnings = 0
  console.warn = () => {
    warnings += 1
  }
  try {
    const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
    mounted.harness.change(messageBox(), 'fix: toast is down')
    await mounted.harness.flush()
    mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
    await mounted.harness.flush()
    assert.equal(mounted.calls.find((call) => call.op === 'commit')?.message, 'fix: toast is down')
    assert.equal(messageBox()?.props.value, '', 'the commit still clears its message')
    assert.equal(mounted.calls.filter((call) => call.op === 'status').length >= 2, true)
    assert.equal(mounted.calls.filter((call) => call.op === 'history').length >= 2, true)
    assert.doesNotMatch(mounted.harness.text(), /toast offline/)
    assert.doesNotMatch(mounted.harness.text(), /error\.title/)
  } finally {
    console.warn = originalWarn
  }
  assert.ok(warnings >= 1, 'the delivery failure is contained and logged')
  await mounted.harness.dispose()
})

test('disposing the plugin lifetime stops the pane from reaching the old service', async () => {
  const mounted = await mountGit()
  const notify = slotNotify(mounted.components)
  const before = mounted.components.notifications.length
  mounted.components.dispose()
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'fix: after unload')
  await mounted.harness.flush()
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.find((call) => call.op === 'commit')?.message, 'fix: after unload')
  assert.equal(messageBox()?.props.value, '', 'the commit still clears its message')
  notify('after unload', true)
  assert.equal(
    mounted.components.notifications.length,
    before,
    'the disposed binding never reaches the old service',
  )
  assert.doesNotMatch(mounted.harness.text(), /error\.title/)
  await mounted.harness.dispose()
})

test('menu copies absolute paths from the repository root, not the Session directory', async () => {
  const status = createStatus({
    repo: createRepo({ cwd: '/repo/apps/web', upstream: null, ahead: 0, behind: 0 }),
    files: [
      {
        kind: 'ordinary',
        x: '.',
        y: 'M',
        path: 'apps/web/src/app.js',
        conflict: false,
        untracked: false,
      },
    ],
  })
  const mounted = await mountGit({ status })
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'apps/web/src/app.js',
  )
  mounted.harness.contextmenu(rows[rows.length - 1])
  const target = lastTarget(mounted.menu)
  assert.equal(target.value.cwd, '/repo')
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const copied: string[] = []
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: async (text: string) => {
            copied.push(text)
          },
        },
      },
      configurable: true,
    })
    await runMenuAction(mounted.components, target, 'copy-path')
    assert.equal(copied.at(-1), '/repo/apps/web/src/app.js')
  } finally {
    if (previousNavigator === undefined) Reflect.deleteProperty(globalThis, 'navigator')
    else Object.defineProperty(globalThis, 'navigator', previousNavigator)
  }
  mounted.harness.click(rows[rows.length - 1])
  const firstOpen = mounted.openedTabs[0]
  assert.ok(firstOpen)
  assert.equal(firstOpen.options.params.cwd, '/repo')
  await mounted.harness.dispose()
})

test('a menu command for a vanished change reports it instead of doing nothing', async () => {
  const mounted = await mountGit()
  const target = {
    kind: 'gitGraphItem',
    value: {
      sessionId: 'session-1',
      kind: 'file',
      section: 'changes',
      path: 'gone.js',
      cwd: '/repo',
    },
  }
  await runMenuAction(mounted.components, target, 'stage')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'stage').length, 0)
  assert.deepEqual(mounted.components.notifications, [{ text: 'menu.stale', success: false }])
  assert.equal(mounted.harness.text().includes('menu.stale'), false, 'no inline notice is rendered')
  await mounted.harness.dispose()
})

test('a group discard uses the group confirmation wording', async () => {
  const status = createStatus({
    files: [
      { kind: 'ordinary', x: '.', y: 'M', path: 'only.js', conflict: false, untracked: false },
    ],
  })
  const mounted = await mountGit({ status })
  const section = mounted.harness.findAll(
    (element) => element.props?.['data-section'] === 'changes',
  )[0]
  assert.ok(section, 'the changes section did not render')
  mounted.harness.contextmenu(elementOf(section.children[0]))
  const target = lastTarget(mounted.menu)
  await runMenuAction(mounted.components, target, 'discard-all')
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /confirm\.discardAllTitle/)
  floatingPanel(mounted.harness)
  await mounted.harness.dispose()
})

test('commit rows are keyboard focus stops with menu semantics', async () => {
  const mounted = await mountGit()
  const graphRow = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )[0]
  assert.ok(graphRow, 'no graph row rendered')
  assert.equal(graphRow.props.tabIndex, 0)
  assert.equal(graphRow.props['aria-haspopup'], 'menu')
  mounted.harness.keydown(graphRow, { key: 'ContextMenu' })
  assert.equal(mounted.menu.opens.length, 1)
  const open = mounted.menu.opens[0]
  assert.ok(open, 'the keyboard gesture bound no menu target')
  assert.equal(open.target.value.kind, 'commit')
  await mounted.harness.dispose()
})

test('a menu command from another pane of the same Session is ignored', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.contextmenu(rows[rows.length - 1])
  const target = lastTarget(mounted.menu)
  assert.equal(typeof target.value.panelId, 'string')
  const foreign = { kind: 'gitGraphItem', value: { ...target.value, panelId: 'git-panel-other' } }
  await runMenuAction(mounted.components, foreign, 'stage')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'stage').length, 0)
  await runMenuAction(mounted.components, target, 'stage')
  await mounted.harness.flush()
  assert.deepEqual(mounted.calls.find((call) => call.op === 'stage')?.paths, ['src/app.js'])
  await mounted.harness.dispose()
})

/** Badge elements rendered inside one row. */
function badgesIn(row: TestElement | undefined): TestElement[] {
  assert.ok(row, 'the row is rendered')
  return collectElements(row, (element) =>
    String(element.props?.className ?? '')
      .split(' ')
      .includes('dshgg-graphBadge'),
  )
}

/** Count recorded calls of one operation. */
function opCount(mounted: MountedGit, op: string): number {
  return mounted.calls.filter((call) => call.op === op).length
}

test('an external working-tree change refreshes the status without reloading the graph', async () => {
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({ watchState: () => counters })
  assert.equal(opCount(mounted, 'status'), 1)
  assert.equal(opCount(mounted, 'history'), 1)

  mounted.harness.runIntervals()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 1, 'an unchanged counter does not refresh')

  counters = { watching: true, worktree: 1, references: 0 }
  mounted.harness.runIntervals()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2, 'the working-tree counter refreshes the status')
  assert.equal(opCount(mounted, 'history'), 1, 'the loaded graph is not reloaded')
  assert.equal(opCount(mounted, 'references'), 0, 'a working-tree change is not a reference change')
  assert.match(mounted.harness.text(), /Fix the sidebar/, 'the loaded commits stay visible')
  await mounted.harness.dispose()
})

test('an external branch switch recolors and re-badges loaded rows in place', async () => {
  const history: HistoryResult = {
    commits: [
      {
        oid: 'a'.repeat(40),
        shortOid: 'aaaaaaa',
        author: 'Ann',
        authoredAt: 1_700_000_000,
        refs: 'HEAD -> refs/heads/main',
        parents: ['b'.repeat(40)],
        subject: 'Old tip',
      },
      {
        oid: 'b'.repeat(40),
        shortOid: 'bbbbbbb',
        author: 'Bob',
        authoredAt: 1_699_999_000,
        refs: 'refs/heads/feature',
        parents: [],
        subject: 'Feature tip',
      },
    ],
    hasMore: false,
    references: {
      current: { id: 'refs/heads/main', name: 'main', revision: 'a'.repeat(40) },
      remote: null,
      base: null,
    },
  }
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    history,
    watchState: () => counters,
    referencePages: [
      {
        current: { id: 'refs/heads/feature', name: 'feature', revision: 'b'.repeat(40) },
        remote: null,
        base: null,
      },
    ],
  })
  const rowsBefore = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
  )
  assert.equal(rowsBefore[0]?.props['data-current'], 'true')
  assert.deepEqual(
    badgesIn(rowsBefore[0]).map((badge) => badge.props['data-icon']),
    ['target'],
    'the checked-out branch starts on the old tip',
  )

  counters = { watching: true, worktree: 0, references: 1 }
  mounted.harness.runIntervals()
  await mounted.harness.flush()

  assert.equal(opCount(mounted, 'references'), 1)
  assert.equal(opCount(mounted, 'history'), 1, 'the loaded pages are kept')
  assert.equal(opCount(mounted, 'status'), 2, 'the branch header follows the switch')
  const rowsAfter = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
  )
  assert.equal(rowsAfter[0]?.props['data-current'], undefined)
  assert.equal(rowsAfter[1]?.props['data-current'], 'true')
  assert.deepEqual(
    badgesIn(rowsAfter[0]).map((badge) => badge.props['data-icon']),
    ['branch'],
    'the old tip keeps main as an ordinary branch badge',
  )
  const feature = badgesIn(rowsAfter[1])
  assert.equal(feature.length, 1)
  assert.equal(feature[0]?.props['data-icon'], 'target')
  assert.equal(feature[0]?.props['data-color'], 'ref')
  await mounted.harness.dispose()
})

test('a reference move outside the loaded rows reloads the newest graph page', async () => {
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    watchState: () => counters,
    referencePages: [
      {
        current: { id: 'refs/heads/main', name: 'main', revision: 'c'.repeat(40) },
        remote: null,
        base: null,
      },
    ],
  })
  counters = { watching: true, worktree: 0, references: 1 }
  mounted.harness.runIntervals()
  await mounted.harness.flush()

  assert.equal(opCount(mounted, 'references'), 1)
  assert.equal(opCount(mounted, 'status'), 2)
  assert.equal(opCount(mounted, 'history'), 2, 'the newest page is reloaded for the new tip')
  await mounted.harness.dispose()
})

test('a Host that cannot watch leaves the periodic status check in charge', async () => {
  const mounted = await mountGit({
    watchState: () => ({ watching: false, worktree: 0, references: 0 }),
  })
  assert.equal(opCount(mounted, 'status'), 1)
  mounted.harness.runIntervals()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2, 'the fallback poll keeps the panel current')
  assert.equal(opCount(mounted, 'references'), 0)
  assert.doesNotMatch(mounted.harness.text(), /error\.title/)
  await mounted.harness.dispose()
  assert.ok(
    mounted.calls.some((call) => call.op === 'unwatch'),
    'unmounting releases the subscription',
  )
})

/** One externally released await used to hold a Host answer open. */
function deferred(): { readonly promise: Promise<void>; readonly release: () => void } {
  let release = (): void => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

/** The commit box textarea, whose disabled state follows the busy lock. */
function commitBox(harness: TestHarness): TestElement | undefined {
  return harness.findAll((element) => element.type === 'textarea')[0]
}

/** Hold a status poll open, so a write lands while the old snapshot is in flight. */
async function holdSlowStatusPoll(mounted: MountedGit, counters: () => void): Promise<void> {
  counters()
  mounted.harness.runIntervals()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2, 'the poll status read is in flight')
}

test('a slow poll cannot overwrite the status refreshed after a write', async (t) => {
  const gate = deferred()
  const stale = createStatus({
    files: [
      {
        kind: 'untracked',
        x: '?',
        y: '?',
        path: 'poll-stale.txt',
        conflict: false,
        untracked: true,
      },
    ],
  })
  const fresh = createStatus({
    files: [
      { kind: 'ordinary', x: 'M', y: ' ', path: 'src/fresh.js', conflict: false, untracked: false },
    ],
  })
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    watchState: () => counters,
    statusPages: [STATUS, stale, fresh],
    statusGates: [undefined, gate.promise],
  })
  t.after(() => mounted.harness.dispose())
  await holdSlowStatusPoll(mounted, () => {
    counters = { watching: true, worktree: 1, references: 0 }
  })

  mounted.harness.click(buttonByLabel(mounted.harness, 'actions.stageAll'))
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'stage'), 1)
  assert.equal(
    opCount(mounted, 'status'),
    2,
    'the write does not start a second status RPC while one is in flight',
  )
  assert.equal(
    commitBox(mounted.harness)?.props.disabled,
    true,
    'the panel stays busy until the post-write read has answered',
  )

  gate.release()
  await mounted.harness.flush()
  assert.equal(
    opCount(mounted, 'status'),
    3,
    'exactly one follow-up read drains the queued refresh',
  )
  assert.match(mounted.harness.text(), /fresh\.js/, 'the post-write snapshot wins')
  assert.doesNotMatch(
    mounted.harness.text(),
    /poll-stale\.txt/,
    'the slow poll snapshot never becomes the final state',
  )
  assert.equal(commitBox(mounted.harness)?.props.disabled, false, 'busy clears after the follow-up')
})

test('repeated explicit refreshes during one read coalesce into one follow-up', async (t) => {
  const gate = deferred()
  const stale = createStatus({
    files: [
      {
        kind: 'untracked',
        x: '?',
        y: '?',
        path: 'poll-stale.txt',
        conflict: false,
        untracked: true,
      },
    ],
  })
  const fresh = createStatus({
    files: [
      {
        kind: 'ordinary',
        x: 'M',
        y: ' ',
        path: 'src/coalesced.js',
        conflict: false,
        untracked: false,
      },
    ],
  })
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    watchState: () => counters,
    statusPages: [STATUS, stale, fresh],
    statusGates: [undefined, gate.promise],
  })
  t.after(() => mounted.harness.dispose())
  await holdSlowStatusPoll(mounted, () => {
    counters = { watching: true, worktree: 1, references: 0 }
  })

  const refresh = buttonByLabel(mounted.harness, 'refresh')
  mounted.harness.click(refresh)
  mounted.harness.click(refresh)
  mounted.harness.click(refresh)
  await mounted.harness.flush()
  assert.equal(
    opCount(mounted, 'status'),
    2,
    'queued refreshes never start a concurrent status read',
  )

  gate.release()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 3, 'three requests fold into one follow-up read')
  assert.match(mounted.harness.text(), /coalesced\.js/)
  assert.doesNotMatch(mounted.harness.text(), /poll-stale\.txt/)
})

test('a failed status read still drains the queued retry', async (t) => {
  const gate = deferred()
  const fresh = createStatus({
    files: [
      {
        kind: 'untracked',
        x: '?',
        y: '?',
        path: 'src/retried.js',
        conflict: false,
        untracked: true,
      },
    ],
  })
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    watchState: () => counters,
    statusPages: [STATUS, STATUS, fresh],
    failStatusPages: [1],
    statusGates: [undefined, gate.promise],
  })
  t.after(() => mounted.harness.dispose())
  await holdSlowStatusPoll(mounted, () => {
    counters = { watching: true, worktree: 1, references: 0 }
  })

  mounted.harness.click(buttonByLabel(mounted.harness, 'refresh'))
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2)

  gate.release()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 3, 'the queued retry runs after the failure')
  assert.match(mounted.harness.text(), /retried\.js/, 'the retry answer is applied')
  assert.doesNotMatch(
    mounted.harness.text(),
    /error\.title/,
    'the successful retry clears the failed state',
  )
})

test('an unmounting panel does not run a queued status read', async (t) => {
  const gate = deferred()
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    watchState: () => counters,
    statusPages: [STATUS, STATUS, STATUS],
    statusGates: [undefined, gate.promise],
  })
  t.after(() => mounted.harness.dispose())
  await holdSlowStatusPoll(mounted, () => {
    counters = { watching: true, worktree: 1, references: 0 }
  })

  mounted.harness.click(buttonByLabel(mounted.harness, 'refresh'))
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2, 'the refresh is queued behind the read')

  await mounted.harness.dispose()
  gate.release()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2, 'unmounting drops the queued read')
})

/**
 * Read the native Toast host registration the bundle adds to the frame overlay.
 * @param components - loaded bundle components.
 * @returns the host component, its injected store face, and the store.
 */
function nativeToastHost(
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
function recordingToast(seen: TestProps[]): TestComponent {
  return (props: TestProps): TestNode => {
    seen.push(props)
    return { type: 'div', props: { 'data-native-toast': '' }, children: [] }
  }
}

test('a failed operation reaches the native Toast store instead of the panel layout', async () => {
  const seen: TestProps[] = []
  const mounted = await mountGit({
    failOp: 'commit',
    hostModules: { '@deepseek-ai/dsh-client-ui-primitives': { Toast: recordingToast(seen) } },
  })
  const host = nativeToastHost(mounted.components)
  assert.ok(host, 'the native Toast host is registered in the frame overlay')
  assert.equal(host.store.getSnapshot(), null, 'nothing is delivered before a failure')
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'fix: will fail')
  await mounted.harness.flush()
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  const notice = host.store.getSnapshot()
  assert.equal(notice?.success, false)
  assert.equal(notice?.text, 'git said no')
  assert.doesNotMatch(
    mounted.harness.text(),
    /git said no/,
    'the failure text lives in the notice, not in the panel layout',
  )
  assert.equal(
    mounted.components.notifications.length,
    0,
    'the shared service is not used when the native host is available',
  )
  await mounted.harness.dispose()
})

test('the native Toast host distinguishes success and failure with type icons', async () => {
  const seen: TestProps[] = []
  const mounted = await mountGit({
    hostModules: { '@deepseek-ai/dsh-client-ui-primitives': { Toast: recordingToast(seen) } },
  })
  const host = nativeToastHost(mounted.components)
  assert.ok(host)
  assert.equal(seen.length, 0, 'no notice renders no Toast')
  host.store.push({ text: 'commit.done', success: true })
  await mounted.harness.render()
  const success = seen.at(-1)
  assert.equal(success?.tone, 'success')
  assert.equal(success?.icon, undefined, 'the success Toast uses its native check icon')
  const ran: string[] = []
  host.store.push({
    text: 'git said no',
    success: false,
    action: { label: 'retry', run: () => ran.push('retry') },
  })
  await mounted.harness.render()
  const failure = seen.at(-1)
  assert.ok(failure)
  assert.equal(failure.tone, undefined)
  assert.ok(failure.icon, 'a failure carries the warning icon')
  assert.equal(failure.holdMs, 6000)
  const actions = failure.actions as Array<{ label: string; onClick: () => void }>
  assert.equal(actions[0]?.label, 'retry')
  actions[0]?.onClick()
  await mounted.harness.render()
  assert.deepEqual(ran, ['retry'])
  assert.equal(host.store.getSnapshot(), null, 'the action dismisses the notice first')
  await mounted.harness.dispose()
})

test('a retry that fails again reports a fresh native notice', async () => {
  const seen: TestProps[] = []
  const mounted = await mountGit({
    failStatusPages: [1, 2],
    hostModules: { '@deepseek-ai/dsh-client-ui-primitives': { Toast: recordingToast(seen) } },
  })
  const host = nativeToastHost(mounted.components)
  assert.ok(host)
  mounted.harness.click(buttonByLabel(mounted.harness, 'refresh'))
  await mounted.harness.flush()
  const first = host.store.getSnapshot()
  assert.equal(first?.text, 'git said no')
  assert.equal(first?.action?.label, 'retry')
  const afterFirst = opCount(mounted, 'status')
  assert.equal(afterFirst, 2, `expected two status reads, saw ${afterFirst}`)
  const actions = seen.at(-1)?.actions as Array<{ label: string; onClick: () => void }> | undefined
  assert.equal(actions?.[0]?.label, 'retry')
  actions?.[0]?.onClick()
  await mounted.harness.flush()
  const afterRetry = opCount(mounted, 'status')
  assert.equal(afterRetry, 3, `the retry ran, saw ${afterRetry} status reads`)
  const second = host.store.getSnapshot()
  assert.ok(second, 'the retry failure is reported again')
  assert.notEqual(second?.seq, first?.seq)
  assert.equal(second?.text, 'git said no')
  await mounted.harness.dispose()
})

test('a retryable read failure offers a retry action in the native notice', async () => {
  const seen: TestProps[] = []
  const mounted = await mountGit({
    failOp: 'commit-details',
    hostModules: { '@deepseek-ai/dsh-client-ui-primitives': { Toast: recordingToast(seen) } },
  })
  const host = nativeToastHost(mounted.components)
  assert.ok(host)
  await openCommitDetails(mounted)
  const notice = host.store.getSnapshot()
  assert.equal(notice?.success, false)
  assert.equal(notice?.text, 'git said no')
  assert.equal(notice?.action?.label, 'retry')
  const before = mounted.calls.filter((call) => call.op === 'commit-details').length
  notice?.action?.run()
  await mounted.harness.flush()
  assert.ok(
    mounted.calls.filter((call) => call.op === 'commit-details').length > before,
    'the retry action reads the commit again',
  )
  await mounted.harness.dispose()
})
