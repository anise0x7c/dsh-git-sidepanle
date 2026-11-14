/**
 * Browser-half behavior tests over a tiny React renderer.
 *
 * These mount the real panel and diff components, feed them canned Host
 * responses, click the same controls a user clicks, and assert the requests the
 * Host receives.
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { createHarness } from './support/mini-react.mjs'

const now = Math.floor(Date.now() / 1000)

let registration

before(async () => {
  const styles = []
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
    head: { appendChild(tag) { styles.push(tag) } },
  }
  await import('../client.js')
  assert.equal(typeof registration?.factory, 'function')
})

function translate(key) {
  return key
}

const STATUS = {
  repo: {
    root: '/repo',
    cwd: '/repo',
    branch: 'main',
    detached: false,
    unborn: false,
    upstream: 'origin/main',
    ahead: 2,
    behind: 1,
    headOid: '0123456789abcdef',
  },
  files: [
    { kind: 'ordinary', x: 'M', y: 'M', path: 'src/app.js', conflict: false, untracked: false },
    { kind: 'untracked', x: '?', y: '?', path: 'README.md', conflict: false, untracked: true },
    { kind: 'unmerged', x: 'U', y: 'U', path: 'merge.txt', conflict: true, untracked: false },
  ],
}

const HISTORY = {
  commits: [
    {
      oid: 'a'.repeat(40),
      shortOid: 'aaaaaaa',
      author: 'Ann',
      authoredAt: now - 120,
      refs: 'HEAD -> main, origin/main',
      subject: 'Fix the sidebar',
      graph: '*',
    },
    {
      oid: 'b'.repeat(40),
      shortOid: 'bbbbbbb',
      author: 'Bob',
      authoredAt: now - 7200,
      refs: 'tag: v1.0',
      subject: 'Initial commit',
      graph: '| *',
    },
  ],
}

const BRANCHES = { branches: [{ name: 'main', current: true }, { name: 'feature/sidebar', current: false }] }

/**
 * Stand-in for the host's shared context-menu trigger bindings.
 * Mirrors the shipped binding: existing handlers run first, a prevented event
 * keeps its owner, pointer positions come from the event, and keyboard
 * gestures use the row's lower edge.
 * @returns {{opens: object[], useContextMenu: () => object}} recorder and hook.
 */
function createMenuMock() {
  const opens = []
  return {
    opens,
    useContextMenu: () => ({
      getTriggerProps(target, handlers = {}) {
        const show = (event, x, y) => {
          if (event.defaultPrevented) return
          event.preventDefault()
          event.stopPropagation()
          opens.push({ target, point: { x, y } })
        }
        return {
          ...handlers,
          tabIndex: handlers.tabIndex ?? 0,
          onContextMenu(event) {
            handlers.onContextMenu?.(event)
            const rect = event.clientX === 0 && event.clientY === 0
              ? event.currentTarget.getBoundingClientRect()
              : undefined
            show(event, rect?.left ?? event.clientX, rect?.bottom ?? event.clientY)
          },
          onKeyDown(event) {
            handlers.onKeyDown?.(event)
            if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return
            if (!(event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey)) return
            const rect = event.currentTarget.getBoundingClientRect()
            show(event, rect.left, rect.bottom)
          },
        }
      },
    }),
  }
}

/**
 * Build one harness, load the bundle components against it, and mount a panel.
 * @param {object} options - mount options.
 * @returns {object} mounted test context.
 */
