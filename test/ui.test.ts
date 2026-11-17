/**
 * Browser-half behavior tests over a tiny React renderer.
 *
 * These mount the real panel and diff components, feed them canned Host
 * responses, click the same controls a user clicks, and assert the requests the
 * Host receives.
 */

import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import type {
  BranchesResult,
  ChangeEntry,
  CommitDetails,
  GraphReferences,
  HistoryResult,
  StatusResult,
  WatchState,
} from '../src/shared/git.ts'
import { createFakeContext, loadClientBundle, translate } from './support/fake-ctx.ts'
import { createMenuMock } from './support/fake-menu.ts'
import {
  BRANCHES,
  COMMIT_DETAILS,
  createRepo,
  createStatus,
  HISTORY,
  STATUS,
} from './support/fixtures.ts'
import { createHarness } from './support/mini-react.ts'
import type {
  CapturedTarget,
  ClientRegistration,
  ContextMenuContribution,
  FetchResponseLike,
  MenuMock,
  OpenedTab,
  RpcRequestRecord,
  TestComponent,
  TestContextMenusService,
  TestElement,
  TestEventTarget,
  TestHarness,
  TestMenuActionView,
  TestNode,
  TestProps,
} from './support/types.ts'

/** The tab fixture the mounted panel reads through `useTabInfo`. */
interface UiTab {
  id: string
  title: string
  visible: boolean
  signal: AbortSignal
  actions: {
    openTab(kind: string, options: { params: Record<string, unknown> }): void
    openResource(): void
    close(): void
    bindCommands(): () => void
  }
  navigation: { address?: string; params?: Record<string, unknown>; revision: number }
}

/** One tab-info hook stand-in. */
type UiTabInfo = () => TestProps

/** Mount options a test may override. */
interface MountOptions {
  status?: StatusResult
  history?: HistoryResult
  /** `history` answers in call order; the last page repeats once exhausted. */
  historyPages?: HistoryResult[]
  /** Zero-based `history` request indexes that answer with a failure. */
  failHistoryPages?: number[]
  branches?: BranchesResult
  commitDetails?: CommitDetails
  /** Current `watch` counters; defaults to a watching repository with zero counters. */
  watchState?: () => WatchState
  /** `references` responses in call order; the last repeats. */
  referencePages?: GraphReferences[]
  failOp?: string
  diff?: boolean
  menus?: boolean
  tabInfo?: UiTabInfo
}

/** Components loaded from one bundle registration. */
interface LoadedComponents {
  git: TestComponent
  diff: TestComponent
  gitTitle: TestComponent
  diffTitle: TestComponent
  contextMenus: TestContextMenusService
  contributions: ContextMenuContribution[]
}

/** One mounted panel plus its recorders. */
interface MountedGit {
  harness: TestHarness
  calls: RpcRequestRecord[]
  openedTabs: OpenedTab[]
  components: LoadedComponents
  useTabInfo: UiTabInfo
  menu: MenuMock
}

let registration: ClientRegistration

before(async () => {
  ;({ registration } = await loadClientBundle())
  assert.equal(typeof registration?.factory, 'function')
})

/**
 * Build one harness, load the bundle components against it, and mount a panel.
 * @param options - mount options.
 * @returns mounted test context.
 */
async function mountGit(options: MountOptions = {}): Promise<MountedGit> {
  const calls: RpcRequestRecord[] = []
  const responses: Record<string, unknown> = {
    status: options.status ?? STATUS,
    history: options.history ?? HISTORY,
    branches: options.branches ?? BRANCHES,
    'commit-details': options.commitDetails ?? COMMIT_DETAILS,
  }
  const historyPages = options.historyPages ?? [options.history ?? HISTORY]
  const failedHistoryPages = new Set(options.failHistoryPages ?? [])
  const referencePages = options.referencePages ?? [(options.history ?? HISTORY).references]
  let historyPage = 0
  let referencePage = 0
  const harness = createHarness({
    fetch: async (_url: string, init: { body: string }): Promise<FetchResponseLike> => {
      const request = JSON.parse(init.body) as RpcRequestRecord
      calls.push(request)
      if (request.op === 'watch') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            value: options.watchState?.() ?? { watching: true, worktree: 0, references: 0 },
          }),
        }
      }
      if (request.op === 'references') {
        const index = referencePage
        referencePage += 1
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            value: referencePages[Math.min(index, referencePages.length - 1)],
          }),
        }
      }
      if (request.op === 'unwatch') {
        return { ok: true, status: 200, json: async () => ({ ok: true, value: { ok: true } }) }
      }
      if (request.op === 'history') {
        const index = historyPage
        historyPage += 1
        if (failedHistoryPages.has(index)) {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              ok: false,
              error: { code: 'git-command-failed', message: 'git said no' },
            }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            value: historyPages[Math.min(index, historyPages.length - 1)],
          }),
        }
      }
      if (options.failOp !== undefined && request.op === options.failOp) {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            ok: false,
            error: { code: 'git-command-failed', message: 'git said no' },
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, value: responses[request.op] ?? { ok: true } }),
      }
    },
    component: null,
    props: {},
  })
  const openedTabs: OpenedTab[] = []
  const tab: UiTab = {
    id: 'tab-1',
    title: 'Source control',
    visible: true,
    signal: new AbortController().signal,
    actions: {
      openTab: (kind, openOptions) => {
        openedTabs.push({ kind, options: openOptions })
      },
      openResource: () => {},
      close: () => {},
      bindCommands: () => () => {},
    },
    navigation: { address: 'sidebar://git', params: {}, revision: 0 },
  }
  const useTabInfo: UiTabInfo = () => ({
    sidebar: { expanded: true, fullscreen: false },
    panel: { id: 'pane-1', isFloating: false },
    tab,
  })
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

/** Read one registered slot component, failing loudly when the seat is empty. */
function slotComponent(seats: Map<string, TestComponent>, seat: string): TestComponent {
  const component = seats.get(seat)
  assert.ok(component !== undefined, `no slot component registered for ${seat}`)
  return component
}

function loadComponents(harness: TestHarness): LoadedComponents {
  const module = registration.factory((specifier) => {
    if (specifier === 'react') return harness.React
    throw new Error(`unexpected require("${specifier}")`)
  })
  const fake = createFakeContext()
  module.apply(fake.ctx)
  const bySeat = new Map(
    fake.records.slots.map(({ options, component }) => [
      `${options.name}:${options.key}`,
      component,
    ]),
  )
  return {
    git: slotComponent(bySeat, 'sidebar.right.pane.tab:@local/dsh-git-graph/git'),
    diff: slotComponent(bySeat, 'sidebar.right.pane.tab:@local/dsh-git-graph/diff'),
    gitTitle: slotComponent(bySeat, 'sidebar.right.pane.tab.title:@local/dsh-git-graph/git'),
    diffTitle: slotComponent(bySeat, 'sidebar.right.pane.tab.title:@local/dsh-git-graph/diff'),
    contextMenus: fake.menu.contextMenus,
    contributions: fake.menu.contributions,
  }
}

/** Whether a rendered node is an element object. */
function isElement(node: TestNode): node is TestElement {
  return typeof node === 'object' && node !== null && !Array.isArray(node)
}

/** Narrow one rendered node to an element. */
function elementOf(node: TestNode): TestElement {
  assert.ok(isElement(node), 'expected a rendered element')
  return node
}

function buttonByLabel(harness: TestHarness, label: string): TestElement {
  const buttons = harness.findAll(
    (element) => element.type === 'button' && element.props['aria-label'] === label,
  )
  assert.ok(buttons.length > 0, `no button labelled "${label}"`)
  const button = buttons[0]
  assert.ok(button)
  return button
}

function collectElements(
  element: TestNode,
  predicate: (element: TestElement) => boolean,
): TestElement[] {
  const found: TestElement[] = []
  const visit = (node: TestNode): void => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (!isElement(node)) return
    if (predicate(node)) found.push(node)
    for (const child of node.children) visit(child)
  }
  visit(element)
  return found
}

function elementText(element: TestNode): string {
  const parts: string[] = []
  const walk = (node: TestNode): void => {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') {
      parts.push(String(node))
      return
    }
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    for (const child of node.children) walk(child)
  }
  walk(element)
  return parts.join(' ').trim()
}

