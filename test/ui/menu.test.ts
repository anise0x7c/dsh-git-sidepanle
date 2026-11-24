/**
 * Context-menu binding, commands and their effects.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { HistoryResult } from '../../src/shared/git.ts'
import { translate } from '../support/fake-ctx.ts'
import { createMenuMock } from '../support/fake-menu.ts'
import { createRepo, createStatus, HISTORY, STATUS } from '../support/fixtures.ts'
import type { CapturedTarget, TestElement, TestEventTarget } from '../support/types.ts'
import {
  buttonByText,
  buttonContaining,
  buttonInside,
  createHarness,
  disposeUiLifetimes,
  elementOf,
  finishMotion,
  floatingPanel,
  lastTarget,
  loadComponents,
  loadUiPanel,
  menuActionId,
  menuActions,
  mountGit,
  runMenuAction,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

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
  const open = mounted.menu.opens[0]
  assert.ok(open, 'no context-menu target was bound')
  assert.deepEqual(open.point, { x: 40, y: 60 })
  const target = open.target
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
  assert.deepEqual(mounted.components.notifications.pop(), {
    text: 'menu.ignoredTracked',
    success: true,
  })
  assert.equal(
    mounted.harness.text().includes('menu.ignored'),
    false,
    'no inline notice is rendered',
  )
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
  assert.deepEqual(mounted.components.notifications.pop(), {
    text: 'menu.ignored',
    success: true,
  })
  await mounted.harness.dispose()
})

test('a failed ignore refreshes no success Toast and reports its error', async () => {
  const mounted = await mountGit({ failOp: 'ignore' })
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.contextmenu(rows[rows.length - 1])
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'ignore')
  await mounted.harness.flush()
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
  assert.equal(
    mounted.components.notifications.some((notification) => notification.success),
    false,
    'a failed ignore emits no success Toast',
  )
  await mounted.harness.dispose()
})

test('an ignored path is notified again when the same message repeats', async () => {
  const mounted = await mountGit()
  const target = {
    kind: 'gitGraphItem',
    value: {
      sessionId: 'session-1',
      kind: 'file',
      section: 'changes',
      path: 'src/app.js',
      cwd: '/repo',
    },
  }
  await runMenuAction(mounted.components, target, 'ignore')
  await mounted.harness.flush()
  await runMenuAction(mounted.components, target, 'ignore')
  await mounted.harness.flush()
  assert.deepEqual(mounted.components.notifications, [
    { text: 'menu.ignoredTracked', success: true },
    { text: 'menu.ignoredTracked', success: true },
  ])
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
  assert.deepEqual(mounted.components.notifications.pop(), {
    text: 'menu.detached',
    success: true,
  })

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
  assert.deepEqual(mounted.components.notifications.pop(), {
    text: 'menu.branchCreated',
    success: true,
  })
  await finishMotion(mounted.harness)
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
  assert.deepEqual(mounted.components.notifications.pop(), {
    text: 'menu.tagCreated',
    success: true,
  })
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
  await finishMotion(mounted.harness)
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
  await finishMotion(mounted.harness)
  assert.equal(focusRestores, focusBeforeCancel + 1)
  await runMenuAction(mounted.components, await openMenu(), 'delete-branch', 'feature/graph')
  await mounted.harness.flush()
  mounted.harness.click(buttonContaining(mounted.harness, 'menu.deleteBranch'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.find((call) => call.op === 'delete-branch')?.branch, 'feature/graph')
  assert.deepEqual(mounted.components.notifications.pop(), {
    text: 'menu.branchDeleted',
    success: true,
  })
  assert.ok(mounted.calls.filter((call) => call.op === 'history').length >= 6)
  await mounted.harness.dispose()
})

test('a failed tag creation keeps the dialog text and reports the failure', async () => {
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
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
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
  const { dialog } = floatingPanel(mounted.harness)
  assert.notEqual(dialog.props['aria-busy'], true)
  assert.equal(mounted.calls.filter((call) => call.op === 'create-tag').length, 1)
  assert.equal(
    mounted.components.notifications.some((notification) => notification.success),
    false,
    'a failed reference creation emits no success Toast',
  )
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
  const open = mounted.menu.opens[0]
  assert.ok(open, 'the keyboard gesture bound no menu target')
  assert.equal(open.target.value.path, 'src/app.js')
  assert.equal(open.target.value.kind, 'file')
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
      menuActionId('view-details'),
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

test('a busy panel rejects a menu command without a second write', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const mounted = await mountGit({ pending: { op: 'stage', until: pending } })
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  const row = rows[rows.length - 1]
  assert.ok(row)
  mounted.harness.click(buttonInside(row, 'actions.stage'))
  mounted.harness.contextmenu(row)
  const target = lastTarget(mounted.menu)
  await runMenuAction(mounted.components, target, 'stage')
  assert.deepEqual(mounted.components.notifications, [{ text: 'menu.busy', success: false }])
  assert.equal(
    mounted.calls.filter((call) => call.op === 'stage').length,
    1,
    'the busy refusal never starts a second write',
  )
  release()
  await mounted.harness.flush()
  assert.deepEqual(mounted.components.notifications, [{ text: 'menu.busy', success: false }])
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
  assert.deepEqual(mounted.components.notifications, [{ text: 'menu.stale', success: false }])
  assert.equal(mounted.harness.text().includes('menu.stale'), false, 'no inline notice is rendered')
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
  assert.ok(section, 'the changes section did not render')
  mounted.harness.contextmenu(elementOf(section.children[0]))
  const target = lastTarget(mounted.menu)
  await runMenuAction(mounted.components, target, 'discard-all')
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /confirm\.discardAllTitle/)
  floatingPanel(mounted.harness)
  await mounted.harness.dispose()
})

test('commit rows are keyboard focus stops with menu semantics', async () => {
  const mounted = await mountGit()
  const graphRow = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-graphRow'),
  )[0]
  assert.ok(graphRow, 'no graph row rendered')
  assert.equal(graphRow.props.tabIndex, 0)
  assert.equal(graphRow.props['aria-haspopup'], 'menu')
  mounted.harness.keydown(graphRow, { key: 'ContextMenu' })
  assert.equal(mounted.menu.opens.length, 1)
  const open = mounted.menu.opens[0]
  assert.ok(open, 'the keyboard gesture bound no menu target')
  assert.equal(open.target.value.kind, 'commit')
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
