#!/usr/bin/env node
/** Check captured-value menu semantics against a real, explicitly located DSH installation. */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DSH_ROOT = '/opt/DeepSeek Harness/resources/app/dsh'
const REGISTRY_PACKAGE = '@deepseek-ai/dsh-client-ui-context-menu'
const REGISTRY_CLIENT = join('node_modules', REGISTRY_PACKAGE, 'lib', 'client.js')
const PLUGIN_CLIENT = resolve(SCRIPT_DIR, '..', 'client.js')

interface Artifact {
  apply(context: unknown): void
}
interface Registration {
  factory(requireDependency: (specifier: string) => unknown): Artifact
}
interface MenuView {
  id: string
  label: string
}
interface ContextMenus {
  resolve(target: { kind: string; value: object }): {
    ready: Promise<void>
    source: { getSnapshot(): MenuView[] }
    dispose(): void
  }
}
interface ReactRuntime {
  Fragment: unknown
}

/** Print a concise diagnostic and preserve a failing exit status. */
function fail(message: string): never {
  console.error(`verify-contract: ${message}`)
  process.exit(1)
}

/** Explicit CLI path, environment override, then the packaged Desktop default. */
function dshRoot(argv: string[]): string {
  const index = argv.findIndex((arg) => arg === '--dsh-root' || arg.startsWith('--dsh-root='))
  if (index === -1) return resolve(process.env.DSH_ROOT ?? DEFAULT_DSH_ROOT)
  const argument = argv[index]
  const value = argument.includes('=') ? argument.slice(argument.indexOf('=') + 1) : argv[index + 1]
  if (!value || value.startsWith('--')) fail('--dsh-root requires a directory path')
  return resolve(value)
}

const inert = () => {}
const browser = {
  window: {
    __ModuleLoader__: undefined as { load(value: Registration): void } | undefined,
    addEventListener: inert,
    removeEventListener: inert,
  },
  document: {
    querySelector: () => null,
    createElement: () => ({ textContent: '', setAttribute: inert, appendChild: inert }),
    head: { appendChild: inert },
    body: { appendChild: inert },
    activeElement: null,
    visibilityState: 'visible',
    execCommand: () => false,
    addEventListener: inert,
    removeEventListener: inert,
  },
}

/** Evaluate trusted installed artifacts in a non-rendering browser boundary. */
function loadArtifact(file: string, requireDependency: (specifier: string) => unknown): Artifact {
  let registration: Registration | undefined
  browser.window.__ModuleLoader__ = {
    load(value) {
      registration = value
    },
  }
  try {
    new Function('window', 'document', readFileSync(file, 'utf8'))(browser.window, browser.document)
  } finally {
    browser.window.__ModuleLoader__ = undefined
  }
  if (typeof registration?.factory !== 'function') throw new Error(`${file} has no module factory`)
  return registration.factory(requireDependency)
}

/** The contract check never renders; React is normally supplied by the Web shell. */
function inertReact() {
  return {
    createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({
      type,
      props,
      children,
    }),
    Fragment: Symbol('Fragment'),
    useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial, inert],
    useEffect: inert,
    useMemo: (factory: () => unknown) => factory(),
    useCallback: (callback: unknown) => callback,
    useRef: (value: unknown) => ({ current: value }),
    useId: () => 'react-id',
    useContext: () => undefined,
    createContext: (value: unknown) => ({ Provider: null, Consumer: null, defaultValue: value }),
  }
}

/** Only these browser shell capabilities are touched while registering contributions. */
function shellStubs() {
  const store = {
    createSnapshotStore(initial: unknown) {
      let value = initial
      return {
        getSnapshot: () => value,
        set(next: unknown) {
          value = next
        },
        subscribe: () => inert,
      }
    },
    defineStore({
      init,
      actions,
    }: {
      init(): unknown
      actions: Record<string, (state: unknown, ...args: unknown[]) => unknown>
    }) {
      return {
        create() {
          const state = init()
          return {
            getSnapshot: () => state,
            actions: Object.fromEntries(
              Object.entries(actions).map(([name, action]) => [
                name,
                (...args: unknown[]) => action(state, ...args),
              ]),
            ),
          }
        },
      }
    },
  }
  const primitives = new Proxy<Record<string, unknown>>(
    {
      MENU_TRANSITION_MS: { prepare: 0, replace: 0, dismiss: 0 },
    },
    { get: (target, key: string) => target[key] ?? (() => null) },
  )
  return { store, primitives }
}

/** Resolve the actual dictionaries registered by the plugin. */
function createLocale() {
  const dictionaries = new Map<string, Record<string, Record<string, string>>>()
  return {
    register(namespace: string, value: Record<string, Record<string, string>>) {
      dictionaries.set(namespace, value)
      return inert
    },
    bind: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
      const text = dictionaries.get(namespace)?.en?.[key] ?? key
      return Object.entries(params ?? {}).reduce(
        (out, [name, value]) => out.replaceAll(`{${name}}`, String(value)),
        text,
      )
    },
  }
}