function buttonContaining(harness: TestHarness, label: string): TestElement {
  const buttons = harness.findAll(
    (element) => element.type === 'button' && elementText(element) === label,
  )
  assert.ok(buttons.length > 0, `no button containing "${label}"`)
  const button = buttons[0]
  assert.ok(button)
  return button
}

function buttonInside(element: TestElement, label: string): TestElement {
  const buttons: TestElement[] = []
  const walk = (node: TestNode): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!isElement(node)) return
    if (node.type === 'button' && node.props?.['aria-label'] === label) buttons.push(node)
    for (const child of node.children) walk(child)
  }
  walk(element.children)
  assert.ok(buttons.length > 0, `no button labelled "${label}" inside the row`)
  const button = buttons[0]
  assert.ok(button)
  return button
}

function buttonByText(harness: TestHarness, text: string): TestElement {
  const buttons = harness.findAll((element) => {
    if (element.type !== 'button' && element.type !== 'div') return false
    return element.children.some((child) => child === text)
  })
  assert.ok(buttons.length > 0, `no control with text "${text}"`)
  const button = buttons[0]
  assert.ok(button)
  return button
}

/**
 * Build a two-page history: two recent commits on the first page and the root
 * commit on the second.
 * @returns the first and last `history` responses.
 */
function pagedHistory(): { first: HistoryResult; second: HistoryResult } {
  const now = Math.floor(Date.now() / 1000)
  const oid = (character: string): string => character.repeat(40)
  const commit = (
    character: string,
    parents: string[],
    subject: string,
    authoredAt: number,
  ): HistoryResult['commits'][number] => ({
    oid: oid(character),
    shortOid: character.repeat(7),
    author: 'Ann',
    authoredAt,
    refs: character === 'c' ? 'HEAD -> refs/heads/main' : '',
    parents,
    subject,
  })
  const references: HistoryResult['references'] = {
    current: { id: 'refs/heads/main', name: 'main', revision: oid('c') },
    remote: null,
    base: null,
  }
  return {
    first: {
      commits: [
        commit('c', [oid('b')], 'Recent work', now - 60),
        commit('b', [oid('a')], 'Older work', now - 3600),
      ],
      hasMore: true,
      references,
    },
    second: {
      commits: [commit('a', [], 'Root commit', now - 7200)],
      hasMore: false,
      references,
    },
  }
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
  const badges = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphBadge',
  )
  assert.deepEqual(
    badges.map((badge) => [
      badge.props['data-icon'],
      badge.props['data-color'],
      elementText(badge),
    ]),
    [
      ['target', 'ref', 'main'],
      ['cloud', 'remote', ''],
      ['tag', 'ref', 'v1.0'],
    ],
    'the checked-out branch is named, its upstream collapses into an icon badge',
  )
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

test('change groups and graph are independent scroll panes with a resizable divider', async () => {
  const mounted = await mountGit()
  const panes = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-pane'),
  )
  assert.equal(panes.length, 2, 'the changes and graph each get a scroll pane')
  const [changesPane, graphPane] = panes
  assert.ok(changesPane)
  assert.ok(graphPane)
  for (const pane of panes) {
    assert.ok(String(pane.props.className).includes('dshgg-scroll'))
  }
  const sectionsIn = (pane: TestElement): unknown[] =>
    collectElements(pane, (element) => element.props['data-section'] !== undefined).map(
      (element) => element.props['data-section'],
    )
  assert.deepEqual(sectionsIn(changesPane), ['merge', 'staged', 'changes'])
  assert.deepEqual(sectionsIn(graphPane), ['graph'])
  assert.equal(changesPane.props.style?.flexBasis, '50%')
  const divider = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) => candidate.props.role === 'separator')
    assert.ok(element, 'no split divider rendered')
    return element
  }
  assert.equal(divider().props['aria-orientation'], 'horizontal')
  assert.equal(divider().props['aria-valuemin'], 20)
  assert.equal(divider().props['aria-valuemax'], 80)
  assert.equal(divider().props['aria-valuenow'], 50)
  assert.equal(divider().props.tabIndex, 0)
  assert.match(String(divider().props['aria-label']), /split\.label/)
  mounted.harness.keydown(divider(), { key: 'ArrowDown' })
  await mounted.harness.flush()
  assert.equal(divider().props['aria-valuenow'], 55)
  const paneTop = (): TestElement | undefined =>
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-paneTop'),
    )[0]
  assert.equal(paneTop()?.props.style?.flexBasis, '55%')

  const rect = { left: 0, top: 100, width: 320, height: 400, bottom: 500 }
  const target: TestEventTarget = {
    getBoundingClientRect: () => rect,
    focus() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => true,
    parentElement: { getBoundingClientRect: () => rect },
  }
  mounted.harness.pointer(divider(), 'down', {
    pointerId: 7,
    clientY: 200,
    currentTarget: target,
  })
  await mounted.harness.flush()
  assert.equal(divider().props['data-dragging'], 'true')
  mounted.harness.pointer(divider(), 'move', {
    pointerId: 7,
    clientY: 240,
    currentTarget: target,
  })
  await mounted.harness.flush()
  assert.equal(divider().props['aria-valuenow'], 65, 'a 40px drag over 400px moves 10%')
  assert.equal(paneTop()?.props.style?.flexBasis, '65%')
  mounted.harness.pointer(divider(), 'move', {
    pointerId: 7,
    clientY: 900,
    currentTarget: target,
  })
  await mounted.harness.flush()
  assert.equal(divider().props['aria-valuenow'], 80, 'a drag beyond the edge clamps')
  mounted.harness.pointer(divider(), 'up', {
    pointerId: 7,
    clientY: 900,
    currentTarget: target,
  })
  await mounted.harness.flush()
  assert.equal(divider().props['data-dragging'], undefined)
  await mounted.harness.dispose()
})

test('each section header belongs to its own section so only one can stick', async () => {
  const mounted = await mountGit()
  const sections = mounted.harness.findAll((element) => element.props['data-section'] !== undefined)
  assert.deepEqual(
    sections.map((section) => section.props['data-section']),
    ['merge', 'staged', 'changes', 'graph'],
  )
  for (const section of sections) {
    // A header only pins while its own section is in view when the section is
    // its containing block: the header is a direct child, never a sibling
    // shared by a stack of sections.
    const header = elementOf(section.children[0])
    assert.equal(
      header.props.className,
      'dshgg-sectionHeader',
      `${String(section.props['data-section'])} must lead with its own header`,
    )
  }
  await mounted.harness.dispose()
})

test('the graph header shows no commit count while group headers keep theirs', async () => {
  const mounted = await mountGit()
  const section = (id: string): TestElement => {
    const [element] = mounted.harness.findAll(
      (candidate) => candidate.props?.['data-section'] === id,
    )
    assert.ok(element, `no ${id} section rendered`)
    return element
  }
  const countChips = (id: string): TestElement[] =>
    collectElements(section(id), (element) =>
      String(element.props?.className ?? '')
        .split(' ')
        .includes('dshgg-sectionCount'),
    )
  assert.equal(
    countChips('graph').length,
    0,
    'the graph header shows no count of the loaded commits',
  )
  assert.deepEqual(
    countChips('staged').map((chip) => elementText(chip)),
    ['1'],
    'the staged group keeps its file count',
  )
  assert.deepEqual(
    countChips('changes').map((chip) => elementText(chip)),
    ['2'],
    'the changes group keeps its file count',
  )
  await mounted.harness.dispose()
})

test('scrolling the graph pane to its end appends the next page of commits', async () => {
  const pages = pagedHistory()
  const mounted = await mountGit({ historyPages: [pages.first, pages.second] })
  const rows = (): TestElement[] =>
    mounted.harness.findAll(
      (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
    )
  const graphPane = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) =>
      String(candidate.props?.className ?? '').includes('dshgg-paneBottom'),
    )
    assert.ok(element, 'no graph pane rendered')
    return element
  }
  assert.equal(rows().length, 2)
  // A scroll far from the end keeps the loaded page.
  mounted.harness.scroll(graphPane(), { scrollTop: 0, clientHeight: 400, scrollHeight: 1000 })
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((request) => request.op === 'history').length, 1)
  // Reaching the end loads the next page with the offset of the loaded rows.
  mounted.harness.scroll(graphPane(), { scrollTop: 580, clientHeight: 400, scrollHeight: 1000 })
  await mounted.harness.flush()
  const historyCalls = mounted.calls.filter((request) => request.op === 'history')
  assert.equal(historyCalls.length, 2)
  assert.equal(historyCalls[1]?.offset, 2)
  assert.equal(rows().length, 3)
  assert.match(mounted.harness.text(), /Root commit/)
  assert.equal(
    mounted.harness.findAll(
      (element) => element.type === 'button' && elementText(element) === 'graph.loadMore',
    ).length,
    0,
    'the last page offers no further loading',
  )
  await mounted.harness.dispose()
})

