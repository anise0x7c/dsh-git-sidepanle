/**
 * Floating confirmations and reference forms.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { translate } from '../support/fake-ctx.ts'
import { createStatus, HISTORY } from '../support/fixtures.ts'
import type { TestElement, TestEventTarget } from '../support/types.ts'
import {
  buttonByText,
  buttonContaining,
  buttonInside,
  collectElements,
  disposeUiLifetimes,
  elementText,
  finishMotion,
  floatingPanel,
  graphMenuTarget,
  hasClass,
  loadUiPanel,
  mountGit,
  openDiscard,
  runMenuAction,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

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

test('floating discard focuses Cancel and Escape preserves the split without Git', async (t) => {
  const mounted = await mountGit()
  t.after(() => mounted.harness.dispose())
  const [splitter] = mounted.harness.findAll((element) => element.props.role === 'separator')
  assert.ok(splitter)
  mounted.harness.keydown(splitter, { key: 'ArrowDown' })
  await mounted.harness.flush()
  const geometry = () =>
    mounted.harness
      .findAll(
        (element) =>
          hasClass(element, 'dshgg-split') ||
          hasClass(element, 'dshgg-paneTop') ||
          hasClass(element, 'dshgg-paneBottom') ||
          element.props.role === 'separator',
      )
      .map((element) => [
        element.props.className,
        element.props.style,
        element.props['aria-valuenow'],
      ])
  const beforeGeometry = geometry()
  const beforeCalls = [...mounted.calls]
  await openDiscard(mounted)
  const { dialog, footer } = floatingPanel(mounted.harness)
  assert.equal(buttonByText(mounted.harness, 'action.cancel').props.autoFocus, true)
  assert.match(elementText(footer), /confirm\.discard/)
  const [split] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-split'))
  assert.equal(collectElements(split, (element) => element === dialog).length, 0)
  assert.deepEqual(geometry(), beforeGeometry, 'opening a card keeps both pane allocations')
  let prevented = false
  let stopped = false
  mounted.harness.keydown(dialog, {
    key: 'Escape',
    preventDefault: () => {
      prevented = true
    },
    stopPropagation: () => {
      stopped = true
    },
  })
  await mounted.harness.flush()
  assert.ok(prevented && stopped, 'Escape is handled here, not by the surrounding tab')
  await finishMotion(mounted.harness)
  assert.equal(mounted.harness.findAll((element) => element.props.role === 'alertdialog').length, 0)
  assert.deepEqual(mounted.calls, beforeCalls, 'opening and cancelling do not call Git')
  assert.deepEqual(geometry(), beforeGeometry)
})

test('the operation prompt rises into place and lowers away before it is removed', async (t) => {
  const status = createStatus({
    files: [
      { kind: 'ordinary', x: '.', y: 'M', path: 'src/app.js', conflict: false, untracked: false },
    ],
  })
  const mounted = await mountGit({ status })
  t.after(() => mounted.harness.dispose())
  const wrappers = (): TestElement[] =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-promptMotion'))
  assert.equal(wrappers().length, 0, 'no prompt motion is rendered while the pane is idle')
  await openDiscard(mounted)
  floatingPanel(mounted.harness)
  assert.equal(wrappers().length, 1, 'the prompt is wrapped in the surface that moves')
  assert.equal(
    wrappers()[0]?.props['data-phase'],
    'enter',
    'an opening prompt rises from the bottom',
  )
  mounted.harness.click(buttonByText(mounted.harness, 'action.cancel'))
  await mounted.harness.flush()
  assert.equal(wrappers().length, 1, 'a dismissed prompt stays mounted while it leaves')
  const [leaving] = wrappers()
  assert.ok(leaving)
  assert.equal(leaving.props['data-phase'], 'leave', 'a dismissed prompt lowers away')
  assert.match(
    mounted.harness.text(),
    /confirm\.discardTitle/,
    'the card keeps its content while it leaves',
  )
  assert.equal(
    collectElements(leaving, (element) => element.props.role === 'alertdialog').length,
    1,
  )
  await finishMotion(mounted.harness)
  assert.equal(wrappers().length, 0, 'the prompt is removed once its exit animation ends')
  assert.equal(mounted.harness.findAll((element) => element.props.role === 'alertdialog').length, 0)
})

test('floating stage-all confirmation has no empty or dangling description', async (t) => {
  const status = createStatus({
    files: [
      { kind: 'ordinary', x: '.', y: 'M', path: 'src/app.js', conflict: false, untracked: false },
    ],
  })
  const mounted = await mountGit({ status })
  t.after(() => mounted.harness.dispose())
  const [message] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMessage'))
  mounted.harness.change(message, 'commit everything')
  await mounted.harness.flush()
  const beforeCalls = [...mounted.calls]
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  const { body, footer } = floatingPanel(mounted.harness, false)
  assert.match(elementText(body), /commit\.emptyConfirm/)
  assert.match(elementText(footer), /commit\.stageAll/)
  assert.equal(buttonByText(mounted.harness, 'action.cancel').props.autoFocus, true)
  mounted.harness.click(buttonByText(mounted.harness, 'action.cancel'))
  await mounted.harness.flush()
  assert.deepEqual(mounted.calls, beforeCalls)
})

test('floating prompts replace each other in both directions and never resurface on cancel', async (t) => {
  const mounted = await mountGit({
    status: createStatus({
      files: [
        { kind: 'ordinary', x: '.', y: 'M', path: 'src/app.js', conflict: false, untracked: false },
      ],
    }),
  })
  t.after(() => mounted.harness.dispose())
  const beforeCalls = [...mounted.calls]
  let focusRestores = 0
  const invoker: TestEventTarget = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 80, height: 22, bottom: 22 }),
    isConnected: true,
    focus: () => {
      focusRestores += 1
    },
  }
  const createTag = async () => {
    await runMenuAction(mounted.components, graphMenuTarget(mounted, invoker), 'create-tag')
    await mounted.harness.flush()
  }
  const commitAll = async () => {
    const [message] = mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMessage'))
    mounted.harness.change(message, 'not submitted')
    await mounted.harness.flush()
    mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
    await mounted.harness.flush()
  }
  const cancel = async () => {
    mounted.harness.click(buttonByText(mounted.harness, 'action.cancel'))
    await finishMotion(mounted.harness)
    assert.equal(
      mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
      0,
    )
  }
  await openDiscard(mounted)
  await createTag()
  assert.equal(floatingPanel(mounted.harness).dialog.props['aria-label'], 'menu.createTag')
  await cancel()
  await createTag()
  const focusBeforeReplacement = focusRestores
  await openDiscard(mounted)
  assert.equal(
    focusRestores,
    focusBeforeReplacement,
    'replacement must not focus the old graph row over the new Cancel',
  )
  assert.equal(floatingPanel(mounted.harness).dialog.props['aria-label'], 'confirm.discardTitle')
  await cancel()
  await createTag()
  await commitAll()
  assert.equal(
    floatingPanel(mounted.harness, false).dialog.props['aria-label'],
    'commit.emptyConfirm',
  )
  await cancel()
  await commitAll()
  await createTag()
  assert.equal(floatingPanel(mounted.harness).dialog.props['aria-label'], 'menu.createTag')
  await cancel()
  assert.deepEqual(mounted.calls, beforeCalls, 'replaced operations are never submitted')
})

test('floating content retains long filenames, branch names, annotations and translated actions', async (t) => {
  const filename = `${'very-long-unbroken-filename'.repeat(15)}.ts`
  const branch = `feature/${'long-unbroken-branch'.repeat(10)}`
  const cancelLabel = '取消这个尚未提交的操作'.repeat(8)
  const discardLabel = '确认放弃这个文件的全部更改'.repeat(8)
  const head = HISTORY.commits[0]
  assert.ok(head)
  const mounted = await mountGit({
    status: createStatus({
      files: [
        { kind: 'ordinary', x: '.', y: 'M', path: filename, conflict: false, untracked: false },
      ],
    }),
    history: {
      ...HISTORY,
      commits: [{ ...head, refs: `HEAD -> refs/heads/main, refs/heads/${branch}` }],
    },
    t: (key, params) => {
      if (key === 'confirm.discardTitle' || key === 'menu.deleteBranchConfirm')
        return `${key}: ${params?.name}`
      if (key === 'action.cancel') return cancelLabel
      if (key === 'confirm.discard') return discardLabel
      return translate(key, params)
    },
  })
  t.after(() => mounted.harness.dispose())
  await openDiscard(mounted, filename)
  let panel = floatingPanel(mounted.harness)
  assert.ok(elementText(panel.body).includes(filename), 'long copy is preserved in the scroll body')
  assert.ok(elementText(panel.footer).includes(cancelLabel))
  assert.ok(elementText(panel.footer).includes(discardLabel))
  mounted.harness.click(buttonContaining(mounted.harness, cancelLabel))
  await mounted.harness.flush()
  await runMenuAction(mounted.components, graphMenuTarget(mounted), 'delete-branch', branch)
  await mounted.harness.flush()
  panel = floatingPanel(mounted.harness)
  assert.ok(elementText(panel.body).includes(branch), 'deletion copy keeps the full branch name')
  mounted.harness.click(buttonContaining(mounted.harness, cancelLabel))
  await mounted.harness.flush()
  await runMenuAction(mounted.components, graphMenuTarget(mounted), 'create-tag')
  await mounted.harness.flush()
  const annotation = 'Long annotation\n'.repeat(120)
  const [message] = mounted.harness.findAll(
    (element) => element.props['aria-label'] === 'menu.tagMessage',
  )
  mounted.harness.change(message, annotation)
  await mounted.harness.flush()
  panel = floatingPanel(mounted.harness)
  const [field] = collectElements(
    panel.body,
    (element) => element.props['aria-label'] === 'menu.tagMessage',
  )
  assert.equal(field?.props.value, annotation)
  assert.equal(collectElements(panel.footer, (element) => element.type === 'textarea').length, 0)
})

for (const operation of ['create-branch', 'create-tag', 'delete-branch']) {
  test(`floating pending ${operation} rejects cancellation and duplicate submission`, async (t) => {
    let release = () => {}
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const head = HISTORY.commits[0]
    assert.ok(head)
    const mounted = await mountGit({
      pending: { op: operation, until: pending },
      history: {
        ...HISTORY,
        commits: [{ ...head, refs: 'HEAD -> refs/heads/main, refs/heads/feature/graph' }],
      },
    })
    t.after(async () => {
      release()
      await mounted.harness.flush()
      await mounted.harness.dispose()
    })
    const target = graphMenuTarget(mounted)
    if (operation === 'delete-branch') {
      await runMenuAction(mounted.components, target, operation, 'feature/graph')
    } else {
      await runMenuAction(mounted.components, target, operation)
    }
    await mounted.harness.flush()
    const [name] = mounted.harness.findAll(
      (element) => element.props['aria-label'] === 'menu.referenceName',
    )
    if (operation !== 'delete-branch') {
      assert.equal(name?.props.autoFocus, true, 'reference creation keeps focus on its name')
      mounted.harness.change(name, 'new-reference')
      await mounted.harness.flush()
    } else {
      assert.equal(buttonByText(mounted.harness, 'action.cancel').props.autoFocus, true)
    }
    const label =
      operation === 'create-branch'
        ? 'menu.createBranch'
        : operation === 'create-tag'
          ? 'menu.createTag'
          : 'menu.deleteBranch'
    const submit = buttonContaining(mounted.harness, label)
    mounted.harness.click(submit)
    mounted.harness.click(submit)
    await mounted.harness.flush()
    const { dialog, body } = floatingPanel(mounted.harness)
    assert.equal(dialog.props['aria-busy'], true)
    assert.ok(collectElements(body, (element) => element.props.role === 'status').length > 0)
    const cancel = buttonByText(mounted.harness, 'action.cancel')
    const busySubmit = buttonContaining(mounted.harness, label)
    assert.equal(cancel.props['aria-disabled'], 'true')
    assert.equal(busySubmit.props['aria-disabled'], 'true')
    assert.notEqual(cancel.props.disabled, true, 'busy state does not steal keyboard focus')
    let stopped = false
    mounted.harness.keydown(dialog, {
      key: 'Escape',
      stopPropagation: () => {
        stopped = true
      },
    })
    mounted.harness.click(cancel)
    mounted.harness.click(busySubmit)
    if (name !== undefined) {
      const [busyName] = mounted.harness.findAll(
        (element) => element.props['aria-label'] === 'menu.referenceName',
      )
      mounted.harness.keydown(busyName, { key: 'Enter' })
    }
    await mounted.harness.flush()
    assert.ok(stopped, 'busy Escape is consumed instead of dismissing the containing tab')
    assert.equal(mounted.calls.filter((call) => call.op === operation).length, 1)
    floatingPanel(mounted.harness)
    release()
    await finishMotion(mounted.harness)
    assert.equal(
      mounted.harness.findAll((element) => element.props.role === 'alertdialog').length,
      0,
    )
  })
}

test('floating reference inputs keep IME Enter and ordinary annotation Enter out of submit', async (t) => {
  const mounted = await mountGit()
  t.after(() => mounted.harness.dispose())
  await runMenuAction(mounted.components, graphMenuTarget(mounted), 'create-tag')
  await mounted.harness.flush()
  const [name] = mounted.harness.findAll(
    (element) => element.props['aria-label'] === 'menu.referenceName',
  )
  mounted.harness.change(name, 'composition-tag')
  await mounted.harness.flush()
  const [currentName] = mounted.harness.findAll(
    (element) => element.props['aria-label'] === 'menu.referenceName',
  )
  const [message] = mounted.harness.findAll(
    (element) => element.props['aria-label'] === 'menu.tagMessage',
  )
  mounted.harness.keydown(currentName, { key: 'Enter', nativeEvent: { isComposing: true } })
  mounted.harness.keydown(message, { key: 'Enter' })
  mounted.harness.keydown(message, {
    key: 'Enter',
    ctrlKey: true,
    nativeEvent: { isComposing: true },
  })
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'create-tag').length, 0)
  floatingPanel(mounted.harness)
})

test('a floating branch failure keeps the retained form and reports the failure', async (t) => {
  const mounted = await mountGit({ failOp: 'create-branch' })
  t.after(() => mounted.harness.dispose())
  await runMenuAction(mounted.components, graphMenuTarget(mounted), 'create-branch')
  await mounted.harness.flush()
  const [name] = mounted.harness.findAll(
    (element) => element.props['aria-label'] === 'menu.referenceName',
  )
  mounted.harness.change(name, 'existing-branch')
  await mounted.harness.flush()
  mounted.harness.click(buttonContaining(mounted.harness, 'menu.createBranch'))
  await mounted.harness.flush()
  const { body, dialog } = floatingPanel(mounted.harness)
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
  assert.equal(
    collectElements(body, (element) => element.props['aria-label'] === 'menu.referenceName')[0]
      ?.props.value,
    'existing-branch',
  )
  assert.notEqual(dialog.props['aria-busy'], true)
  mounted.harness.click(buttonByText(mounted.harness, 'action.cancel'))
  await finishMotion(mounted.harness)
  assert.equal(mounted.harness.findAll((element) => element.props.role === 'alertdialog').length, 0)
  assert.equal(mounted.calls.filter((call) => call.op === 'create-branch').length, 1)
})
