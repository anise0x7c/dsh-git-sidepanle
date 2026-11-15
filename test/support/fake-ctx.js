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

/**
 * Translation stand-in: returns the key, filling `{name}` placeholders when the
 * caller passes parameters (the real binder interpolates them too).
 * @param {string} key - dictionary key.
 * @param {object} [params] - interpolation parameters.
 * @returns {string} translated text.
 */
export function translate(key, params) {
  if (params === undefined) return key
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), key)
}

/** @type {{registration: object, styleTags: object[]} | undefined} */
let browser

/**
 * Install the browser globals the artifact touches and evaluate `client.js`.
 * Idempotent: later calls return the same registration and style-tag recorder.
 * @returns {Promise<{registration: object, styleTags: object[]}>} loaded bundle.
 */
export async function loadClientBundle() {
  if (browser === undefined) {
    const styleTags = []
    let registration
    globalThis.window = {
      __ModuleLoader__: {
        load(value) { registration = value },
      },
    }
    globalThis.document = {
      querySelector() { return null },
      addEventListener() {},
      removeEventListener() {},
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
    await import('../../client.js')
    browser = { registration, styleTags }
  }
  return browser
}

/**
 * Stand-in for the shared context-menu registry.
 *
 * Registered contributions are matched by target family and resolved with the
 * captured target's value, as the shipped registry does. The returned record
 * also exposes test conveniences (`views`, `select`) outside the service object,
 * so tests exercise the same host-shaped `resolve` the real page uses.
 * @returns {object} `contextMenus` stand-in plus recorders and helpers.
 */
export function createMenuService() {
  const contributions = []
  const notifications = []

  const contextMenus = {
    register(contribution) {
      const duplicate = contributions.find((candidate) =>
        candidate.target === contribution.target && candidate.id === contribution.id)
      if (duplicate !== undefined) throw new Error(`Duplicate menu contribution: ${contribution.target}/${contribution.id}`)
      contributions.push(contribution)
      return () => {
        const index = contributions.indexOf(contribution)
        if (index !== -1) contributions.splice(index, 1)
      }
    },
    notify(text, success) {
      notifications.push({ text, success })
    },
    resolve(target) {
      const providers = contributions
        .filter((contribution) => contribution.target === target.kind)
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
      const lifetime = new AbortController()
      const callbacks = new Map()
      const pending = []
      let views = []
      const accept = (contribution, actions) => {
        if (lifetime.signal.aborted) return
        const project = (action, parent) => {
          const id = `${parent}/${encodeURIComponent(action.id)}`
          callbacks.set(id, { contribution, action })
          const { run: _run, failureLabel: _failureLabel, children, ...view } = action
          return {
            ...view,
            id,
            ...(children === undefined ? {} : { children: children.map((child) => project(child, id)) }),
          }
        }
        views.push(...actions.map((action) => project(action, encodeURIComponent(contribution.id))))
      }
      for (const contribution of providers) {
        let result
        try {
          result = contribution.resolve(target.value, lifetime.signal)
        } catch (error) {
          notifications.push({ text: error?.message ?? 'contextMenu.failed', success: false })
          continue
        }
        if (result instanceof Promise) {
          pending.push(result.then(
            (actions) => accept(contribution, actions),
            (error) => notifications.push({ text: error?.message ?? 'contextMenu.failed', success: false }),
          ))
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
              result.catch(() => notifications.push({ text: selected.action.failureLabel ?? 'contextMenu.failed', success: false }))
            }
          } catch (error) {
            notifications.push({ text: selected.action.failureLabel ?? error?.message ?? 'contextMenu.failed', success: false })
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
     * @param {{kind: string, value: object}} target - captured trigger target.
     * @returns {object[]} action views.
     */
    views(target) {
      const resolution = contextMenus.resolve(target)
      const snapshot = resolution.source.getSnapshot()
      resolution.dispose()
      return snapshot
    },
    /**
     * Select one resolved action and wait for its callback's asynchronous work.
     * The host's `select` returns void, so tests settle one macrotask afterwards.
     * @param {{kind: string, value: object}} target - captured trigger target.
     * @param {string} id - resolved action id (`<contributionId>/<actionId>`).
     */
    async select(target, id) {
      const resolution = contextMenus.resolve(target)
      const view = resolution.source.getSnapshot().find((candidate) => candidate.id === id)
      assert.ok(view, `no context-menu action "${id}"`)
      resolution.select(id)
      await new Promise((resolve) => setImmediate(resolve))
    },
  }
}

/**
 * Build a recording Cordis plugin context for the bundle's `apply`.
 * @param {object} [options] - context options.
 * @param {object} [options.sidebarRight] - sidebarRight service stand-in.
 * @returns {{ctx: object, records: object, menu: object}} context, recorders, menu service.
 */
export function createFakeContext(options = {}) {
  const menu = createMenuService()
  const records = {
    localeDictionaries: [],
    tabTypes: [],
    slots: [],
    shortcuts: [],
  }
  const base = {
    effect(callback) {
      const cleanup = callback()
      return () => { if (typeof cleanup === 'function') cleanup() }
    },
    locale: {
      bind: () => translate,
      register(namespace, dictionaries) {
        records.localeDictionaries.push({ namespace, dictionaries })
        return () => {}
      },
    },
    sidebarRightTabs: {
      register(definition) {
        records.tabTypes.push(definition)
        return () => {}
      },
    },
    slots: {
      inject(_key, callback) {
        const cleanup = callback()
        return () => { if (typeof cleanup === 'function') cleanup() }
      },
      register(slotOptions, component) {
        records.slots.push({ options: slotOptions, component })
        return () => {}
      },
    },
    sidebarRight: options.sidebarRight ?? {
      commandTarget: () => undefined,
      openTabFromTarget: () => {},
    },
  }
  const ctx = {
    ...base,
    inject(services, callback) {
      if (Array.isArray(services) && services.includes('shortcuts')) {
        callback({
          ...base,
          shortcuts: {
            register(definition) {
              records.shortcuts.push(definition)
              return () => {}
            },
          },
        })
      }
      if (Array.isArray(services) && services.includes('contextMenus')) {
        callback({ ...base, contextMenus: menu.contextMenus })
      }
    },
  }
  return { ctx, records, menu }
}