async function mountGit(options = {}) {
  const calls = []
  const responses = {
    status: options.status ?? STATUS,
    history: options.history ?? HISTORY,
    branches: options.branches ?? BRANCHES,
  }
  const harness = createHarness({
    fetch: async (_url, init) => {
      const request = JSON.parse(init.body)
      calls.push(request)
      if (options.failOp !== undefined && request.op === options.failOp) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ ok: false, error: { code: 'git-command-failed', message: 'git said no' } }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, value: responses[request.op] ?? { ok: true } }) }
    },
    component: null,
    props: {},
  })
  const openedTabs = []
  const tab = {
    id: 'tab-1',
    title: 'Source control',
    visible: true,
    signal: new AbortController().signal,
    actions: {
      openTab: (kind, openOptions) => { openedTabs.push({ kind, options: openOptions }) },
      openResource: () => {},
      close: () => {},
      bindCommands: () => () => {},
    },
    navigation: { address: 'sidebar://git', params: {}, revision: 0 },
  }
  const useTabInfo = () => ({ sidebar: { expanded: true, fullscreen: false }, panel: { id: 'pane-1', isFloating: false }, tab })
  const components = loadComponents(harness)
  const component = options.diff === true ? components.diff : components.git
  const menu = createMenuMock()
  harness.setComponent(component, {
    sessionId: 'session-1',
    t: translate,
    useTabInfo: options.tabInfo ?? useTabInfo,
    useSessions: () => undefined,
    ...(options.menus === false ? {} : { useContextMenu: menu.useContextMenu }),
  })
  await harness.render()
  return { harness, calls, openedTabs, components, useTabInfo, menu }
}

function loadComponents(harness) {
  const module = registration.factory((specifier) => {
    if (specifier === 'react') return harness.React
    throw new Error(`unexpected require("${specifier}")`)
  })
  const registrations = []
  const menuContributions = []
  const notifications = []
  const shared = {
    effect(callback) { const cleanup = callback(); return () => { if (typeof cleanup === 'function') cleanup() } },
    locale: { bind: () => translate, register: () => () => {} },
    sidebarRightTabs: { register: () => () => {} },
    slots: {
      inject(_key, callback) { callback() },
      register(options, component) { registrations.push({ options, component }); return () => {} },
    },
    sidebarRight: { commandTarget: () => undefined, openTabFromTarget: () => {} },
  }
  module.apply({
    ...shared,
    inject(services, callback) {
      if (!services.includes('contextMenus')) return
      callback({
        ...shared,
        contextMenus: {
          register(contribution) { menuContributions.push(contribution); return () => {} },
          notify(text, success) { notifications.push({ text, success }) },
        },
      })
    },
  })
  const bySeat = new Map(registrations.map(({ options, component }) => [`${options.name}:${options.key}`, component]))
  return {
    git: bySeat.get('sidebar.right.pane.tab:@local/dsh-git-graph/git'),
    diff: bySeat.get('sidebar.right.pane.tab:@local/dsh-git-graph/diff'),
    gitTitle: bySeat.get('sidebar.right.pane.tab.title:@local/dsh-git-graph/git'),
    diffTitle: bySeat.get('sidebar.right.pane.tab.title:@local/dsh-git-graph/diff'),
    contribution: menuContributions[0],
    notifications,
  }
}

function buttonByLabel(harness, label) {
  const buttons = harness.findAll((element) => element.type === 'button' && element.props['aria-label'] === label)
  assert.ok(buttons.length > 0, `no button labelled "${label}"`)
  return buttons[0]
}

function elementText(element) {
  const parts = []
  const walk = (node) => {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') { parts.push(String(node)); return }
    if (Array.isArray(node)) { for (const child of node) walk(child); return }
    for (const child of node.children ?? []) walk(child)
  }
  walk(element)
  return parts.join(' ').trim()
}

function buttonContaining(harness, label) {
  const buttons = harness.findAll((element) => element.type === 'button' && elementText(element) === label)
  assert.ok(buttons.length > 0, `no button containing "${label}"`)
  return buttons[0]
}

function buttonInside(element, label) {
  const buttons = []
  const walk = (node) => {
    if (node === null || node === undefined || typeof node !== 'object') return
    if (Array.isArray(node)) { for (const child of node) walk(child); return }
    if (node.type === 'button' && node.props?.['aria-label'] === label) buttons.push(node)
    for (const child of node.children ?? []) walk(child)
  }
  walk(element.children)
  assert.ok(buttons.length > 0, `no button labelled "${label}" inside the row`)
  return buttons[0]
}