test('the end of the graph offers the next page as a control', async () => {
  const pages = pagedHistory()
  const mounted = await mountGit({ historyPages: [pages.first, pages.second] })
  const loadMore = (): TestElement[] =>
    mounted.harness.findAll(
      (element) => element.type === 'button' && elementText(element) === 'graph.loadMore',
    )
  assert.equal(loadMore().length, 1)
  const [button] = loadMore()
  assert.ok(button)
  mounted.harness.click(button)
  await mounted.harness.flush()
  const historyCalls = mounted.calls.filter((request) => request.op === 'history')
  assert.equal(historyCalls[1]?.offset, 2)
  assert.match(mounted.harness.text(), /Root commit/)
  assert.equal(loadMore().length, 0)
  await mounted.harness.dispose()
})

test('a failed earlier page keeps the loaded rows and can be retried', async () => {
  const pages = pagedHistory()
  const mounted = await mountGit({
    historyPages: [pages.first, pages.second],
    failHistoryPages: [1],
  })
  const rows = (): TestElement[] =>
    mounted.harness.findAll(
      (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
    )
  const graphPane = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) =>
      String(candidate.props?.className ?? '').includes('dshgg-paneBottom'),
    )
    assert.ok(element, 'no graph pane rendered')
    return element
  }
  mounted.harness.scroll(graphPane(), { scrollTop: 580, clientHeight: 400, scrollHeight: 1000 })
  await mounted.harness.flush()
  assert.equal(rows().length, 2, 'the loaded rows stay visible')
  assert.match(mounted.harness.text(), /git said no/)
  const retry = mounted.harness.findAll(
    (element) => element.type === 'button' && elementText(element) === 'retry',
  )
  assert.equal(retry.length, 1)
  const [button] = retry
  assert.ok(button)
  mounted.harness.click(button)
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((request) => request.op === 'history').length, 3)
  assert.equal(rows().length, 3)
  assert.match(mounted.harness.text(), /Root commit/)
  await mounted.harness.dispose()
})

test('refresh returns the graph to the first page', async () => {
  const pages = pagedHistory()
  const mounted = await mountGit({ historyPages: [pages.first, pages.second, pages.first] })
  const rows = (): TestElement[] =>
    mounted.harness.findAll(
      (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
    )
  const graphPane = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) =>
      String(candidate.props?.className ?? '').includes('dshgg-paneBottom'),
    )
    assert.ok(element, 'no graph pane rendered')
    return element
  }
  mounted.harness.scroll(graphPane(), { scrollTop: 580, clientHeight: 400, scrollHeight: 1000 })
  await mounted.harness.flush()
  assert.equal(rows().length, 3)
  mounted.harness.click(buttonByLabel(mounted.harness, 'refresh'))
  await mounted.harness.flush()
  const historyCalls = mounted.calls.filter((request) => request.op === 'history')
  assert.equal(historyCalls.length, 3)
  assert.equal(historyCalls[2]?.offset, undefined, 'a refresh asks for the first page')
  assert.equal(rows().length, 2)
  assert.equal(
    mounted.harness.findAll(
      (element) => element.type === 'button' && elementText(element) === 'graph.loadMore',
    ).length,
    1,
    'the refreshed first page can load earlier commits again',
  )
  await mounted.harness.dispose()
})

test('commit details replace the split and return with the chosen ratio', async () => {
  const mounted = await mountGit()
  const divider = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) => candidate.props.role === 'separator')
    assert.ok(element, 'no split divider rendered')
    return element
  }
  mounted.harness.keydown(divider(), { key: 'PageDown' })
  await mounted.harness.flush()
  assert.equal(divider().props['aria-valuenow'], 60)
  const graphRow = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )[0]
  assert.ok(graphRow)
  mounted.harness.click(graphRow)
  await mounted.harness.flush()
  assert.equal(mounted.harness.findAll((element) => element.props.role === 'separator').length, 0)
  assert.match(mounted.harness.text(), /commitDetails\.files/)
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await mounted.harness.flush()
  assert.equal(divider().props['aria-valuenow'], 60)
  await mounted.harness.dispose()
})

test('a clean repository shows the clean text without a check icon', async () => {
  const mounted = await mountGit({ status: createStatus({ files: [] }) })
  const clean = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-clean',
  )[0]
  assert.ok(clean, 'no clean-workspace state rendered')
  assert.match(elementText(clean), /clean\.title/)
  assert.match(elementText(clean), /clean\.desc/)
  assert.equal(
    collectElements(clean, (element) => element.type === 'svg').length,
    0,
    'the clean state carries no icon',
  )
  assert.equal(
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-cleanIcon'),
    ).length,
    0,
  )
  await mounted.harness.dispose()
})

test('the commit graph draws one line layer and a node per row', async () => {
  const mounted = await mountGit()
  const layers = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphLayer',
  )
  assert.equal(layers.length, 1, 'the rows share one layer')
  const [layer] = layers
  assert.ok(layer)
  assert.equal(layer.props['aria-hidden'], 'true')
  assert.equal(layer.props.width, 22, 'one lane plus one position')
  assert.equal(layer.props.height, 44, 'two rows')
  assert.equal(layer.props.viewBox, '0 0 22 44')
  const [mask] = collectElements(layer, (element) => element.type === 'mask')
  assert.ok(mask)
  assert.equal(mask.props.maskUnits, 'userSpaceOnUse')
  assert.equal(mask.props.height, 44, 'the mask covers the whole layer')
  const gaps = collectElements(mask, (element) => element.type === 'circle')
  assert.deepEqual(
    gaps.map((gap) => [
      gap.props.className,
      gap.props.cx,
      gap.props.cy,
      gap.props.r,
      gap.props.fill,
    ]),
    [
      ['dshgg-graphGap', 11, 11, 8, 'black'],
      ['dshgg-graphGap', 11, 33, 6, 'black'],
    ],
    'the gap cuts the lines around each node',
  )
  const [lines] = collectElements(layer, (element) => element.type === 'g')
  assert.ok(lines)
  assert.equal(lines.props.mask, `url(#${String(mask.props.id)})`)
  const cells = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphSvg',
  )
  assert.equal(cells.length, 2, 'one graph cell per commit row')
  for (const cell of cells) {
    assert.equal(cell.props.height, 22, 'a cell is one row high')
    assert.equal(
      collectElements(cell, (element) => element.type === 'path').length,
      0,
      'the cell holds no lines',
    )
  }
  assert.deepEqual(
    cells.map((cell) => cell.props.viewBox),
    ['0 0 22 22', '0 0 22 22'],
  )
  const nodes = mounted.harness.findAll(
    (element) => element.type === 'circle' && element.props.className === 'dshgg-graphNode',
  )
  assert.deepEqual(
    nodes.map((node) => [
      node.props['data-shape'],
      node.props['data-paint'],
      node.props.cx,
      node.props.cy,
      node.props.r,
    ]),
    [
      ['head', 'ring', 11, 11, 5],
      ['node', 'fill', 11, 11, 4],
    ],
    'the checked-out commit is a ring and the root a filled dot',
  )
  assert.equal(nodes[0]?.props.style?.stroke, 'var(--dshgg-scm-ref)')
  assert.equal(nodes[1]?.props.style?.fill, 'var(--dshgg-scm-ref)')
  const paths = mounted.harness.findAll(
    (element) => element.type === 'path' && element.props.className === 'dshgg-graphEdge',
  )
  assert.deepEqual(
    paths.map((path) => [path.props.d, path.props.style?.stroke]),
    [['M 11 11 V 22 M 11 21 V 22 M 11 22 V 33', 'var(--dshgg-scm-ref)']],
    'both rows are one path, and the second row also covers the pixel above it',
  )
  const rows = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
  )
  assert.deepEqual(
    rows.map((row) => row.props['data-current']),
    ['true', undefined],
    'only the checked-out commit renders bold',
  )
  await mounted.harness.dispose()
})

