#!/usr/bin/env node
/**
 * Regression gate for AGENTS.md contract 2: the shared context-menu registry
 * calls a contribution's `resolve` with the captured target's value, never the
 * `{ kind, value }` wrapper the trigger received. Double-unwrapping is the
 * 7cac4e6 empty-menu defect. This script swaps the unit-test doubles for the
 * REAL installed registry: load DSH's `dsh-client-ui-context-menu` client
 * artifact through a fake `window.__ModuleLoader__`, run its `apply`, hand the
 * real `contextMenus` service to this bundle's contribution, then resolve the
 * targets the panel captures. Node built-ins only, no network, no DOM.
 * Usage: node scripts/verify-contract.mjs [--dsh-root <path>]
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DSH_ROOT = '/opt/DeepSeek Harness/resources/app/dsh'
const REGISTRY_PACKAGE = '@deepseek-ai/dsh-client-ui-context-menu'
const REGISTRY_CLIENT = join('node_modules', '@deepseek-ai', 'dsh-client-ui-context-menu', 'lib', 'client.js')
const STORE_PACKAGE = '@deepseek-ai/dsh-client-store'
const PRIMITIVES_PACKAGE = '@deepseek-ai/dsh-client-ui-primitives'
const MENU_TARGET = 'gitGraphItem'
const CONTRIBUTION_ID = 'git-graph.actions'
const PLUGIN_CLIENT = resolve(SCRIPT_DIR, '..', 'client.js')

/** Print one diagnostic line and exit non-zero, without a stack trace. */
function fail(message) {
  console.error(`verify-contract: ${message}`)
  process.exit(1)
}

/** Resolve the installation: `--dsh-root <path>`, `--dsh-root=<path>`, `DSH_ROOT`, else the desktop default. */
function dshRoot(argv) {
  const index = argv.findIndex((argument) => argument === '--dsh-root' || argument.startsWith('--dsh-root='))
  if (index === -1) return resolve(process.env.DSH_ROOT ?? DEFAULT_DSH_ROOT)
  const value = argv[index].includes('=') ? argv[index].slice(argv[index].indexOf('=') + 1) : argv[index + 1]
  if (value === undefined || value === '' || value.startsWith('--')) fail('--dsh-root requires a directory path')
  return resolve(value)
}

/** Install the inert browser globals the client artifacts touch while loading. */
function installBrowserGlobals() {
  const inert = () => {}
  globalThis.window = { __ModuleLoader__: undefined, addEventListener: inert, removeEventListener: inert }
  globalThis.document = {
    querySelector: () => null, createElement: () => ({ textContent: '', setAttribute: inert, appendChild: inert }),
    head: { appendChild: inert }, body: { appendChild: inert }, activeElement: null, visibilityState: 'visible',
    execCommand: () => false, addEventListener: inert, removeEventListener: inert,
  }
}

/** Inert React substitute: a packaged installation may ship no react because the Web shell seeds it. */
function inertReact() {
  const createElement = (type, props, ...children) => ({ type, props: props ?? {}, children })
  return { createElement, Fragment: Symbol('Fragment'),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {}, useMemo: (factory) => factory(), useCallback: (callback) => callback,
    useRef: (value) => ({ current: value }), useId: () => 'react-id', useContext: () => undefined,
    createContext: (value) => ({ Provider: null, Consumer: null, defaultValue: value }) }
}

/** Stand-ins for the registry's browser-only shell deps; the contract check never renders. */
function shellStubs() {
  const store = {
    createSnapshotStore(initial) {
      let value = initial
      return { getSnapshot: () => value, set(next) { value = next }, subscribe: () => () => {} }
    },
    defineStore: ({ init, actions }) => ({
      create() {
        const state = init()
        return { getSnapshot: () => state, actions: Object.fromEntries(Object.entries(actions).map(([name, action]) => [name, (...args) => action(state, ...args)])) }
      },
    }),
  }
  const primitives = new Proxy({ MENU_TRANSITION_MS: { prepare: 0, replace: 0, dismiss: 0 } }, { get: (target, key) => target[key] ?? (() => null) })
  return { store, primitives }
}

/** Evaluate one DSH client artifact through a fake module loader. */
function loadArtifact(file, requireDependency) {
  let registration
  globalThis.window.__ModuleLoader__ = { load(value) { registration = value } }
  try {
    new Function(readFileSync(file, 'utf8'))()
  } finally {
    globalThis.window.__ModuleLoader__ = undefined
  }
  if (typeof registration?.factory !== 'function') throw new Error(`${file} did not call window.__ModuleLoader__.load({ factory })`)
  return registration.factory(requireDependency)
}

/** Locale service resolving the dictionaries the plugins register. */
function createLocale() {
  const dictionaries = new Map()
  return {
    register(namespace, value) { dictionaries.set(namespace, value); return () => {} },
    bind: (namespace) => (key, params) => {
      const text = dictionaries.get(namespace)?.en?.[key] ?? key
      return params === undefined ? text : Object.entries(params).reduce((out, [name, value]) => out.replaceAll(`{${name}}`, String(value)), text)
    },
  }
}

/** Instantiate the real installed context-menu registry and run its plugin apply. */
function createRegistry(root, dependencies, locale) {
  const provided = {}
  const context = {
    effect: (callback) => callback(), locale, shortcuts: { catalog: [] }, provide: (name, value) => { provided[name] = value },
    slots: { register() {}, registerFactory() {}, provideRoot() {}, inject(_name, callback) { callback() } },
  }
  const artifact = loadArtifact(join(root, REGISTRY_CLIENT), (specifier) => {
    if (dependencies[specifier] !== undefined) return dependencies[specifier]
    throw new Error(`unexpected require("${specifier}") from ${REGISTRY_PACKAGE}`)
  })
  artifact.apply(context)
  if (typeof provided.contextMenus?.resolve !== 'function') throw new Error(`${REGISTRY_PACKAGE} did not provide contextMenus`)
  return provided.contextMenus
}