function buttonByText(harness, text) {
  const buttons = harness.findAll((element) => {
    if (element.type !== 'button' && element.type !== 'div') return false
    return element.children.some((child) => child === text)
  })
  assert.ok(buttons.length > 0, `no control with text "${text}"`)
  return buttons[0]
}

test('the panel renders branch, change groups, status letters, and the graph', async () => {
  const mounted = await mountGit()
  const text = mounted.harness.text()
  assert.match(text, /main/)
  assert.match(text, /origin\/main/)
  assert.match(text, /sections\.merge/)
  assert.match(text, /sections\.staged/)
  assert.match(text, /sections\.changes/)
  assert.match(text, /sections\.graph/)
  assert.match(text, /Fix the sidebar/)
  assert.match(text, /Initial commit/)
  assert.match(text, /app\.js/)
  assert.match(text, /README\.md/)
  assert.match(text, /merge\.txt/)
  assert.match(text, /\bU\b/)
  assert.match(text, /\bM\b/)
  assert.match(text, /!/)
  assert.ok(buttonByLabel(mounted.harness, 'refresh'))
  assert.ok(mounted.harness.findAll((element) => element.type === 'textarea').length === 1)
  const initial = mounted.calls.filter((call) => call.op === 'status')
  assert.ok(initial.length >= 1)
  assert.equal(typeof mounted.harness.hookStoreSize(), 'number')
  await mounted.harness.dispose()
})

test('row actions stage and unstage through the Host', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll((element) => String(element.props?.className ?? '').includes('dshgg-fileRow') && element.props?.title === 'src/app.js')
  assert.equal(rows.length, 2, 'the file appears staged and again unstaged')
  mounted.harness.click(buttonInside(rows[1], 'actions.stage'))
  await mounted.harness.flush()
  const stageCall = mounted.calls.find((call) => call.op === 'stage')
  assert.deepEqual(stageCall?.paths, ['src/app.js'])
  mounted.harness.click(buttonInside(rows[0], 'actions.unstage'))
  await mounted.harness.flush()
  const unstageCall = mounted.calls.find((call) => call.op === 'unstage')
  assert.deepEqual(unstageCall?.paths, ['src/app.js'])
  await mounted.harness.dispose()
})

test('the commit button follows the message and posts a commit', async () => {
  const mounted = await mountGit()
  const commitButton = () => buttonByText(mounted.harness, 'commit.action')
  assert.equal(commitButton().props.disabled, true)
  const textarea = mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(textarea, 'feat: git sidebar')
  await mounted.harness.flush()
  assert.equal(commitButton().props.disabled, false)
  mounted.harness.click(commitButton())
  await mounted.harness.flush()
  const commitCall = mounted.calls.find((call) => call.op === 'commit')
  assert.equal(commitCall?.message, 'feat: git sidebar')
  assert.notEqual(commitCall?.stageAll, true)
  assert.match(mounted.harness.text(), /commit\.done/)
  await mounted.harness.dispose()
})

test('committing with nothing staged offers to stage everything', async () => {
  const status = {
    repo: STATUS.repo,
    files: [{ kind: 'ordinary', x: '.', y: 'M', path: 'src/app.js', conflict: false, untracked: false }],
  }
  const mounted = await mountGit({ status })
  const textarea = mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(textarea, 'commit everything')
  await mounted.harness.flush()
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /commit\.emptyConfirm/)
  mounted.harness.click(buttonByText(mounted.harness, 'commit.stageAll'))
  await mounted.harness.flush()
  const commitCall = mounted.calls.find((call) => call.op === 'commit')
  assert.equal(commitCall?.stageAll, true)
  await mounted.harness.dispose()
})

