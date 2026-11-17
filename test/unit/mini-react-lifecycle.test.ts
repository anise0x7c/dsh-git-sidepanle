/**
 * Lifecycle contract of the mini React test harness: disposal is a safety net,
 * so a throwing effect cleanup must not skip the remaining cleanups, must not
 * leave the overridden timer/fetch globals installed, and must surface the
 * failures instead of silently passing a test.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHarness } from '../support/mini-react.ts'
import type { FetchResponseLike, TestComponent } from '../support/types.ts'

/** Timer and fetch globals the harness replaces for one mount. */
interface HarnessGlobals {
  setInterval: unknown
  clearInterval: unknown
  setTimeout: unknown
  clearTimeout: unknown
  fetch: unknown
}

test('dispose runs every effect cleanup before reporting and restoring', async () => {
  const globals = globalThis as unknown as HarnessGlobals
  const before: HarnessGlobals = {
    setInterval: globals.setInterval,
    clearInterval: globals.clearInterval,
    setTimeout: globals.setTimeout,
    clearTimeout: globals.clearTimeout,
    fetch: globals.fetch,
  }
  const harness = createHarness({
    fetch: async (): Promise<FetchResponseLike> => {
      throw new Error('the lifecycle test never calls fetch')
    },
    component: null,
    props: {},
  })
  let laterCleanups = 0
  const component: TestComponent = () => {
    harness.React.useEffect(
      () => () => {
        throw new Error('cleanup boom')
      },
      [],
    )
    harness.React.useEffect(
      () => () => {
        laterCleanups += 1
      },
      [],
    )
    return null
  }
  harness.setComponent(component, {})
  try {
    await harness.render()
    assert.notEqual(globals.setInterval, before.setInterval, 'the mount owns the timer globals')

    await assert.rejects(harness.dispose(), (error: unknown) => {
      assert.ok(error instanceof AggregateError, 'cleanup failures are aggregated')
      assert.equal(error.errors.length, 1)
      assert.match(String(error.errors[0]), /cleanup boom/)
      return true
    })
    assert.equal(laterCleanups, 1, 'a failing cleanup does not skip the later one')
    assert.deepEqual(
      {
        setInterval: globals.setInterval,
        clearInterval: globals.clearInterval,
        setTimeout: globals.setTimeout,
        clearTimeout: globals.clearTimeout,
        fetch: globals.fetch,
      },
      before,
      'every overridden global is restored even when cleanup throws',
    )

    await harness.dispose()
    assert.equal(laterCleanups, 1, 'a repeated dispose has no cleanup side effect')
  } finally {
    // Disposal is already done on the success path; this only covers an
    // assertion failing before it, and never masks that failure.
    await harness.dispose().catch(() => {})
  }
})
