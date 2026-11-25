/**
 * Graph header controls, toolbar progress and the branch picker.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createBranches } from '../support/fixtures.ts'
import type { TestElement } from '../support/types.ts'
import {
  buttonContaining,
  buttonInside,
  collectElements,
  deferred,
  disposeUiLifetimes,
  elementText,
  graphHeaderButton,
  graphSection,
  hasClass,
  loadUiPanel,
  mountGit,
  openRemoteMenu,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

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

test('the commit graph header fetches and reports success', async () => {
  const mounted = await mountGit({ menuService: true })
  await openRemoteMenu(mounted)
  assert.ok(
    mounted.calls.some((call) => call.op === 'remotes'),
    'opening the overflow menu reads the configured remotes',
  )
  assert.equal(graphHeaderButton(mounted, 'remote.fetch').props.disabled, false)
  const statusBefore = mounted.calls.filter((call) => call.op === 'status').length
  mounted.harness.click(graphHeaderButton(mounted, 'remote.fetch'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'fetch').length, 1)
  assert.equal(
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-menuItem')).length,
    0,
    'starting an action closes the menu',
  )
  assert.deepEqual(mounted.components.notifications, [{ text: 'remote.fetchDone', success: true }])
  assert.ok(
    mounted.calls.filter((call) => call.op === 'status').length > statusBefore,
    'a successful remote action refreshes the status',
  )
  await mounted.harness.dispose()
})

test('the commit graph header runs pull and push', async () => {
  const mounted = await mountGit()
  mounted.harness.click(graphHeaderButton(mounted, 'remote.pull'))
  await mounted.harness.flush()
  const pull = mounted.calls.filter((call) => call.op === 'pull').at(-1)
  assert.equal(pull?.rebase, false, 'Pull merges the upstream')
  mounted.harness.click(graphHeaderButton(mounted, 'remote.push'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'push').length, 1)
  assert.deepEqual(mounted.components.notifications, [
    { text: 'remote.pullDone', success: true },
    { text: 'remote.pushDone', success: true },
  ])
  await mounted.harness.dispose()
})

test('the commit graph header owns fetch, pull, push and the overflow menu', async () => {
  const mounted = await mountGit()
  for (const label of ['remote.fetch', 'remote.pull', 'remote.push', 'remote.menu']) {
    assert.ok(graphHeaderButton(mounted, label), `${label} lives in the graph header`)
  }
  const [toolbar] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-toolbar'))
  assert.ok(toolbar, 'no panel toolbar rendered')
  assert.equal(
    collectElements(
      toolbar,
      (element) => element.type === 'button' && element.props['aria-label'] === 'remote.menu',
    ).length,
    0,
    'the toolbar no longer owns the overflow menu',
  )
  for (const label of ['remote.statusSync', 'remote.statusPublish', 'remote.fetch']) {
    assert.equal(
      collectElements(
        toolbar,
        (element) => element.type === 'button' && element.props['aria-label'] === label,
      ).length,
      0,
      `the toolbar no longer owns ${label}`,
    )
  }
  assert.ok(buttonInside(toolbar, 'refresh'), 'the refresh control stays in the toolbar')
  const [header] = collectElements(graphSection(mounted), (element) =>
    hasClass(element, 'dshgg-sectionHeader'),
  )
  assert.ok(header, 'no graph section header rendered')
  assert.equal(
    header.props['data-hover'],
    undefined,
    'the graph header keeps the whole-header highlight like every other header',
  )
  const toggle = (): TestElement => {
    const [element] = collectElements(
      graphSection(mounted),
      (candidate) => candidate.type === 'button' && hasClass(candidate, 'dshgg-sectionToggle'),
    )
    assert.ok(element, 'no graph section toggle rendered')
    return element
  }
  assert.equal(toggle().props['aria-expanded'], true)
  mounted.harness.click(toggle())
  await mounted.harness.flush()
  assert.equal(toggle().props['aria-expanded'], false, 'the graph section collapses')
  for (const label of ['remote.fetch', 'remote.pull', 'remote.push']) {
    assert.ok(graphHeaderButton(mounted, label), `${label} survives the collapse`)
  }
  await mounted.harness.dispose()
})

test('the toolbar shows an indeterminate progress bar while the panel loads', async (t) => {
  const gate = deferred()
  const mounted = await mountGit({ statusGates: [gate.promise] })
  t.after(async () => {
    gate.release()
    await mounted.harness.flush()
    await mounted.harness.dispose()
  })
  const progressBars = (): TestElement[] =>
    mounted.harness.findAll((element) => element.props.role === 'progressbar')
  assert.equal(progressBars().length, 1, 'the opening load shows the progress bar')
  const [bar] = progressBars()
  assert.ok(bar)
  assert.ok(hasClass(bar, 'dshgg-progress'), 'the bar is the toolbar track')
  assert.equal(bar.props['aria-label'], 'progress.label', 'the bar carries a localized label')
  assert.equal(
    collectElements(bar, (element) => hasClass(element, 'dshgg-progressBar')).length,
    1,
    'the track holds the sweeping segment',
  )
  gate.release()
  await mounted.harness.flush()
  assert.equal(progressBars().length, 1, 'a brief load holds the bar for its minimum time')
  mounted.harness.runTimeouts()
  await mounted.harness.flush()
  assert.equal(progressBars().length, 0, 'the settled panel shows no progress bar')
})

test('the toolbar progress bar follows a running operation', async (t) => {
  let release = (): void => {}
  const until = new Promise<void>((resolve) => {
    release = resolve
  })
  const mounted = await mountGit({ pending: { op: 'stage', until } })
  t.after(async () => {
    release()
    await mounted.harness.flush()
    await mounted.harness.dispose()
  })
  const progressBars = (): TestElement[] =>
    mounted.harness.findAll((element) => element.props.role === 'progressbar')
  // The opening load's answer already arrived; let its minimum visible time
  // pass so the panel is idle before the operation starts.
  mounted.harness.runTimeouts()
  await mounted.harness.flush()
  assert.equal(progressBars().length, 0, 'an idle panel shows no progress bar')
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  const row = rows[rows.length - 1]
  assert.ok(row, 'the unstaged file row is missing')
  mounted.harness.click(buttonInside(row, 'actions.stage'))
  await mounted.harness.flush()
  assert.equal(progressBars().length, 1, 'the running stage shows the bar')
  release()
  await mounted.harness.flush()
  assert.equal(progressBars().length, 1, 'a finished operation still holds the minimum time')
  mounted.harness.runTimeouts()
  await mounted.harness.flush()
  assert.equal(progressBars().length, 0, 'the bar leaves when the operation and minimum finish')
})

test('the overflow menu keeps only actions that are not in the header', async () => {
  const mounted = await mountGit()
  await openRemoteMenu(mounted)
  assert.deepEqual(
    mounted.harness
      .findAll((element) => element.type === 'button' && hasClass(element, 'dshgg-menuItem'))
      .map((item) => elementText(item)),
    ['remote.pullRebase', 'remote.sync', 'remote.group'],
  )
  for (const label of ['remote.fetch', 'remote.pull', 'remote.push']) {
    assert.equal(
      mounted.harness.findAll(
        (element) => element.type === 'button' && elementText(element) === label,
      ).length,
      0,
      `no ${label} menu item remains`,
    )
  }
  await mounted.harness.dispose()
})

test('the branch picker lists remote branches and checks one out', async () => {
  const remotes = [
    { name: 'origin/main', remote: 'origin', branch: 'main' },
    { name: 'origin/release/1.0', remote: 'origin', branch: 'release/1.0' },
  ]
  const mounted = await mountGit({
    branches: createBranches(['main', 'feature/sidebar'], 'main', remotes),
  })
  const chip = (): TestElement => {
    const [element] = mounted.harness.findAll(
      (candidate) => candidate.type === 'button' && hasClass(candidate, 'dshgg-branchChip'),
    )
    assert.ok(element, 'no branch chip rendered')
    return element
  }
  const items = (): TestElement[] =>
    mounted.harness.findAll(
      (element) => element.type === 'button' && hasClass(element, 'dshgg-menuItem'),
    )
  mounted.harness.click(chip())
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /branch\.remoteHeading/)
  assert.deepEqual(
    items().map((item) => elementText(item)),
    ['main', 'feature/sidebar', 'origin/main', 'origin/release/1.0'],
    'local branches come first, then the remote group',
  )
  const remoteItem = items()[2]
  assert.ok(remoteItem)
  assert.equal(
    collectElements(remoteItem, (element) => element.type === 'svg').length,
    1,
    'remote branches carry the cloud icon',
  )
  const historyBefore = mounted.calls.filter((call) => call.op === 'history').length
  const branchReads = mounted.calls.filter((call) => call.op === 'branches').length
  mounted.harness.click(remoteItem)
  await mounted.harness.flush()
  const checkedOut = mounted.calls.filter((call) => call.op === 'checkout-remote').at(-1)
  assert.equal(checkedOut?.remote, 'origin')
  assert.equal(checkedOut?.branch, 'main')
  assert.deepEqual(mounted.components.notifications, [
    { text: 'branch.checkedOutRemote', success: true },
  ])
  assert.ok(
    mounted.calls.filter((call) => call.op === 'history').length > historyBefore,
    'a remote checkout refreshes the graph',
  )
  mounted.harness.click(chip())
  await mounted.harness.flush()
  assert.ok(
    mounted.calls.filter((call) => call.op === 'branches').length > branchReads,
    'the branch list is read again after a remote checkout',
  )
  await mounted.harness.dispose()
})

test('an empty local branch group still shows the remote group', async () => {
  const mounted = await mountGit({
    branches: createBranches([], '', [{ name: 'origin/main', remote: 'origin', branch: 'main' }]),
  })
  mounted.harness.click(
    mounted.harness.findAll(
      (element) => element.type === 'button' && hasClass(element, 'dshgg-branchChip'),
    )[0],
  )
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /branch\.remoteHeading/)
  assert.ok(buttonContaining(mounted.harness, 'origin/main'))
  assert.match(mounted.harness.text(), /branch\.empty/)
  await mounted.harness.dispose()
})