test('discard asks for confirmation before calling the Host', async () => {
  const mounted = await mountGit()
  mounted.harness.click(buttonByLabel(mounted.harness, 'actions.discard'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'discard').length, 0)
  assert.match(mounted.harness.text(), /confirm\.discardTitle/)
  mounted.harness.click(buttonByText(mounted.harness, 'confirm.discard'))
  await mounted.harness.flush()
  const discardCall = mounted.calls.find((call) => call.op === 'discard')
  assert.equal(discardCall?.path, 'src/app.js')
  assert.notEqual(discardCall?.untracked, true)
  await mounted.harness.dispose()
})

test('the branch menu loads local branches and checks one out', async () => {
  const mounted = await mountGit()
  const chip = mounted.harness.findAll((element) => element.type === 'button' && String(element.props.className).includes('dshgg-branchChip'))[0]
  assert.ok(chip)
  mounted.harness.click(chip)
  await mounted.harness.flush()
  assert.ok(mounted.calls.some((call) => call.op === 'branches'))
  const feature = buttonContaining(mounted.harness, 'feature/sidebar')
  mounted.harness.click(feature)
  await mounted.harness.flush()
  const checkoutCall = mounted.calls.find((call) => call.op === 'checkout')
  assert.equal(checkoutCall?.branch, 'feature/sidebar')
  await mounted.harness.dispose()
})

test('a changed file opens a diff tab with its addressing parameters', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll((element) => String(element.props?.className ?? '').includes('dshgg-fileRow') && element.props?.title === 'src/app.js')
  assert.ok(rows.length >= 2)
  mounted.harness.click(rows[rows.length - 1])
  const opened = mounted.openedTabs[0]
  assert.equal(opened.kind, 'git-diff')
  assert.equal(opened.options.params.path, 'src/app.js')
  assert.equal(opened.options.params.staged, false)
  await mounted.harness.dispose()
})

test('a missing repository renders the explanation instead of actions', async () => {
  const mounted = await mountGit({ status: { repo: null, cwd: '/tmp/plain', files: [] } })
  const text = mounted.harness.text()
  assert.match(text, /noRepo\.title/)
  assert.match(text, /noRepo\.desc/)
  assert.equal(mounted.harness.findAll((element) => element.type === 'textarea').length, 0)
  await mounted.harness.dispose()
})