/** Instantiate DSH's real registry; fake only its unrelated shell dependencies. */
function createRegistry(
  root: string,
  dependencies: Record<string, unknown>,
  locale: ReturnType<typeof createLocale>,
): ContextMenus {
  const provided: Record<string, unknown> = {}
  const context = {
    effect: (callback: () => unknown) => callback(),
    locale,
    shortcuts: { catalog: [] },
    provide: (name: string, value: unknown) => {
      provided[name] = value
    },
    slots: {
      register: inert,
      registerFactory: inert,
      provideRoot: inert,
      inject: (_name: string, callback: () => void) => callback(),
    },
  }
  loadArtifact(join(root, REGISTRY_CLIENT), (specifier) => {
    if (specifier in dependencies) return dependencies[specifier]
    throw new Error(`unexpected require("${specifier}") from ${REGISTRY_PACKAGE}`)
  }).apply(context)
  const service = provided.contextMenus
  if (
    typeof service !== 'object' ||
    service === null ||
    !('resolve' in service) ||
    typeof service.resolve !== 'function'
  ) {
    throw new Error(`${REGISTRY_PACKAGE} did not provide contextMenus`)
  }
  // An installed JavaScript artifact is the single dynamic boundary of this integration test.
  return service as ContextMenus
}

/** Cover the services used by our plugin's apply without rendering the panel. */
function createPluginContext(contextMenus: ContextMenus, locale: ReturnType<typeof createLocale>) {
  const base = {
    effect: (callback: () => unknown) => callback(),
    locale,
    contextMenus,
    sidebarRight: {},
    sidebarRightTabs: { register: inert },
    slots: { inject: (_name: string, callback: () => void) => callback(), register: inert },
  }
  return {
    ...base,
    inject: (required: string[], callback: (context: object) => unknown) =>
      callback(required.includes('shortcuts') ? { ...base, shortcuts: { register: inert } } : base),
  }
}

/** Targets mirror what rows capture, not what a contribution assumes it receives. */
function scenarios() {
  const sessionId = 'session-verify',
    panelId = 'git-panel-verify'
  const cwd = '/home/example/project',
    path = 'src/client/menu/actions.ts'
  const change = (kind: string, detail: object) => ({
    sessionId,
    kind,
    cwd,
    busy: false,
    panelId,
    ...detail,
  })
  return [
    {
      name: 'changed file row',
      expected: ['open', 'stage', 'discard', 'copy-relative', 'copy-path'],
      value: change('file', { section: 'changes', path }),
    },
    {
      name: 'commit-details file row',
      expected: ['copy-relative', 'copy-path'],
      value: change('commitFile', { section: 'commit', path }),
    },
    {
      name: 'changes group header',
      expected: ['stage-all', 'discard-all', 'refresh'],
      value: { sessionId, kind: 'section', section: 'changes', busy: false, panelId },
    },
    {
      name: 'commit row',
      expected: ['copy-id', 'copy-message'],
      value: {
        sessionId,
        kind: 'commit',
        oid: '7cac4e6b1f9d2a6e0b4c8d7a5f3e1c9b',
        shortOid: '7cac4e6',
        subject: 'Fix empty context menus',
      },
    },
    {
      name: 'diff header',
      expected: ['copy-relative', 'copy-path'],
      value: { sessionId, kind: 'diff', path, cwd },
    },
  ]
}

async function main(): Promise<void> {
  const root = dshRoot(process.argv.slice(2))
  if (!existsSync(root) || !statSync(root).isDirectory())
    fail(`DSH installation not found at ${root}; pass --dsh-root <path> or set DSH_ROOT`)
  if (!existsSync(join(root, REGISTRY_CLIENT))) fail(`context-menu registry not found at ${root}`)
  if (!existsSync(PLUGIN_CLIENT)) fail(`plugin artifact not found; run pnpm build`)
  const locale = createLocale()
  let react: ReactRuntime | undefined, jsxRuntime: unknown
  try {
    const fromRoot = createRequire(join(root, 'package.json'))
    react = fromRoot('react') as ReactRuntime
    jsxRuntime = fromRoot('react/jsx-runtime')
  } catch {
    /* Packaged DSH can omit React; the Web shell supplies it. */
  }
  const installed = react !== undefined
  react ??= inertReact()
  jsxRuntime ??= { Fragment: react.Fragment, jsx: () => null, jsxs: () => null }
  const stubs = shellStubs()
  const dependencies = {
    react,
    'react/jsx-runtime': jsxRuntime,
    '@deepseek-ai/dsh-client-store': stubs.store,
    '@deepseek-ai/dsh-client-ui-primitives': stubs.primitives,
  }
  const contextMenus = createRegistry(root, dependencies, locale)
  loadArtifact(PLUGIN_CLIENT, (specifier) => {
    if (specifier === 'react') return react
    throw new Error(`undeclared plugin external: ${specifier}`)
  }).apply(createPluginContext(contextMenus, locale))
  console.log(`verify-contract: ${REGISTRY_PACKAGE} — ${join(root, REGISTRY_CLIENT)}`)
  console.log(`  React: ${installed ? 'installed' : 'inert stand-in (Web shell seeds React)'}`)
  let total = 0
  const failures: string[] = []
  for (const scenario of scenarios()) {
    const resolution = contextMenus.resolve({ kind: 'gitGraphItem', value: scenario.value })
    try {
      await resolution.ready
      const views = resolution.source.getSnapshot()
      const ids = views.map((view) => view.id)
      const expected = scenario.expected.map((action) => `git-graph.actions/${action}`)
      for (const id of expected)
        if (!ids.includes(id)) failures.push(`${scenario.name}: missing ${id}`)
      for (const view of views) {
        if (typeof view.label !== 'string' || !view.label)
          failures.push(`${scenario.name}: ${view.id} has no label`)
      }
      total += views.length
      console.log(`${scenario.name}: ${views.length} commands — ${ids.join(', ')}`)
    } finally {
      resolution.dispose()
    }
  }
  if (failures.length) fail(failures.join('\n'))
  console.log(
    `verify-contract: OK — 5 targets, ${total} commands resolved through the real registry`,
  )
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)))