/** Fake Cordis plugin context covering the services `apply` touches, exposing the real contextMenus. */
function createPluginContext({ contextMenus, locale }) {
  const base = { effect(callback) { callback() }, locale, contextMenus, sidebarRight: {}, sidebarRightTabs: { register() {} },
    slots: { inject(_name, callback) { callback() }, register() {} } }
  return { ...base, inject: (required, callback) => callback(required.includes('shortcuts') ? { ...base, shortcuts: { register() {} } } : base) }
}

/** Captured `{ kind, value }` targets exactly as the panel's triggers capture them. */
function scenarios() {
  const sessionId = 'session-verify', panelId = 'git-panel-verify'
  const cwd = '/home/example/project'
  const path = 'src/client/menu/actions.js'
  const change = (kind, detail) => ({ sessionId, kind, cwd, busy: false, panelId, ...detail })
  return [
    { name: 'changed file row', expected: ['open', 'stage', 'discard', 'copy-relative', 'copy-path'],
      value: change('file', { section: 'changes', path }) },
    { name: 'commit-details file row', expected: ['copy-relative', 'copy-path'],
      value: change('commitFile', { section: 'commit', path }) },
    { name: 'changes group header', expected: ['stage-all', 'discard-all', 'refresh'], value: { sessionId, kind: 'section', section: 'changes', busy: false, panelId } },
    { name: 'commit row', expected: ['copy-id', 'copy-message'],
      value: { sessionId, kind: 'commit', oid: '7cac4e6b1f9d2a6e0b4c8d7a5f3e1c9b', shortOid: '7cac4e6', subject: 'Fix empty context menus' } },
    { name: 'diff header', expected: ['copy-relative', 'copy-path'], value: { sessionId, kind: 'diff', path, cwd } },
  ]
}

/** Resolve every target, print ids/labels/table, and exit non-zero on any miss. */
async function main() {
  const root = dshRoot(process.argv.slice(2))
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    fail(`DSH installation not found at ${root}; pass --dsh-root <path> or set DSH_ROOT`)
  }
  const registryClient = join(root, REGISTRY_CLIENT)
  if (!existsSync(registryClient)) fail(`context-menu registry not found at ${registryClient}; is this a DSH installation?`)
  if (!existsSync(PLUGIN_CLIENT)) fail(`plugin artifact not found at ${PLUGIN_CLIENT}; run the build first`)

  installBrowserGlobals()
  const locale = createLocale()
  let fromRoot, react, jsxRuntime
  try {
    fromRoot = createRequire(join(root, 'package.json'))
    react = fromRoot('react')
    jsxRuntime = fromRoot('react/jsx-runtime')
  } catch {}
  const installed = react !== undefined
  react ??= inertReact()
  jsxRuntime ??= { Fragment: react.Fragment, jsx: () => null, jsxs: () => null }
  const stubs = shellStubs()
  const dependencies = { react, 'react/jsx-runtime': jsxRuntime, [STORE_PACKAGE]: stubs.store, [PRIMITIVES_PACKAGE]: stubs.primitives }
  const contextMenus = createRegistry(root, dependencies, locale)
  const plugin = loadArtifact(PLUGIN_CLIENT, (specifier) => {
    if (specifier === 'react') return react
    throw new Error(`the plugin artifact requires "${specifier}", which this bundle does not declare`)
  })
  plugin.apply(createPluginContext({ contextMenus, locale }))

  const label = installed ? 'installed in the DSH installation' : 'inert stand-in (the Web shell seeds React)'
  console.log(`verify-contract: ${REGISTRY_PACKAGE} — ${registryClient}`)
  console.log(`  dsh root: ${root} | react: ${label} | shell deps: inert stand-ins`)

  const rows = [], failures = []
  for (const scenario of scenarios()) {
    const target = { kind: MENU_TARGET, value: scenario.value }
    let views
    try {
      const resolution = contextMenus.resolve(target)
      await resolution.ready
      views = resolution.source.getSnapshot()
      resolution.dispose()
    } catch (error) {
      failures.push(`${scenario.name}: resolving threw — ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    const ids = views.map((view) => view.id)
    const expected = scenario.expected.map((action) => `${CONTRIBUTION_ID}/${action}`)
    const missing = expected.filter((id) => !ids.includes(id))
    if (views.length === 0) failures.push(`${scenario.name}: no commands resolved (expected ${expected.join(', ')})`)
    else if (missing.length > 0) failures.push(`${scenario.name}: missing ${missing.join(', ')} (resolved ${ids.join(', ')})`)
    for (const view of views) if (typeof view.label !== 'string' || view.label === '') failures.push(`${scenario.name}: "${view.id}" has no label`)
    const width = views.reduce((size, view) => Math.max(size, view.id.length), 0)
    console.log(`\n${scenario.name} → ${views.length} command(s)`)
    for (const view of views) console.log(`  ${view.id.padEnd(width)}  ${view.label}`)
    rows.push({ name: scenario.name, count: views.length, ids })
  }

  console.log('\ntarget                   | count | ids')
  console.log('------------------------ | ----- | ---')
  for (const row of rows) console.log(`${row.name.padEnd(24)} | ${String(row.count).padEnd(5)} | ${row.ids.join(', ') || '—'}`)

  if (failures.length > 0) {
    console.error('\nverify-contract: FAILED')
    for (const failure of failures) console.error(`  ${failure}`)
    process.exit(1)
  }
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  console.log(`\nverify-contract: OK — ${rows.length} targets, ${total} commands resolved through the real registry`)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
