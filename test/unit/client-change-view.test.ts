/**
 * Direct unit tests for the browser half's pure change-view state.
 *
 * These import `src/client/panel/change-view.ts` directly — no React, no
 * plugin context, no built `client.js`. The state is per change group, so the
 * expectations describe how one group's folder toggles without touching the
 * other groups' trees.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { CollapsedFolders } from '../../src/client/panel/change-view.ts'
import { NO_COLLAPSED_FOLDERS, toggleCollapsedFolder } from '../../src/client/panel/change-view.ts'

/** Sorted folder paths one group's tree hides. */
function collapsedIn(state: CollapsedFolders, mode: 'merge' | 'staged' | 'changes'): string[] {
  return [...state[mode]].sort()
}

describe('toggleCollapsedFolder', () => {
  test('the initial state hides no folder in any group', () => {
    assert.deepEqual(collapsedIn(NO_COLLAPSED_FOLDERS, 'merge'), [])
    assert.deepEqual(collapsedIn(NO_COLLAPSED_FOLDERS, 'staged'), [])
    assert.deepEqual(collapsedIn(NO_COLLAPSED_FOLDERS, 'changes'), [])
  })

  test('collapsing a folder hides only that group', () => {
    const next = toggleCollapsedFolder(NO_COLLAPSED_FOLDERS, 'staged', 'src')
    assert.deepEqual(collapsedIn(next, 'staged'), ['src'])
    assert.deepEqual(collapsedIn(next, 'changes'), [])
    assert.deepEqual(collapsedIn(next, 'merge'), [])
    assert.deepEqual(
      collapsedIn(NO_COLLAPSED_FOLDERS, 'staged'),
      [],
      'the previous state is not mutated',
    )
  })

  test('the same folder collapses independently in another group', () => {
    const staged = toggleCollapsedFolder(NO_COLLAPSED_FOLDERS, 'staged', 'src')
    const both = toggleCollapsedFolder(staged, 'changes', 'src')
    assert.deepEqual(collapsedIn(both, 'staged'), ['src'])
    assert.deepEqual(collapsedIn(both, 'changes'), ['src'])
    const expanded = toggleCollapsedFolder(both, 'staged', 'src')
    assert.deepEqual(collapsedIn(expanded, 'staged'), [])
    assert.deepEqual(collapsedIn(expanded, 'changes'), ['src'], 'the other group stays collapsed')
  })

  test('toggling a folder twice expands it again', () => {
    const collapsed = toggleCollapsedFolder(NO_COLLAPSED_FOLDERS, 'changes', 'src/lib')
    const expanded = toggleCollapsedFolder(collapsed, 'changes', 'src/lib')
    assert.deepEqual(collapsedIn(expanded, 'changes'), [])
  })

  test('several folders of one group stay collapsed together', () => {
    const first = toggleCollapsedFolder(NO_COLLAPSED_FOLDERS, 'changes', 'src')
    const second = toggleCollapsedFolder(first, 'changes', 'docs')
    assert.deepEqual(collapsedIn(second, 'changes'), ['docs', 'src'])
    const reopened = toggleCollapsedFolder(second, 'changes', 'src')
    assert.deepEqual(collapsedIn(reopened, 'changes'), ['docs'])
  })
})
