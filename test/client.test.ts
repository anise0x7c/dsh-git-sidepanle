/**
 * Client-half registration tests.
 *
 * A stub module loader, React, and Cordis context let the browser bundle
 * evaluate in Node: registration shapes, locale dictionaries, guide metadata,
 * the shortcut, and the component render paths are checked without a browser.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFakeContext, loadClientBundle, translate } from './support/fake-ctx.ts'
import type {
  CapturedTargetValue,
  ClientModule,
  ClientRegistration,
  HarnessReact,
  SidebarRightTarget,
  TestComponent,
  TestElement,
  TestMenuActionView,
  TestNode,
  TestProps,
} from './support/types.ts'

/** Narrow one rendered node to an element; a test that mounts a component expects one. */
function element(node: TestNode): TestElement {
  assert.ok(
    typeof node === 'object' && node !== null && !Array.isArray(node),
    'expected a rendered element',
  )
  return node as TestElement
}

/** Read one slot component from the recorded seats, failing loudly when absent. */
function slotComponent(seats: Map<string, TestComponent>, seat: string): TestComponent {
  const component = seats.get(seat)
  assert.ok(component !== undefined, `no slot component registered for ${seat}`)
  return component
}

/** Minimal element shape the stub React returns. */
function createElement(type: unknown, props: TestProps, ...children: TestNode[]): TestElement {
  return { type, props: props ?? {}, children }
}

const fakeReact: HarnessReact = {
  createElement,
  Fragment: Symbol('Fragment'),
  useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void] {
    return [typeof initial === 'function' ? (initial as () => T)() : initial, () => {}]
  },
  useEffect() {},
  useLayoutEffect() {},
  useId: () => 'test-react',
  useMemo<T>(factory: () => T) {
    return factory()
  },
  useCallback<T extends (...args: never[]) => unknown>(callback: T) {
    return callback
  },
  useRef<T>(value: T) {
    return { current: value }
  },
}

/** Contribution id of the bundle's context-menu provider. */
const MENU_ID = 'git-graph.actions'

/** A resolved action id as the shared registry publishes it. */
const menuActionId = (id: string): string => `${MENU_ID}/${id}`

/** Resolved action ids in overlay order. */
const MENU_IDS = (views: readonly TestMenuActionView[]): string[] => views.map((view) => view.id)

/**
 * Evaluate the bundle factory against the stub React.
 * @param registration - module-loader registration.
 * @returns evaluated bundle module.
 */
