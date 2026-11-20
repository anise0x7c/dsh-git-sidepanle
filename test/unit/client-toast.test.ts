/**
 * Direct unit tests for the browser half's single-notice toast store.
 *
 * The store is the only mutable piece behind the native Toast host: a later
 * notice replaces the current one, clearing re-arms a future notice, and a
 * disposed subscriber stops receiving changes.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createToastStore } from '../../src/client/toast/notify.ts'

describe('toast store', () => {
  test('starts empty and publishes each replacement', () => {
    const store = createToastStore()
    const seen: Array<string | null> = []
    store.subscribe(() => seen.push(store.getSnapshot()?.text ?? null))
    assert.equal(store.getSnapshot(), null)
    store.push({ text: 'commit.done', success: true })
    assert.deepEqual(store.getSnapshot(), {
      seq: 1,
      text: 'commit.done',
      success: true,
    })
    store.push({
      text: 'git said no',
      success: false,
      action: { label: 'retry', run: () => {} },
    })
    assert.deepEqual(seen, ['commit.done', 'git said no'])
    const current = store.getSnapshot()
    assert.equal(current?.success, false)
    assert.equal(current?.action?.label, 'retry')
    assert.equal(store.getSnapshot()?.seq, 2)
  })

  test('dismissing an empty store publishes nothing and a later notice reappears', () => {
    const store = createToastStore()
    let changes = 0
    store.subscribe(() => {
      changes += 1
    })
    store.dismiss()
    assert.equal(changes, 0)
    store.push({ text: 'first', success: true })
    store.dismiss()
    assert.equal(changes, 2)
    assert.equal(store.getSnapshot(), null)
    store.push({ text: 'first', success: true })
    assert.equal(store.getSnapshot()?.seq, 2)
  })

  test('unsubscribing stops changes without clearing the notice', () => {
    const store = createToastStore()
    let changes = 0
    const unsubscribe = store.subscribe(() => {
      changes += 1
    })
    store.push({ text: 'one', success: true })
    unsubscribe()
    store.push({ text: 'two', success: true })
    assert.equal(changes, 1)
    assert.equal(store.getSnapshot()?.text, 'two')
  })
})