test('hovering a row closes its node gap in the line layer', async () => {
  const mounted = await mountGit()
  const body = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphBody',
  )[0]
  assert.ok(body)
  const gaps = (): [unknown, unknown][] =>
    mounted.harness
      .findAll(
        (element) => element.type === 'circle' && element.props.className === 'dshgg-graphGap',
      )
      .map((gap) => [gap.props.cy, gap.props.r])
  assert.deepEqual(gaps(), [
    [11, 8],
    [33, 6],
  ])
  const rows = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
  )
  const enter = rows[1]?.props.onMouseEnter as (() => void) | undefined
  assert.equal(typeof enter, 'function', 'the row reports the pointer')
  enter?.()
  await mounted.harness.flush()
  assert.deepEqual(
    gaps(),
    [
      [11, 8],
      [33, 5],
    ],
    'the hovered row keeps the smaller gap',
  )
  const leave = rows[1]?.props.onMouseLeave as (() => void) | undefined
  leave?.()
  await mounted.harness.flush()
  assert.deepEqual(
    gaps(),
    [
      [11, 8],
      [33, 6],
    ],
    'the gap restores when the pointer leaves',
  )
  await mounted.harness.dispose()
})

test('a merge fans out to the right and joins its fork point like VS Code', async () => {
  const now = Math.floor(Date.now() / 1000)
  const history: HistoryResult = {
    commits: [
      {
        oid: 'd'.repeat(40),
        shortOid: 'ddddddd',
        author: 'Ann',
        authoredAt: now,
        refs: 'HEAD -> refs/heads/main',
        subject: 'Merge feature',
        parents: ['c'.repeat(40), 'b'.repeat(40)],
      },
      {
        oid: 'c'.repeat(40),
        shortOid: 'ccccccc',
        author: 'Ann',
        authoredAt: now - 60,
        refs: '',
        subject: 'Main work',
        parents: ['a'.repeat(40)],
      },
      {
        oid: 'b'.repeat(40),
        shortOid: 'bbbbbbb',
        author: 'Bob',
        authoredAt: now - 120,
        refs: 'refs/heads/feature/x, refs/remotes/origin/feature/x',
        subject: 'Feature work',
        parents: ['a'.repeat(40)],
      },
      {
        oid: 'a'.repeat(40),
        shortOid: 'aaaaaaa',
        author: 'Bob',
        authoredAt: now - 180,
        refs: 'tag: refs/tags/v1.0',
        subject: 'Initial commit',
        parents: [],
      },
    ],
    hasMore: false,
    references: {
      current: { id: 'refs/heads/main', name: 'main', revision: 'd'.repeat(40) },
      remote: null,
      base: null,
    },
  }
  const mounted = await mountGit({ history })
  const rows = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
  )
  assert.equal(rows.length, 4)
  const cells = rows.map((row) => elementOf(row.children[0]))
  assert.deepEqual(
    cells.map((cell) => cell.props.width),
    [33, 33, 33, 33],
  )
  const nodeOf = (cell: TestElement): TestElement => {
    const [node] = collectElements(cell, (element) => element.props.className === 'dshgg-graphNode')
    assert.ok(node)
    return node
  }
  assert.deepEqual(
    cells.map((cell) => [nodeOf(cell).props['data-shape'], nodeOf(cell).props['data-color']]),
    [
      ['head', 'ref'],
      ['node', 'ref'],
      ['node', 'lane1'],
      ['node', 'ref'],
    ],
  )
  assert.equal(nodeOf(cells[2] as TestElement).props.cx, 22, 'the side branch sits on lane 1')
  assert.equal(
    collectElements(cells[0] as TestElement, (element) => element.type === 'path').length,
    0,
    'the row cell holds only its node',
  )
  const [layer] = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphLayer',
  )
  assert.ok(layer)
  const layerPaths = collectElements(layer, (element) => element.type === 'path')
  assert.deepEqual(
    layerPaths.map((path) => path.props['data-color']),
    ['lane1', 'ref'],
    'one path per color for the whole graph',
  )
  assert.match(
    String(layerPaths[0]?.props.d),
    /^M 11 11 A 11 11 0 0 1 22 22 M 11 11 H 11 /,
    'the merge opens its second parent on the first row',
  )
  assert.match(
    String(layerPaths[0]?.props.d),
    /M 22 66 A 11 11 0 0 1 11 77 H 11$/,
    'the branch joins the fork point three rows below',
  )
  assert.match(
    String(layerPaths[1]?.props.d),
    /^M 11 11 V 22 M 11 21 V 22 M 11 22 V 33 M 11 33 V 44 M 11 43 V 44 M 11 44 V 66 /,
    'the checked-out lane runs through every row, bridging the row edges',
  )
  const labels = mounted.harness.findAll(
    (element) => element.props.className === 'dshgg-graphLabel',
  )
  assert.deepEqual(
    labels.map((label) =>
      label.children.filter(isElement).map((child) => [child.props.className, elementText(child)]),
    ),
    [
      [
        ['dshgg-graphSubject', 'Merge feature'],
        ['dshgg-graphAuthor', 'Ann'],
      ],
      [
        ['dshgg-graphSubject', 'Main work'],
        ['dshgg-graphAuthor', 'Ann'],
      ],
      [
        ['dshgg-graphSubject', 'Feature work'],
        ['dshgg-graphAuthor', 'Bob'],
      ],
      [
        ['dshgg-graphSubject', 'Initial commit'],
        ['dshgg-graphAuthor', 'Bob'],
      ],
    ],
    'each row shows the subject and the author, like VS Code',
  )
  const featureBadges = collectElements(
    rows[2] as TestElement,
    (element) => element.props.className === 'dshgg-graphBadge',
  )
  assert.deepEqual(
    featureBadges.map((badge) => [
      badge.props['data-icon'],
      badge.props.style?.backgroundColor,
      elementText(badge),
    ]),
    [
      ['branch', 'var(--dshgg-scm-lane1)', 'feature/x'],
      ['cloud', 'var(--dshgg-scm-lane1)', ''],
    ],
    'ordinary references take their node color',
  )
  assert.equal(
    mounted.harness.findAll((element) =>
      /dshgg-graph(Hash|Time|Meta)/.test(String(element.props?.className ?? '')),
    ).length,
    0,
    'identifier and time move to the tooltip',
  )
  const title = rows[2]?.props.title
  assert.ok(typeof title === 'string')
  assert.match(title, /feature\/x, origin\/feature\/x/)
  assert.match(title, /bbbbbbb Feature work/)
  assert.match(title, /Bob/)
  assert.match(title, /time\./)
  await mounted.harness.dispose()
})

test('lanes right of a joined lane shift left with VS Code curves', async () => {
  const now = Math.floor(Date.now() / 1000)
  const oid = (char: string): string => char.repeat(40)
  const entry = (id: string, parents: string[], refs = '') => ({
    oid: oid(id),
    shortOid: id.repeat(7),
    author: 'Ann',
    authoredAt: now,
    refs,
    subject: `commit ${id}`,
    parents: parents.map(oid),
  })
  const history: HistoryResult = {
    commits: [
      entry('a', ['d']),
      entry('b', ['d']),
      entry('c', ['e']),
      entry('d', ['f']),
      entry('e', ['f']),
      entry('f', []),
    ],
    hasMore: false,
    references: { current: null, remote: null, base: null },
  }
  const mounted = await mountGit({ history })
  const cells = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphSvg',
  )
  assert.deepEqual(
    cells.map((cell) => cell.props.width),
    [22, 33, 44, 44, 33, 33],
    'text begins after each row’s own graph cell',
  )
  const joinRow = cells[3]
  assert.ok(joinRow)
  assert.equal(
    collectElements(joinRow, (element) => element.type === 'path').length,
    0,
    'the row cell holds only its node',
  )
  const [layer] = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphLayer',
  )
  assert.ok(layer)
  const layerPaths = collectElements(layer, (element) => element.type === 'path')
  assert.deepEqual(
    layerPaths.map((path) => path.props['data-color']),
    ['lane1', 'lane2', 'lane3'],
  )
  assert.match(
    String(layerPaths[2]?.props.d),
    /M 33 66 V 72 A 5 5 0 0 1 28 77 H 27 A 5 5 0 0 0 22 82 V 88/,
    'the lane right of the ended one turns into its new position on the join row',
  )
  assert.match(
    String(layerPaths[1]?.props.d),
    /M 22 66 A 11 11 0 0 1 11 77 H 11/,
    'the fork point curve sits on the join row, not on the row below',
  )
  const gaps = collectElements(layer, (element) => element.props.className === 'dshgg-graphGap')
  assert.deepEqual(
    gaps.map((gap) => [gap.props.cy, gap.props.r]),
    [
      [11, 6],
      [33, 6],
      [55, 6],
      [77, 6],
      [99, 6],
      [121, 6],
    ],
    'one node gap per row, in the layer coordinates',
  )
  await mounted.harness.dispose()
})

