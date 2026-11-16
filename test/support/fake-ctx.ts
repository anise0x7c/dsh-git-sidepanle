/**
 * Shared fakes for the browser-half bundle tests.
 *
 * `loadClientBundle` installs the minimal browser host the artifact expects and
 * evaluates it once; `createFakeContext` builds the recording Cordis plugin
 * context the bundle's `apply` receives; `createMenuService` is a stand-in for
 * the host's shared context-menu registry.
 *
 * The menu stand-in mirrors the shipped registry, not the bundle's assumptions:
 * `register` stores a contribution by target family, and `resolve(target)` calls
 * the contribution with the **captured target's value** — never with the
 * `{ kind, value }` wrapper the trigger received. It returns an owned occurrence
 * `{ dispose, ready, select, source }`; `source.getSnapshot()` exposes
 * presentation-only action views whose ids are `<contributionId>/<actionId>`,
 * and `select(id)` executes the captured callback once. Encoding the wrong shape
 * here is exactly how the empty-menu defect fixed in 7cac4e6 stayed hidden.
 */
import assert from 'node:assert/strict'
import type { ComponentType } from 'react'
import type {
  CapturedTarget,
  ClientContext,
  ClientModule,
  ClientRegistration,
  ContextMenuAction,
  ContextMenuContribution,
  FakeContext,
  FakeRecords,
  LoadedBrowser,
  LocaleBinder,
  LocaleDictionaries,
  LocaleParams,
  MenuNotification,
  MenuResolution,
  MenuService,
  SlotRegisterOptions,
  StyleTagStub,
  TestComponent,
  TestContextMenusService,
  TestMenuActionView,
} from './types.ts'

/**
 * Translation stand-in: returns the key, filling `{name}` placeholders when the
 * caller passes parameters (the real binder interpolates them too).
 * @param key - dictionary key.
 * @param params - interpolation parameters.
 * @returns translated text.
 */
export function translate(key: string, params?: LocaleParams): string {
  if (params === undefined) return key
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    key,
  )
}

/** Browser globals and the artifact registration, filled once. */
let browser: LoadedBrowser | undefined

/**
 * Install the browser globals the artifact touches and evaluate `client.js`.
 * Idempotent: later calls return the same registration and style-tag recorder.
 * @returns loaded bundle.
 */
export async function loadClientBundle(): Promise<LoadedBrowser> {
  if (browser !== undefined) return browser
  const styleTags: StyleTagStub[] = []
  let registration: ClientRegistration | undefined
  /** Find one style tag by the attribute selector the plugin uses. */
  const findStyle = (selector: string): StyleTagStub | null => {
    const match = /^style\[data-plugin=(.+)\]$/.exec(selector)
    if (match === null) return null
    let wanted = match[1] ?? ''
    if (
      (wanted.startsWith('"') && wanted.endsWith('"')) ||
      (wanted.startsWith("'") && wanted.endsWith("'"))
    ) {
      wanted = wanted.slice(1, -1)
    }
    return styleTags.find((tag) => tag.getAttribute('data-plugin') === wanted) ?? null
  }
  const head: import('./types.ts').DocumentStub['head'] = {
    appendChild(tag) {
      if (!styleTags.includes(tag)) styleTags.push(tag)
    },
    removeChild(tag) {
      const index = styleTags.indexOf(tag)
      if (index !== -1) styleTags.splice(index, 1)
    },
    querySelector: findStyle,
    contains: (tag) => styleTags.includes(tag),
  }
  const globals = globalThis as unknown as {
    window: { __ModuleLoader__: { load(value: ClientRegistration): void } }
    document: import('./types.ts').DocumentStub
    fetch: import('./types.ts').FetchLike
  }
  globals.window = {
    __ModuleLoader__: {
      load(value) {
        registration = value
      },
    },
  }
  globals.document = {
    querySelector: findStyle,
    addEventListener() {},
    removeEventListener() {},
    createElement() {
      const attributes: Record<string, string> = {}
      const tag: StyleTagStub = {
        dataset: {},
        attributes,
        textContent: '',
        setAttribute(name, value) {
          attributes[name] = value
        },
        getAttribute(name) {
          return attributes[name] ?? null
        },
        appendChild() {},
        remove() {
          head.removeChild(tag)
        },
      }
      return tag
    },
    head,
  }
  globals.fetch = async () => {
    throw new Error('fetch is not exercised here')
  }
  // A variable URL keeps TypeScript from resolving the generated artifact as a
  // source module; the runtime still executes the committed bundle.
  await import(new URL('../../client.js', import.meta.url).href)
  assert.ok(registration !== undefined, 'the artifact did not call window.__ModuleLoader__.load')
  browser = { registration, styleTags }
  return browser
}

