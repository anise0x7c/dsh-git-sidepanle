/**
 * Direct unit tests for the browser half's shared constants and the menu
 * trigger adapter.
 *
 * These import `src/client/constants.js` and `src/client/menu/trigger.js`
 * directly — no React, no plugin context, no built `client.js`. The route
 * invariant is checked against the Host module that registers the same path.
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DIFF_ID,
  DIFF_KIND,
  GIT_ID,
  GIT_KIND,
  GIT_SHORTCUT,
  MAX_RENDERED_DIFF_LINES,
  MENU_CONTRIBUTION_ID,
  MENU_TARGET,
  NS,
  PACKAGE_ID,
  POLL_INTERVAL_MS,
  RPC_PATH,
  nextPanelId,
} from '../../src/client/constants.js'
import { HEALTH_PATH, RPC_PATH as HOST_RPC_PATH } from '../../src/host/rpc.js'
import { resolveMenuActions } from '../../src/client/menu/actions.js'
import { bindMenuTrigger, menuTarget } from '../../src/client/menu/trigger.js'

const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
/** Locale binder stand-in for the captured-value contract check. */
const t = (key) => key

describe('constants', () => {
  test('the package id matches the manifest name and namespaces both tabs', () => {
    assert.equal(PACKAGE_ID, manifest.name)
    assert.equal(PACKAGE_ID, '@local/dsh-git-graph')
    assert.equal(GIT_ID, `${PACKAGE_ID}/git`)
    assert.equal(DIFF_ID, `${PACKAGE_ID}/diff`)
  })

  test('tab kinds, the locale namespace, and the shortcut id stay stable', () => {
    assert.equal(GIT_KIND, 'git')
    assert.equal(DIFF_KIND, 'git-diff')
    assert.equal(NS, 'gitGraph')
    assert.equal(GIT_SHORTCUT, 'workspace.git')
  })

  test('the client RPC path is the Host route without the leading slash', () => {
    assert.equal(RPC_PATH, 'api/dsh-git-graph/rpc')
    assert.equal(RPC_PATH.startsWith('/'), false)
    assert.equal(`/${RPC_PATH}`, HOST_RPC_PATH)
    assert.equal(HOST_RPC_PATH, '/api/dsh-git-graph/rpc')
    assert.equal(HEALTH_PATH, '/api/dsh-git-graph/health')
    assert.notEqual(HEALTH_PATH, HOST_RPC_PATH)
  })

  test('menu ids and rendering limits stay stable', () => {
    assert.equal(MENU_TARGET, 'gitGraphItem')
    assert.equal(MENU_CONTRIBUTION_ID, 'git-graph.actions')
    assert.equal(POLL_INTERVAL_MS, 5000)
    assert.equal(MAX_RENDERED_DIFF_LINES, 4000)
  })
})

describe('nextPanelId', () => {
  test('returns unique sequential panel ids', () => {
    const ids = Array.from({ length: 5 }, () => nextPanelId())
    assert.equal(new Set(ids).size, ids.length)
    for (let index = 0; index < ids.length; index += 1) {
      assert.match(ids[index], /^git-panel-\d+$/)
      if (index > 0) {
        assert.equal(Number(ids[index].slice('git-panel-'.length)), Number(ids[index - 1].slice('git-panel-'.length)) + 1)
      }
    }
  })
})

describe('menuTarget', () => {
  test('wraps the captured row value with the registered target kind', () => {
    assert.deepEqual(menuTarget('session-1', 'file', { section: 'changes', path: 'src/app.js', cwd: '/repo' }), {
      kind: 'gitGraphItem',
      value: { sessionId: 'session-1', kind: 'file', section: 'changes', path: 'src/app.js', cwd: '/repo' },
    })
    assert.equal(menuTarget('session-1', 'file', {}).kind, MENU_TARGET)
  })

  test('merges panel and action detail into the captured value', () => {
    assert.deepEqual(menuTarget('session-1', 'section', { section: 'changes', busy: true, panelId: 'git-panel-1' }), {
      kind: MENU_TARGET,
      value: { sessionId: 'session-1', kind: 'section', section: 'changes', busy: true, panelId: 'git-panel-1' },
    })
  })

  test('spreads detail last, so a detail field wins over the positional value', () => {
    const target = menuTarget('session-1', 'file', { sessionId: 'other-session', kind: 'section' })
    assert.deepEqual(target.value, { sessionId: 'other-session', kind: 'section' })
  })

  test('the contribution receives the captured value, never the wrapper (7cac4e6)', () => {
    const target = menuTarget('session-1', 'file', { section: 'changes', path: 'src/app.js' })
    // The shared registry calls `resolve(target.value, signal)`; handing the
    // wrapper to the resolver has no session id and must resolve nothing.
    assert.deepEqual(resolveMenuActions(target, t, () => {}), [])
    assert.ok(resolveMenuActions(target.value, t, () => {}).length > 0)
  })
})

describe('bindMenuTrigger', () => {
  test('returns null when the slot did not provide the hook', () => {
    for (const hook of [undefined, null, {}, 'useContextMenu']) {
      assert.equal(bindMenuTrigger(hook), null, `hook ${String(hook)}`)
    }
  })

  test('returns null when the hook does not expose getTriggerProps', () => {
    for (const bindings of [undefined, null, {}, { getTriggerProps: 'not a function' }]) {
      assert.equal(bindMenuTrigger(() => bindings), null, `bindings ${JSON.stringify(bindings)}`)
    }
  })

  test('returns null and warns when the hook throws', () => {
    const originalWarn = console.warn
    const warnings = []
    console.warn = (...args) => { warnings.push(args) }
    try {
      assert.equal(bindMenuTrigger(() => { throw new Error('menus unavailable') }), null)
    } finally {
      console.warn = originalWarn
    }
    assert.equal(warnings.length, 1)
    assert.equal(warnings[0][0], '[git-graph] context menus are unavailable')
  })

  test('calls the hook once and passes the target and handlers through', () => {
    const calls = []
    const props = { tabIndex: -1, 'aria-haspopup': 'menu' }
    const factory = bindMenuTrigger(() => ({
      getTriggerProps(target, handlers) {
        calls.push({ target, handlers })
        return { target, handlers, ...handlers }
      },
    }))
    assert.equal(typeof factory, 'function')
    const target = { kind: 'gitGraphItem', value: { sessionId: 'session-1', kind: 'file' } }
    const handlers = { tabIndex: -1 }
    const first = factory(target, handlers)
    const second = factory(target, props)
    assert.equal(calls.length, 2, 'the factory should call the host binding per invocation')
    assert.equal(calls[0].target, target)
    assert.equal(calls[0].handlers, handlers)
    assert.equal(calls[1].handlers, props)
    assert.equal(first.target, target)
    assert.equal(first.handlers, handlers)
    assert.deepEqual(second, { target, handlers: props, ...props })
  })
})