function bundleModule(registration: ClientRegistration): ClientModule {
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
  const styleTag = styleTags[0]
  assert.ok(styleTag)
  assert.equal(styleTag.getAttribute('data-plugin'), '@local/dsh-git-graph')
  const graphStyles = styleTag.textContent
  // The graph's palette: VS Code's Source Control Graph colors tuned slightly
  // more vivid with each hue held, plus light and dark reference variants.
  for (const [name, value] of [
    ['lane1', '#ffb300'],
    ['lane2', '#e3007f'],
    ['lane3', '#a85600'],
    ['lane4', '#2cb2a7'],
    ['lane5', '#b266ff'],
    ['ref', '#0a7eff'],
    ['remote', '#672696'],
    ['base', '#f26100'],
  ]) {
    assert.match(graphStyles, new RegExp(`--dshgg-scm-${name}: ${value};`))
  }
  assert.match(
    graphStyles,
    /body\[data-ds-dark-theme\] \.dshgg-root\s*\{[^}]*--dshgg-scm-ref: #2e91ff;[^}]*--dshgg-scm-remote: #b37ddd;/,
  )
  // VS Code row metrics: 22px rows, one ellipsized label, badges that keep their size.
  assert.match(graphStyles, /\.dshgg-graphRow\s*\{[^}]*height: 22px;/)
  assert.match(graphStyles, /\.dshgg-graphLabel\s*\{[^}]*text-overflow: ellipsis;/)
  assert.match(graphStyles, /\.dshgg-graphBadges\s*\{[^}]*flex-shrink: 0;/)
  assert.match(graphStyles, /\.dshgg-graphBadgeName\s*\{[^}]*max-width: 100px;/)
  // The lines of the whole graph share one layer, so a lane that crosses a row
  // boundary is a single stroke; the layer is positioned against the rows' own
  // inset and paints over their hover surface without taking their pointer.
  assert.match(graphStyles, /\.dshgg-graphBody\s*\{[^}]*position: relative;/)
  assert.match(
    graphStyles,
    /\.dshgg-graphRow\s*\{[^}]*padding: 0 6px 0 var\(--dshgg-graph-inset\);/,
  )
  assert.match(
    graphStyles,
    /\.dshgg-graphLayer\s*\{[^}]*position: absolute;[^}]*top: 0;[^}]*left: var\(--dshgg-graph-inset\);[^}]*pointer-events: none;/,
  )
  assert.match(graphStyles, /\.dshgg-graphEdge\s*\{[^}]*stroke-linecap: round;/)
  // Panel chrome follows the host: standard divider color, larger section
  // titles and two independently scrolling panes.
  assert.match(
    graphStyles,
    /\.dshgg-toolbar\s*\{[^}]*height: 38px;[^}]*box-sizing: border-box;[^}]*border-bottom: 0\.5px solid var\(--dsw-alias-border-l3\);/,
  )
  assert.match(
    graphStyles,
    /\.dshgg-commitFilesHeader\s*\{[^}]*border-top: 0\.5px solid var\(--dsw-alias-border-l3\);/,
  )
  assert.match(
    graphStyles,
    /\.dshgg-diffHeader\s*\{[^}]*height: 38px;[^}]*box-sizing: border-box;[^}]*border-bottom: 0\.5px solid var\(--dsw-alias-border-l3\);/,
  )
  assert.match(
    graphStyles,
    /\.dshgg-splitterLine\s*\{[^}]*background: var\(--dsw-alias-border-l3\);/,
  )
  // The details card borrows the operation prompt's frosted menu surface and
  // keeps the solid layer as its fallback; its clipped shadow was removed.
  assert.match(
    graphStyles,
    /\.dshgg-root \.dshgg-commitCard\s*\{[^}]*background: var\(--dsw-alias-bg-layer-1\);[^}]*border: 0\.5px solid var\(--dsw-alias-border-l1\);/,
  )
  assert.doesNotMatch(
    graphStyles,
    /\.dshgg-root \.dshgg-commitCard\s*\{[^}]*box-shadow:/,
    'the details card paints no shadow',
  )
  assert.match(
    graphStyles,
    /@supports \(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\) \{[\s\S]*?\.dshgg-root \.dshgg-commitCard/,
    'the frosted enhancement reaches the built stylesheet',
  )
  assert.match(
    graphStyles,
    /\.dshgg-sectionToggle\s*\{[^}]*font: var\(--dsw-font-s-strong-14\);[^}]*font-weight: 600;/,
  )
  // Section headers rest flush at the pane's top edge on the host surface, so
  // the rows pass hidden beneath them and beginning to scroll never shifts the
  // header. The header owns that surface (a floating tab uses layer-2 instead
  // of the docked tab host's base fill) and keeps the host hover highlight as
  // a rounded layer above the surface, so hovering keeps working while the
  // rows stay masked.
  assert.match(
    graphStyles,
    /\.dshgg-sectionHeader\s*\{[^}]*position: sticky;[^}]*top: 0;[^}]*z-index: 1;[^}]*background: var\(--dsw-alias-bg-base\);/,
  )
  assert.match(
    graphStyles,
    /\[data-dockkit-float\] \.dshgg-sectionHeader\s*\{[^}]*background: var\(--dsw-alias-bg-layer-2\);/,
  )
  assert.doesNotMatch(graphStyles, /--dshgg-section-inset/)
  assert.doesNotMatch(graphStyles, /\.dshgg-sectionHeader\s*\{[^}]*box-shadow:/)
  assert.match(
    graphStyles,
    /\.dshgg-sectionHeader::before\s*\{[^}]*border-radius: var\(--dsw-radius-md\);[^}]*background: var\(--dsw-alias-interactive-bg-hover\);[^}]*opacity: 0;/,
  )
  assert.match(
    graphStyles,
    /@media \(hover: hover\) \{\s*\.dshgg-sectionHeader:hover::before \{\s*opacity: 1;\s*\}\s*\}/,
  )
  // The scroll frame is free of top padding and has no inset above the first
  // section: the first header starts at the pane's top edge, so its own
  // surface covers the edge and no row can appear above it.
  assert.match(graphStyles, /\.dshgg-scroll\s*\{[^}]*gap: 2px;[^}]*padding: 0 6px 10px;/)
  assert.doesNotMatch(graphStyles, /\.dshgg-scroll > \.dshgg-section:first-child/)
  assert.match(graphStyles, /\.dshgg-paneTop\s*\{[^}]*flex: 0 0 auto;/)
  assert.match(graphStyles, /\.dshgg-paneBottom\s*\{[^}]*flex: 1 1 0;/)
  assert.doesNotMatch(graphStyles, /\.dshgg-cleanIcon/)
  assert.equal(records.localeDictionaries.length, 1)
  const registrationRecord = records.localeDictionaries[0]
  assert.ok(registrationRecord)
  assert.equal(registrationRecord.namespace, 'gitGraph')
  assert.ok(registrationRecord.dictionaries.en?.title)
  assert.ok(registrationRecord.dictionaries.zh?.title)
  assert.deepEqual(
    Object.keys(registrationRecord.dictionaries.en).sort(),
    Object.keys(registrationRecord.dictionaries.zh).sort(),
  )

  assert.deepEqual(
    records.tabTypes.map((definition) => definition.kind),
    ['git', 'git-diff'],
  )
  const gitType = records.tabTypes[0]
  assert.ok(gitType)
  assert.equal(gitType.id, '@local/dsh-git-graph/git')
  assert.equal(gitType.title('x'), 'title')
  assert.ok(gitType.guide)
  assert.equal(gitType.guide.length, 1)
  const guide = gitType.guide[0]
  assert.ok(guide)
  assert.equal(guide.commandId, 'workspace.git')
  assert.equal(guide.title(), 'guideTitle')
  assert.equal(typeof guide.icon, 'function')
  assert.ok(guide.icon)
  const icon = guide.icon as unknown as TestComponent
  const iconElement = element(icon({ size: 16 }))
  assert.equal(iconElement.type, 'svg')
  const diffType = records.tabTypes[1]
  assert.ok(diffType)
  assert.deepEqual(diffType, {
    id: '@local/dsh-git-graph/diff',
    kind: 'git-diff',
    title: diffType.title,
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
  const gitBody = records.slots.find(
    ({ options }) =>
      options.name === 'sidebar.right.pane.tab' && options.key === '@local/dsh-git-graph/git',
  )
  assert.ok(gitBody, 'the Git pane body was not registered')
  assert.equal(typeof gitBody.options.inject, 'function', 'the Git pane injects its Toast face')
  assert.equal(typeof gitBody.options.inject?.().notify, 'function')
  const diffBody = records.slots.find(
    ({ options }) =>
      options.name === 'sidebar.right.pane.tab' && options.key === '@local/dsh-git-graph/diff',
  )
  assert.ok(diffBody, 'the diff pane body was not registered')
  assert.equal(typeof diffBody.options.inject, 'function', 'the diff pane injects its Toast face')
  assert.equal(typeof diffBody.options.inject?.().notify, 'function')
  for (const slot of records.slots) {
    if (slot !== gitBody && slot !== diffBody) {
      assert.equal(slot.options.inject, undefined, 'other seats stay plain')
    }
  }

  assert.equal(records.shortcuts.length, 1)
  const shortcut = records.shortcuts[0]
  assert.ok(shortcut)
  assert.equal(shortcut.id, 'workspace.git')
  assert.equal(shortcut.label(), 'title')
  assert.deepEqual(shortcut.resolve({ target: null }), {
    status: 'blocked',
    reason: 'shortcut.noSession',
  })
  const windowsBinding = shortcut.defaults['web:windows']
  assert.ok(windowsBinding)
  assert.equal(typeof windowsBinding.code, 'string')

  // The shortcut opens the page for the resolved target.
  const opened: { value: { kind: string; target: SidebarRightTarget } | null } = { value: null }
  const custom = createFakeContext({
    sidebarRight: {
      commandTarget: (): SidebarRightTarget => ({ sessionId: 's', paneId: 'p', host: 'dock' }),
      openTabFromTarget: (kind: string, target: SidebarRightTarget) => {
        opened.value = { kind, target }
      },
    },
  })
  module.apply(custom.ctx)
  const customShortcut = custom.records.shortcuts[0]
  assert.ok(customShortcut)
  // The resolver only checks that a DOM target exists, so the stub stands in
  // for the focused element rather than a real Node tree.
  const handled = customShortcut.resolve({ target: {} as unknown as Element })
  assert.ok(handled.status === 'handled')
  handled.run()
  assert.ok(opened.value)
  assert.equal(opened.value.kind, 'git')
  assert.equal(opened.value.target.sessionId, 's')
})