test('a Host failure surfaces a retryable banner', async () => {
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
    hunks: [{
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
    }],
  }
  const status = STATUS
  const calls = []
  const harness = createHarness({
    fetch: async (_url, init) => {
      const request = JSON.parse(init.body)
      calls.push(request)
      return { ok: true, status: 200, json: async () => ({ ok: true, value: request.op === 'diff' ? diffPayload : status }) }
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
    actions: { openTab: () => {}, openResource: () => {}, close: () => {}, bindCommands: () => () => {} },
    navigation: { address: 'sidebar://git-diff', params, revision: 1 },
  }
  harness.setComponent(components.diff, {
    sessionId: 'session-1',
    t: translate,
    useTabInfo: () => ({ sidebar: { expanded: true }, panel: { id: 'pane-1', isFloating: false }, tab }),
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

/** Resolve the shared context-menu actions for a target captured by the mock. */
function menuActions(components, target) {
  assert.equal(typeof components.contribution?.resolve, 'function', 'no context-menu contribution was registered')
  return components.contribution.resolve(target, new AbortController().signal)
}

/** Resolve and run one action id from a captured menu target. */
function runMenuAction(components, target, id) {
  const action = menuActions(components, target).find((candidate) => candidate.id === id)
  assert.ok(action, `no context-menu action "${id}"`)
  return action.run()
}

test('right-clicking a change binds its target without calling the Host', async () => {
  const mounted = await mountGit()
  const before = mounted.calls.length
  const rows = mounted.harness.findAll((element) => String(element.props?.className ?? '').includes('dshgg-fileRow') && element.props?.title === 'src/app.js')
  mounted.harness.contextmenu(rows[rows.length - 1], { clientX: 40, clientY: 60 })
  assert.equal(mounted.menu.opens.length, 1)
  assert.deepEqual(mounted.menu.opens[0].point, { x: 40, y: 60 })
  const target = mounted.menu.opens[0].target
  assert.equal(target.kind, 'gitGraphItem')
  assert.equal(target.value.sessionId, 'session-1')
  assert.equal(target.value.kind, 'file')
  assert.equal(target.value.section, 'changes')
  assert.equal(target.value.path, 'src/app.js')
  assert.equal(target.value.cwd, '/repo')
  assert.equal(mounted.calls.length, before, 'opening a menu must not call the Host')
  assert.deepEqual(menuActions(mounted.components, target).map((action) => action.id),
    ['open', 'stage', 'discard', 'copy-relative', 'copy-path'])
  await mounted.harness.dispose()
})

test('a menu command stages through the panel like the inline control', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll((element) => String(element.props?.className ?? '').includes('dshgg-fileRow') && element.props?.title === 'src/app.js')
  mounted.harness.contextmenu(rows[rows.length - 1])
  const target = mounted.menu.opens.at(-1).target
  await runMenuAction(mounted.components, target, 'stage')
  await mounted.harness.flush()
  const stageCall = mounted.calls.find((call) => call.op === 'stage')
  assert.deepEqual(stageCall?.paths, ['src/app.js'])
  assert.ok(mounted.calls.filter((call) => call.op === 'status').length >= 2, 'the panel refreshes after a menu command')
  await mounted.harness.dispose()
})

test('a menu discard keeps the panel confirmation before calling the Host', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll((element) => String(element.props?.className ?? '').includes('dshgg-fileRow') && element.props?.title === 'src/app.js')
  mounted.harness.contextmenu(rows[rows.length - 1])
  await runMenuAction(mounted.components, mounted.menu.opens.at(-1).target, 'discard')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'discard').length, 0)
  assert.match(mounted.harness.text(), /confirm\.discardTitle/)
  mounted.harness.click(buttonByText(mounted.harness, 'confirm.discard'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.find((call) => call.op === 'discard')?.path, 'src/app.js')
  await mounted.harness.dispose()
})

test('a group header menu stages every change in the group', async () => {
  const mounted = await mountGit()
  const section = mounted.harness.findAll((element) => element.props?.['data-section'] === 'changes')[0]
  assert.ok(section, 'no changes group rendered')
  mounted.harness.contextmenu(section.children[0])
  const target = mounted.menu.opens.at(-1).target
  assert.equal(target.value.kind, 'section')
  assert.equal(target.value.section, 'changes')
  assert.deepEqual(menuActions(mounted.components, target).map((action) => action.id),
    ['stage-all', 'discard-all', 'refresh'])
  await runMenuAction(mounted.components, target, 'stage-all')
  await mounted.harness.flush()
  const stageCall = mounted.calls.find((call) => call.op === 'stage')
  assert.deepEqual([...stageCall.paths].sort(), ['README.md', 'src/app.js'])
  await mounted.harness.dispose()
})

test('the keyboard context-menu gesture binds the focused row', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll((element) => String(element.props?.className ?? '').includes('dshgg-fileRow') && element.props?.title === 'src/app.js')
  mounted.harness.keydown(rows[rows.length - 1], { key: 'F10', shiftKey: true })
  assert.equal(mounted.menu.opens.length, 1)
  assert.equal(mounted.menu.opens[0].target.value.path, 'src/app.js')
  assert.equal(mounted.menu.opens[0].target.value.kind, 'file')
  // Enter still opens the diff instead of a menu.
  mounted.harness.keydown(rows[rows.length - 1], { key: 'Enter' })
  assert.equal(mounted.menu.opens.length, 1)
  assert.equal(mounted.openedTabs.length, 1)
  await mounted.harness.dispose()
})

test('a menu command for another session is ignored', async () => {
  const mounted = await mountGit()
  const target = { kind: 'gitGraphItem', value: { sessionId: 'other-session', kind: 'file', section: 'changes', path: 'src/app.js', cwd: '/repo' } }
  await runMenuAction(mounted.components, target, 'stage')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'stage').length, 0)
  await mounted.harness.dispose()
})

