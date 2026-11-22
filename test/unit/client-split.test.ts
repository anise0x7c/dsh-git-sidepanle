/**
 * Direct unit tests for the browser half's pure split-pane rules.
 *
 * These import `src/client/panel/split.ts` directly — no React and no DOM.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  adjustSplitRatio,
  allSectionsCollapsed,
  clampSplitRatio,
  DEFAULT_SPLIT_RATIO,
  dragSplitRatio,
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  SPLIT_STEP,
  splitSizing,
} from '../../src/client/panel/split.ts'

/**
 * Assert two floating-point ratios within a small tolerance.
 * @param actual - computed ratio.
 * @param expected - expected ratio.
 */
function near(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${actual} to be close to ${expected}`)
}

describe('split ratios', () => {
  test('starts from an even split with a usable range and step', () => {
    assert.equal(DEFAULT_SPLIT_RATIO, 0.5)
    assert.equal(MIN_SPLIT_RATIO, 0.2)
    assert.equal(MAX_SPLIT_RATIO, 0.8)
    assert.equal(SPLIT_STEP, 0.05)
    assert.equal(clampSplitRatio(DEFAULT_SPLIT_RATIO), DEFAULT_SPLIT_RATIO)
  })

  test('clamps to the usable range', () => {
    assert.equal(clampSplitRatio(-1), MIN_SPLIT_RATIO)
    assert.equal(clampSplitRatio(0), MIN_SPLIT_RATIO)
    assert.equal(clampSplitRatio(0.6), 0.6)
    assert.equal(clampSplitRatio(1), MAX_SPLIT_RATIO)
    assert.equal(clampSplitRatio(Number.NaN), DEFAULT_SPLIT_RATIO)
    assert.equal(clampSplitRatio(Number.POSITIVE_INFINITY), DEFAULT_SPLIT_RATIO)
  })

  test('maps a pointer drag to a ratio', () => {
    near(dragSplitRatio(0.5, 200, 240, 400), 0.6)
    near(dragSplitRatio(0.4, 300, 260, 400), 0.3)
    near(dragSplitRatio(0.5, 200, 200, 400), 0.5)
  })

  test('clamps a drag that leaves the container', () => {
    assert.equal(dragSplitRatio(0.5, 200, 0, 400), MIN_SPLIT_RATIO)
    assert.equal(dragSplitRatio(0.5, 200, 900, 400), MAX_SPLIT_RATIO)
  })

  test('keeps the starting ratio when the drag or container is invalid', () => {
    assert.equal(dragSplitRatio(0.5, Number.NaN, 240, 400), 0.5)
    assert.equal(dragSplitRatio(0.5, 200, Number.NaN, 400), 0.5)
    assert.equal(dragSplitRatio(0.5, 200, 240, 0), 0.5)
    assert.equal(dragSplitRatio(0.5, 200, 240, -20), 0.5)
    assert.equal(dragSplitRatio(0.5, 200, 240, Number.NaN), 0.5)
  })

  test('steps by 5% with arrows and 10% with page keys', () => {
    near(adjustSplitRatio(0.5, 'ArrowUp') ?? Number.NaN, 0.45)
    near(adjustSplitRatio(0.5, 'ArrowDown') ?? Number.NaN, 0.55)
    near(adjustSplitRatio(0.5, 'PageUp') ?? Number.NaN, 0.4)
    near(adjustSplitRatio(0.5, 'PageDown') ?? Number.NaN, 0.6)
  })

  test('keeps keyboard steps inside the usable range', () => {
    assert.equal(adjustSplitRatio(MIN_SPLIT_RATIO, 'ArrowUp'), MIN_SPLIT_RATIO)
    assert.equal(adjustSplitRatio(MAX_SPLIT_RATIO, 'ArrowDown'), MAX_SPLIT_RATIO)
    assert.equal(adjustSplitRatio(0.5, 'Home'), MIN_SPLIT_RATIO)
    assert.equal(adjustSplitRatio(0.5, 'End'), MAX_SPLIT_RATIO)
  })

  test('ignores keys that are not resize gestures', () => {
    for (const key of ['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'Tab']) {
      assert.equal(adjustSplitRatio(0.5, key), null, key)
    }
  })
})

describe('collapsed panes', () => {
  test('a pane is collapsed only when it renders sections and none is open', () => {
    assert.equal(allSectionsCollapsed(['merge', 'staged'], { merge: false, staged: false }), true)
    assert.equal(allSectionsCollapsed(['merge', 'staged'], { merge: false, staged: true }), false)
    assert.equal(allSectionsCollapsed(['changes'], {}), true, 'a section without a flag is closed')
    assert.equal(
      allSectionsCollapsed([], { merge: false }),
      false,
      'a pane that renders no section keeps its share of the split',
    )
  })

  test('an expanded split sizes each pane from the ratio', () => {
    const sizing = splitSizing({ ratio: 0.5, changesCollapsed: false, graphCollapsed: false })
    assert.deepEqual(sizing.changes, { flexBasis: '50%' })
    assert.deepEqual(sizing.graph, {})
    assert.equal(sizing.divider, true)
    assert.deepEqual(
      splitSizing({ ratio: 0.555, changesCollapsed: false, graphCollapsed: false }).changes,
      { flexBasis: '55.5%' },
    )
    assert.deepEqual(
      splitSizing({ ratio: 2, changesCollapsed: false, graphCollapsed: false }).changes,
      { flexBasis: '80%' },
      'the ratio still clamps',
    )
  })

  test('a collapsed graph keeps its header at the bottom and releases the divider', () => {
    const sizing = splitSizing({ ratio: 0.5, changesCollapsed: false, graphCollapsed: true })
    assert.deepEqual(sizing.changes, { flex: '1 1 0' })
    assert.deepEqual(sizing.graph, { flex: '0 0 auto' })
    assert.equal(sizing.divider, false)
  })

  test('a collapsed change pane keeps only its headers and the graph takes the room', () => {
    const sizing = splitSizing({ ratio: 0.5, changesCollapsed: true, graphCollapsed: false })
    assert.deepEqual(sizing.changes, { flex: '0 0 auto' })
    assert.deepEqual(sizing.graph, {})
    assert.equal(sizing.divider, false)
  })

  test('both panes collapsed lets the change pane hold the empty space', () => {
    const sizing = splitSizing({ ratio: 0.5, changesCollapsed: true, graphCollapsed: true })
    assert.deepEqual(sizing.changes, { flex: '1 1 0' })
    assert.deepEqual(sizing.graph, { flex: '0 0 auto' })
    assert.equal(sizing.divider, false)
  })

  test('expanding again restores the ratio that was in effect', () => {
    const collapsed = splitSizing({ ratio: 0.65, changesCollapsed: false, graphCollapsed: true })
    assert.deepEqual(collapsed.changes, { flex: '1 1 0' })
    assert.deepEqual(
      splitSizing({ ratio: 0.65, changesCollapsed: false, graphCollapsed: false }).changes,
      { flexBasis: '65%' },
    )
  })
})