test('components render without a browser and expose stable markup entry points', async () => {
  const { registration } = await loadClientBundle()
  const module = bundleModule(registration)
  const fake = createFakeContext()
  module.apply(fake.ctx)
  // Mirror the host's Slot composition: merge each registration's inject face
  // into the props the component receives.
  const bySeat = new Map(
    fake.records.slots.map(({ options, component }) => {
      const face = options.inject?.() ?? {}
      const injected: TestComponent = (props) => component({ ...props, ...face })
      return [`${options.name}:${options.key}`, injected]
    }),
  )
  const gitPanel = slotComponent(bySeat, 'sidebar.right.pane.tab:@local/dsh-git-graph/git')
  const diffPanel = slotComponent(bySeat, 'sidebar.right.pane.tab:@local/dsh-git-graph/diff')
  const gitTitle = slotComponent(bySeat, 'sidebar.right.pane.tab.title:@local/dsh-git-graph/git')
  const diffTitle = slotComponent(bySeat, 'sidebar.right.pane.tab.title:@local/dsh-git-graph/diff')
  assert.equal(typeof gitPanel, 'function')
  assert.equal(typeof diffPanel, 'function')

  const tab = {
    id: 'tab-1',
    title: 'Source control',
    visible: true,
    signal: new AbortController().signal,
    actions: {
      openTab: () => {},
      openResource: () => {},
      close: () => {},
      bindCommands: () => () => {},
    },
    navigation: { address: 'sidebar://git', params: {}, revision: 0 },
  }
  const useTabInfo = () => ({
    sidebar: { expanded: true, fullscreen: false },
    panel: { id: 'pane-1', isFloating: false },
    tab,
  })

  const panelElement = element(
    gitPanel({ sessionId: 'session-1', t: translate, useTabInfo, useSessions: () => undefined }),
  )
  assert.equal(panelElement.type, 'div')
  assert.equal(panelElement.props.className, 'dshgg-root')
  assert.ok(panelElement.props['data-dsh-git-graph'] !== undefined)

  const diffElement = element(diffPanel({ sessionId: 'session-1', t: translate, useTabInfo }))
  assert.equal(diffElement.type, 'div')
  assert.equal(diffElement.props.className, 'dshgg-diffRoot')

  const gitTitleElement = element(gitTitle({ t: translate, useTabInfo }))
  assert.equal(gitTitleElement.type, 'span')
  const diffTitleElement = element(diffTitle({ t: translate, useTabInfo }))
  assert.equal(diffTitleElement.type, 'span')

  // A commit-scoped diff names the commit in the tab title, so two revisions
  // of the same file do not read as the same tab.
  const commitTab = {
    ...tab,
    navigation: {
      address: 'sidebar://git-diff',
      params: { path: 'src/app.js', commit: 'a'.repeat(40), shortOid: 'aaaaaaa' },
      revision: 1,
    },
  }
  const commitTitleElement = element(
    diffTitle({ t: translate, useTabInfo: () => ({ sidebar: {}, panel: {}, tab: commitTab }) }),
  )
  assert.match(JSON.stringify(commitTitleElement), /aaaaaaa/)

  // A diff tab that restored without navigation parameters shows its picker prompt.
  const restoredTab = {
    ...tab,
    navigation: { address: 'sidebar://git-diff', params: undefined, revision: 0 },
  }
  const restored = element(
    diffPanel({
      sessionId: 'session-1',
      t: translate,
      useTabInfo: () => ({ sidebar: {}, panel: {}, tab: restoredTab }),
    }),
  )
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
  assert.ok(contribution, 'no context-menu contribution was registered')
  assert.equal(contribution.id, 'git-graph.actions')
  assert.equal(contribution.target, 'gitGraphItem')
  assert.equal(typeof contribution.resolve, 'function')

  const resolve = (value: CapturedTargetValue): TestMenuActionView[] =>
    fake.menu.views({ kind: 'gitGraphItem', value })
  const ids = (value: CapturedTargetValue): string[] => MENU_IDS(resolve(value))

  // The registry hands the contribution the captured value, so an invoked row
  // always yields its commands (an empty list here means the menu opens empty).
  assert.ok(
    resolve({ sessionId: 's1', kind: 'file', section: 'changes', path: 'src/app.js', cwd: '/repo' })
      .length > 0,
  )

  // Unstaged files offer opening, staging, discarding, and copying both paths.
  const changes = resolve({
    sessionId: 's1',
    kind: 'file',
    section: 'changes',
    path: 'src/app.js',
    cwd: '/repo',
  })
  assert.deepEqual(MENU_IDS(changes), [
    menuActionId('open'),
    menuActionId('stage'),
    menuActionId('discard'),
    menuActionId('ignore'),
    menuActionId('copy-relative'),
    menuActionId('copy-path'),
  ])
  const [openChange, stageChange, discardChange, ignoreChange, relativeChange, pathChange] = changes
  assert.ok(openChange, 'the unstaged file menu has no open action')
  assert.ok(stageChange, 'the unstaged file menu has no stage action')
  assert.ok(discardChange, 'the unstaged file menu has no discard action')
  assert.ok(ignoreChange, 'the unstaged file menu has no ignore action')
  assert.ok(relativeChange, 'the unstaged file menu has no copy-relative action')
  assert.ok(pathChange, 'the unstaged file menu has no copy-path action')
  assert.equal(openChange.label, 'menu.openDiff')
  assert.equal(stageChange.label, 'actions.stage')
  assert.equal(stageChange.separatorBefore, true)
  assert.equal(discardChange.label, 'actions.discard')
  assert.equal(discardChange.danger, true)
  assert.equal(ignoreChange.label, 'menu.addToGitignore')
  assert.equal(relativeChange.label, 'menu.copyRelativePath')
  assert.equal(pathChange.label, 'menu.copyPath')

  // Staged files offer unstaging instead of staging and discarding.
  assert.deepEqual(
    ids({ sessionId: 's1', kind: 'file', section: 'staged', path: 'src/app.js', cwd: '/repo' }),
    [
      menuActionId('open'),
      menuActionId('unstage'),
      menuActionId('ignore'),
      menuActionId('copy-relative'),
      menuActionId('copy-path'),
    ],
  )
  // Conflicted files can be staged but not discarded.
  assert.deepEqual(
    ids({ sessionId: 's1', kind: 'file', section: 'merge', path: 'merge.txt', cwd: '/repo' }),
    [
      menuActionId('open'),
      menuActionId('stage'),
      menuActionId('ignore'),
      menuActionId('copy-relative'),
      menuActionId('copy-path'),
    ],
  )
  // A captured target without a path or session resolves to nothing.
  assert.deepEqual(ids({ sessionId: 's1', kind: 'file', section: 'changes' }), [])
  assert.deepEqual(ids({ kind: 'file', section: 'changes', path: 'a' }), [])
  // Folder rows are gone: their former target kinds have no commands.
  assert.deepEqual(
    ids({ sessionId: 's1', kind: 'folder', section: 'changes', path: 'src', paths: ['src/a.js'] }),
    [],
  )

  // Group headers stage, unstage, discard, and refresh the whole group.
  assert.deepEqual(ids({ sessionId: 's1', kind: 'section', section: 'changes' }), [
    menuActionId('stage-all'),
    menuActionId('discard-all'),
    menuActionId('refresh'),
  ])
  assert.deepEqual(ids({ sessionId: 's1', kind: 'section', section: 'staged' }), [
    menuActionId('unstage-all'),
    menuActionId('refresh'),
  ])
  assert.deepEqual(ids({ sessionId: 's1', kind: 'section', section: 'merge' }), [
    menuActionId('stage-all'),
  ])
  const graphSection = resolve({ sessionId: 's1', kind: 'section', section: 'graph' })
  assert.deepEqual(MENU_IDS(graphSection), [menuActionId('refresh')])
  const refreshHistory = graphSection[0]
  assert.ok(refreshHistory, 'the graph section menu has no refresh action')
  assert.equal(refreshHistory.label, 'menu.refreshHistory')

  // Ordinary commits lead with View Details, then group checkout and reference
  // creation before the copies.
  const commit = resolve({
    sessionId: 's1',
    kind: 'commit',
    oid: 'a'.repeat(40),
    shortOid: 'aaaaaaa',
    subject: 'Fix it',
  })
  assert.deepEqual(MENU_IDS(commit), [
    menuActionId('view-details'),
    menuActionId('checkout-detached'),
    menuActionId('create-branch'),
    menuActionId('create-tag'),
    menuActionId('copy-id'),
    menuActionId('copy-message'),
  ])
  const [viewDetails, checkoutDetached, createBranch, , copyCommitId, copyCommitSubject] = commit
  assert.ok(viewDetails, 'the commit menu has no view-details action')
  assert.equal(viewDetails.label, 'menu.viewDetails')
  assert.ok(checkoutDetached, 'the commit menu has no checkout action')
  assert.equal(checkoutDetached.separatorBefore, true)
  assert.ok(createBranch, 'the commit menu has no create-branch action')
  assert.ok(copyCommitId, 'the commit menu has no copy-id action')
  assert.ok(copyCommitSubject, 'the commit menu has no copy-subject action')
  assert.equal(checkoutDetached.label, 'menu.checkoutDetached')
  assert.equal(createBranch.separatorBefore, true)
  assert.equal(copyCommitId.label, 'menu.copyCommitId')
  assert.equal(copyCommitSubject.label, 'menu.copyCommitSubject')
  const branchHead = resolve({
    sessionId: 's1',
    kind: 'commit',
    oid: 'a'.repeat(40),
    subject: 'Fix it',
    branchHeads: [
      { name: 'main', current: true },
      { name: 'feature', current: false },
    ],
  })
  const checkout = branchHead.find((action) => action.id === menuActionId('checkout'))
  const remove = branchHead.find((action) => action.id === menuActionId('delete-branch'))
  const checkoutChild = checkout?.children?.[0]
  const removeChild = remove?.children?.[0]
  assert.ok(checkoutChild, 'the checkout action has no branch entries')
  assert.ok(removeChild, 'the delete-branch action has no branch entries')
  assert.equal(checkoutChild.disabled, true)
  assert.equal(removeChild.id, `${menuActionId('delete-branch')}/feature`)

  // The diff header copies the file's paths.
  assert.deepEqual(ids({ sessionId: 's1', kind: 'diff', path: 'src/app.js', cwd: '/repo' }), [
    menuActionId('copy-relative'),
    menuActionId('copy-path'),
  ])
  assert.deepEqual(ids({ sessionId: 's1', kind: 'diff', path: 'src/app.js' }), [
    menuActionId('copy-relative'),
  ])

  // While the panel is busy, mutating actions are disabled and copies are not.
  const busyFile = resolve({
    sessionId: 's1',
    kind: 'file',
    section: 'changes',
    path: 'src/app.js',
    cwd: '/repo',
    busy: true,
  })
  assert.deepEqual(
    busyFile.filter((action) => action.disabled === true).map((action) => action.id),
    [menuActionId('open'), menuActionId('stage'), menuActionId('discard'), menuActionId('ignore')],
  )
  const busyCopy = busyFile.find((action) => action.id === menuActionId('copy-relative'))
  assert.ok(busyCopy)
  assert.equal(busyCopy.disabled, undefined)
  const busySection = resolve({ sessionId: 's1', kind: 'section', section: 'changes', busy: true })
  assert.ok(busySection.every((action) => action.disabled === true))

  // Menu labels exist in both dictionaries.
  const labels = createFakeContext()
  module.apply(labels.ctx)
  const labelsRecord = labels.records.localeDictionaries[0]
  assert.ok(labelsRecord)
  const twoDictionaries = labelsRecord.dictionaries
  for (const locale of ['en', 'zh']) {
    const dictionary = twoDictionaries[locale]
    assert.ok(dictionary, `the ${locale} dictionary was not registered`)
    for (const key of [
      'menu.openDiff',
      'menu.copyRelativePath',
      'menu.copyPath',
      'menu.copyCommitId',
      'menu.copyCommitSubject',
      'menu.refreshHistory',
      'menu.hint',
      'menu.stale',
      'menu.busy',
      'menu.copiedRelativePath',
      'menu.copiedPath',
      'menu.copiedCommitId',
      'menu.copiedCommitSubject',
      'menu.copyFailed',
    ]) {
      assert.equal(typeof dictionary[key], 'string', `${locale} is missing ${key}`)
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
  const contribution = contributions[0]
  assert.ok(contribution, 'no context-menu contribution was registered')
  assert.equal(typeof contribution.resolve, 'function')

  // Each select reopens the menu occurrence, as the real overlay does.
  const runMenuAction = (value: CapturedTargetValue, id: string): Promise<void> =>
    fake.menu.select({ kind: 'gitGraphItem', value }, menuActionId(id))
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const copied: string[] = []
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: async (text: string) => {
            copied.push(text)
          },
        },
      },
      configurable: true,
    })
    const file = {
      sessionId: 's1',
      kind: 'file',
      section: 'changes',
      path: 'src/app.js',
      cwd: '/repo',
    }
    await runMenuAction(file, 'copy-relative')
    assert.deepEqual(copied, ['src/app.js'])
    assert.deepEqual(notifications.pop(), { text: 'menu.copiedRelativePath', success: true })
    await runMenuAction(file, 'copy-path')
    assert.deepEqual(copied, ['src/app.js', '/repo/src/app.js'])
    assert.deepEqual(notifications.pop(), { text: 'menu.copiedPath', success: true })

    const commit = {
      sessionId: 's1',
      kind: 'commit',
      oid: 'a'.repeat(40),
      shortOid: 'aaaaaaa',
      subject: 'Fix it',
    }
    await runMenuAction(commit, 'copy-id')
    assert.equal(copied.at(-1), 'a'.repeat(40))
    assert.deepEqual(notifications.pop(), { text: 'menu.copiedCommitId', success: true })
    await runMenuAction(commit, 'copy-message')
    assert.equal(copied.at(-1), 'Fix it')
    assert.deepEqual(notifications.pop(), { text: 'menu.copiedCommitSubject', success: true })

    // A Windows working directory keeps native separators in the copied path.
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: async (text: string) => {
            copied.push(text)
          },
        },
      },
      configurable: true,
    })
    await runMenuAction(
      { sessionId: 's1', kind: 'file', section: 'changes', path: 'src/app.js', cwd: 'C:\\repo' },
      'copy-path',
    )
    assert.equal(copied.at(-1), 'C:\\repo\\src\\app.js')

    // A refusing clipboard is reported instead of being ignored.
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: async () => {
            throw new Error('denied')
          },
        },
      },
      configurable: true,
    })
    await runMenuAction(file, 'copy-relative')
    assert.deepEqual(notifications.pop(), { text: 'menu.copyFailed', success: false })
  } finally {
    if (previousNavigator === undefined) Reflect.deleteProperty(globalThis, 'navigator')
    else Object.defineProperty(globalThis, 'navigator', previousNavigator)
  }
})