test('a conflicted file is listed directly under merge changes', async () => {
  const status = createStatus({
    files: [
      {
        kind: 'unmerged',
        x: 'U',
        y: 'U',
        path: 'src/deep/conflicted.txt',
        conflict: true,
        untracked: false,
      },
    ],
  })
  const mounted = await mountGit({ status })
  const text = mounted.harness.text()
  assert.match(text, /sections\.merge/)
  assert.match(text, /conflicted\.txt/)
  assert.match(text, /src\/deep/)
  assert.match(text, /!/)
  assert.equal(
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-folderRow'),
    ).length,
    0,
    'no folder rows are rendered',
  )
})

test('nested changed files stay in one flat path-sorted layer', async () => {
  const modified = (path: string): ChangeEntry => ({
    kind: 'ordinary',
    x: '.',
    y: 'M',
    path,
    conflict: false,
    untracked: false,
  })
  const status = createStatus({
    files: [
      modified('src/z/deep.js'),
      modified('src/a.js'),
      modified('docs/readme.md'),
      modified('a10.js'),
      modified('a2.js'),
    ],
  })
  const mounted = await mountGit({ status })
  const fileRows = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-fileRow'),
  )
  assert.deepEqual(
    fileRows.map((row) => row.props.title),
    ['a2.js', 'a10.js', 'docs/readme.md', 'src/a.js', 'src/z/deep.js'],
    'one row per file in path order, with no folder rows between them',
  )
  assert.equal(
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-folderRow'),
    ).length,
    0,
  )
  const texts = fileRows.map(elementText)
  assert.ok(
    texts[2].includes('readme.md') && texts[2].includes('docs'),
    'the row shows the file name and its parent directory',
  )
  assert.ok(
    texts[4].includes('deep.js') && texts[4].includes('src/z'),
    'a nested file keeps its whole parent path on one line',
  )
  for (const row of fileRows)
    assert.equal(row.props.style, undefined, 'a flat row needs no indentation')
  await mounted.harness.dispose()
})

test('row actions stage and unstage through the Host', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
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
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  const emptyBox = messageBox()
  assert.equal(emptyBox?.props.rows, 1, 'the message box starts one line high')
  assert.equal(emptyBox?.props.className, 'dshgg-commitMessage')
  mounted.harness.change(emptyBox, 'feat: git sidebar')
  await mounted.harness.flush()
  assert.equal(commitButton().props.disabled, false)
  mounted.harness.click(commitButton())
  await mounted.harness.flush()
  const commitCall = mounted.calls.find((call) => call.op === 'commit')
  assert.equal(commitCall?.message, 'feat: git sidebar')
  assert.notEqual(commitCall?.stageAll, true)
  assert.match(mounted.harness.text(), /commit\.done/)
  assert.equal(messageBox()?.props.value, '', 'a committed message leaves the box empty')
  await mounted.harness.dispose()
})

test('committing with nothing staged offers to stage everything', async () => {
  const status = createStatus({
    files: [
      { kind: 'ordinary', x: '.', y: 'M', path: 'src/app.js', conflict: false, untracked: false },
    ],
  })
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
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  const row = rows.at(-1)
  assert.ok(row, 'no changed-file row rendered')
  mounted.harness.click(buttonInside(row, 'actions.discard'))
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
  const chip = mounted.harness.findAll(
    (element) =>
      element.type === 'button' && String(element.props.className).includes('dshgg-branchChip'),
  )[0]
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
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  assert.ok(rows.length >= 2)
  mounted.harness.click(rows[rows.length - 1])
  const opened = mounted.openedTabs[0]
  assert.equal(opened.kind, 'git-diff')
  assert.equal(opened.options.params.path, 'src/app.js')
  assert.equal(opened.options.params.staged, false)
  await mounted.harness.dispose()
})

test('clicking a commit shows its files and a file opens the commit diff', async () => {
  const mounted = await mountGit()
  const graphRow = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )[0]
  assert.ok(graphRow, 'no graph row rendered')
  mounted.harness.click(graphRow)
  await mounted.harness.flush()

  const detailsCall = mounted.calls.find((call) => call.op === 'commit-details')
  assert.equal(detailsCall?.oid, 'a'.repeat(40))
  const text = mounted.harness.text()
  assert.match(text, /commitDetails\.files/)
  assert.match(text, /Fix the sidebar/)
  assert.match(text, /Ann/)
  assert.match(text, /A longer explanation of the fix\./)
  assert.match(text, /\.js/)
  assert.match(text, /app\.js/)
  assert.match(text, /added\.js/)
  assert.match(text, /renamed\.js/)
  assert.match(text, /old\.js/)
  assert.match(text, /gone\.md/)
  assert.equal(
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-folderRow'),
    ).length,
    0,
    'commit files are a flat list',
  )
  const commitTitles = mounted.harness
    .findAll((element) => String(element.props?.className ?? '').includes('dshgg-fileRow'))
    .map((row) => row.props.title)
  assert.deepEqual(
    commitTitles,
    ['docs/gone.md', 'src/added.js', 'src/app.js', 'src/old.js → src/renamed.js'],
    'commit files are listed once each in path order',
  )
  assert.ok(buttonByLabel(mounted.harness, 'commitDetails.back'))
  assert.equal(
    mounted.harness.findAll((element) => element.type === 'textarea').length,
    0,
    'the commit box is hidden while details are open',
  )

  const fileRows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  assert.equal(fileRows.length, 1, 'the changed file is listed once')
  mounted.harness.click(fileRows[0])
  const opened = mounted.openedTabs.at(-1)
  assert.ok(opened)
  assert.equal(opened.kind, 'git-diff')
  assert.equal(opened.options.params.path, 'src/app.js')
  assert.equal(opened.options.params.commit, 'a'.repeat(40))
  assert.equal(opened.options.params.shortOid, 'aaaaaaa')
  assert.equal(opened.options.params.status, 'M')

  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await mounted.harness.flush()
  const after = mounted.harness.text()
  assert.match(after, /sections\.changes/)
  assert.doesNotMatch(after, /commitDetails\.files/)
  await mounted.harness.dispose()
})

test('a commit row opens its details with the keyboard', async () => {
  const mounted = await mountGit()
  const graphRow = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )[0]
  mounted.harness.keydown(graphRow, { key: 'Enter' })
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'commit-details').length, 1)
  assert.match(mounted.harness.text(), /commitDetails\.files/)
  await mounted.harness.dispose()
})

test('a commit without file changes says so', async () => {
  const commitDetails = {
    commit: COMMIT_DETAILS.commit,
    files: [],
    truncated: false,
  }
  const mounted = await mountGit({ commitDetails })
  const graphRow = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )[0]
  mounted.harness.click(graphRow)
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /commitDetails\.empty/)
  assert.equal(
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow'),
    ).length,
    0,
  )
  await mounted.harness.dispose()
})

test('a failed commit read reports the failure and retries', async () => {
  const mounted = await mountGit({ failOp: 'commit-details' })
  const graphRow = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )[0]
  mounted.harness.click(graphRow)
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /error\.title/)
  assert.match(mounted.harness.text(), /git said no/)
  const before = mounted.calls.filter((call) => call.op === 'commit-details').length
  mounted.harness.click(buttonByText(mounted.harness, 'retry'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'commit-details').length, before + 1)
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /sections\.changes/)
  await mounted.harness.dispose()
})