/** One nested action shape the stand-in projects. */
interface NestedAction extends ContextMenuAction {
  children?: readonly NestedAction[]
}

/** Read a human message from an unknown rejection, as the registry reports it. */
function failureText(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message
  return 'contextMenu.failed'
}

/**
 * Stand-in for the shared context-menu registry.
 *
 * Registered contributions are matched by target family and resolved with the
 * captured target's value, as the shipped registry does. The returned record
 * also exposes test conveniences (`views`, `select`) outside the service object,
 * so tests exercise the same host-shaped `resolve` the real page uses.
 * @returns `contextMenus` stand-in plus recorders and helpers.
 */
export function createMenuService(): MenuService {
  const contributions: ContextMenuContribution[] = []
  const notifications: MenuNotification[] = []

  const contextMenus: TestContextMenusService = {
    register(contribution) {
      const duplicate = contributions.find(
        (candidate) => candidate.target === contribution.target && candidate.id === contribution.id,
      )
      if (duplicate !== undefined)
        throw new Error(`Duplicate menu contribution: ${contribution.target}/${contribution.id}`)
      contributions.push(contribution)
      return () => {
        const index = contributions.indexOf(contribution)
        if (index !== -1) contributions.splice(index, 1)
      }
    },
    notify(text, success = false) {
      notifications.push({ text, success })
    },
    resolve(target) {
      const providers = contributions
        .filter((contribution) => contribution.target === target.kind)
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
      const lifetime = new AbortController()
      const callbacks = new Map<
        string,
        { contribution: ContextMenuContribution; action: NestedAction }
      >()
      const pending: Array<Promise<unknown>> = []
      const views: TestMenuActionView[] = []
      const accept = (
        contribution: ContextMenuContribution,
        actions: readonly ContextMenuAction[],
      ) => {
        if (lifetime.signal.aborted) return
        const project = (action: NestedAction, parent: string): TestMenuActionView => {
          const id = `${parent}/${encodeURIComponent(action.id)}`
          callbacks.set(id, { contribution, action })
          const { run: _run, failureLabel: _failureLabel, children, ...view } = action
          return {
            ...view,
            id,
            ...(children === undefined
              ? {}
              : { children: children.map((child) => project(child, id)) }),
          }
        }
        views.push(
          ...(actions as readonly NestedAction[]).map((action) =>
            project(action, encodeURIComponent(contribution.id)),
          ),
        )
      }
      for (const contribution of providers) {
        let result: ReturnType<ContextMenuContribution['resolve']>
        try {
          result = contribution.resolve(target.value, lifetime.signal)
        } catch (error) {
          notifications.push({ text: failureText(error), success: false })
          continue
        }
        if (result instanceof Promise) {
          pending.push(
            result.then(
              (actions) => accept(contribution, actions),
              (error) => notifications.push({ text: failureText(error), success: false }),
            ),
          )
        } else {
          accept(contribution, result ?? [])
        }
      }
      const dispose = () => {
        if (lifetime.signal.aborted) return
        lifetime.abort()
        callbacks.clear()
      }
      return {
        dispose,
        ready: Promise.all(pending).then(() => {}),
        source: { getSnapshot: () => views },
        select(id) {
          const selected = callbacks.get(id)
          if (lifetime.signal.aborted || selected === undefined) return
          if (selected.action.disabled || selected.action.children !== undefined) return
          dispose()
          try {
            const result = selected.action.run?.()
            if (result instanceof Promise) {
              result.catch(() =>
                notifications.push({
                  text: selected.action.failureLabel ?? 'contextMenu.failed',
                  success: false,
                }),
              )
            }
          } catch (error) {
            notifications.push({
              text: selected.action.failureLabel ?? failureText(error),
              success: false,
            })
          }
        },
      }
    },
  }

  return {
    contextMenus,
    contributions,
    notifications,
    /**
     * Presentation views the shared overlay would render for a captured target.
     * A contribution that resolves synchronously publishes during `resolve`, so
     * the snapshot is populated immediately.
     * @param target - captured trigger target.
     * @returns action views.
     */
    views(target: CapturedTarget): TestMenuActionView[] {
      const resolution: MenuResolution = contextMenus.resolve(target)
      const snapshot = resolution.source.getSnapshot()
      resolution.dispose()
      return snapshot
    },
    /**
     * Select one resolved action and wait for its callback's asynchronous work.
     * The host's `select` returns void, so tests settle one macrotask afterwards.
     * @param target - captured trigger target.
     * @param id - resolved action id (`<contributionId>/<actionId>`).
     */
    async select(target: CapturedTarget, id: string): Promise<void> {
      const resolution = contextMenus.resolve(target)
      const view = resolution.source.getSnapshot().find((candidate) => candidate.id === id)
      assert.ok(view, `no context-menu action "${id}"`)
      resolution.select(id)
      await new Promise<void>((resolve) => {
        setImmediate(resolve)
      })
    },
  }
}

