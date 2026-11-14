/**
 * A tiny React renderer for tests.
 *
 * It implements just the hooks the Git bundle uses, resolves function
 * components recursively, and records effects so tests can mount a component,
 * flush its data effects, inspect the resolved element tree, and click handlers
 * without a browser or a React installation.
 */

const FRAGMENT = Symbol('Fragment')

// Captured before any harness replaces the timer globals, so awaiting a real
// tick always works even after a test failed to dispose its harness.
const realSetTimeout = globalThis.setTimeout
const originalGlobals = {
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  fetch: globalThis.fetch,
}

function sameDeps(previous, next) {
  if (previous === undefined || next === undefined) return false
  if (previous.length !== next.length) return false
  for (let index = 0; index < previous.length; index += 1) {
    if (!Object.is(previous[index], next[index])) return false
  }
  return true
}

/**
 * Mount one component with a mini React runtime.
 * @param {object} options - harness options.
 * @param {() => object} options.component - component factory receiving the harness React.
 * @param {object} options.props - root props.
 * @param {() => Promise<object>} options.fetch - fetch stand-in.
 * @returns {object} harness with render, click, find, text, dispose.
 */
export function createHarness(options) {
  const intervals = new Map()
  const timeouts = new Map()
  let timerId = 0
  globalThis.setInterval = (callback) => {
    const id = ++timerId
    intervals.set(id, callback)
    return id
  }
  globalThis.clearInterval = (id) => { intervals.delete(id) }
  globalThis.setTimeout = (callback) => {
    const id = ++timerId
    timeouts.set(id, callback)
    return id
  }
  globalThis.clearTimeout = (id) => { timeouts.delete(id) }
  globalThis.fetch = options.fetch

  const hookStore = new Map()
  const effectStore = new Map()
  let current = null
  let scheduled = false
  let effectQueue = []
  let lastTree = null

  function hookCell(index, create) {
    const hooks = current.hooks
    if (hooks[index] === undefined) hooks[index] = create()
    return hooks[index]
  }

  const react = {
    Fragment: FRAGMENT,
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children }
    },
    useState(initial) {
      const index = current.index++
      const cell = hookCell(index, () => ({ value: typeof initial === 'function' ? initial() : initial }))
      const setState = (value) => {
        const next = typeof value === 'function' ? value(cell.value) : value
        if (Object.is(next, cell.value)) return
        cell.value = next
        scheduled = true
      }
      return [cell.value, setState]
    },
    useRef(initial) {
      const index = current.index++
      return hookCell(index, () => ({ current: initial }))
    },
    useMemo(factory, deps) {
      const index = current.index++
      const cell = hookCell(index, () => ({ deps: undefined, value: undefined }))
      if (cell.deps === undefined || !sameDeps(cell.deps, deps)) {
        cell.value = factory()
        cell.deps = deps
      }
      return cell.value
    },
    useCallback(callback, deps) {
      const index = current.index++
      const cell = hookCell(index, () => ({ deps: undefined, value: undefined }))
      if (cell.deps === undefined || !sameDeps(cell.deps, deps)) {
        cell.value = callback
        cell.deps = deps
      }
      return cell.value
    },
    useEffect(callback, deps) {
      const index = current.index++
      const cell = hookCell(index, () => ({ deps: undefined }))
      if (cell.deps === undefined || !sameDeps(cell.deps, deps)) {
        cell.deps = deps
        effectQueue.push({ path: current.path, index, callback })
      }
    },
  }

  function resolve(element, path) {
    if (element === null || element === undefined || typeof element === 'boolean') return element
    if (typeof element === 'string' || typeof element === 'number') return element
    if (Array.isArray(element)) return element.map((child, index) => resolve(child, `${path}.${index}`))
    if (element.type === FRAGMENT) return resolve(element.children, path)
    if (typeof element.type === 'function') {
      const rawChildren = element.children.length === 0
        ? undefined
        : element.children.length === 1 ? element.children[0] : element.children
      const props = { ...element.props, ...(rawChildren === undefined ? {} : { children: rawChildren }) }
      return invoke(element.type, props, path)
    }
    const children = (element.children ?? []).map((child, index) => resolve(child, `${path}.${index}`))
    return { type: element.type, props: element.props, children }
  }

  function invoke(component, props, path) {
    const saved = current
    current = { hooks: hookStore.get(path) ?? [], index: 0, path }
    let result
    try {
      result = component(props)
    } finally {
      const finished = current
      current = saved
      hookStore.set(path, finished.hooks)
    }
    return resolve(result, `${path}/`)
  }

  async function settle() {
    for (let index = 0; index < 4; index += 1) {
      await new Promise((resolve) => realSetTimeout(resolve, 0))
    }
  }

  async function flushEffects() {
    while (effectQueue.length > 0) {
      const next = effectQueue.shift()
      const key = `${next.path}:${next.index}`
      const previous = effectStore.get(key)
      if (typeof previous?.cleanup === 'function') previous.cleanup()
      const cleanup = next.callback()
      effectStore.set(key, { cleanup: typeof cleanup === 'function' ? cleanup : undefined })
    }
  }

  async function flush() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await settle()
      if (!scheduled) return lastTree
      await render()
    }
    return lastTree
  }

  async function render() {
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

  function walk(node, visit) {
    if (node === null || node === undefined || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const child of node) walk(child, visit)
      return
    }
    visit(node)
    for (const child of node.children ?? []) walk(child, visit)
  }

  function findAll(predicate) {
    const found = []
    walk(lastTree, (element) => { if (predicate(element)) found.push(element) })
    return found
  }

  function text() {
    const parts = []
    walk(lastTree, (element) => {
      for (const child of element.children ?? []) {
        if (typeof child === 'string' || typeof child === 'number') parts.push(String(child))
      }
    })
    return parts.join(' ')
  }

  function click(element, event = {}) {
    const handler = element?.props?.onClick
    if (typeof handler !== 'function') throw new Error('element has no onClick handler')
    return handler({ stopPropagation() {}, preventDefault() {}, target: {}, ...event })
  }

  function contextmenu(element, event = {}) {
    const handler = element?.props?.onContextMenu
    if (typeof handler !== 'function') throw new Error('element has no onContextMenu handler')
    return handler({
      stopPropagation() {},
      preventDefault() {},
      target: {},
      currentTarget: { getBoundingClientRect: () => ({ left: 0, bottom: 0 }), focus() {} },
      clientX: 0,
      clientY: 0,
      defaultPrevented: false,
      ...event,
    })
  }

  function keydown(element, event = {}) {
    const handler = element?.props?.onKeyDown
    if (typeof handler !== 'function') throw new Error('element has no onKeyDown handler')
    return handler({
      stopPropagation() {},
      preventDefault() {},
      target: {},
      currentTarget: { getBoundingClientRect: () => ({ left: 0, bottom: 0 }), focus() {} },
      key: '',
      repeat: false,
      ...event,
    })
  }

  function change(element, value) {
    const handler = element?.props?.onChange
    if (typeof handler !== 'function') throw new Error('element has no onChange handler')
    return handler({ target: { value }, preventDefault() {} })
  }

  async function dispose() {
    for (const entry of effectStore.values()) {
      if (typeof entry.cleanup === 'function') entry.cleanup()
    }
    effectStore.clear()
    intervals.clear()
    timeouts.clear()
    globalThis.setInterval = originalGlobals.setInterval
    globalThis.clearInterval = originalGlobals.clearInterval
    globalThis.setTimeout = originalGlobals.setTimeout
    globalThis.clearTimeout = originalGlobals.clearTimeout
    globalThis.fetch = originalGlobals.fetch
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
    dispose,
    setComponent(component, props) {
      options.component = component
      options.props = props
    },
    hookStoreSize: () => hookStore.size,
  }
}
