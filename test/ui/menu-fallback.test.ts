/**
 * Behavior without host menus or notifications, and after disposal.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  buttonByText,
  buttonInside,
  disposeUiLifetimes,
  loadUiPanel,
  mountGit,
  slotNotify,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

test('without host context menus the inline controls keep working', async () => {
  const mounted = await mountGit({ menus: false })
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  const row = rows[rows.length - 1]
  assert.ok(row, 'the unstaged file row is missing')
  assert.equal(row.props.onContextMenu, undefined)
  mounted.harness.click(buttonInside(row, 'actions.stage'))
  await mounted.harness.flush()
  assert.deepEqual(mounted.calls.find((call) => call.op === 'stage')?.paths, ['src/app.js'])
  assert.deepEqual(mounted.components.notifications, [], 'staging has no new success feedback')
  await mounted.harness.dispose()
})

test('without the host notification service the pane still registers and commits', async () => {
  const mounted = await mountGit({ menuService: false })
  assert.equal(
    mounted.components.slots.length,
    4,
    'the Git pane is registered once without its service',
  )
  assert.equal(
    mounted.components.contributions.length,
    0,
    'no menu contribution without the service',
  )
  assert.equal(
    typeof slotNotify(mounted.components),
    'function',
    'the pane still gets a safe callback',
  )
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'fix: no toast service')
  await mounted.harness.flush()
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.find((call) => call.op === 'commit')?.message, 'fix: no toast service')
  assert.equal(messageBox()?.props.value, '', 'the commit still clears its message')
  assert.equal(mounted.calls.filter((call) => call.op === 'status').length >= 2, true)
  assert.deepEqual(mounted.components.notifications, [], 'a missing service stays silent')
  assert.doesNotMatch(mounted.harness.text(), /error\.title/)
  await mounted.harness.dispose()
})

test('a failing host notification does not interrupt a commit', async () => {
  const mounted = await mountGit()
  mounted.components.contextMenus.notify = () => {
    throw new Error('toast offline')
  }
  const originalWarn = console.warn
  let warnings = 0
  console.warn = () => {
    warnings += 1
  }
  try {
    const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
    mounted.harness.change(messageBox(), 'fix: toast is down')
    await mounted.harness.flush()
    mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
    await mounted.harness.flush()
    assert.equal(mounted.calls.find((call) => call.op === 'commit')?.message, 'fix: toast is down')
    assert.equal(messageBox()?.props.value, '', 'the commit still clears its message')
    assert.equal(mounted.calls.filter((call) => call.op === 'status').length >= 2, true)
    assert.equal(mounted.calls.filter((call) => call.op === 'history').length >= 2, true)
    assert.doesNotMatch(mounted.harness.text(), /toast offline/)
    assert.doesNotMatch(mounted.harness.text(), /error\.title/)
  } finally {
    console.warn = originalWarn
  }
  assert.ok(warnings >= 1, 'the delivery failure is contained and logged')
  await mounted.harness.dispose()
})

test('disposing the plugin lifetime stops the pane from reaching the old service', async () => {
  const mounted = await mountGit()
  const notify = slotNotify(mounted.components)
  const before = mounted.components.notifications.length
  mounted.components.dispose()
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'fix: after unload')
  await mounted.harness.flush()
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.find((call) => call.op === 'commit')?.message, 'fix: after unload')
  assert.equal(messageBox()?.props.value, '', 'the commit still clears its message')
  notify('after unload', true)
  assert.equal(
    mounted.components.notifications.length,
    before,
    'the disposed binding never reaches the old service',
  )
  assert.doesNotMatch(mounted.harness.text(), /error\.title/)
  await mounted.harness.dispose()
})
