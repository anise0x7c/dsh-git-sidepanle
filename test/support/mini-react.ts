/**
 * A tiny React renderer for tests.
 *
 * It implements just the hooks the Git bundle uses, resolves function
 * components recursively, and records effects so tests can mount a component,
 * flush its data effects, inspect the resolved element tree, and click handlers
 * without a browser or a React installation.
 */
import type {
  HarnessOptions,
  HarnessReact,
  TestComponent,
  TestElement,
  TestEvent,
  TestEventTarget,
  TestHarness,
  TestNode,
  TestPointerPhase,
  TestProps,
  TestScrollMetrics,
} from './types.ts'

const FRAGMENT = Symbol('Fragment')

/** Timer globals the harness overrides for one mount. */
interface TimerGlobals {
  setInterval(callback: () => void, delay?: number): unknown
  clearInterval(id: unknown): void
  setTimeout(callback: () => void, delay?: number): unknown
  clearTimeout(id: unknown): void
  fetch: HarnessOptions['fetch']
}

// Captured before any harness replaces the timer globals, so awaiting a real
// tick always works even after a test failed to dispose its harness.
const realSetTimeout = globalThis.setTimeout as unknown as (
  callback: () => void,
  delay?: number,
) => unknown
const timerGlobals = globalThis as unknown as TimerGlobals
const originalGlobals: TimerGlobals = {
  setInterval: globalThis.setInterval as unknown as TimerGlobals['setInterval'],
  clearInterval: globalThis.clearInterval as unknown as TimerGlobals['clearInterval'],
  setTimeout: globalThis.setTimeout as unknown as TimerGlobals['setTimeout'],
  clearTimeout: globalThis.clearTimeout as unknown as TimerGlobals['clearTimeout'],
  fetch: globalThis.fetch as unknown as TimerGlobals['fetch'],
}

/** One component render's hook cursor. */
interface RenderCursor {
  hooks: unknown[]
  index: number
  path: string
}

/** Cell a `useMemo`/`useCallback` comparison uses. */
interface DependencyCell<T> {
  deps: readonly unknown[] | undefined
  value: T | undefined
}

/** One queued effect callback. */
interface PendingEffect {
  path: string
  index: number
  callback: () => (() => void) | undefined
}

/** Whether two dependency lists are equal under React's `Object.is` rule. */
function sameDeps(
  previous: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean {
  if (previous === undefined || next === undefined) return false
  if (previous.length !== next.length) return false
  for (let index = 0; index < previous.length; index += 1) {
    if (!Object.is(previous[index], next[index])) return false
  }
  return true
}

/** Narrow a rendered node to an element object. */
function isTestElement(node: TestNode): node is TestElement {
  return typeof node === 'object' && node !== null && !Array.isArray(node)
}

/** Build the current-target stand-in a test event carries by default. */
function eventTargetStub(): TestEventTarget {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0, bottom: 0 }),
    focus() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => true,
    parentElement: null,
  }
}

/**
 * Mount one component with a mini React runtime.
 * @param options - harness options.
 * @returns harness with render, click, find, text, dispose.
 */
