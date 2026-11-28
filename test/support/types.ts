/**
 * Test-only structural types shared by the fakes, fixtures, and the mini React
 * harness.
 *
 * Domain and DSH service types come from the source modules (type-only), so a
 * test fake cannot drift from the contract the bundle actually expects. The
 * remaining declarations model what the tests themselves need: rendered
 * elements, captured menu targets, and recorders.
 */

import type {
  ContextMenuAction,
  ContextMenuContribution,
  ContextMenusService,
  LocaleBinder,
  LocaleParams,
  MenuActionView,
  ShortcutCommand,
  ShortcutResolution,
  SidebarRightGuideEntry,
  SidebarRightTabDefinition,
  SidebarRightTarget,
  SlotRegisterOptions,
} from '../../src/client/types/dsh.ts'

/** Services the bundle's `apply` receives. */
export type { ClientContext } from '../../src/client/types/dsh.ts'
/** Translation binder shape the plugin calls `ctx.locale.bind`. */
/** One contribution action with its execution callback. */
/** One application keyboard command registered by the bundle. */
/** Static face of one registered right-Sidebar tab type. */
/** One namespaced context-menu contribution. */
/** A page captured by the right Sidebar's navigation controller. */
/** Options of one keyed Slot registration. */
export type {
  ContextMenuAction,
  ContextMenuContribution,
  ContextMenusService,
  LocaleBinder,
  LocaleParams,
  MenuActionView,
  ShortcutCommand,
  ShortcutResolution,
  SidebarRightTabDefinition,
  SidebarRightTarget,
  SlotRegisterOptions,
}

/** One dictionary pair registered through the locale service. */
export type LocaleDictionaries = Readonly<Record<string, Readonly<Record<string, string>>>>

/** A disposable registration. */
export type Disposable = () => void

/** Line one component returns or nests; mirrors the mini React renderer. */
export type TestNode = TestElement | TestNode[] | string | number | boolean | null | undefined

/** One rendered element: the mini React runtime only needs these three fields. */
export interface TestElement {
  type: unknown
  props: TestProps
  children: TestNode[]
}

/** Props of one rendered element; named fields cover the assertions helpers use. */
export interface TestProps {
  [key: string]: unknown
  className?: string
  title?: string
  role?: string
  tabIndex?: number
  disabled?: boolean
  width?: number
  height?: number
  cx?: number
  cy?: number
  r?: number
  d?: string
  style?: {
    marginLeft?: string
    flexBasis?: string
    [property: string]: string | number | undefined
  }
  children?: TestNode
  onClick?: TestEventHandler
  onContextMenu?: TestEventHandler
  onKeyDown?: TestEventHandler
  onChange?: TestEventHandler
  onMouseEnter?: TestEventHandler
  onMouseLeave?: TestEventHandler
  onPointerDown?: TestEventHandler
  onPointerMove?: TestEventHandler
  onPointerUp?: TestEventHandler
  onPointerCancel?: TestEventHandler
  'aria-label'?: string
  'aria-haspopup'?: string
  'aria-hidden'?: string | boolean
  'aria-orientation'?: string
  'aria-valuemin'?: number
  'aria-valuemax'?: number
  'aria-valuenow'?: number
  'data-dragging'?: string
  'data-lane'?: string
  'data-kind'?: string
  'data-section'?: string
  'data-plugin'?: string
  'data-dsh-git-sidepanel'?: string
  'data-dsh-git-sidepanel-diff'?: string
}

/** A rectangle stand-in for `getBoundingClientRect` in tests. */
export interface TestRect {
  left: number
  top: number
  width: number
  height: number
  bottom: number
}

/** The element a test event reports as its current target. */
export interface TestEventTarget {
  getBoundingClientRect(): TestRect
  focus?(): void
  isConnected?: boolean
  setPointerCapture?(pointerId: number): void
  releasePointerCapture?(pointerId: number): void
  hasPointerCapture?(pointerId: number): boolean
  parentElement?: TestEventTarget | null
  /** Scroll offset of a scroll container, in pixels. */
  scrollTop?: number
  /** Visible height of a scroll container, in pixels. */
  clientHeight?: number
  /** Content height of a scroll container, in pixels. */
  scrollHeight?: number
}

/** Scroll metrics a test hands to a pane's `onScroll` handler. */
export interface TestScrollMetrics {
  /** Pixels the content is scrolled down. */
  scrollTop: number
  /** Visible height of the pane in pixels. */
  clientHeight: number
  /** Total height of the pane's content in pixels. */
  scrollHeight: number
}

