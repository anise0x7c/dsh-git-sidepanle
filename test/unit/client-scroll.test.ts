/**
 * Direct unit tests for the browser half's pure near-end scroll rule.
 *
 * These import `src/client/panel/scroll.ts` directly — no React and no DOM.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { isNearEnd, NEAR_END_PX } from '../../src/client/panel/scroll.ts'

describe('isNearEnd', () => {
  test('reports the end and everything inside the preload margin', () => {
    assert.equal(NEAR_END_PX, 24)
    assert.equal(isNearEnd({ scrollTop: 1000, clientHeight: 500, scrollHeight: 1500 }), true)
    assert.equal(isNearEnd({ scrollTop: 990, clientHeight: 500, scrollHeight: 1500 }), true)
    assert.equal(isNearEnd({ scrollTop: 976, clientHeight: 500, scrollHeight: 1500 }), true)
  })

  test('reports positions farther from the end', () => {
    assert.equal(isNearEnd({ scrollTop: 975, clientHeight: 500, scrollHeight: 1500 }), false)
    assert.equal(isNearEnd({ scrollTop: 0, clientHeight: 500, scrollHeight: 1500 }), false)
  })

  test('tolerates a pane shorter than its content and fractional offsets', () => {
    assert.equal(isNearEnd({ scrollTop: 999.5, clientHeight: 500, scrollHeight: 1500 }), true)
    assert.equal(isNearEnd({ scrollTop: 0, clientHeight: 500, scrollHeight: 400 }), true)
  })
})