test('past-commit files offer copy-only context menus', async () => {
  const mounted = await mountGit()
  const graphRow = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )[0]
  mounted.harness.click(graphRow)
  await mounted.harness.flush()
  const fileRows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  assert.equal(fileRows.length, 1)
  mounted.harness.contextmenu(fileRows[0], { clientX: 7, clientY: 8 })
  assert.equal(mounted.menu.opens.length, 1, 'a past-commit file binds a menu target')
  const target = mounted.menu.opens[0].target
  assert.equal(target.value.kind, 'commitFile')
  assert.equal(target.value.path, 'src/app.js')
  assert.equal(target.value.cwd, '/repo')
  assert.deepEqual(
    menuActions(mounted.components, target).map((action) => action.id),
    [menuActionId('copy-relative'), menuActionId('copy-path')],
  )
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

/** Contribution id of the bundle's context-menu provider. */
const MENU_ID = 'git-graph.actions'

/** A resolved action id as the shared registry publishes it. */
const menuActionId = (id: string): string => `${MENU_ID}/${id}`

/** Resolve the actions the shared overlay would show for a captured trigger target.
 *
 * The stand-in mirrors the shipped registry, which calls a contribution with the
 * captured target's value rather than the `{ kind, value }` wrapper the trigger
 * received. Calling the contribution directly with the wrapper would hide the
 * contract mismatch that opened empty menus in the real page.
 */
function menuActions(components: LoadedComponents, target: CapturedTarget): TestMenuActionView[] {
  assert.equal(components.contributions.length, 1, 'no context-menu contribution was registered')
  return components.contextMenus.resolve(target).source.getSnapshot()
}

/** Read the most recently bound target, failing when no menu opened. */
function lastTarget(menu: MenuMock): CapturedTarget {
  const open = menu.opens.at(-1)
  assert.ok(open, 'no context-menu target was bound')
  return open.target
}

/** Resolve and run one root or nested action from a captured menu target. */
async function runMenuAction(
  components: LoadedComponents,
  target: CapturedTarget,
  ...ids: readonly [string, ...string[]]
): Promise<void> {
  const resolution = components.contextMenus.resolve(target)
  let candidates: readonly TestMenuActionView[] = resolution.source.getSnapshot()
  let published = MENU_ID
  for (const [index, id] of ids.entries()) {
    published += `/${encodeURIComponent(id)}`
    const action = candidates.find((candidate: TestMenuActionView) => candidate.id === published)
    assert.ok(action, `no context-menu action "${published}"`)
    if (index === ids.length - 1) {
      resolution.select(action.id)
      await new Promise<void>((resolve) => {
        setImmediate(resolve)
      })
      return
    }
    candidates = action.children ?? []
  }
}

test('right-clicking a change binds its target without calling the Host', async () => {
  const mounted = await mountGit()
  const before = mounted.calls.length
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
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
  assert.deepEqual(
    menuActions(mounted.components, target).map((action) => action.id),
    [
      menuActionId('open'),
      menuActionId('stage'),
      menuActionId('discard'),
      menuActionId('ignore'),
      menuActionId('copy-relative'),
      menuActionId('copy-path'),
    ],
  )
  await mounted.harness.dispose()
})

test('every listed object resolves at least one menu command', async () => {
  const mounted = await mountGit()
  const byClass = (name: string): TestElement[] =>
    mounted.harness.findAll((element) => String(element.props?.className ?? '').includes(name))
  const changedFile = mounted.harness
    .findAll(
      (element) =>
        String(element.props?.className ?? '').includes('dshgg-fileRow') &&
        element.props?.title === 'src/app.js',
    )
    .at(-1)
  assert.ok(changedFile, 'no changed file rendered')
  const group = mounted.harness.findAll(
    (element) => element.props?.['data-section'] === 'changes',
  )[0]
  assert.ok(group, 'no change group rendered')
  const commitRow = byClass('dshgg-graphRow')[0]
  assert.ok(commitRow, 'no commit row rendered')
  const surfaces: Array<[label: string, element: TestElement]> = [
    ['changed file', changedFile],
    ['change group header', elementOf(group.children[0])],
    ['commit', commitRow],
  ]
  for (const [label, element] of surfaces) {
    const before = mounted.menu.opens.length
    mounted.harness.contextmenu(element, { clientX: 5, clientY: 6 })
    assert.equal(mounted.menu.opens.length, before + 1, `${label} did not bind a menu target`)
    const ids = menuActions(mounted.components, lastTarget(mounted.menu)).map((action) => action.id)
    assert.ok(ids.length > 0, `${label} resolved an empty menu`)
  }
  await mounted.harness.dispose()
})

test('a menu command stages through the panel like the inline control', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.contextmenu(rows[rows.length - 1])
  const target = lastTarget(mounted.menu)
  await runMenuAction(mounted.components, target, 'stage')
  await mounted.harness.flush()
  const stageCall = mounted.calls.find((call) => call.op === 'stage')
  assert.deepEqual(stageCall?.paths, ['src/app.js'])
  assert.ok(
    mounted.calls.filter((call) => call.op === 'status').length >= 2,
    'the panel refreshes after a menu command',
  )
  await mounted.harness.dispose()
})

test('a changed-file menu ignores its path through the shared action refresh', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.contextmenu(rows[rows.length - 1])
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'ignore')
  await mounted.harness.flush()
  const ignore = mounted.calls.find((call) => call.op === 'ignore')
  assert.equal(ignore?.path, 'src/app.js')
  assert.ok(mounted.calls.filter((call) => call.op === 'status').length >= 2)
  assert.match(mounted.harness.text(), /menu\.ignoredTracked/)
  const untracked = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'README.md',
  )[0]
  assert.ok(untracked)
  mounted.harness.contextmenu(untracked)
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'ignore')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'ignore').at(-1)?.path, 'README.md')
  assert.match(mounted.harness.text(), /menu\.ignored/)
  await mounted.harness.dispose()
})

test('commit submenus run checkout, creation and confirmed deletion', async () => {
  const head = HISTORY.commits[0]
  assert.ok(head)
  const history: HistoryResult = {
    ...HISTORY,
    commits: [
      {
        ...head,
        refs: 'HEAD -> refs/heads/main, refs/heads/feature/graph, refs/remotes/origin/main, tag: refs/tags/v1',
      },
      ...HISTORY.commits.slice(1),
    ],
  }
  const mounted = await mountGit({ history })
  let focusRestores = 0
  const invoker: TestEventTarget = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 80, height: 22, bottom: 22 }),
    isConnected: true,
    focus: () => {
      focusRestores += 1
    },
  }
  const openMenu = async (): Promise<CapturedTarget> => {
    const row = mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-graphRow'),
    )[0]
    assert.ok(row, 'no graph row rendered')
    mounted.harness.contextmenu(row, { clientX: 1, clientY: 2, currentTarget: invoker })
    await mounted.harness.flush()
    return lastTarget(mounted.menu)
  }
  const target = await openMenu()
  assert.deepEqual(target.value.branchHeads, [
    { name: 'feature/graph', current: false },
    { name: 'main', current: true },
  ])
  await runMenuAction(mounted.components, target, 'checkout', 'feature/graph')
  await mounted.harness.flush()
  assert.equal(mounted.calls.find((call) => call.op === 'checkout')?.branch, 'feature/graph')

  await runMenuAction(mounted.components, await openMenu(), 'checkout-detached')
  await mounted.harness.flush()
  assert.equal(mounted.calls.find((call) => call.op === 'checkout-detached')?.oid, 'a'.repeat(40))

  await runMenuAction(mounted.components, await openMenu(), 'create-branch')
  await mounted.harness.flush()
  let nameInput = mounted.harness.findAll(
    (element) => element.type === 'input' && element.props['aria-label'] === 'menu.referenceName',
  )[0]
  assert.ok(nameInput)
  assert.equal(buttonContaining(mounted.harness, 'menu.createBranch').props.disabled, true)
  mounted.harness.change(nameInput, 'feature/from-menu')
  await mounted.harness.flush()
  mounted.harness.click(buttonContaining(mounted.harness, 'menu.createBranch'))
  await mounted.harness.flush()
  const branch = mounted.calls.find((call) => call.op === 'create-branch')
  assert.equal(branch?.oid, 'a'.repeat(40))
  assert.equal(branch?.name, 'feature/from-menu')
  assert.equal(mounted.harness.text().includes('menu.createBranchAt'), false)

  await runMenuAction(mounted.components, await openMenu(), 'create-tag')
  await mounted.harness.flush()
  nameInput = mounted.harness.findAll(
    (element) => element.type === 'input' && element.props['aria-label'] === 'menu.referenceName',
  )[0]
  const messageInput = mounted.harness.findAll(
    (element) => element.type === 'textarea' && element.props['aria-label'] === 'menu.tagMessage',
  )[0]
  assert.ok(nameInput)
  assert.ok(messageInput)
  mounted.harness.change(nameInput, 'v2.0')
  mounted.harness.change(messageInput, 'release\n\nnotes')
  await mounted.harness.flush()
  mounted.harness.click(buttonContaining(mounted.harness, 'menu.createTag'))
  await mounted.harness.flush()
  const tag = mounted.calls.find((call) => call.op === 'create-tag')
  assert.equal(tag?.oid, 'a'.repeat(40))
  assert.equal(tag?.name, 'v2.0')
  assert.equal(tag?.message, 'release\n\nnotes')
  assert.equal(focusRestores, 2, 'successful creation restores its triggering row')

  await runMenuAction(mounted.components, await openMenu(), 'delete-branch', 'feature/graph')
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /menu\.deleteBranchConfirm/)
  assert.equal(
    mounted.calls.some((call) => call.op === 'delete-branch'),
    false,
  )
  const cancel = buttonByText(mounted.harness, 'action.cancel')
  assert.equal(cancel.props.autoFocus, true)
  const dialog = mounted.harness.findAll((element) => element.props.role === 'alertdialog')[0]
  assert.ok(dialog)
  const describedBy = dialog.props['aria-describedby']
  assert.equal(typeof describedBy, 'string')
  assert.equal(mounted.harness.findAll((element) => element.props.id === describedBy).length, 1)
  const focusBeforeEscape = focusRestores
  mounted.harness.keydown(dialog, { key: 'Escape' })
  await mounted.harness.flush()
  assert.equal(mounted.harness.text().includes('menu.deleteBranchConfirm'), false)
  assert.equal(focusRestores, focusBeforeEscape + 1)
  assert.equal(
    mounted.calls.some((call) => call.op === 'delete-branch'),
    false,
  )

  await runMenuAction(mounted.components, await openMenu(), 'delete-branch', 'feature/graph')
  await mounted.harness.flush()
  const focusBeforeCancel = focusRestores
  mounted.harness.click(buttonByText(mounted.harness, 'action.cancel'))
  await mounted.harness.flush()
  assert.equal(focusRestores, focusBeforeCancel + 1)
  await runMenuAction(mounted.components, await openMenu(), 'delete-branch', 'feature/graph')
  await mounted.harness.flush()
  mounted.harness.click(buttonContaining(mounted.harness, 'menu.deleteBranch'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.find((call) => call.op === 'delete-branch')?.branch, 'feature/graph')
  assert.ok(mounted.calls.filter((call) => call.op === 'history').length >= 6)
  await mounted.harness.dispose()
})

