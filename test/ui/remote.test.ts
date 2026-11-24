/**
 * Remote menu, network actions and remote configuration.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { RemotesResult } from '../../src/shared/git.ts'
import { createRepo, createStatus, REMOTES, STATUS } from '../support/fixtures.ts'
import type { TestElement } from '../support/types.ts'
import {
  buttonByLabel,
  buttonContaining,
  collectElements,
  dialogInput,
  dispatchDocumentPointerdown,
  disposeUiLifetimes,
  elementOf,
  elementText,
  escapeKeydown,
  finishMotion,
  floatingPanel,
  graphHeaderButton,
  hasClass,
  loadUiPanel,
  mountGit,
  openDiscard,
  openRemoteGroup,
  openRemoteMenu,
  remoteMenuItem,
  remotesCalls,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

test('the remote menu runs pull with rebase and sync', async () => {
  const mounted = await mountGit()
  await openRemoteMenu(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.pullRebase'))
  await mounted.harness.flush()
  assert.equal(
    mounted.calls.filter((call) => call.op === 'pull').at(-1)?.rebase,
    true,
    'Pull (Rebase) asks Git to rebase',
  )
  await openRemoteMenu(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.sync'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'sync').length, 1)
  assert.deepEqual(mounted.components.notifications, [
    { text: 'remote.pullRebaseDone', success: true },
    { text: 'remote.syncDone', success: true },
  ])
  await mounted.harness.dispose()
})

test('the header disables pull and push without an upstream while the menu publishes', async () => {
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null }) }),
  })
  assert.equal(graphHeaderButton(mounted, 'remote.pull').props.disabled, true)
  assert.equal(graphHeaderButton(mounted, 'remote.push').props.disabled, true)
  await openRemoteMenu(mounted)
  assert.equal(remoteMenuItem(mounted, 'remote.publishBranch').props.disabled, false)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.publishBranch'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'publish').length, 1)
  assert.equal(mounted.calls.filter((call) => call.op === 'publish').at(-1)?.remote, 'origin')
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    0,
    'one configured remote publishes without asking',
  )
  assert.deepEqual(mounted.components.notifications, [
    { text: 'remote.publishDone', success: true },
  ])
  await mounted.harness.dispose()
})

test('publish with several remotes asks for one and prefers origin', async () => {
  const many: RemotesResult = {
    remotes: [
      {
        name: 'upstream',
        fetchUrl: 'https://example.test/up.git',
        pushUrl: 'https://example.test/up.git',
      },
      {
        name: 'origin',
        fetchUrl: 'https://example.test/repo.git',
        pushUrl: 'https://example.test/repo.git',
      },
    ],
  }
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null }), files: STATUS.files }),
    remotes: many,
  })
  await openRemoteMenu(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.publishBranch'))
  await mounted.harness.flush()
  const { dialog } = floatingPanel(mounted.harness)
  assert.match(elementText(dialog), /remote\.publishTitle/)
  const [select] = mounted.harness.findAll((element) => element.type === 'select')
  assert.ok(select, 'the publish form offers a remote select')
  assert.equal(select.props.value, 'origin', 'origin is preferred when it exists')
  mounted.harness.change(select, 'upstream')
  await mounted.harness.flush()
  assert.equal(
    mounted.harness.findAll((element) => element.type === 'select')[0]?.props.value,
    'upstream',
  )
  mounted.harness.click(buttonContaining(mounted.harness, 'remote.publishAction'))
  await mounted.harness.flush()
  const publish = mounted.calls.filter((call) => call.op === 'publish').at(-1)
  assert.equal(publish?.remote, 'upstream', 'the chosen remote reaches the Host')
  assert.deepEqual(mounted.components.notifications, [
    { text: 'remote.publishDone', success: true },
  ])
  await finishMotion(mounted.harness)
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    0,
    'a successful publish closes the form',
  )
  await mounted.harness.dispose()
})

test('a failed publish keeps the form and its selected remote', async () => {
  const many: RemotesResult = {
    remotes: [
      {
        name: 'origin',
        fetchUrl: 'https://example.test/repo.git',
        pushUrl: 'https://example.test/repo.git',
      },
      {
        name: 'upstream',
        fetchUrl: 'https://example.test/up.git',
        pushUrl: 'https://example.test/up.git',
      },
    ],
  }
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null }) }),
    remotes: many,
    failOp: 'publish',
  })
  await openRemoteMenu(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.publishBranch'))
  await mounted.harness.flush()
  const select = (): TestElement | undefined =>
    mounted.harness.findAll((element) => element.type === 'select')[0]
  assert.ok(select())
  mounted.harness.change(select(), 'upstream')
  await mounted.harness.flush()
  const statusBefore = mounted.calls.filter((call) => call.op === 'status').length
  mounted.harness.click(buttonContaining(mounted.harness, 'remote.publishAction'))
  await mounted.harness.flush()
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    1,
    'the failed publish keeps the form open',
  )
  assert.equal(select()?.props.value, 'upstream', 'the chosen remote stays selected')
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
  assert.ok(
    mounted.calls.filter((call) => call.op === 'status').length > statusBefore,
    'a failed remote action still refreshes the status',
  )
  assert.equal(
    mounted.components.notifications.some((notification) => notification.success),
    false,
    'a failure emits no success notice',
  )
  await mounted.harness.dispose()
})

test('publish with no configured remote reports it without calling Git', async () => {
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null }) }),
    remotes: { remotes: [] },
  })
  await openRemoteMenu(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.publishBranch'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'publish').length, 0)
  assert.deepEqual(mounted.components.notifications, [{ text: 'remote.noRemotes', success: false }])
  await mounted.harness.dispose()
})

test('the remote menu shows the remote-list loading and failure notes with retry', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const loading = await mountGit({ pending: { op: 'remotes', until: pending } })
  loading.harness.click(buttonByLabel(loading.harness, 'remote.menu'))
  await loading.harness.flush()
  assert.match(loading.harness.text(), /remote\.loading/)
  release()
  await loading.harness.flush()
  assert.equal(graphHeaderButton(loading, 'remote.fetch').props.disabled, false)
  await loading.harness.dispose()

  const failing = await mountGit({ failRemotesPages: [0] })
  await openRemoteMenu(failing)
  assert.match(failing.harness.text(), /git said no/)
  assert.equal(failing.calls.filter((call) => call.op === 'remotes').length, 1)
  failing.harness.click(buttonContaining(failing.harness, 'retry'))
  await failing.harness.flush()
  assert.equal(failing.calls.filter((call) => call.op === 'remotes').length, 2)
  assert.doesNotMatch(failing.harness.text(), /git said no/)
  assert.equal(graphHeaderButton(failing, 'remote.fetch').props.disabled, false)
  await failing.harness.dispose()
})

test('Escape and an outside pointerdown close the remote menu', async () => {
  const mounted = await mountGit()
  const items = (): number =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-menuItem')).length
  await openRemoteMenu(mounted)
  assert.equal(items(), 3, 'Pull (Rebase), Sync and the Remote disclosure')
  const escapeResult = escapeKeydown()
  await mounted.harness.flush()
  assert.equal(escapeResult.prevented, false, 'the menu does not consume the key')
  assert.equal(items(), 0)
  await openRemoteMenu(mounted)
  assert.equal(items(), 3)
  dispatchDocumentPointerdown({})
  await mounted.harness.flush()
  assert.equal(items(), 0, 'an outside pointerdown closes the menu')
  await mounted.harness.dispose()
})

test('the branch picker and remote menu never stay open together', async () => {
  const mounted = await mountGit()
  const chip = (): TestElement => {
    const [element] = mounted.harness.findAll(
      (element) => element.type === 'button' && hasClass(element, 'dshgg-branchChip'),
    )
    assert.ok(element, 'no branch chip rendered')
    return element
  }
  mounted.harness.click(chip())
  await mounted.harness.flush()
  assert.equal(chip().props['aria-expanded'], true)
  await openRemoteMenu(mounted)
  assert.equal(chip().props['aria-expanded'], false, 'the remote menu closes the branch picker')
  assert.ok(mounted.harness.findAll((element) => hasClass(element, 'dshgg-menuItem')).length > 0)
  mounted.harness.click(chip())
  await mounted.harness.flush()
  assert.equal(chip().props['aria-expanded'], true)
  assert.equal(
    mounted.harness.findAll(
      (element) =>
        element.type === 'button' &&
        hasClass(element, 'dshgg-menuItem') &&
        elementText(element) === 'remote.pullRebase',
    ).length,
    0,
    'the branch picker closes the remote menu',
  )
  await mounted.harness.dispose()
})

test('a busy panel disables every remote action', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const mounted = await mountGit({ pending: { op: 'fetch', until: pending } })
  mounted.harness.click(graphHeaderButton(mounted, 'remote.fetch'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'fetch').length, 1)
  await openRemoteMenu(mounted)
  for (const label of ['remote.fetch', 'remote.pull', 'remote.push']) {
    assert.equal(graphHeaderButton(mounted, label).props.disabled, true, `${label} is disabled`)
  }
  for (const label of ['remote.pullRebase', 'remote.sync']) {
    assert.equal(remoteMenuItem(mounted, label).props.disabled, true, `${label} is disabled`)
  }
  release()
  await mounted.harness.flush()
  for (const label of ['remote.fetch', 'remote.pull', 'remote.push']) {
    assert.equal(
      graphHeaderButton(mounted, label).props.disabled,
      false,
      `${label} is enabled again`,
    )
  }
  for (const label of ['remote.pullRebase', 'remote.sync']) {
    assert.equal(remoteMenuItem(mounted, label).props.disabled, false, `${label} is enabled again`)
  }
  await mounted.harness.dispose()
})

test('the publish form replaces an open confirmation and a confirmation replaces it', async () => {
  const many: RemotesResult = {
    remotes: [
      {
        name: 'origin',
        fetchUrl: 'https://example.test/repo.git',
        pushUrl: 'https://example.test/repo.git',
      },
      {
        name: 'upstream',
        fetchUrl: 'https://example.test/up.git',
        pushUrl: 'https://example.test/up.git',
      },
    ],
  }
  const mounted = await mountGit({
    status: createStatus({ repo: createRepo({ upstream: null }), files: STATUS.files }),
    remotes: many,
  })
  await openDiscard(mounted)
  assert.match(mounted.harness.text(), /confirm\.discardTitle/)
  await openRemoteMenu(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.publishBranch'))
  await mounted.harness.flush()
  const dialogs = (): TestElement[] =>
    mounted.harness.findAll((element) => element.props.role === 'alertdialog')
  assert.equal(dialogs().length, 1)
  assert.match(elementText(elementOf(dialogs()[0])), /remote\.publishTitle/)
  assert.equal(
    elementText(elementOf(dialogs()[0])).includes('confirm.discardTitle'),
    false,
    'the publish form replaced the confirmation',
  )
  await openDiscard(mounted)
  assert.equal(dialogs().length, 1)
  assert.match(elementText(elementOf(dialogs()[0])), /confirm\.discardTitle/)
  assert.equal(
    elementText(elementOf(dialogs()[0])).includes('remote.publishTitle'),
    false,
    'the confirmation replaced the publish form',
  )
  await mounted.harness.dispose()
})

test('Add Remote submits the name and URL, closes and refreshes the list', async () => {
  const mounted = await mountGit({ menuService: true })
  await openRemoteMenu(mounted)
  await openRemoteGroup(mounted)
  const before = remotesCalls(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.add'))
  await mounted.harness.flush()
  const { dialog } = floatingPanel(mounted.harness)
  assert.match(elementText(dialog), /remote\.addTitle/)
  const name = dialogInput(mounted, 'remote.nameField')
  const url = dialogInput(mounted, 'remote.urlField')
  assert.ok(name, 'the form shows the name field')
  assert.ok(url, 'the form shows the URL field')
  assert.equal(name.props.autoFocus, true, 'the name field takes focus')
  const submit = buttonContaining(mounted.harness, 'remote.addAction')
  assert.equal(submit.props.disabled, true, 'empty fields cannot be submitted')
  mounted.harness.change(name, 'upstream')
  mounted.harness.change(url, 'https://example.test/up.git')
  await mounted.harness.flush()
  assert.equal(buttonContaining(mounted.harness, 'remote.addAction').props.disabled, false)
  mounted.harness.click(buttonContaining(mounted.harness, 'remote.addAction'))
  await mounted.harness.flush()
  const added = mounted.calls.filter((call) => call.op === 'add-remote').at(-1)
  assert.equal(added?.name, 'upstream')
  assert.equal(added?.url, 'https://example.test/up.git')
  assert.deepEqual(mounted.components.notifications, [{ text: 'remote.addDone', success: true }])
  assert.ok(remotesCalls(mounted) > before, 'the remotes list reloads after a successful add')
  await finishMotion(mounted.harness)
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    0,
    'a successful add closes the form',
  )
  await mounted.harness.dispose()
})

test('a failed add keeps the form and its values and reports the failure', async () => {
  const mounted = await mountGit({ failOp: 'add-remote' })
  await openRemoteMenu(mounted)
  await openRemoteGroup(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.add'))
  await mounted.harness.flush()
  const name = dialogInput(mounted, 'remote.nameField')
  const url = dialogInput(mounted, 'remote.urlField')
  assert.ok(name)
  assert.ok(url)
  mounted.harness.change(name, 'upstream')
  mounted.harness.change(url, 'https://example.test/up.git')
  await mounted.harness.flush()
  mounted.harness.click(buttonContaining(mounted.harness, 'remote.addAction'))
  await mounted.harness.flush()
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    1,
    'the failed add keeps the form open',
  )
  assert.equal(dialogInput(mounted, 'remote.nameField')?.props.value, 'upstream')
  assert.equal(dialogInput(mounted, 'remote.urlField')?.props.value, 'https://example.test/up.git')
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
  assert.equal(
    mounted.components.notifications.some((notification) => notification.success),
    false,
    'a failure emits no success notice',
  )
  await mounted.harness.dispose()
})

test('Remove Remote lists the remotes, confirms and refreshes', async () => {
  const mounted = await mountGit({ menuService: true })
  await openRemoteMenu(mounted)
  await openRemoteGroup(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.remove'))
  await mounted.harness.flush()
  const { dialog, footer } = floatingPanel(mounted.harness)
  assert.match(elementText(dialog), /remote\.removeTitle/)
  assert.match(elementText(dialog), /remote\.removeDesc/)
  const select = mounted.harness.findAll((element) => element.type === 'select')[0]
  assert.ok(select, 'the remove form offers a remote select')
  assert.equal(select.props.value, 'origin', 'the first configured remote is selected')
  const footerButtons = collectElements(footer, (element) => element.type === 'button')
  assert.equal(footerButtons[0]?.props.autoFocus, true, 'Cancel takes focus on a destructive form')
  const before = remotesCalls(mounted)
  mounted.harness.click(buttonContaining(mounted.harness, 'remote.removeAction'))
  await mounted.harness.flush()
  const removed = mounted.calls.filter((call) => call.op === 'remove-remote').at(-1)
  assert.equal(removed?.name, 'origin')
  assert.deepEqual(mounted.components.notifications, [{ text: 'remote.removeDone', success: true }])
  assert.ok(remotesCalls(mounted) > before, 'the remotes list reloads after a successful remove')
  await finishMotion(mounted.harness)
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    0,
    'a successful remove closes the form',
  )
  await mounted.harness.dispose()
})

test('Remove reports no remotes after reading the list again', async () => {
  const mounted = await mountGit({
    remotesPages: [REMOTES, { remotes: [] }],
  })
  await openRemoteMenu(mounted)
  await openRemoteGroup(mounted)
  assert.equal(remoteMenuItem(mounted, 'remote.remove').props.disabled, false)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.remove'))
  await mounted.harness.flush()
  assert.equal(
    mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
    0,
    'no remove form opens without a configured remote',
  )
  assert.deepEqual(mounted.components.notifications, [{ text: 'remote.noRemotes', success: false }])
  await mounted.harness.dispose()
})

test('Remove stays disabled until a non-empty remote list is loaded', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const loading = await mountGit({ pending: { op: 'remotes', until: pending } })
  loading.harness.click(buttonByLabel(loading.harness, 'remote.menu'))
  await loading.harness.flush()
  await openRemoteGroup(loading)
  assert.equal(
    remoteMenuItem(loading, 'remote.add').props.disabled,
    false,
    'Add works while loading',
  )
  assert.equal(remoteMenuItem(loading, 'remote.remove').props.disabled, true)
  release()
  await loading.harness.flush()
  assert.equal(remoteMenuItem(loading, 'remote.remove').props.disabled, false)
  await loading.harness.dispose()

  const failing = await mountGit({ failRemotesPages: [0] })
  await openRemoteMenu(failing)
  await openRemoteGroup(failing)
  assert.equal(remoteMenuItem(failing, 'remote.remove').props.disabled, true)
  assert.match(failing.harness.text(), /git said no/)
  failing.harness.click(buttonContaining(failing.harness, 'retry'))
  await failing.harness.flush()
  assert.equal(remoteMenuItem(failing, 'remote.remove').props.disabled, false)
  await failing.harness.dispose()
})

test('Escape closes the add-remote form without running Git', async () => {
  const mounted = await mountGit()
  await openRemoteMenu(mounted)
  await openRemoteGroup(mounted)
  mounted.harness.click(remoteMenuItem(mounted, 'remote.add'))
  await mounted.harness.flush()
  const { dialog } = floatingPanel(mounted.harness)
  mounted.harness.keydown(dialog, { key: 'Escape' })
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'add-remote').length, 0)
  await finishMotion(mounted.harness)
  assert.equal(mounted.harness.findAll((element) => element.props.role === 'alertdialog').length, 0)
  await mounted.harness.dispose()
})

test('fetch and remote configuration work without a current branch', async () => {
  const detached = await mountGit({
    status: createStatus({
      repo: createRepo({
        branch: null,
        detached: true,
        upstream: null,
        ahead: 0,
        behind: 0,
        headOid: 'a'.repeat(40),
      }),
    }),
  })
  await openRemoteMenu(detached)
  assert.equal(graphHeaderButton(detached, 'remote.fetch').props.disabled, false)
  assert.equal(
    graphHeaderButton(detached, 'remote.pull').props.disabled,
    true,
    'Pull needs a branch with an upstream',
  )
  assert.equal(
    graphHeaderButton(detached, 'remote.push').props.disabled,
    true,
    'Push needs a branch with an upstream',
  )
  detached.harness.click(graphHeaderButton(detached, 'remote.fetch'))
  await detached.harness.flush()
  assert.equal(detached.calls.filter((call) => call.op === 'fetch').length, 1)
  await openRemoteMenu(detached)
  await openRemoteGroup(detached)
  assert.equal(remoteMenuItem(detached, 'remote.add').props.disabled, false)
  assert.equal(remoteMenuItem(detached, 'remote.remove').props.disabled, false)
  detached.harness.click(remoteMenuItem(detached, 'remote.add'))
  await detached.harness.flush()
  floatingPanel(detached.harness)
  const name = dialogInput(detached, 'remote.nameField')
  const url = dialogInput(detached, 'remote.urlField')
  assert.ok(name)
  assert.ok(url)
  detached.harness.change(name, 'upstream')
  detached.harness.change(url, 'https://example.test/up.git')
  await detached.harness.flush()
  detached.harness.click(buttonContaining(detached.harness, 'remote.addAction'))
  await detached.harness.flush()
  assert.equal(detached.calls.filter((call) => call.op === 'add-remote').length, 1)
  await detached.harness.dispose()

  const unborn = await mountGit({
    status: createStatus({
      repo: createRepo({ unborn: true, upstream: null, ahead: 0, behind: 0, headOid: null }),
    }),
  })
  await openRemoteMenu(unborn)
  assert.equal(graphHeaderButton(unborn, 'remote.fetch').props.disabled, false)
  unborn.harness.click(graphHeaderButton(unborn, 'remote.fetch'))
  await unborn.harness.flush()
  assert.equal(unborn.calls.filter((call) => call.op === 'fetch').length, 1)
  await unborn.harness.dispose()
})