export function createHarness(options: HarnessOptions): TestHarness {
  const intervals = new Map<number, () => void>()
  const timeouts = new Map<number, () => void>()
  let timerId = 0
  timerGlobals.setInterval = (callback) => {
    const id = ++timerId
    intervals.set(id, callback)
    return id
  }
  timerGlobals.clearInterval = (id) => {
    intervals.delete(id as number)
  }
  timerGlobals.setTimeout = (callback) => {
    const id = ++timerId
    timeouts.set(id, callback)
    return id
  }
  timerGlobals.clearTimeout = (id) => {
    timeouts.delete(id as number)
  }
  timerGlobals.fetch = options.fetch

  const hookStore = new Map<string, unknown[]>()
  const effectStore = new Map<string, { cleanup?: () => void }>()
  let current: RenderCursor | null = null
  let scheduled = false
  let effectQueue: PendingEffect[] = []
  let lastTree: TestNode = null
  let nextId = 0

  function activeRender(): RenderCursor {
    if (current === null) throw new Error('a hook was called outside a component render')
    return current
  }

  function hookCell<T>(index: number, create: () => T): T {
    const active = activeRender()
    const existing = active.hooks[index]
    if (existing === undefined) {
      const created = create()
      active.hooks[index] = created
      return created
    }
    return existing as T
  }

  const react: HarnessReact = {
    Fragment: FRAGMENT,
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children }
    },
    useState<T>(initial: T | (() => T)) {
      const index = activeRender().index++
      const cell = hookCell(index, () => ({
        value: typeof initial === 'function' ? (initial as () => T)() : initial,
      }))
      const setState = (value: T | ((previous: T) => T)) => {
        const next = typeof value === 'function' ? (value as (previous: T) => T)(cell.value) : value
        if (Object.is(next, cell.value)) return
        cell.value = next
        scheduled = true
      }
      return [cell.value, setState] as [T, (value: T | ((previous: T) => T)) => void]
    },
    useRef<T>(initial: T) {
      const index = activeRender().index++
      return hookCell(index, () => ({ current: initial }))
    },
    useMemo<T>(factory: () => T, deps?: readonly unknown[]) {
      const index = activeRender().index++
      const cell = hookCell<DependencyCell<T>>(index, () => ({ deps: undefined, value: undefined }))
      if (cell.deps === undefined || !sameDeps(cell.deps, deps)) {
        cell.value = factory()
        cell.deps = deps
      }
      return cell.value as T
    },
    useCallback<T extends (...args: never[]) => unknown>(callback: T, deps?: readonly unknown[]) {
      const index = activeRender().index++
      const cell = hookCell<DependencyCell<T>>(index, () => ({ deps: undefined, value: undefined }))
      if (cell.deps === undefined || !sameDeps(cell.deps, deps)) {
        cell.value = callback
        cell.deps = deps
      }
      return cell.value as T
    },
    useId() {
      const index = activeRender().index++
      return hookCell(index, () => `test-react-${++nextId}`)
    },
    useEffect(callback, deps) {
      scheduleEffect(callback, deps)
    },
    // The harness has no paint, so a layout effect is scheduled like a data
    // effect: after the render that produced it.
    useLayoutEffect(callback, deps) {
      scheduleEffect(callback, deps)
    },
  }

  function scheduleEffect(
    callback: () => (() => void) | undefined,
    deps: readonly unknown[] | undefined,
  ): void {
    const active = activeRender()
    const index = active.index++
    const cell = hookCell<DependencyCell<undefined>>(index, () => ({
      deps: undefined,
      value: undefined,
    }))
    if (cell.deps === undefined || !sameDeps(cell.deps, deps)) {
      cell.deps = deps
      effectQueue.push({ path: active.path, index, callback })
    }
  }

  function resolve(node: TestNode, path: string): TestNode {
    if (node === null || node === undefined || typeof node === 'boolean') return node
    if (typeof node === 'string' || typeof node === 'number') return node
    if (Array.isArray(node)) return node.map((child, index) => resolve(child, `${path}.${index}`))
    if (node.type === FRAGMENT) return resolve(node.children, path)
    if (typeof node.type === 'function') {
      const rawChildren =
        node.children.length === 0
          ? undefined
          : node.children.length === 1
            ? node.children[0]
            : node.children
      const props: TestProps = {
        ...node.props,
        ...(rawChildren === undefined ? {} : { children: rawChildren }),
      }
      return invoke(node.type as TestComponent, props, path)
    }
    const children = node.children.map((child, index) => resolve(child, `${path}.${index}`))
    return { type: node.type, props: node.props, children }
  }

  function invoke(component: TestComponent, props: TestProps, path: string): TestNode {
    const saved = current
    current = { hooks: hookStore.get(path) ?? [], index: 0, path }
    let result: TestNode
    try {
      result = component(props)
    } finally {
      const finished = current
      current = saved
      if (finished !== null) hookStore.set(path, finished.hooks)
    }
    return resolve(result, `${path}/`)
  }

  async function settle(): Promise<void> {
    for (let index = 0; index < 4; index += 1) {
      await new Promise<void>((next) => {
        realSetTimeout(next, 0)
      })
    }
  }

  async function flushEffects(): Promise<void> {
    while (effectQueue.length > 0) {
      const next = effectQueue.shift()
      if (next === undefined) break
      const key = `${next.path}:${next.index}`
      const previous = effectStore.get(key)
      if (typeof previous?.cleanup === 'function') previous.cleanup()
      const cleanup = next.callback()
      effectStore.set(key, { cleanup: typeof cleanup === 'function' ? cleanup : undefined })
    }
  }

  async function flush(): Promise<TestNode> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await settle()
      if (!scheduled) return lastTree
      await render()
    }
    return lastTree
  }

  async function render(): Promise<TestNode> {
    for (let iteration = 0; iteration < 80; iteration += 1) {
      scheduled = false
      effectQueue = []
      lastTree = resolve(react.createElement(options.component, options.props), 'root')
      await flushEffects()
      await settle()
      if (!scheduled) break
    }
    return lastTree
  }

  function walk(node: TestNode, visit: (element: TestElement) => void): void {
    if (Array.isArray(node)) {
      for (const child of node) walk(child, visit)
      return
    }
    if (!isTestElement(node)) return
    visit(node)
    for (const child of node.children) walk(child, visit)
  }

  function findAll(predicate: (element: TestElement) => boolean): TestElement[] {
    const found: TestElement[] = []
    walk(lastTree, (element) => {
      if (predicate(element)) found.push(element)
    })
    return found
  }

  function text(): string {
    const parts: string[] = []
    walk(lastTree, (element) => {
      for (const child of element.children) {
        if (typeof child === 'string' || typeof child === 'number') parts.push(String(child))
      }
    })
    return parts.join(' ')
  }

  function click(element: TestElement | undefined, event: Partial<TestEvent> = {}): unknown {
    const handler = element?.props?.onClick
    if (typeof handler !== 'function') throw new Error('element has no onClick handler')
    return handler({ stopPropagation() {}, preventDefault() {}, target: {}, ...event })
  }

  function contextmenu(element: TestElement | undefined, event: Partial<TestEvent> = {}): unknown {
    const handler = element?.props?.onContextMenu
    if (typeof handler !== 'function') throw new Error('element has no onContextMenu handler')
    return handler({
      stopPropagation() {},
      preventDefault() {},
      target: {},
      currentTarget: eventTargetStub(),
      clientX: 0,
      clientY: 0,
      defaultPrevented: false,
      ...event,
    })
  }

  function keydown(element: TestElement | undefined, event: Partial<TestEvent> = {}): unknown {
    const handler = element?.props?.onKeyDown
    if (typeof handler !== 'function') throw new Error('element has no onKeyDown handler')
    return handler({
      stopPropagation() {},
      preventDefault() {},
      target: {},
      currentTarget: eventTargetStub(),
      nativeEvent: { isComposing: false },
      key: '',
      repeat: false,
      ...event,
    })
  }

  function change(element: TestElement | undefined, value: string): unknown {
    const handler = element?.props?.onChange
    if (typeof handler !== 'function') throw new Error('element has no onChange handler')
    return handler({ target: { value }, preventDefault() {}, stopPropagation() {} })
  }

  function pointer(
    element: TestElement | undefined,
    phase: TestPointerPhase,
    event: Partial<TestEvent> = {},
  ): unknown {
    const handlers = {
      down: element?.props?.onPointerDown,
      move: element?.props?.onPointerMove,
      up: element?.props?.onPointerUp,
      cancel: element?.props?.onPointerCancel,
    }
    const handler = handlers[phase]
    if (typeof handler !== 'function') throw new Error(`element has no onPointer${phase} handler`)
    return handler({
      stopPropagation() {},
      preventDefault() {},
      target: {},
      currentTarget: eventTargetStub(),
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      ...event,
    })
  }

  function scroll(element: TestElement | undefined, metrics: TestScrollMetrics): unknown {
    const handler = element?.props?.onScroll
    if (typeof handler !== 'function') throw new Error('element has no onScroll handler')
    return handler({
      stopPropagation() {},
      preventDefault() {},
      target: {},
      currentTarget: { ...eventTargetStub(), ...metrics },
    })
  }

  async function dispose(): Promise<void> {
    for (const entry of effectStore.values()) {
      if (typeof entry.cleanup === 'function') entry.cleanup()
    }
    effectStore.clear()
    intervals.clear()
    timeouts.clear()
    timerGlobals.setInterval = originalGlobals.setInterval
    timerGlobals.clearInterval = originalGlobals.clearInterval
    timerGlobals.setTimeout = originalGlobals.setTimeout
    timerGlobals.clearTimeout = originalGlobals.clearTimeout
    timerGlobals.fetch = originalGlobals.fetch
  }

  /**
   * Run every pending interval callback once, as one elapsed polling period
   * would. Tests call this (and then `flush`) to drive the panel's pollers,
   * whose delays are irrelevant to the behavior under test.
   */
  function runIntervals(): void {
    for (const callback of [...intervals.values()]) callback()
  }

  return {
    React: react,
    render,
    flush,
    findAll,
    text,
    click,
    contextmenu,
    keydown,
    change,
    pointer,
    scroll,
    dispose,
    runIntervals,
    setComponent(component, props) {
      options.component = component
      options.props = props
    },
    hookStoreSize: () => hookStore.size,
  }
}