test('a failed tag creation keeps the dialog text and displays the failure', async () => {
  const mounted = await mountGit({ failOp: 'create-tag' })
  const row = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )[0]
  assert.ok(row)
  mounted.harness.contextmenu(row)
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'create-tag')
  await mounted.harness.flush()
  const name = mounted.harness.findAll(
    (element) => element.type === 'input' && element.props['aria-label'] === 'menu.referenceName',
  )[0]
  const message = mounted.harness.findAll(
    (element) => element.type === 'textarea' && element.props['aria-label'] === 'menu.tagMessage',
  )[0]
  assert.ok(name)
  assert.ok(message)
  mounted.harness.change(name, 'existing-tag')
  mounted.harness.change(message, 'keep this text')
  await mounted.harness.flush()
  mounted.harness.keydown(message, { key: 'Enter' })
  await mounted.harness.flush()
  assert.equal(
    mounted.calls.some((call) => call.op === 'create-tag'),
    false,
  )
  mounted.harness.change(message, 'keep this text\non two lines')
  await mounted.harness.flush()
  const currentMessage = mounted.harness.findAll(
    (element) => element.type === 'textarea' && element.props['aria-label'] === 'menu.tagMessage',
  )[0]
  assert.ok(currentMessage)
  mounted.harness.keydown(currentMessage, { key: 'Enter', ctrlKey: true })
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /git said no/)
  assert.equal(
    mounted.harness.findAll(
      (element) => element.type === 'input' && element.props['aria-label'] === 'menu.referenceName',
    )[0]?.props.value,
    'existing-tag',
  )
  assert.equal(
    mounted.harness.findAll(
      (element) => element.type === 'textarea' && element.props['aria-label'] === 'menu.tagMessage',
    )[0]?.props.value,
    'keep this text\non two lines',
  )
  assert.match(mounted.harness.text(), /menu\.createTagAt/)
  await mounted.harness.dispose()
})

test('a menu discard keeps the panel confirmation before calling the Host', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.contextmenu(rows[rows.length - 1])
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'discard')
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
  const section = mounted.harness.findAll(
    (element) => element.props?.['data-section'] === 'changes',
  )[0]
  assert.ok(section, 'no changes group rendered')
  mounted.harness.contextmenu(elementOf(section.children[0]))
  const target = lastTarget(mounted.menu)
  assert.equal(target.value.kind, 'section')
  assert.equal(target.value.section, 'changes')
  assert.deepEqual(
    menuActions(mounted.components, target).map((action) => action.id),
    [menuActionId('stage-all'), menuActionId('discard-all'), menuActionId('refresh')],
  )
  await runMenuAction(mounted.components, target, 'stage-all')
  await mounted.harness.flush()
  const stageCall = mounted.calls.find((call) => call.op === 'stage')
  assert.ok(stageCall?.paths)
  assert.deepEqual([...stageCall.paths].sort(), ['README.md', 'src/app.js'])
  await mounted.harness.dispose()
})

test('the keyboard context-menu gesture binds the focused row', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
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
  const target = {
    kind: 'gitGraphItem',
    value: {
      sessionId: 'other-session',
      kind: 'file',
      section: 'changes',
      path: 'src/app.js',
      cwd: '/repo',
    },
  }
  await runMenuAction(mounted.components, target, 'stage')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'stage').length, 0)
  await mounted.harness.dispose()
})

test('commit rows and the diff header bind their copy targets', async () => {
  const mounted = await mountGit()
  const graphRow = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )[0]
  assert.ok(graphRow, 'no graph row rendered')
  mounted.harness.contextmenu(graphRow, { clientX: 1, clientY: 2 })
  const commitTarget = lastTarget(mounted.menu)
  assert.equal(commitTarget.value.kind, 'commit')
  assert.equal(commitTarget.value.oid, 'a'.repeat(40))
  assert.equal(commitTarget.value.subject, 'Fix the sidebar')
  assert.deepEqual(commitTarget.value.branchHeads, [{ name: 'main', current: true }])
  assert.deepEqual(
    menuActions(mounted.components, commitTarget).map((action) => action.id),
    [
      menuActionId('checkout'),
      menuActionId('checkout-detached'),
      menuActionId('create-branch'),
      menuActionId('create-tag'),
      menuActionId('copy-id'),
      menuActionId('copy-message'),
    ],
  )
  await mounted.harness.dispose()

  const harness = createHarness({
    fetch: async (_url, init) => {
      const request = JSON.parse(init.body)
      const value =
        request.op === 'diff'
          ? {
              path: 'src/app.js',
              staged: false,
              untracked: false,
              binary: false,
              truncated: false,
              additions: 0,
              deletions: 0,
              hunks: [],
            }
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
    actions: {
      openTab: () => {},
      openResource: () => {},
      close: () => {},
      bindCommands: () => () => {},
    },
    navigation: {
      address: 'sidebar://git-diff',
      params: { path: 'src/app.js', staged: false, untracked: false, status: 'M', cwd: '/repo' },
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
    useContextMenu: menu.useContextMenu,
  })
  await harness.render()
  const header = harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-diffHeader'),
  )[0]
  assert.ok(header, 'no diff header rendered')
  harness.contextmenu(header, { clientX: 3, clientY: 4 })
  const diffTarget = lastTarget(menu)
  assert.equal(diffTarget.value.kind, 'diff')
  assert.equal(diffTarget.value.path, 'src/app.js')
  assert.equal(diffTarget.value.cwd, '/repo')
  assert.deepEqual(
    menuActions(components, diffTarget).map((action) => action.id),
    [menuActionId('copy-relative'), menuActionId('copy-path')],
  )
  await harness.dispose()
})