/** Event object the harness hands to a component handler. */
export interface TestEvent {
  stopPropagation(): void
  preventDefault(): void
  target: Record<string, unknown>
  currentTarget?: TestEventTarget
  clientX?: number
  clientY?: number
  pointerId?: number
  defaultPrevented?: boolean
  key?: string
  repeat?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  /** Native keyboard composition state, as React's KeyboardEvent exposes it. */
  nativeEvent?: { isComposing?: boolean }
}

/** Pointer gesture phase the harness can invoke. */
export type TestPointerPhase = 'down' | 'move' | 'up' | 'cancel'

/** Handler signature the harness calls with a {@link TestEvent}. */
export type TestEventHandler = (event: TestEvent) => unknown

/** A component the harness can mount; loaded bundle components are cast here. */
export type TestComponent = (props: TestProps) => TestNode

/** The slice of the React API the mini renderer provides. */
export interface HarnessReact {
  Fragment: symbol
  createElement(type: unknown, props: TestProps, ...children: TestNode[]): TestElement
  useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void]
  useRef<T>(initial: T): { current: T }
  useMemo<T>(factory: () => T, deps?: readonly unknown[]): T
  useCallback<T extends (...args: never[]) => unknown>(callback: T, deps?: readonly unknown[]): T
  useId(): string
  useEffect(callback: () => (() => void) | undefined, deps?: readonly unknown[]): void
  useLayoutEffect(callback: () => (() => void) | undefined, deps?: readonly unknown[]): void
}

/** JSON body of one panel RPC request, as the panel sends it. */
export interface RpcRequestRecord {
  sessionId: string
  op: string
  path?: string
  paths?: string[]
  message?: string
  stageAll?: boolean
  commit?: string
  oid?: string
  branch?: string
  untracked?: boolean
  offset?: number
  [key: string]: unknown
}

/** Minimal fetch response the panel caller reads. */
export interface FetchResponseLike {
  ok: boolean
  status: number
  json(): Promise<unknown>
}

/** Fetch stand-in installed into the harness global scope. */
export type FetchLike = (
  url: string,
  init: { body: string; method?: string },
) => Promise<FetchResponseLike>

/** Options for the mini React harness. */
export interface HarnessOptions {
  fetch: FetchLike
  component: TestComponent | null
  props: TestProps
}

/** Public surface of the mini React harness. */
export interface TestHarness {
  React: HarnessReact
  render(): Promise<TestNode>
  flush(): Promise<TestNode>
  findAll(predicate: (element: TestElement) => boolean): TestElement[]
  text(): string
  click(element: TestElement | undefined, event?: Partial<TestEvent>): unknown
  contextmenu(element: TestElement | undefined, event?: Partial<TestEvent>): unknown
  keydown(element: TestElement | undefined, event?: Partial<TestEvent>): unknown
  change(element: TestElement | undefined, value: string): unknown
  pointer(
    element: TestElement | undefined,
    phase: TestPointerPhase,
    event?: Partial<TestEvent>,
  ): unknown
  scroll(element: TestElement | undefined, metrics: TestScrollMetrics): unknown
  /** Run every pending interval callback once (one elapsed poll period). */
  runIntervals(): void
  /** Run every pending one-shot timeout once (one elapsed exit animation). */
  runTimeouts(): void
  dispose(): Promise<void>
  setComponent(component: TestComponent, props: TestProps): void
  hookStoreSize(): number
}

/** Browser style tag the artifact appends to `document.head`. */
export interface StyleTagStub {
  textContent: string
  attributes: Record<string, string>
  dataset: Record<string, string>
  setAttribute(name: string, value: string): void
  getAttribute(name: string): string | null
  appendChild(child: unknown): void
  remove(): void
}

/** Browser document stand-in installed before the artifact is evaluated. */
export interface DocumentStub {
  querySelector(selector: string): StyleTagStub | null
  addEventListener(type: string, listener: unknown): void
  removeEventListener(type: string, listener: unknown): void
  createElement(tag: string): StyleTagStub
  head: {
    appendChild(tag: StyleTagStub): void
    removeChild(tag: StyleTagStub): void
    querySelector(selector: string): StyleTagStub | null
    contains(tag: StyleTagStub): boolean
  }
}

/** Module-loader registration the browser artifact publishes. */
export interface ClientRegistration {
  id: string
  factory(require: (specifier: string) => unknown): ClientModule
}