test('commit rows and the diff header bind their copy targets', async () => {
  const mounted = await mountGit()
  const graphRow = mounted.harness.findAll((element) => String(element.props?.className ?? '').includes('dshgg-graphRow'))[0]
  assert.ok(graphRow, 'no graph row rendered')
  mounted.harness.contextmenu(graphRow, { clientX: 1, clientY: 2 })
  const commitTarget = mounted.menu.opens.at(-1).target
  assert.equal(commitTarget.value.kind, 'commit')
  assert.equal(commitTarget.value.oid, 'a'.repeat(40))
  assert.equal(commitTarget.value.subject, 'Fix the sidebar')
  assert.deepEqual(menuActions(mounted.components, commitTarget).map((action) => action.id), ['copy-id', 'copy-message'])
  await mounted.harness.dispose()

  const harness = createHarness({
    fetch: async (_url, init) => {
      const request = JSON.parse(init.body)
      const value = request.op === 'diff'
        ? { path: 'src/app.js', staged: false, untracked: false, binary: false, truncated: false, additions: 0, deletions: 0, hunks: [] }
        : STATUS
      return { ok: true, status: 200, json: async () => ({ ok: true, value }) }
    },
    component: null,
    props: {},
  })
  const components = loadComponents(harness)
  const menu = createMenuMock()
  const tab = {
    id: 'tab-2',
    title: 'Diff',
    visible: true,
    signal: new AbortController().signal,
    actions: { openTab: () => {}, openResource: () => {}, close: () => {}, bindCommands: () => () => {} },
    navigation: { address: 'sidebar://git-diff', params: { path: 'src/app.js', staged: false, untracked: false, status: 'M', cwd: '/repo' }, revision: 1 },
  }
  harness.setComponent(components.diff, {
    sessionId: 'session-1',
    t: translate,
    useTabInfo: () => ({ sidebar: { expanded: true }, panel: { id: 'pane-1', isFloating: false }, tab }),
    useContextMenu: menu.useContextMenu,
  })
  await harness.render()
  const header = harness.findAll((element) => String(element.props?.className ?? '').includes('dshgg-diffHeader'))[0]
  assert.ok(header, 'no diff header rendered')
  harness.contextmenu(header, { clientX: 3, clientY: 4 })
  const diffTarget = menu.opens.at(-1).target
  assert.equal(diffTarget.value.kind, 'diff')
  assert.equal(diffTarget.value.path, 'src/app.js')
  assert.equal(diffTarget.value.cwd, '/repo')
  assert.deepEqual(menuActions(components, diffTarget).map((action) => action.id), ['copy-relative', 'copy-path'])
  await harness.dispose()
})

test('without host context menus the inline controls keep working', async () => {
  const mounted = await mountGit({ menus: false })
  const rows = mounted.harness.findAll((element) => String(element.props?.className ?? '').includes('dshgg-fileRow') && element.props?.title === 'src/app.js')
  const row = rows[rows.length - 1]
  assert.equal(row.props.onContextMenu, undefined)
  mounted.harness.click(buttonInside(row, 'actions.stage'))
  await mounted.harness.flush()
  assert.deepEqual(mounted.calls.find((call) => call.op === 'stage')?.paths, ['src/app.js'])
  await mounted.harness.dispose()
})