test('without host context menus the inline controls keep working', async () => {
  const mounted = await mountGit({ menus: false })
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  const row = rows[rows.length - 1]
  assert.equal(row.props.onContextMenu, undefined)
  mounted.harness.click(buttonInside(row, 'actions.stage'))
  await mounted.harness.flush()
  assert.deepEqual(mounted.calls.find((call) => call.op === 'stage')?.paths, ['src/app.js'])
  await mounted.harness.dispose()
})

test('menu copies absolute paths from the repository root, not the Session directory', async () => {
  const status = createStatus({
    repo: createRepo({ cwd: '/repo/apps/web', upstream: null, ahead: 0, behind: 0 }),
    files: [
      {
        kind: 'ordinary',
        x: '.',
        y: 'M',
        path: 'apps/web/src/app.js',
        conflict: false,
        untracked: false,
      },
    ],
  })
  const mounted = await mountGit({ status })
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'apps/web/src/app.js',
  )
  mounted.harness.contextmenu(rows[rows.length - 1])
  const target = lastTarget(mounted.menu)
  assert.equal(target.value.cwd, '/repo')
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
    await runMenuAction(mounted.components, target, 'copy-path')
    assert.equal(copied.at(-1), '/repo/apps/web/src/app.js')
  } finally {
    if (previousNavigator === undefined) Reflect.deleteProperty(globalThis, 'navigator')
    else Object.defineProperty(globalThis, 'navigator', previousNavigator)
  }
  mounted.harness.click(rows[rows.length - 1])
  const firstOpen = mounted.openedTabs[0]
  assert.ok(firstOpen)
  assert.equal(firstOpen.options.params.cwd, '/repo')
  await mounted.harness.dispose()
})

test('a menu command for a vanished change reports it instead of doing nothing', async () => {
  const mounted = await mountGit()
  const target = {
    kind: 'gitGraphItem',
    value: {
      sessionId: 'session-1',
      kind: 'file',
      section: 'changes',
      path: 'gone.js',
      cwd: '/repo',
    },
  }
  await runMenuAction(mounted.components, target, 'stage')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'stage').length, 0)
  assert.match(mounted.harness.text(), /menu\.stale/)
  await mounted.harness.dispose()
})

test('a group discard uses the group confirmation wording', async () => {
  const status = createStatus({
    files: [
      { kind: 'ordinary', x: '.', y: 'M', path: 'only.js', conflict: false, untracked: false },
    ],
  })
  const mounted = await mountGit({ status })
  const section = mounted.harness.findAll(
    (element) => element.props?.['data-section'] === 'changes',
  )[0]
  mounted.harness.contextmenu(elementOf(section.children[0]))
  const target = lastTarget(mounted.menu)
  await runMenuAction(mounted.components, target, 'discard-all')
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /confirm\.discardAllTitle/)
  await mounted.harness.dispose()
})

test('commit rows are keyboard focus stops with menu semantics', async () => {
  const mounted = await mountGit()
  const graphRow = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )[0]
  assert.equal(graphRow.props.tabIndex, 0)
  assert.equal(graphRow.props['aria-haspopup'], 'menu')
  mounted.harness.keydown(graphRow, { key: 'ContextMenu' })
  assert.equal(mounted.menu.opens.length, 1)
  assert.equal(mounted.menu.opens[0].target.value.kind, 'commit')
  await mounted.harness.dispose()
})

test('a menu command from another pane of the same Session is ignored', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.contextmenu(rows[rows.length - 1])
  const target = lastTarget(mounted.menu)
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

/** Badge elements rendered inside one row. */
function badgesIn(row: TestElement | undefined): TestElement[] {
  assert.ok(row, 'the row is rendered')
  return collectElements(row, (element) =>
    String(element.props?.className ?? '')
      .split(' ')
      .includes('dshgg-graphBadge'),
  )
}

/** Count recorded calls of one operation. */
function opCount(mounted: MountedGit, op: string): number {
  return mounted.calls.filter((call) => call.op === op).length
}

test('an external working-tree change refreshes the status without reloading the graph', async () => {
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({ watchState: () => counters })
  assert.equal(opCount(mounted, 'status'), 1)
  assert.equal(opCount(mounted, 'history'), 1)

  mounted.harness.runIntervals()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 1, 'an unchanged counter does not refresh')

  counters = { watching: true, worktree: 1, references: 0 }
  mounted.harness.runIntervals()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2, 'the working-tree counter refreshes the status')
  assert.equal(opCount(mounted, 'history'), 1, 'the loaded graph is not reloaded')
  assert.equal(opCount(mounted, 'references'), 0, 'a working-tree change is not a reference change')
  assert.match(mounted.harness.text(), /Fix the sidebar/, 'the loaded commits stay visible')
  await mounted.harness.dispose()
})

test('an external branch switch recolors and re-badges loaded rows in place', async () => {
  const history: HistoryResult = {
    commits: [
      {
        oid: 'a'.repeat(40),
        shortOid: 'aaaaaaa',
        author: 'Ann',
        authoredAt: 1_700_000_000,
        refs: 'HEAD -> refs/heads/main',
        parents: ['b'.repeat(40)],
        subject: 'Old tip',
      },
      {
        oid: 'b'.repeat(40),
        shortOid: 'bbbbbbb',
        author: 'Bob',
        authoredAt: 1_699_999_000,
        refs: 'refs/heads/feature',
        parents: [],
        subject: 'Feature tip',
      },
    ],
    hasMore: false,
    references: {
      current: { id: 'refs/heads/main', name: 'main', revision: 'a'.repeat(40) },
      remote: null,
      base: null,
    },
  }
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    history,
    watchState: () => counters,
    referencePages: [
      {
        current: { id: 'refs/heads/feature', name: 'feature', revision: 'b'.repeat(40) },
        remote: null,
        base: null,
      },
    ],
  })
  const rowsBefore = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
  )
  assert.equal(rowsBefore[0]?.props['data-current'], 'true')
  assert.deepEqual(
    badgesIn(rowsBefore[0]).map((badge) => badge.props['data-icon']),
    ['target'],
    'the checked-out branch starts on the old tip',
  )

  counters = { watching: true, worktree: 0, references: 1 }
  mounted.harness.runIntervals()
  await mounted.harness.flush()

  assert.equal(opCount(mounted, 'references'), 1)
  assert.equal(opCount(mounted, 'history'), 1, 'the loaded pages are kept')
  assert.equal(opCount(mounted, 'status'), 2, 'the branch header follows the switch')
  const rowsAfter = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphRow',
  )
  assert.equal(rowsAfter[0]?.props['data-current'], undefined)
  assert.equal(rowsAfter[1]?.props['data-current'], 'true')
  assert.deepEqual(
    badgesIn(rowsAfter[0]).map((badge) => badge.props['data-icon']),
    ['branch'],
    'the old tip keeps main as an ordinary branch badge',
  )
  const feature = badgesIn(rowsAfter[1])
  assert.equal(feature.length, 1)
  assert.equal(feature[0]?.props['data-icon'], 'target')
  assert.equal(feature[0]?.props['data-color'], 'ref')
  await mounted.harness.dispose()
})

test('a reference move outside the loaded rows reloads the newest graph page', async () => {
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    watchState: () => counters,
    referencePages: [
      {
        current: { id: 'refs/heads/main', name: 'main', revision: 'c'.repeat(40) },
        remote: null,
        base: null,
      },
    ],
  })
  counters = { watching: true, worktree: 0, references: 1 }
  mounted.harness.runIntervals()
  await mounted.harness.flush()

  assert.equal(opCount(mounted, 'references'), 1)
  assert.equal(opCount(mounted, 'status'), 2)
  assert.equal(opCount(mounted, 'history'), 2, 'the newest page is reloaded for the new tip')
  await mounted.harness.dispose()
})

test('a Host that cannot watch leaves the periodic status check in charge', async () => {
  const mounted = await mountGit({
    watchState: () => ({ watching: false, worktree: 0, references: 0 }),
  })
  assert.equal(opCount(mounted, 'status'), 1)
  mounted.harness.runIntervals()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2, 'the fallback poll keeps the panel current')
  assert.equal(opCount(mounted, 'references'), 0)
  assert.doesNotMatch(mounted.harness.text(), /error\.title/)
  await mounted.harness.dispose()
  assert.ok(
    mounted.calls.some((call) => call.op === 'unwatch'),
    'unmounting releases the subscription',
  )
})
