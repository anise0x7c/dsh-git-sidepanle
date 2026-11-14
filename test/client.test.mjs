/**
 * Client-half registration tests.
 *
 * A stub module loader, React, and Cordis context let the browser bundle
 * evaluate in Node: registration shapes, locale dictionaries, guide metadata,
 * the shortcut, and the component render paths are checked without a browser.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

/** Minimal element shape the stub React returns. */
function createElement(type, props, ...children) {
  return { type, props: props ?? {}, children }
}

const fakeReact = {
  createElement,
  Fragment: Symbol('Fragment'),
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}]
  },
  useEffect() {},
  useMemo(factory) { return factory() },
  useCallback(callback) { return callback },
  useRef(value) { return { current: value } },
}

function installGlobals() {
  const styleTags = []
  globalThis.window = {
    __ModuleLoader__: {
      load(registration) { globalThis.__gitGraphRegistration = registration },
    },
  }
  globalThis.document = {
    querySelector() { return null },
    createElement() {
      const attributes = {}
      return {
        dataset: {},
        attributes,
        setAttribute(name, value) { attributes[name] = value },
        getAttribute(name) { return attributes[name] ?? null },
        appendChild() {},
        textContent: '',
      }
    },
    head: { appendChild(tag) { styleTags.push(tag) } },
  }
  globalThis.fetch = async () => { throw new Error('fetch is not exercised here') }
  return styleTags
}

function translate(key, params) {
  if (params === undefined) return key
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), key)
}

/** @type {object} */
let registration
/** @type {object} */
let globals

