/**
 * Native Toast delivery for operations and failures.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { TestProps } from '../support/types.ts'
import {
  buttonByLabel,
  buttonByText,
  disposeUiLifetimes,
  loadUiPanel,
  mountGit,
  nativeToastHost,
  opCount,
  openCommitDetails,
  recordingToast,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

test('a failed operation reaches the native Toast store instead of the panel layout', async () => {
  const seen: TestProps[] = []
  const mounted = await mountGit({
    failOp: 'commit',
    hostModules: { '@deepseek-ai/dsh-client-ui-primitives': { Toast: recordingToast(seen) } },
  })
  const host = nativeToastHost(mounted.components)
  assert.ok(host, 'the native Toast host is registered in the frame overlay')
  assert.equal(host.store.getSnapshot(), null, 'nothing is delivered before a failure')
  const messageBox = () => mounted.harness.findAll((element) => element.type === 'textarea')[0]
  mounted.harness.change(messageBox(), 'fix: will fail')
  await mounted.harness.flush()
  mounted.harness.click(buttonByText(mounted.harness, 'commit.action'))
  await mounted.harness.flush()
  const notice = host.store.getSnapshot()
  assert.equal(notice?.success, false)
  assert.equal(notice?.text, 'git said no')
  assert.doesNotMatch(
    mounted.harness.text(),
    /git said no/,
    'the failure text lives in the notice, not in the panel layout',
  )
  assert.equal(
    mounted.components.notifications.length,
    0,
    'the shared service is not used when the native host is available',
  )
  await mounted.harness.dispose()
})

test('the native Toast host distinguishes success and failure with type icons', async () => {
  const seen: TestProps[] = []
  const mounted = await mountGit({
    hostModules: { '@deepseek-ai/dsh-client-ui-primitives': { Toast: recordingToast(seen) } },
  })
  const host = nativeToastHost(mounted.components)
  assert.ok(host)
  assert.equal(seen.length, 0, 'no notice renders no Toast')
  host.store.push({ text: 'commit.done', success: true })
  await mounted.harness.render()
  const success = seen.at(-1)
  assert.equal(success?.tone, 'success')
  assert.equal(success?.icon, undefined, 'the success Toast uses its native check icon')
  const ran: string[] = []
  host.store.push({
    text: 'git said no',
    success: false,
    action: { label: 'retry', run: () => ran.push('retry') },
  })
  await mounted.harness.render()
  const failure = seen.at(-1)
  assert.ok(failure)
  assert.equal(failure.tone, undefined)
  assert.ok(failure.icon, 'a failure carries the warning icon')
  assert.equal(failure.holdMs, 6000)
  const actions = failure.actions as Array<{ label: string; onClick: () => void }>
  assert.equal(actions[0]?.label, 'retry')
  actions[0]?.onClick()
  await mounted.harness.render()
  assert.deepEqual(ran, ['retry'])
  assert.equal(host.store.getSnapshot(), null, 'the action dismisses the notice first')
  await mounted.harness.dispose()
})

test('a retry that fails again reports a fresh native notice', async () => {
  const seen: TestProps[] = []
  const mounted = await mountGit({
    failStatusPages: [1, 2],
    hostModules: { '@deepseek-ai/dsh-client-ui-primitives': { Toast: recordingToast(seen) } },
  })
  const host = nativeToastHost(mounted.components)
  assert.ok(host)
  mounted.harness.click(buttonByLabel(mounted.harness, 'refresh'))
  await mounted.harness.flush()
  const first = host.store.getSnapshot()
  assert.equal(first?.text, 'git said no')
  assert.equal(first?.action?.label, 'retry')
  const afterFirst = opCount(mounted, 'status')
  assert.equal(afterFirst, 2, `expected two status reads, saw ${afterFirst}`)
  const actions = seen.at(-1)?.actions as Array<{ label: string; onClick: () => void }> | undefined
  assert.equal(actions?.[0]?.label, 'retry')
  actions?.[0]?.onClick()
  await mounted.harness.flush()
  const afterRetry = opCount(mounted, 'status')
  assert.equal(afterRetry, 3, `the retry ran, saw ${afterRetry} status reads`)
  const second = host.store.getSnapshot()
  assert.ok(second, 'the retry failure is reported again')
  assert.notEqual(second?.seq, first?.seq)
  assert.equal(second?.text, 'git said no')
  await mounted.harness.dispose()
})

test('a retryable read failure offers a retry action in the native notice', async () => {
  const seen: TestProps[] = []
  const mounted = await mountGit({
    failOp: 'commit-details',
    hostModules: { '@deepseek-ai/dsh-client-ui-primitives': { Toast: recordingToast(seen) } },
  })
  const host = nativeToastHost(mounted.components)
  assert.ok(host)
  await openCommitDetails(mounted)
  const notice = host.store.getSnapshot()
  assert.equal(notice?.success, false)
  assert.equal(notice?.text, 'git said no')
  assert.equal(notice?.action?.label, 'retry')
  const before = mounted.calls.filter((call) => call.op === 'commit-details').length
  notice?.action?.run()
  await mounted.harness.flush()
  assert.ok(
    mounted.calls.filter((call) => call.op === 'commit-details').length > before,
    'the retry action reads the commit again',
  )
  await mounted.harness.dispose()
})
