/**
 * Diff tab and the panel-level empty and failure states.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { translate } from '../support/fake-ctx.ts'
import { createStatus, STATUS } from '../support/fixtures.ts'
import type { FetchResponseLike, RpcRequestRecord } from '../support/types.ts'
import {
  buttonByText,
  createHarness,
  disposeUiLifetimes,
  loadComponents,
  loadUiPanel,
  mountGit,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

test('a changed file opens a diff tab with its addressing parameters', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  assert.ok(rows.length >= 2)
  mounted.harness.click(rows[rows.length - 1])
  const opened = mounted.openedTabs[0]
  assert.ok(opened, 'no diff tab was opened')
  assert.equal(opened.kind, 'git-diff')
  assert.equal(opened.options.params.path, 'src/app.js')
  assert.equal(opened.options.params.staged, false)
  await mounted.harness.dispose()
})

test('a missing repository renders the explanation instead of actions', async () => {
  const mounted = await mountGit({
    status: createStatus({ repo: null, cwd: '/tmp/plain', files: [] }),
  })
  const text = mounted.harness.text()
  assert.match(text, /noRepo\.title/)
  assert.match(text, /noRepo\.desc/)
  assert.equal(mounted.harness.findAll((element) => element.type === 'textarea').length, 0)
  await mounted.harness.dispose()
})

test('a Host failure surfaces a retryable state', async () => {
  const mounted = await mountGit({ failOp: 'status' })
  const text = mounted.harness.text()
  assert.match(text, /error\.title/)
  assert.match(text, /git said no/)
  assert.ok(buttonByText(mounted.harness, 'retry'))
  await mounted.harness.dispose()
})

test('the diff tab renders unified diff hunks from the Host', async () => {
  const diffPayload = {
    path: 'src/app.js',
    staged: false,
    untracked: false,
    binary: false,
    truncated: false,
    additions: 1,
    deletions: 1,
    hunks: [
      {
        header: '@@ -1,2 +1,2 @@',
        oldStart: 1,
        oldCount: 2,
        newStart: 1,
        newCount: 2,
        lines: [
          { t: ' ', text: 'one' },
          { t: '-', text: 'two' },
          { t: '+', text: 'TWO' },
        ],
      },
    ],
  }
  const calls: RpcRequestRecord[] = []
  const harness = createHarness({
    fetch: async (_url: string, init: { body: string }): Promise<FetchResponseLike> => {
      const request = JSON.parse(init.body) as RpcRequestRecord
      calls.push(request)
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, value: request.op === 'diff' ? diffPayload : STATUS }),
      }
    },
    component: null,
    props: {},
  })
  const components = loadComponents(harness)
  const params = { path: 'src/app.js', staged: false, untracked: false, status: 'M' }
  const tab = {
    id: 'tab-2',
    title: 'Diff',
    visible: true,
    signal: new AbortController().signal,
    actions: {
      openTab: () => {},
      openResource: () => {},
      close: () => {},
      bindCommands: () => () => {},
    },
    navigation: { address: 'sidebar://git-diff', params, revision: 1 },
  }
  harness.setComponent(components.diff, {
    sessionId: 'session-1',
    t: translate,
    useTabInfo: () => ({
      sidebar: { expanded: true },
      panel: { id: 'pane-1', isFloating: false },
      tab,
    }),
  })
  await harness.render()
  const text = harness.text()
  assert.match(text, /app\.js/)
  assert.match(text, /diff\.unstaged/)
  assert.match(text, /@@ -1,2 \+1,2 @@/)
  assert.match(text, /TWO/)
  assert.ok(calls.some((call) => call.op === 'diff' && call.path === 'src/app.js'))
  await harness.dispose()
})

test('the diff tab is scoped to a commit and labels it', async () => {
  const commit = 'a'.repeat(40)
  const diffPayload = {
    path: 'src/app.js',
    commit,
    binary: false,
    truncated: false,
    additions: 1,
    deletions: 0,
    hunks: [
      {
        header: '@@ -1,1 +1,2 @@',
        oldStart: 1,
        oldCount: 1,
        newStart: 1,
        newCount: 2,
        lines: [
          { t: ' ', text: 'one' },
          { t: '+', text: 'TWO' },
        ],
      },
    ],
  }
  const calls: RpcRequestRecord[] = []
  const harness = createHarness({
    fetch: async (_url: string, init: { body: string }): Promise<FetchResponseLike> => {
      const request = JSON.parse(init.body) as RpcRequestRecord
      calls.push(request)
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, value: request.op === 'diff' ? diffPayload : STATUS }),
      }
    },
    component: null,
    props: {},
  })
  const components = loadComponents(harness)
  const tab = {
    id: 'tab-3',
    title: 'Diff',
    visible: true,
    signal: new AbortController().signal,
    actions: {
      openTab: () => {},
      openResource: () => {},
      close: () => {},
      bindCommands: () => () => {},
    },
    navigation: {
      params: { path: 'src/app.js', commit, shortOid: 'aaaaaaa', status: 'M', cwd: '/repo' },
      revision: 1,
    },
  }
  harness.setComponent(components.diff, {
    sessionId: 'session-1',
    t: translate,
    useTabInfo: () => ({
      sidebar: { expanded: true },
      panel: { id: 'pane-1', isFloating: false },
      tab,
    }),
  })
  await harness.render()
  const text = harness.text()
  assert.match(text, /diff\.commit/)
  assert.match(text, /TWO/)
  assert.equal(
    harness.findAll((element) => element.props?.['data-kind'] === 'commit').length,
    1,
    'the badge identifies the commit scope',
  )
  const diffCall = calls.find((call) => call.op === 'diff')
  assert.equal(diffCall?.commit, commit)
  assert.equal(diffCall?.path, 'src/app.js')
  assert.notEqual(diffCall?.staged, true)
  await harness.dispose()
})

test('a pure rename diff explains the rename instead of showing an empty diff', async () => {
  const diffPayload = {
    path: 'src/renamed.js',
    commit: 'a'.repeat(40),
    binary: false,
    truncated: false,
    additions: 0,
    deletions: 0,
    renameFrom: 'src/old.js',
    renameTo: 'src/renamed.js',
    hunks: [],
  }
  const harness = createHarness({
    fetch: async () => {
      return { ok: true, status: 200, json: async () => ({ ok: true, value: diffPayload }) }
    },
    component: null,
    props: {},
  })
  const components = loadComponents(harness)
  const tab = {
    id: 'tab-4',
    title: 'Diff',
    visible: true,
    signal: new AbortController().signal,
    actions: {
      openTab: () => {},
      openResource: () => {},
      close: () => {},
      bindCommands: () => () => {},
    },
    navigation: {
      params: {
        path: 'src/renamed.js',
        commit: 'a'.repeat(40),
        shortOid: 'aaaaaaa',
        origPath: 'src/old.js',
        status: 'R',
      },
      revision: 1,
    },
  }
  harness.setComponent(components.diff, {
    sessionId: 'session-1',
    t: translate,
    useTabInfo: () => ({
      sidebar: { expanded: true },
      panel: { id: 'pane-1', isFloating: false },
      tab,
    }),
  })
  await harness.render()
  const text = harness.text()
  assert.match(text, /diff\.renamed/)
  assert.match(text, /diff\.from/, 'the header still names the original path')
  await harness.dispose()
})
