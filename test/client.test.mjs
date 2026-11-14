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