test('menu copies absolute paths from the repository root, not the Session directory', async () => {
  const status = {
    repo: {
      root: '/repo',
      cwd: '/repo/apps/web',
      branch: 'main',
      detached: false,
      unborn: false,
      upstream: null,
      ahead: 0,
      behind: 0,
      headOid: '0123456789abcdef',
    },
    files: [{ kind: 'ordinary', x: '.', y: 'M', path: 'apps/web/src/app.js', conflict: false, untracked: false }],
  }
  const mounted = await mountGit({ status })
  const rows = mounted.harness.findAll((element) => String(element.props?.className ?? '').includes('dshgg-fileRow') && element.props?.title === 'apps/web/src/app.js')
  mounted.harness.contextmenu(rows[rows.length - 1])
  const target = mounted.menu.opens.at(-1).target
  assert.equal(target.value.cwd, '/repo')
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const copied = []
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: async (text) => { copied.push(text) } } },
      configurable: true,
    })
    await runMenuAction(mounted.components, target, 'copy-path')
    assert.equal(copied.at(-1), '/repo/apps/web/src/app.js')
  } finally {
    if (previousNavigator === undefined) delete globalThis.navigator
    else Object.defineProperty(globalThis, 'navigator', previousNavigator)
  }
  mounted.harness.click(rows[rows.length - 1])
  assert.equal(mounted.openedTabs[0].options.params.cwd, '/repo')
  await mounted.harness.dispose()
})

test('a menu command for a vanished change reports it instead of doing nothing', async () => {
  const mounted = await mountGit()
  const target = {
    kind: 'gitGraphItem',
    value: { sessionId: 'session-1', kind: 'file', section: 'changes', path: 'gone.js', cwd: '/repo' },
  }
  await runMenuAction(mounted.components, target, 'stage')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'stage').length, 0)
  assert.match(mounted.harness.text(), /menu\.stale/)
  await mounted.harness.dispose()
})

test('a group discard uses the group confirmation wording', async () => {
  const status = {
    repo: STATUS.repo,
    files: [{ kind: 'ordinary', x: '.', y: 'M', path: 'only.js', conflict: false, untracked: false }],
  }
  const mounted = await mountGit({ status })
  const section = mounted.harness.findAll((element) => element.props?.['data-section'] === 'changes')[0]
  mounted.harness.contextmenu(section.children[0])
  const target = mounted.menu.opens.at(-1).target
  await runMenuAction(mounted.components, target, 'discard-all')
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /confirm\.discardAllTitle/)
  await mounted.harness.dispose()
})

test('commit rows are keyboard focus stops with menu semantics', async () => {
  const mounted = await mountGit()
  const graphRow = mounted.harness.findAll((element) => String(element.props?.className ?? '').includes('dshgg-graphRow'))[0]
  assert.equal(graphRow.props.tabIndex, 0)
  assert.equal(graphRow.props['aria-haspopup'], 'menu')
  mounted.harness.keydown(graphRow, { key: 'ContextMenu' })
  assert.equal(mounted.menu.opens.length, 1)
  assert.equal(mounted.menu.opens[0].target.value.kind, 'commit')
  await mounted.harness.dispose()
})

test('a menu command from another pane of the same Session is ignored', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll((element) => String(element.props?.className ?? '').includes('dshgg-fileRow') && element.props?.title === 'src/app.js')
  mounted.harness.contextmenu(rows[rows.length - 1])
  const target = mounted.menu.opens.at(-1).target
  assert.equal(typeof target.value.panelId, 'string')
  const foreign = { kind: 'gitGraphItem', value: { ...target.value, panelId: 'git-panel-other' } }
  await runMenuAction(mounted.components, foreign, 'stage')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'stage').length, 0)
  await runMenuAction(mounted.components, target, 'stage')
  await mounted.harness.flush()
  assert.deepEqual(mounted.calls.find((call) => call.op === 'stage')?.paths, ['src/app.js'])
  await mounted.harness.dispose()
})
