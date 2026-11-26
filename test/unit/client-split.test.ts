/**
 * Direct unit tests for the browser half's pure split-pane rules and their
 * stylesheet contract.
 *
 * These import `src/client/panel/split.ts` directly — no React and no DOM.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { SPLIT_MOTION_MS } from '../../src/client/constants.ts'
import {
  adjustSplitRatio,
  allSectionsCollapsed,
  clampSplitRatio,
  collapsedSectionHeight,
  DEFAULT_SPLIT_RATIO,
  dragSplitRatio,
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  SECTION_GAP,
  SECTION_HEADER_HEIGHT,
  SPLIT_STEP,
  splitSizing,
  workspaceHeadersHeight,
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

  test('a stack of collapsed headers has the header height plus the gaps', () => {
    assert.equal(SECTION_HEADER_HEIGHT, 30)
    assert.equal(SECTION_GAP, 2)
    assert.equal(collapsedSectionHeight(0), 0)
    assert.equal(collapsedSectionHeight(1), 30)
    assert.equal(collapsedSectionHeight(2), 62)
    assert.equal(collapsedSectionHeight(3), 94)
    assert.equal(collapsedSectionHeight(2.8), 62, 'a fractional count still sizes whole headers')
    assert.equal(collapsedSectionHeight(-1), 0)
    assert.equal(collapsedSectionHeight(Number.NaN), 0)
  })

  test('an expanded split sizes each pane from the ratio', () => {
    const sizing = splitSizing({
      ratio: 0.5,
      workspaceCollapsed: false,
      groupsCollapsed: false,
      groupSections: 3,
      graphCollapsed: false,
    })
    assert.deepEqual(sizing.workspace, { flex: '0 0 50%' })
    assert.deepEqual(sizing.graph, { flex: '1 1 0px' })
    assert.equal(sizing.dividerEnabled, true)
    assert.equal(sizing.workspaceFolded, false)
    assert.deepEqual(
      splitSizing({
        ratio: 0.555,
        workspaceCollapsed: false,
        groupsCollapsed: false,
        groupSections: 3,
        graphCollapsed: false,
      }).workspace,
      { flex: '0 0 55.5%' },
    )
    assert.deepEqual(
      splitSizing({
        ratio: 2,
        workspaceCollapsed: false,
        groupsCollapsed: false,
        groupSections: 3,
        graphCollapsed: false,
      }).workspace,
      { flex: '0 0 80%' },
      'the ratio still clamps',
    )
  })

  test('a collapsed graph keeps its header at the bottom and its basis for the fold', () => {
    const sizing = splitSizing({
      ratio: 0.5,
      workspaceCollapsed: false,
      groupsCollapsed: false,
      groupSections: 3,
      graphCollapsed: true,
    })
    // The workspace pane grows into the free space while keeping the ratio as
    // its basis, so expanding can animate back to the same split.
    assert.deepEqual(sizing.workspace, { flex: '1 1 50%' })
    assert.deepEqual(sizing.graph, { flex: '0 0 30px' })
    assert.equal(sizing.dividerEnabled, false, 'the divider is rendered but inert')
    assert.equal(sizing.workspaceFolded, false)
  })

  test('a collapsed workspace keeps only its own header', () => {
    const sizing = splitSizing({
      ratio: 0.5,
      workspaceCollapsed: true,
      groupsCollapsed: false,
      groupSections: 3,
      graphCollapsed: false,
    })
    assert.deepEqual(sizing.workspace, { flex: '0 0 30px' })
    assert.deepEqual(sizing.graph, { flex: '1 1 0px' })
    assert.equal(sizing.dividerEnabled, false)
    assert.equal(sizing.workspaceFolded, true)
  })

  test('collapsed groups keep the workspace header and their own headers', () => {
    const sizing = splitSizing({
      ratio: 0.5,
      workspaceCollapsed: false,
      groupsCollapsed: true,
      groupSections: 3,
      graphCollapsed: false,
    })
    assert.equal(workspaceHeadersHeight(3), 124, '30px workspace header plus a 94px stack')
    assert.deepEqual(sizing.workspace, { flex: '0 0 124px' })
    assert.deepEqual(sizing.graph, { flex: '1 1 0px' })
    assert.equal(sizing.dividerEnabled, false)
    assert.equal(sizing.workspaceFolded, true)
  })

  test('one expanded group keeps the workspace share of the split', () => {
    const sizing = splitSizing({
      ratio: 0.65,
      workspaceCollapsed: false,
      groupsCollapsed: false,
      groupSections: 3,
      graphCollapsed: false,
    })
    assert.deepEqual(sizing.workspace, { flex: '0 0 65%' })
    assert.equal(sizing.dividerEnabled, true)
    assert.equal(sizing.workspaceFolded, false)
  })

  test('both folded panes let the workspace pane hold the empty space', () => {
    const sizing = splitSizing({
      ratio: 0.5,
      workspaceCollapsed: true,
      groupsCollapsed: true,
      groupSections: 3,
      graphCollapsed: true,
    })
    assert.deepEqual(sizing.workspace, { flex: '1 1 50%' })
    assert.deepEqual(sizing.graph, { flex: '0 0 30px' })
    assert.equal(sizing.dividerEnabled, false)
    assert.equal(sizing.workspaceFolded, true)
  })

  test('expanding again restores the ratio that was in effect', () => {
    const collapsed = splitSizing({
      ratio: 0.65,
      workspaceCollapsed: false,
      groupsCollapsed: false,
      groupSections: 3,
      graphCollapsed: true,
    })
    assert.deepEqual(collapsed.workspace, { flex: '1 1 65%' })
    assert.deepEqual(
      splitSizing({
        ratio: 0.65,
        workspaceCollapsed: false,
        groupsCollapsed: false,
        groupSections: 3,
        graphCollapsed: false,
      }).workspace,
      { flex: '0 0 65%' },
    )
  })

  test('a clean workspace keeps its pane share and an operable divider', () => {
    const sizing = splitSizing({
      ratio: 0.5,
      workspaceCollapsed: false,
      groupsCollapsed: true,
      groupSections: 0,
      graphCollapsed: false,
    })
    assert.deepEqual(sizing.workspace, { flex: '0 0 50%' })
    assert.equal(sizing.dividerEnabled, true)
    assert.equal(sizing.workspaceFolded, false, 'no group header exists to keep the pane at')
  })

  test('the workspace header stack adds the parent header to the group stack', () => {
    assert.equal(workspaceHeadersHeight(0), 30)
    assert.equal(workspaceHeadersHeight(1), 60)
    assert.equal(workspaceHeadersHeight(2), 92)
    assert.equal(workspaceHeadersHeight(3), 124)
    assert.equal(workspaceHeadersHeight(2.8), 92, 'a fractional count still sizes whole headers')
    assert.equal(workspaceHeadersHeight(-1), 30)
    assert.equal(workspaceHeadersHeight(Number.NaN), 30)
  })
})

describe('split stylesheet contract', () => {
  const styles = new URL('../../src/client/styles/', import.meta.url)
  const read = (name: string): string => readFileSync(new URL(name, styles), 'utf8')

  test('the collapsed-header height and gap match the pure geometry', () => {
    assert.match(
      read('section.css'),
      /\.dshgg-sectionHeader\s*\{[^}]*\bheight:\s*30px/,
      'SECTION_HEADER_HEIGHT must match the section header',
    )
    assert.match(
      read('scroll.css'),
      /\.dshgg-scroll\s*\{[^}]*\bgap:\s*2px/,
      'SECTION_GAP must match the pane gap',
    )
    assert.match(
      read('section.css'),
      /\.dshgg-workspaceGroups\s*\{[^}]*\bgap:\s*2px/,
      'SECTION_GAP must match the nested group rhythm',
    )
    assert.match(
      read('section.css'),
      /\.dshgg-section\[data-depth="1"\]\s*>\s*\.dshgg-sectionHeader\s*\{[^}]*\btop:\s*30px/,
      'a nested header pins below the Workspace header',
    )
    assert.equal(SPLIT_MOTION_MS, 200)
  })

  test('panes transition their fold, except while dragging', () => {
    const split = read('split.css')
    assert.match(split, new RegExp(`transition:[^;]*flex-basis ${SPLIT_MOTION_MS}ms`))
    assert.match(split, new RegExp(`transition:[^;]*flex-grow ${SPLIT_MOTION_MS}ms`))
    assert.match(
      split,
      /\.dshgg-split\[data-resizing="true"\] \.dshgg-pane\s*\{\s*transition:\s*none/,
      'a pointer drag must not lag behind the divider',
    )
    assert.match(
      read('motion.css'),
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.dshgg-pane\s*\{\s*transition:\s*none/,
      'reduced motion takes the new pane height at once',
    )
  })

  test('a collapsed divider keeps its line but drops its hover and drag affordances', () => {
    const split = read('split.css')
    assert.match(
      split,
      /@media \(hover: hover\)[\s\S]*\.dshgg-splitter:not\(\[data-disabled="true"\]\):hover/,
      'the hover highlight excludes the inert divider',
    )
    assert.match(split, /\.dshgg-splitter\[data-disabled="true"\]\s*\{\s*cursor:\s*default/)
    assert.match(
      split,
      /\.dshgg-splitterLine\s*\{[^}]*background:/,
      'the disabled divider still paints its hairline',
    )
    assert.match(split, /\.dshgg-pane\[data-collapsed="true"\]\s*\{[^}]*overflow-y:\s*hidden/)
  })
})
