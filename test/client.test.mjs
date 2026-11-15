/**
 * Client-half registration tests.
 *
 * A stub module loader, React, and Cordis context let the browser bundle
 * evaluate in Node: registration shapes, locale dictionaries, guide metadata,
 * the shortcut, and the component render paths are checked without a browser.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFakeContext, loadClientBundle, translate } from './support/fake-ctx.js'

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

/** Contribution id of the bundle's context-menu provider. */
const MENU_ID = 'git-graph.actions'

/** A resolved action id as the shared registry publishes it. */
const menuActionId = (id) => `${MENU_ID}/${id}`

/** Resolved action ids in overlay order. */
const MENU_IDS = (views) => views.map((view) => view.id)

/**
 * Evaluate the bundle factory against the stub React.
 * @param {object} registration - module-loader registration.
 * @returns {object} evaluated bundle module.
 */
function bundleModule(registration) {
  return registration.factory((specifier) => {
    if (specifier === 'react') return fakeReact
    throw new Error(`unexpected require("${specifier}")`)
  })
}

test('the bundle registers its two right-Sidebar types, bodies, titles, and shortcut', async () => {
  const { registration, styleTags } = await loadClientBundle()
  assert.equal(registration.id, '@local/dsh-git-graph')
  const module = bundleModule(registration)
  assert.deepEqual(module.inject, ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight'])

  const fake = createFakeContext()
  module.apply(fake.ctx)
  const { records } = fake

  assert.equal(styleTags.length, 1)
  assert.equal(styleTags[0].getAttribute('data-plugin'), '@local/dsh-git-graph')
  assert.equal(records.localeDictionaries.length, 1)
  assert.equal(records.localeDictionaries[0].namespace, 'gitGraph')
  assert.ok(records.localeDictionaries[0].dictionaries.en.title)
  assert.ok(records.localeDictionaries[0].dictionaries.zh.title)
  assert.deepEqual(
    Object.keys(records.localeDictionaries[0].dictionaries.en).sort(),
    Object.keys(records.localeDictionaries[0].dictionaries.zh).sort(),
  )

  assert.deepEqual(records.tabTypes.map((definition) => definition.kind), ['git', 'git-diff'])
  const gitType = records.tabTypes[0]
  assert.equal(gitType.id, '@local/dsh-git-graph/git')
  assert.equal(gitType.title('x'), 'title')
  assert.equal(gitType.guide.length, 1)
  const guide = gitType.guide[0]
  assert.equal(guide.commandId, 'workspace.git')
  assert.equal(guide.title(), 'guideTitle')
  assert.equal(typeof guide.icon, 'function')
  const iconElement = guide.icon({ size: 16 })
  assert.equal(iconElement.type, 'svg')
  assert.deepEqual(records.tabTypes[1], {
    id: '@local/dsh-git-graph/diff',
    kind: 'git-diff',
    title: records.tabTypes[1].title,
  })

  assert.equal(records.slots.length, 4)
  const slotSummary = records.slots.map(({ options }) => `${options.name}:${options.key}`)
  assert.deepEqual(slotSummary, [
    'sidebar.right.pane.tab:@local/dsh-git-graph/git',
    'sidebar.right.pane.tab.title:@local/dsh-git-graph/git',
    'sidebar.right.pane.tab:@local/dsh-git-graph/diff',
    'sidebar.right.pane.tab.title:@local/dsh-git-graph/diff',
  ])
  for (const { options } of records.slots) assert.equal(options.locale, 'gitGraph')

  assert.equal(records.shortcuts.length, 1)
  assert.equal(records.shortcuts[0].id, 'workspace.git')
  assert.equal(records.shortcuts[0].label(), 'title')
  assert.deepEqual(records.shortcuts[0].resolve({ target: null }), { status: 'blocked', reason: 'shortcut.noSession' })
  assert.equal(typeof records.shortcuts[0].defaults['web:windows'].code, 'string')

  // The shortcut opens the page for the resolved target.
  let opened = null
  const custom = createFakeContext({
    sidebarRight: {
      commandTarget: () => ({ sessionId: 's', paneId: 'p', host: 'dock' }),
      openTabFromTarget: (kind, target) => { opened = { kind, target } },
    },
  })
  module.apply(custom.ctx)
  const handled = custom.records.shortcuts[0].resolve({ target: {} })
  assert.equal(handled.status, 'handled')
  handled.run()
  assert.equal(opened.kind, 'git')
  assert.equal(opened.target.sessionId, 's')
})

test('components render without a browser and expose stable markup entry points', async () => {
  const { registration } = await loadClientBundle()
  const module = bundleModule(registration)
  const fake = createFakeContext()
  module.apply(fake.ctx)
  const bySeat = new Map(fake.records.slots.map(({ options, component }) => [`${options.name}:${options.key}`, component]))
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

  // A commit-scoped diff names the commit in the tab title, so two revisions
  // of the same file do not read as the same tab.
  const commitTab = {
    ...tab,
    navigation: { address: 'sidebar://git-diff', params: { path: 'src/app.js', commit: 'a'.repeat(40), shortOid: 'aaaaaaa' }, revision: 1 },
  }
  const commitTitleElement = diffTitle({ t: translate, useTabInfo: () => ({ sidebar: {}, panel: {}, tab: commitTab }) })
  assert.match(JSON.stringify(commitTitleElement), /aaaaaaa/)

  // A diff tab that restored without navigation parameters shows its picker prompt.
  const restoredTab = { ...tab, navigation: { address: 'sidebar://git-diff', params: undefined, revision: 0 } }
  const restored = diffPanel({ sessionId: 'session-1', t: translate, useTabInfo: () => ({ sidebar: {}, panel: {}, tab: restoredTab }) })
  assert.equal(restored.props.className, 'dshgg-diffRoot')
})

test('the bundle contributes row, group, commit, and diff context-menu actions', async () => {
  const { registration } = await loadClientBundle()
  const module = bundleModule(registration)
  const fake = createFakeContext()
  module.apply(fake.ctx)
  const { contributions } = fake.menu
  assert.equal(contributions.length, 1)
  const contribution = contributions[0]
  assert.equal(contribution.id, 'git-graph.actions')
  assert.equal(contribution.target, 'gitGraphItem')
  assert.equal(typeof contribution.resolve, 'function')

  const resolve = (value) => fake.menu.views({ kind: 'gitGraphItem', value })
  const ids = (value) => MENU_IDS(resolve(value))

  // The registry hands the contribution the captured value, so an invoked row
  // always yields its commands (an empty list here means the menu opens empty).
  assert.ok(resolve({ sessionId: 's1', kind: 'file', section: 'changes', path: 'src/app.js', cwd: '/repo' }).length > 0)

  // Unstaged files offer opening, staging, discarding, and copying both paths.
  const changes = resolve({ sessionId: 's1', kind: 'file', section: 'changes', path: 'src/app.js', cwd: '/repo' })
  assert.deepEqual(MENU_IDS(changes), [
    menuActionId('open'),
    menuActionId('stage'),
    menuActionId('discard'),
    menuActionId('copy-relative'),
    menuActionId('copy-path'),
  ])
  assert.equal(changes[0].label, 'menu.openDiff')
  assert.equal(changes[1].label, 'actions.stage')
  assert.equal(changes[1].separatorBefore, true)
  assert.equal(changes[2].label, 'actions.discard')
  assert.equal(changes[2].danger, true)
  assert.equal(changes[3].label, 'menu.copyRelativePath')
  assert.equal(changes[4].label, 'menu.copyPath')

  // Staged files offer unstaging instead of staging and discarding.
  assert.deepEqual(ids({ sessionId: 's1', kind: 'file', section: 'staged', path: 'src/app.js', cwd: '/repo' }),
    [menuActionId('open'), menuActionId('unstage'), menuActionId('copy-relative'), menuActionId('copy-path')])
  // Conflicted files can be staged but not discarded.
  assert.deepEqual(ids({ sessionId: 's1', kind: 'file', section: 'merge', path: 'merge.txt', cwd: '/repo' }),
    [menuActionId('open'), menuActionId('stage'), menuActionId('copy-relative'), menuActionId('copy-path')])
  // A captured target without a path or session resolves to nothing.
  assert.deepEqual(ids({ sessionId: 's1', kind: 'file', section: 'changes' }), [])
  assert.deepEqual(ids({ kind: 'file', section: 'changes', path: 'a' }), [])

  // Folders act on everything below them.
  const folder = resolve({ sessionId: 's1', kind: 'folder', section: 'changes', path: 'src', paths: ['src/a.js', 'src/b.js'], cwd: '/repo' })
  assert.deepEqual(MENU_IDS(folder), [
    menuActionId('stage-all'),
    menuActionId('discard-all'),
    menuActionId('copy-relative'),
    menuActionId('copy-path'),
  ])
  assert.deepEqual(ids({ sessionId: 's1', kind: 'folder', section: 'staged', path: 'src', paths: ['src/a.js'], cwd: '/repo' }),
    [menuActionId('unstage-all'), menuActionId('copy-relative'), menuActionId('copy-path')])
  assert.deepEqual(ids({ sessionId: 's1', kind: 'folder', section: 'changes', path: 'src', paths: [] }), [])

  // Group headers stage, unstage, discard, and refresh the whole group.
  assert.deepEqual(ids({ sessionId: 's1', kind: 'section', section: 'changes' }),
    [menuActionId('stage-all'), menuActionId('discard-all'), menuActionId('refresh')])
  assert.deepEqual(ids({ sessionId: 's1', kind: 'section', section: 'staged' }),
    [menuActionId('unstage-all'), menuActionId('refresh')])
  assert.deepEqual(ids({ sessionId: 's1', kind: 'section', section: 'merge' }), [menuActionId('stage-all')])
  const graphSection = resolve({ sessionId: 's1', kind: 'section', section: 'graph' })
  assert.deepEqual(MENU_IDS(graphSection), [menuActionId('refresh')])
  assert.equal(graphSection[0].label, 'menu.refreshHistory')

  // Commit rows copy the full identifier and the message.
  const commit = resolve({ sessionId: 's1', kind: 'commit', oid: 'a'.repeat(40), shortOid: 'aaaaaaa', subject: 'Fix it' })
  assert.deepEqual(MENU_IDS(commit), [menuActionId('copy-id'), menuActionId('copy-message')])
  assert.equal(commit[0].label, 'menu.copyCommitId')
  assert.equal(commit[1].label, 'menu.copyCommitSubject')

  // The diff header copies the file's paths.
  assert.deepEqual(ids({ sessionId: 's1', kind: 'diff', path: 'src/app.js', cwd: '/repo' }),
    [menuActionId('copy-relative'), menuActionId('copy-path')])
  assert.deepEqual(ids({ sessionId: 's1', kind: 'diff', path: 'src/app.js' }), [menuActionId('copy-relative')])

  // While the panel is busy, mutating actions are disabled and copies are not.
  const busyFile = resolve({ sessionId: 's1', kind: 'file', section: 'changes', path: 'src/app.js', cwd: '/repo', busy: true })
  assert.deepEqual(busyFile.filter((action) => action.disabled === true).map((action) => action.id),
    [menuActionId('open'), menuActionId('stage'), menuActionId('discard')])
  assert.equal(busyFile.find((action) => action.id === menuActionId('copy-relative')).disabled, undefined)
  const busySection = resolve({ sessionId: 's1', kind: 'section', section: 'changes', busy: true })
  assert.ok(busySection.every((action) => action.disabled === true))

  // Menu labels exist in both dictionaries.
  const labels = createFakeContext()
  module.apply(labels.ctx)
  const twoDictionaries = labels.records.localeDictionaries[0].dictionaries
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
  const { registration } = await loadClientBundle()
  const module = bundleModule(registration)
  const fake = createFakeContext()
  module.apply(fake.ctx)
  const { contributions, notifications } = fake.menu
  assert.equal(contributions.length, 1, 'no context-menu contribution was registered')
  assert.equal(typeof contributions[0].resolve, 'function')

  // Each select reopens the menu occurrence, as the real overlay does.
  const runMenuAction = (value, id) => fake.menu.select({ kind: 'gitGraphItem', value }, menuActionId(id))
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const copied = []
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: async (text) => { copied.push(text) } } },
      configurable: true,
    })
    const file = { sessionId: 's1', kind: 'file', section: 'changes', path: 'src/app.js', cwd: '/repo' }
    await runMenuAction(file, 'copy-relative')
    assert.deepEqual(copied, ['src/app.js'])
    assert.deepEqual(notifications.pop(), { text: 'menu.copiedRelativePath', success: true })
    await runMenuAction(file, 'copy-path')
    assert.deepEqual(copied, ['src/app.js', '/repo/src/app.js'])
    assert.deepEqual(notifications.pop(), { text: 'menu.copiedPath', success: true })

    const commit = { sessionId: 's1', kind: 'commit', oid: 'a'.repeat(40), shortOid: 'aaaaaaa', subject: 'Fix it' }
    await runMenuAction(commit, 'copy-id')
    assert.equal(copied.at(-1), 'a'.repeat(40))
    assert.deepEqual(notifications.pop(), { text: 'menu.copiedCommitId', success: true })
    await runMenuAction(commit, 'copy-message')
    assert.equal(copied.at(-1), 'Fix it')
    assert.deepEqual(notifications.pop(), { text: 'menu.copiedCommitSubject', success: true })

    // A Windows working directory keeps native separators in the copied path.
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: async (text) => { copied.push(text) } } },
      configurable: true,
    })
    await runMenuAction({ sessionId: 's1', kind: 'file', section: 'changes', path: 'src/app.js', cwd: 'C:\\repo' }, 'copy-path')
    assert.equal(copied.at(-1), 'C:\\repo\\src\\app.js')

    // A refusing clipboard is reported instead of being ignored.
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: async () => { throw new Error('denied') } } },
      configurable: true,
    })
    await runMenuAction(file, 'copy-relative')
    assert.deepEqual(notifications.pop(), { text: 'menu.copyFailed', success: false })
  } finally {
    if (previousNavigator === undefined) delete globalThis.navigator
    else Object.defineProperty(globalThis, 'navigator', previousNavigator)
  }
})
