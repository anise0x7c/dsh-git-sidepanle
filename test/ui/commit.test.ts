/**
 * Commit box, its action menu and the combined commit variants.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createRepo, createStatus, STATUS } from '../support/fixtures.ts'
import {
  buttonByLabel,
  buttonByText,
  buttonInside,
  collectElements,
  commitMenuItem,
  commitMenuItems,
  dispatchDocumentPointerdown,
  disposeUiLifetimes,
  elementText,
  escapeKeydown,
  hasClass,
  isElement,
  loadUiPanel,
  mountGit,
  openCommitMenu,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

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
  assert.deepEqual(
    mounted.components.notifications,
    [{ text: 'commit.done', success: true }],
    'one shared success Toast confirms the commit',
  )
  assert.equal(mounted.harness.text().includes('commit.done'), false, 'the panel keeps no notice')
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
  assert.deepEqual(mounted.components.notifications, [{ text: 'commit.done', success: true }])
  assert.equal(
    mounted.harness.findAll((element) => element.type === 'textarea')[0]?.props.value,
    '',
    'stage-all commit still clears the message',
  )
  await mounted.harness.dispose()
})

test('a failed commit keeps its message and reports no success Toast', async () => {
  const mounted = await mountGit({ failOp: 'commit' })
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'fix: will fail')
  await mounted.harness.flush()
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
  assert.equal(messageBox()?.props.value, 'fix: will fail', 'a failed commit keeps its message')
  assert.equal(
    mounted.components.notifications.some((notification) => notification.success),
    false,
    'a Git failure emits no success Toast',
  )
  await mounted.harness.dispose()
})

test('an empty message disables both halves of the split commit button', async () => {
  const mounted = await mountGit()
  const [wrapper] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitActions'))
  assert.ok(wrapper, 'the commit box renders the split commit actions')
  assert.equal(wrapper.props['data-disabled'], 'true', 'the split control uses one disabled state')
  const main = buttonByText(mounted.harness, 'commit.action')
  assert.equal(
    collectElements(wrapper, (element) => element === main).length,
    1,
    'the main commit control sits inside the split wrapper',
  )
  assert.equal(main.props.disabled, true)
  const expand = buttonInside(wrapper, 'commit.menu')
  assert.equal(expand.props.disabled, true, 'the expand control shares the commit button state')
  assert.equal(expand.props['aria-haspopup'], 'menu')
  assert.equal(expand.props['aria-expanded'], false)
  mounted.harness.click(expand)
  await mounted.harness.flush()
  assert.equal(
    commitMenuItems(mounted).length,
    0,
    'the menu cannot open while the message is empty',
  )
  await mounted.harness.dispose()
})

test('a typed message enables both halves and the menu lists the commit variants', async () => {
  const mounted = await mountGit()
  mounted.harness.change(
    mounted.harness.findAll((element) => element.type === 'textarea')[0],
    'feat: menu',
  )
  await mounted.harness.flush()
  const [wrapper] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitActions'))
  assert.ok(wrapper, 'the commit box renders the split commit actions')
  assert.equal(
    wrapper.props['data-disabled'],
    undefined,
    'a typed message enables the split control',
  )
  assert.equal(buttonByText(mounted.harness, 'commit.action').props.disabled, false)
  assert.equal(buttonInside(wrapper, 'commit.menu').props.disabled, false)
  await openCommitMenu(mounted)
  assert.equal(buttonByLabel(mounted.harness, 'commit.menu').props['aria-expanded'], true)
  const [menu] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMenu'))
  assert.ok(menu, 'the split button opens the commit action menu')
  assert.equal(menu.props.role, 'menu')
  assert.equal(menu.props['aria-label'], 'commit.menu')
  const elements = menu.children.filter(isElement)
  assert.deepEqual(
    elements.map((element) =>
      element.props.role === 'separator' ? 'separator' : element.props['data-action'],
    ),
    ['commit', 'amend', 'separator', 'commit-push', 'commit-sync'],
  )
  assert.deepEqual(
    elements.map((element) =>
      element.props.role === 'separator' ? 'separator' : elementText(element),
    ),
    ['commit.action', 'commit.amend', 'separator', 'commit.push', 'commit.sync'],
  )
  for (const element of elements) {
    if (element.props.role === 'separator') continue
    assert.equal(
      element.props.disabled,
      false,
      'every entry is available with a message and an upstream',
    )
  }
  await mounted.harness.dispose()
})

test('Escape and an outside press dismiss the commit action menu', async () => {
  const mounted = await mountGit()
  mounted.harness.change(
    mounted.harness.findAll((element) => element.type === 'textarea')[0],
    'feat: dismiss',
  )
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  assert.equal(commitMenuItems(mounted).length, 4, 'the menu starts open')
  const escapeResult = escapeKeydown()
  assert.equal(escapeResult.prevented, false, 'the menu does not consume Escape')
  await mounted.harness.flush()
  assert.equal(commitMenuItems(mounted).length, 0, 'Escape closes the menu')
  await openCommitMenu(mounted)
  assert.equal(commitMenuItems(mounted).length, 4, 'the menu reopens')
  dispatchDocumentPointerdown({})
  await mounted.harness.flush()
  assert.equal(commitMenuItems(mounted).length, 0, 'an outside pointerdown closes the menu')
  await mounted.harness.dispose()
})

test('a running action disables both halves of the split commit button', async (t) => {
  let release = (): void => {}
  const until = new Promise<void>((resolve) => {
    release = resolve
  })
  const mounted = await mountGit({ pending: { op: 'commit', until } })
  t.after(async () => {
    release()
    await mounted.harness.flush()
    await mounted.harness.dispose()
  })
  mounted.harness.change(
    mounted.harness.findAll((element) => element.type === 'textarea')[0],
    'feat: busy',
  )
  await mounted.harness.flush()
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  const [wrapper] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitActions'))
  assert.equal(wrapper?.props['data-disabled'], 'true', 'a running action dims the split control')
  const [main] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMain'))
  assert.equal(main?.props.disabled, true, 'the commit control is unavailable')
  assert.match(mounted.harness.text(), /commit\.committing/, 'the label shows the running commit')
  assert.equal(buttonByLabel(mounted.harness, 'commit.menu').props.disabled, true)
  assert.equal(commitMenuItems(mounted).length, 0, 'no menu opens over a running action')
})

test('the menu can amend HEAD with the typed message and no staging', async () => {
  const mounted = await mountGit()
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'fix: amend me')
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  mounted.harness.click(commitMenuItem(mounted, 'amend'))
  await mounted.harness.flush()
  const commitCall = mounted.calls.find((call) => call.op === 'commit')
  assert.equal(commitCall?.message, 'fix: amend me')
  assert.equal(commitCall?.amend, true, 'Amend replaces HEAD')
  assert.equal(commitCall?.stageAll, undefined, 'Amend never stages every change')
  assert.equal(messageBox()?.props.value, '', 'the amended message leaves the box empty')
  assert.deepEqual(mounted.components.notifications, [{ text: 'commit.done', success: true }])
  await mounted.harness.dispose()
})

test('Commit and Push commits and then pushes in that order', async () => {
  const mounted = await mountGit()
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'feat: ship it')
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  mounted.harness.click(commitMenuItem(mounted, 'commit-push'))
  await mounted.harness.flush()
  assert.deepEqual(
    mounted.calls
      .filter((call) => call.op === 'commit' || call.op === 'push')
      .map((call) => call.op),
    ['commit', 'push'],
    'the commit lands before the push',
  )
  const commitCall = mounted.calls.find((call) => call.op === 'commit')
  assert.equal(commitCall?.message, 'feat: ship it')
  assert.notEqual(commitCall?.amend, true)
  assert.deepEqual(mounted.components.notifications, [
    { text: 'commit.done', success: true },
    { text: 'remote.pushDone', success: true },
  ])
  assert.equal(messageBox()?.props.value, '', 'the committed message leaves the box empty')
  await mounted.harness.dispose()
})

test('a failed push keeps the completed commit and reports the failure', async () => {
  const mounted = await mountGit({ failOp: 'push' })
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'fix: push fails')
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  mounted.harness.click(commitMenuItem(mounted, 'commit-push'))
  await mounted.harness.flush()
  assert.ok(
    mounted.calls.some((call) => call.op === 'commit'),
    'the commit still reaches the Host',
  )
  assert.equal(messageBox()?.props.value, '', 'the committed message stays cleared')
  assert.ok(
    mounted.components.notifications.some(
      (notification) => notification.text === 'commit.done' && notification.success,
    ),
  )
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the push failure is reported as a non-success notification',
  )
  await mounted.harness.dispose()
})

test('the combined commit entries need an upstream', async () => {
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null }) }),
  })
  mounted.harness.change(
    mounted.harness.findAll((element) => element.type === 'textarea')[0],
    'feat: no upstream',
  )
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  for (const action of ['commit-push', 'commit-sync']) {
    const item = commitMenuItem(mounted, action)
    assert.equal(item.props.disabled, true, `${action} is blocked without an upstream`)
    assert.equal(item.props.title, 'remote.noUpstream')
  }
  for (const action of ['commit', 'amend']) {
    assert.equal(
      commitMenuItem(mounted, action).props.disabled,
      false,
      `${action} stays available without an upstream`,
    )
  }
  await mounted.harness.dispose()
})

test('a clean workspace ahead of its upstream turns the commit action into Sync', async () => {
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ ahead: 3 }), files: [] }),
  })
  const main = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMain'))[0]
  assert.ok(main, 'the commit box renders its primary action')
  assert.equal(
    elementText(main),
    'commit.syncCount',
    'the primary action names the local commits to sync',
  )
  assert.equal(main.props.disabled, false, 'syncing needs no commit message')
  assert.equal(main.props.title, 'commit.syncHint')
  assert.ok(
    collectElements(main, (element) => element.type === 'svg').length > 0,
    'the sync action carries its icon',
  )
  const [wrapper] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitActions'))
  assert.equal(wrapper?.props['data-sync'], 'true', 'the strip marks its sync state')
  assert.equal(
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitExpand')).length,
    0,
    'the commit modes stay out of reach',
  )
  assert.equal(
    mounted.harness.findAll((element) => element.props['aria-label'] === 'commit.menu').length,
    0,
    'the sync action has no action menu',
  )
  await mounted.harness.dispose()
})

test('the sync action runs Sync without a message and without committing', async () => {
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ ahead: 3 }), files: [] }),
  })
  mounted.harness.click(buttonByText(mounted.harness, 'commit.syncCount'))
  await mounted.harness.flush()
  assert.deepEqual(
    mounted.calls.filter((call) => ['commit', 'sync'].includes(call.op)).map((call) => call.op),
    ['sync'],
    'the primary action syncs and creates no commit',
  )
  assert.ok(
    mounted.components.notifications.some(
      (notification) => notification.text === 'remote.syncDone' && notification.success,
    ),
    'the finished sync is reported',
  )
  assert.equal(
    mounted.harness.findAll((element) => element.type === 'textarea')[0]?.props.value,
    '',
    'syncing leaves no commit message behind',
  )
  await mounted.harness.dispose()
})

test('a running sync shows its state and locks the commit box', async (t) => {
  let release = (): void => {}
  const until = new Promise<void>((resolve) => {
    release = resolve
  })
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ ahead: 1 }), files: [] }),
    pending: { op: 'sync', until },
  })
  t.after(async () => {
    release()
    await mounted.harness.flush()
    await mounted.harness.dispose()
  })
  mounted.harness.click(buttonByText(mounted.harness, 'commit.syncCount'))
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /commit\.syncing/, 'the action names its running state')
  const [wrapper] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitActions'))
  assert.equal(wrapper?.props['data-disabled'], 'true', 'a running sync dims the control')
  const [main] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMain'))
  assert.equal(main?.props.disabled, true, 'a second sync waits for the first')
})

test('changes or a missing upstream keep the commit action', async () => {
  const changed = await mountGit({
    status: createStatus({ repo: createRepo({ ahead: 2 }), files: STATUS.files }),
  })
  assert.equal(
    buttonByText(changed.harness, 'commit.action').props.disabled,
    true,
    'a change to commit keeps the commit action, which still needs a message',
  )
  assert.equal(
    changed.harness.findAll((element) => hasClass(element, 'dshgg-commitActions'))[0]?.props[
      'data-sync'
    ],
    undefined,
    'the strip keeps its commit state',
  )
  assert.ok(buttonByLabel(changed.harness, 'commit.menu'), 'the commit modes stay reachable')
  await changed.harness.dispose()
  const unpublished = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null, ahead: 2 }), files: [] }),
  })
  assert.equal(
    buttonByText(unpublished.harness, 'commit.action').props.disabled,
    true,
    'a branch without an upstream never shows the sync action',
  )
  assert.equal(
    unpublished.harness.findAll((element) => hasClass(element, 'dshgg-commitMain'))[0]?.props.title,
    'commit.hintNone',
  )
  await unpublished.harness.dispose()
})

test('Commit and Sync stages everything first when nothing is staged', async () => {
  const stagedStatus = createStatus({
    files: [
      { kind: 'ordinary', x: '.', y: 'M', path: 'src/app.js', conflict: false, untracked: false },
    ],
  })
  const mounted = await mountGit({ status: stagedStatus })
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'chore: sync everything')
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  mounted.harness.click(commitMenuItem(mounted, 'commit-sync'))
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /commit\.emptyConfirm/)
  assert.equal(
    mounted.calls.filter((call) => call.op === 'commit' || call.op === 'sync').length,
    0,
    'no repository write happens before the confirmation',
  )
  mounted.harness.click(buttonByText(mounted.harness, 'commit.stageAll'))
  await mounted.harness.flush()
  assert.deepEqual(
    mounted.calls
      .filter((call) => call.op === 'commit' || call.op === 'sync')
      .map((call) => call.op),
    ['commit', 'sync'],
    'the staged commit lands before the sync',
  )
  const commitCall = mounted.calls.find((call) => call.op === 'commit')
  assert.equal(commitCall?.stageAll, true)
  assert.notEqual(commitCall?.amend, true)
  assert.equal(messageBox()?.props.value, '')
  await mounted.harness.dispose()
})

test('Commit and Push with no changes reports that there is nothing to commit', async () => {
  // A clean branch that is not ahead keeps the commit modes: an ahead branch
  // would offer Sync instead, so this refusal needs the in-step fixture.
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ ahead: 0 }), files: [] }),
  })
  mounted.harness.change(
    mounted.harness.findAll((element) => element.type === 'textarea')[0],
    'feat: nothing',
  )
  await mounted.harness.flush()
  await openCommitMenu(mounted)
  mounted.harness.click(commitMenuItem(mounted, 'commit-push'))
  await mounted.harness.flush()
  assert.equal(
    mounted.calls.filter((call) => call.op === 'commit' || call.op === 'push' || call.op === 'sync')
      .length,
    0,
    'an empty change list runs no repository write',
  )
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'commit.nothing',
    ),
    'the refusal is reported as a non-success notification',
  )
  await mounted.harness.dispose()
})