/**
 * Build a recording Cordis plugin context for the bundle's `apply`.
 * @param options - context options.
 * @param options.sidebarRight - sidebarRight service stand-in.
 * @returns context, recorders, menu service.
 */
export function createFakeContext(
  options: { sidebarRight?: ClientContext['sidebarRight'] } = {},
): FakeContext {
  const menu = createMenuService()
  const records: FakeRecords = {
    localeDictionaries: [],
    tabTypes: [],
    slots: [],
    shortcuts: [],
  }
  const locale: ClientContext['locale'] = {
    bind: (): LocaleBinder => translate,
    register(namespace: string, dictionaries: LocaleDictionaries) {
      records.localeDictionaries.push({ namespace, dictionaries })
      return () => {}
    },
  }
  const sidebarRightTabs: ClientContext['sidebarRightTabs'] = {
    register(definition) {
      records.tabTypes.push(definition)
      return () => {}
    },
  }
  const slots: ClientContext['slots'] = {
    inject<Result>(_name: string, callback: () => Result) {
      const cleanup = callback()
      return () => {
        if (typeof cleanup === 'function') (cleanup as () => void)()
      }
    },
    register<Props extends object>(
      slotOptions: SlotRegisterOptions,
      component: ComponentType<Props>,
    ) {
      records.slots.push({ options: slotOptions, component: component as unknown as TestComponent })
      return () => {}
    },
  }
  const shortcuts: NonNullable<ClientContext['shortcuts']> = {
    register(definition) {
      records.shortcuts.push(definition)
      return () => {}
    },
  }
  const base: Omit<ClientContext, 'inject'> = {
    effect(callback, _label) {
      const cleanup = callback()
      return () => {
        if (typeof cleanup === 'function') cleanup()
      }
    },
    locale,
    sidebarRightTabs,
    slots,
    sidebarRight: options.sidebarRight ?? {
      commandTarget: () => undefined,
      openTabFromTarget: () => {},
    },
  }
  const ctx: ClientContext = {
    ...base,
    inject(services, callback) {
      const names = services as readonly string[]
      if (names.includes('shortcuts')) {
        callback({ ...ctx, shortcuts } as unknown as Parameters<typeof callback>[0])
      }
      if (names.includes('contextMenus')) {
        callback({ ...ctx, contextMenus: menu.contextMenus } as unknown as Parameters<
          typeof callback
        >[0])
      }
    },
  }
  return { ctx, records, menu }
}

/** Re-export the module shape used by tests that evaluate the bundle factory. */
export type { ClientModule }