test('the bundle registers its two right-Sidebar types, bodies, titles, and shortcut', async () => {
  globals = installGlobals()
  await import('../client.js')
  registration = globalThis.__gitGraphRegistration
  assert.equal(registration.id, '@local/dsh-git-graph')
  const module = registration.factory((specifier) => {
    if (specifier === 'react') return fakeReact
    throw new Error(`unexpected require("${specifier}")`)
  })
  assert.deepEqual(module.inject, ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight'])

  const localeDictionaries = []
  const tabTypes = []
  const slotRegistrations = []
  const shortcuts = []
  const effects = []
  const baseContext = {
    effect(callback) {
      const cleanup = callback()
      effects.push(cleanup)
      return () => { if (typeof cleanup === 'function') cleanup() }
    },
    locale: {
      bind: () => translate,
      register(namespace, dictionaries) {
        localeDictionaries.push({ namespace, dictionaries })
        return () => {}
      },
    },
    sidebarRightTabs: {
      register(definition) {
        tabTypes.push(definition)
        return () => {}
      },
    },
    slots: {
      inject(_key, callback) {
        const cleanup = callback()
        return () => { if (typeof cleanup === 'function') cleanup() }
      },
      register(options, component) {
        slotRegistrations.push({ options, component })
        return () => {}
      },
    },
    sidebarRight: {
      commandTarget: () => undefined,
      openTabFromTarget: () => {},
    },
  }
  const context = {
    ...baseContext,
    inject(services, callback) {
      if (!services.includes('shortcuts')) return
      callback({
        ...baseContext,
        shortcuts: {
          register(definition) {
            shortcuts.push(definition)
            return () => {}
          },
        },
      })
    },
  }
  module.apply(context)

  assert.equal(globals.length, 1)
  assert.equal(globals[0].getAttribute('data-plugin'), '@local/dsh-git-graph')
  assert.equal(localeDictionaries.length, 1)
  assert.equal(localeDictionaries[0].namespace, 'gitGraph')
  assert.ok(localeDictionaries[0].dictionaries.en.title)
  assert.ok(localeDictionaries[0].dictionaries.zh.title)
  assert.deepEqual(
    Object.keys(localeDictionaries[0].dictionaries.en).sort(),
    Object.keys(localeDictionaries[0].dictionaries.zh).sort(),
  )

  assert.deepEqual(tabTypes.map((definition) => definition.kind), ['git', 'git-diff'])
  const gitType = tabTypes[0]
  assert.equal(gitType.id, '@local/dsh-git-graph/git')
  assert.equal(gitType.title('x'), 'title')
  assert.equal(gitType.guide.length, 1)
  const guide = gitType.guide[0]
  assert.equal(guide.commandId, 'workspace.git')
  assert.equal(guide.title(), 'guideTitle')
  assert.equal(typeof guide.icon, 'function')
  const iconElement = guide.icon({ size: 16 })
  assert.equal(iconElement.type, 'svg')
  assert.deepEqual(tabTypes[1], {
    id: '@local/dsh-git-graph/diff',
    kind: 'git-diff',
    title: tabTypes[1].title,
  })

  assert.equal(slotRegistrations.length, 4)
  const slotSummary = slotRegistrations.map(({ options }) => `${options.name}:${options.key}`)
  assert.deepEqual(slotSummary, [
    'sidebar.right.pane.tab:@local/dsh-git-graph/git',
    'sidebar.right.pane.tab.title:@local/dsh-git-graph/git',
    'sidebar.right.pane.tab:@local/dsh-git-graph/diff',
    'sidebar.right.pane.tab.title:@local/dsh-git-graph/diff',
  ])
  for (const { options } of slotRegistrations) assert.equal(options.locale, 'gitGraph')

  assert.equal(shortcuts.length, 1)
  assert.equal(shortcuts[0].id, 'workspace.git')
  assert.equal(shortcuts[0].label(), 'title')
  assert.deepEqual(shortcuts[0].resolve({ target: null }), { status: 'blocked', reason: 'shortcut.noSession' })
  assert.equal(typeof shortcuts[0].defaults['web:windows'].code, 'string')

  // The shortcut opens the page for the resolved target.
  let opened = null
  shortcuts.length = 0
  module.apply({
    ...context,
    sidebarRight: {
      commandTarget: () => ({ sessionId: 's', paneId: 'p', host: 'dock' }),
      openTabFromTarget: (kind, target) => { opened = { kind, target } },
    },
  })
  const handled = shortcuts[0].resolve({ target: {} })
  assert.equal(handled.status, 'handled')
  handled.run()
  assert.equal(opened.kind, 'git')
  assert.equal(opened.target.sessionId, 's')
})

test('components render without a browser and expose stable markup entry points', async () => {
  if (registration === undefined) {
    globals = installGlobals()
    await import('../client.js')
    registration = globalThis.__gitGraphRegistration
  }
  const module = registration.factory((specifier) => {
    if (specifier === 'react') return fakeReact
    throw new Error(`unexpected require("${specifier}")`)
  })
  const registrations = []
  module.apply({
    effect(callback) { callback(); return () => {} },
    locale: { bind: () => translate, register: () => () => {} },
    sidebarRightTabs: { register: () => () => {} },
    slots: { inject(_key, callback) { callback() }, register(options, component) { registrations.push({ options, component }); return () => {} } },
    sidebarRight: { commandTarget: () => undefined, openTabFromTarget: () => {} },
    inject() {},
  })
  const bySeat = new Map(registrations.map(({ options, component }) => [`${options.name}:${options.key}`, component]))
  const gitPanel = bySeat.get('sidebar.right.pane.tab:@local/dsh-git-graph/git')
  const diffPanel = bySeat.get('sidebar.right.pane.tab:@local/dsh-git-graph/diff')
  const gitTitle = bySeat.get('sidebar.right.pane.tab.title:@local/dsh-git-graph/git')
  const diffTitle = bySeat.get('sidebar.right.pane.tab.title:@local/dsh-git-graph/diff')
  assert.equal(typeof gitPanel, 'function')
  assert.equal(typeof diffPanel, 'function')

  const tab = {
    id: 'tab-1',
    title: 'Source control',
    visible: true,
    signal: new AbortController().signal,
    actions: { openTab: () => {}, openResource: () => {}, close: () => {}, bindCommands: () => () => {} },
    navigation: { address: 'sidebar://git', params: {}, revision: 0 },
  }
  const useTabInfo = () => ({ sidebar: { expanded: true, fullscreen: false }, panel: { id: 'pane-1', isFloating: false }, tab })

  const panelElement = gitPanel({ sessionId: 'session-1', t: translate, useTabInfo, useSessions: () => undefined })
  assert.equal(panelElement.type, 'div')
  assert.equal(panelElement.props.className, 'dshgg-root')
  assert.ok(panelElement.props['data-dsh-git-graph'] !== undefined)

  const diffElement = diffPanel({ sessionId: 'session-1', t: translate, useTabInfo })
  assert.equal(diffElement.type, 'div')
  assert.equal(diffElement.props.className, 'dshgg-diffRoot')

  const gitTitleElement = gitTitle({ t: translate, useTabInfo })
  assert.equal(gitTitleElement.type, 'span')
  const diffTitleElement = diffTitle({ t: translate, useTabInfo })
  assert.equal(diffTitleElement.type, 'span')

  // A diff tab that restored without navigation parameters shows its picker prompt.
  const restoredTab = { ...tab, navigation: { address: 'sidebar://git-diff', params: undefined, revision: 0 } }
  const restored = diffPanel({ sessionId: 'session-1', t: translate, useTabInfo: () => ({ sidebar: {}, panel: {}, tab: restoredTab }) })
  assert.equal(restored.props.className, 'dshgg-diffRoot')
})

/**
 * Apply the bundle with a Captured context-menu service and no other plugin
 * machinery; returns the recorded contribution and toast calls.
 *
 * The stand-in mirrors the shipped registry: `register` keeps the contribution
 * and `resolve` calls it with the captured target's value, never with the
 * `{ kind, value }` wrapper the trigger received. Reaching the contribution any
 * other way would hide a contract mismatch like the one that opened empty menus.
 * @param {object} module - evaluated bundle module.
 * @returns {{contributions: object[], notifications: object[], contextMenus: object}} recorder.
 */
function applyWithMenuService(module) {
  const contributions = []
  const notifications = []
  const contextMenus = {
    register(contribution) { contributions.push(contribution); return () => {} },
    resolve(target, signal) {
      const contribution = contributions.at(-1)
      assert.equal(typeof contribution?.resolve, 'function', 'no context-menu contribution was registered')
      return contribution.resolve(target.value, signal)
    },
    notify(text, success) { notifications.push({ text, success }) },
  }
  const shared = {
    effect(callback) { callback(); return () => {} },
    locale: { bind: () => translate, register: () => () => {} },
    sidebarRightTabs: { register: () => () => {} },
    slots: { inject(_key, callback) { callback(); return () => {} }, register: () => () => {} },
    sidebarRight: { commandTarget: () => undefined, openTabFromTarget: () => {} },
  }
  module.apply({
    ...shared,
    inject(services, callback) {
      if (!services.includes('contextMenus')) return
      callback({ ...shared, contextMenus })
    },
  })
  return { contributions, notifications, contextMenus }
}

const MENU_IDS = (actions) => actions.map((action) => action.id)

test('the bundle contributes row, group, commit, and diff context-menu actions', async () => {
  if (registration === undefined) {
    globals = installGlobals()
    await import('../client.js')
    registration = globalThis.__gitGraphRegistration
  }
  const module = registration.factory((specifier) => {
    if (specifier === 'react') return fakeReact
    throw new Error(`unexpected require("${specifier}")`)
  })
  const { contributions, contextMenus } = applyWithMenuService(module)
  assert.equal(contributions.length, 1)
  const contribution = contributions[0]
  assert.equal(contribution.id, 'git-graph.actions')
  assert.equal(contribution.target, 'gitGraphItem')
  assert.equal(typeof contribution.resolve, 'function')

  const resolve = (value) => contextMenus.resolve({ kind: 'gitGraphItem', value }, new AbortController().signal)

  // The registry hands the contribution the captured value, so an invoked row
  // always yields its commands (an empty list here means the menu opens empty).
  assert.ok(MENU_IDS(resolve({ sessionId: 's1', kind: 'file', section: 'changes', path: 'src/app.js', cwd: '/repo' })).length > 0)
  const ids = (value) => MENU_IDS(resolve(value))

  // Unstaged files offer opening, staging, discarding, and copying both paths.
  const changes = resolve({ sessionId: 's1', kind: 'file', section: 'changes', path: 'src/app.js', cwd: '/repo' })
  assert.deepEqual(MENU_IDS(changes), ['open', 'stage', 'discard', 'copy-relative', 'copy-path'])
  assert.equal(changes[0].label, 'menu.openDiff')
  assert.equal(changes[1].label, 'actions.stage')
  assert.equal(changes[1].separatorBefore, true)
  assert.equal(changes[2].label, 'actions.discard')
  assert.equal(changes[2].danger, true)
  assert.equal(changes[3].label, 'menu.copyRelativePath')
  assert.equal(changes[4].label, 'menu.copyPath')

  // Staged files offer unstaging instead of staging and discarding.
  assert.deepEqual(ids({ sessionId: 's1', kind: 'file', section: 'staged', path: 'src/app.js', cwd: '/repo' }),
    ['open', 'unstage', 'copy-relative', 'copy-path'])
  // Conflicted files can be staged but not discarded.
  assert.deepEqual(ids({ sessionId: 's1', kind: 'file', section: 'merge', path: 'merge.txt', cwd: '/repo' }),
    ['open', 'stage', 'copy-relative', 'copy-path'])
  // A captured target without a path or session resolves to nothing.
  assert.deepEqual(ids({ sessionId: 's1', kind: 'file', section: 'changes' }), [])
  assert.deepEqual(ids({ kind: 'file', section: 'changes', path: 'a' }), [])

  // Folders act on everything below them.
  const folder = resolve({ sessionId: 's1', kind: 'folder', section: 'changes', path: 'src', paths: ['src/a.js', 'src/b.js'], cwd: '/repo' })
  assert.deepEqual(MENU_IDS(folder), ['stage-all', 'discard-all', 'copy-relative', 'copy-path'])
  assert.deepEqual(ids({ sessionId: 's1', kind: 'folder', section: 'staged', path: 'src', paths: ['src/a.js'], cwd: '/repo' }),
    ['unstage-all', 'copy-relative', 'copy-path'])
  assert.deepEqual(ids({ sessionId: 's1', kind: 'folder', section: 'changes', path: 'src', paths: [] }), [])

  // Group headers stage, unstage, discard, and refresh the whole group.
  assert.deepEqual(ids({ sessionId: 's1', kind: 'section', section: 'changes' }), ['stage-all', 'discard-all', 'refresh'])
  assert.deepEqual(ids({ sessionId: 's1', kind: 'section', section: 'staged' }), ['unstage-all', 'refresh'])
  assert.deepEqual(ids({ sessionId: 's1', kind: 'section', section: 'merge' }), ['stage-all'])
  const graphSection = resolve({ sessionId: 's1', kind: 'section', section: 'graph' })
  assert.deepEqual(MENU_IDS(graphSection), ['refresh'])
  assert.equal(graphSection[0].label, 'menu.refreshHistory')

  // Commit rows copy the full identifier and the message.
  const commit = resolve({ sessionId: 's1', kind: 'commit', oid: 'a'.repeat(40), shortOid: 'aaaaaaa', subject: 'Fix it' })
  assert.deepEqual(MENU_IDS(commit), ['copy-id', 'copy-message'])
  assert.equal(commit[0].label, 'menu.copyCommitId')
  assert.equal(commit[1].label, 'menu.copyCommitSubject')

  // The diff header copies the file's paths.
  assert.deepEqual(ids({ sessionId: 's1', kind: 'diff', path: 'src/app.js', cwd: '/repo' }),
    ['copy-relative', 'copy-path'])
  assert.deepEqual(ids({ sessionId: 's1', kind: 'diff', path: 'src/app.js' }), ['copy-relative'])

  // While the panel is busy, mutating actions are disabled and copies are not.
  const busyFile = resolve({ sessionId: 's1', kind: 'file', section: 'changes', path: 'src/app.js', cwd: '/repo', busy: true })
  assert.deepEqual(busyFile.filter((action) => action.disabled === true).map((action) => action.id),
    ['open', 'stage', 'discard'])
  assert.equal(busyFile.find((action) => action.id === 'copy-relative').disabled, undefined)
  const busySection = resolve({ sessionId: 's1', kind: 'section', section: 'changes', busy: true })
  assert.ok(busySection.every((action) => action.disabled === true))

  // Menu labels exist in both dictionaries.
  const dictionaries = []
  module.apply({
    effect(callback) { callback(); return () => {} },
    locale: { bind: () => translate, register(namespace, value) { dictionaries.push(value); return () => {} } },
    sidebarRightTabs: { register: () => () => {} },
    slots: { inject(_key, callback) { callback() }, register: () => () => {} },
    sidebarRight: { commandTarget: () => undefined, openTabFromTarget: () => {} },
    inject() {},
  })
  const twoDictionaries = dictionaries[0]
  for (const locale of ['en', 'zh']) {
    for (const key of ['menu.openDiff', 'menu.copyRelativePath', 'menu.copyPath', 'menu.copyCommitId',
      'menu.copyCommitSubject', 'menu.refreshHistory', 'menu.hint', 'menu.stale', 'menu.busy',
      'menu.copiedRelativePath', 'menu.copiedPath', 'menu.copiedCommitId', 'menu.copiedCommitSubject',
      'menu.copyFailed']) {
      assert.equal(typeof twoDictionaries[locale][key], 'string', `${locale} is missing ${key}`)
    }
  }
})

test('menu copy actions write the clipboard and report the result', async () => {
  if (registration === undefined) {
    globals = installGlobals()
    await import('../client.js')
    registration = globalThis.__gitGraphRegistration
  }
  const module = registration.factory((specifier) => {
    if (specifier === 'react') return fakeReact
    throw new Error(`unexpected require("${specifier}")`)
  })
  const { contributions, notifications, contextMenus } = applyWithMenuService(module)
  const contribution = contributions[0]
  assert.equal(typeof contribution.resolve, 'function')
  const resolve = (value) => contextMenus.resolve({ kind: 'gitGraphItem', value }, new AbortController().signal)
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const copied = []
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: async (text) => { copied.push(text) } } },
      configurable: true,
    })
    const file = resolve({ sessionId: 's1', kind: 'file', section: 'changes', path: 'src/app.js', cwd: '/repo' })
    await file.find((action) => action.id === 'copy-relative').run()
    assert.deepEqual(copied, ['src/app.js'])
    assert.deepEqual(notifications.pop(), { text: 'menu.copiedRelativePath', success: true })
    await file.find((action) => action.id === 'copy-path').run()
    assert.deepEqual(copied, ['src/app.js', '/repo/src/app.js'])
    assert.deepEqual(notifications.pop(), { text: 'menu.copiedPath', success: true })

    const commit = resolve({ sessionId: 's1', kind: 'commit', oid: 'a'.repeat(40), shortOid: 'aaaaaaa', subject: 'Fix it' })
    await commit.find((action) => action.id === 'copy-id').run()
    assert.equal(copied.at(-1), 'a'.repeat(40))
    assert.deepEqual(notifications.pop(), { text: 'menu.copiedCommitId', success: true })
    await commit.find((action) => action.id === 'copy-message').run()
    assert.equal(copied.at(-1), 'Fix it')
    assert.deepEqual(notifications.pop(), { text: 'menu.copiedCommitSubject', success: true })

    // A Windows working directory keeps native separators in the copied path.
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: async (text) => { copied.push(text) } } },
      configurable: true,
    })
    const windowsFile = resolve({ sessionId: 's1', kind: 'file', section: 'changes', path: 'src/app.js', cwd: 'C:\\repo' })
    await windowsFile.find((action) => action.id === 'copy-path').run()
    assert.equal(copied.at(-1), 'C:\\repo\\src\\app.js')

    // A refusing clipboard is reported instead of being ignored.
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: async () => { throw new Error('denied') } } },
      configurable: true,
    })
    await file.find((action) => action.id === 'copy-relative').run()
    assert.deepEqual(notifications.pop(), { text: 'menu.copyFailed', success: false })
  } finally {
    if (previousNavigator === undefined) delete globalThis.navigator
    else Object.defineProperty(globalThis, 'navigator', previousNavigator)
  }
})