/** Evaluated browser bundle module. */
export interface ClientModule {
  inject: readonly string[]
  apply(ctx: import('../../src/client/types/dsh.ts').ClientContext): void
}

/** Browser globals the bundle touches, installed by `loadClientBundle`. */
export interface BrowserGlobals {
  window: { __ModuleLoader__: { load(registration: ClientRegistration): void } }
  document: DocumentStub
  fetch: FetchLike
}

/** Result of loading the built artifact once. */
export interface LoadedBrowser {
  registration: ClientRegistration
  styleTags: StyleTagStub[]
}

/** One resolved action view the shared overlay renders. */
export type TestMenuActionView = MenuActionView & {
  children?: readonly TestMenuActionView[]
  run?: () => void | Promise<void>
  failureLabel?: string
}

/** One captured context-menu target: the registered family plus the row value. */
export interface CapturedTarget {
  kind: string
  value: CapturedTargetValue
}

/** Row data the trigger captured; each row family fills its own fields. */
export interface CapturedTargetValue {
  sessionId?: string
  kind?: string
  section?: string
  path?: string
  cwd?: string
  panelId?: string
  busy?: boolean
  oid?: string
  shortOid?: string
  subject?: string
  [key: string]: unknown
}

/** One resolved menu occurrence returned by the registry stand-in. */
export interface MenuResolution {
  dispose(): void
  ready: Promise<void>
  source: { getSnapshot(): TestMenuActionView[] }
  select(id: string): void
}

/** Toast recorder shared by the menu service. */
export interface MenuNotification {
  text: string
  success: boolean
}

/** Menu service stand-in plus recorders and helpers. */
export interface MenuService {
  contextMenus: TestContextMenusService
  contributions: ContextMenuContribution[]
  notifications: MenuNotification[]
  views(target: CapturedTarget): TestMenuActionView[]
  select(target: CapturedTarget, id: string): Promise<void>
}

/** Context-menu registry plus the test-only resolve hook the shipped registry owns. */
export interface TestContextMenusService extends ContextMenusService {
  resolve(target: CapturedTarget): MenuResolution
}

/** Handler bag passed through `getTriggerProps`. */
export interface MenuTriggerHandlers {
  tabIndex?: number
  'aria-haspopup'?: string
  title?: string
  onContextMenu?: TestEventHandler
  onKeyDown?: TestEventHandler
}

/** Trigger props the fake binding returns. */
export interface MenuTriggerProps extends MenuTriggerHandlers {
  tabIndex: number
  onContextMenu(event: TestEvent): void
  onKeyDown(event: TestEvent): void
}

/** The fake binding object exposed to slots as `props.useContextMenu`. */
export interface MenuTriggerBindings {
  getTriggerProps(target: CapturedTarget, handlers?: MenuTriggerHandlers): MenuTriggerProps
}

/** Context-menu trigger mock. */
export interface MenuMock {
  opens: Array<{ target: CapturedTarget; point: { x: number; y: number } }>
  useContextMenu: () => MenuTriggerBindings
}

/** One slot registration recorded from the bundle. */
export interface SlotRegistration {
  options: SlotRegisterOptions
  component: TestComponent
}

/** Every registration the bundle made during `apply`. */
export interface FakeRecords {
  localeDictionaries: Array<{ namespace: string; dictionaries: LocaleDictionaries }>
  tabTypes: SidebarRightTabDefinition[]
  slots: SlotRegistration[]
  shortcuts: ShortcutCommand[]
}

/** Recording context built by `createFakeContext`. */
export interface FakeContext {
  ctx: import('../../src/client/types/dsh.ts').ClientContext
  records: FakeRecords
  menu: MenuService
  /** Dispose every effect the bundle registered, as unloading the plugin would. */
  dispose(): void
}

/** The services the fake context hands to an injected callback. */
export interface FakeSidebarTarget extends SidebarRightTarget {}

/** One envelope the Host answers; tests assert `ok` before reading one branch. */
export interface RpcFailure {
  code: string
  message: string
}

/**
 * Wire envelope of one RPC reply. Tests assert `ok` in the branch they read,
 * then read only that branch's field, so both fields stay addressable here.
 */
export interface RpcReply<T> {
  ok: boolean
  value: T
  error: RpcFailure
}

/** A tab the panel opened through `tab.actions.openTab`. */
export interface OpenedTab {
  kind: string
  options: { params: Record<string, unknown> }
}

/** Convenience re-export used by tab fixture helpers. */
export type { SidebarRightGuideEntry }
