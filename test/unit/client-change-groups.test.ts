/**
 * Direct unit tests for the browser half's pure change grouping.
 *
 * These import `src/client/panel/change-groups.ts` directly — no React, no
 * plugin context, no built `client.js`. The group letters are the same values
 * the diff tabs receive, so the expectations describe both the rows and the
 * badge the tab shows.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  changeRow,
  changeRowLetter,
  groupChangeEntries,
} from '../../src/client/panel/change-groups.ts'
import type { ChangeEntry } from '../../src/client/types/domain.ts'

/**
 * Build one changed-file row with the porcelain defaults.
 * @param overrides - row fields; `path` is required.
 * @returns changed-file row.
 */
function entry(overrides: Partial<ChangeEntry> & { path: string }): ChangeEntry {
  return { kind: 'ordinary', x: '.', y: '.', conflict: false, untracked: false, ...overrides }
}

/**
 * Read the paths of grouped rows.
 * @param rows - grouped rows.
 * @returns paths in display order.
 */
function paths(rows: readonly { path: string }[]): string[] {
  return rows.map((row) => row.path)
}

describe('changeRowLetter', () => {
  test('a row listed in the merge group always shows the conflict letter', () => {
    const conflicted = entry({ path: 'merge.txt', x: 'U', y: 'U', conflict: true })
    assert.equal(changeRowLetter(conflicted, 'merge'), '!')
    assert.equal(changeRow(conflicted, 'merge').letter, '!')
  })

  test('staged rows take the index half and unstaged rows the worktree half', () => {
    assert.equal(changeRowLetter(entry({ path: 'a.js', x: 'M', y: 'M' }), 'staged'), 'M')
    assert.equal(changeRowLetter(entry({ path: 'a.js', x: 'M', y: 'D' }), 'changes'), 'D')
    assert.equal(changeRowLetter(entry({ path: 'a.js', x: 'A', y: '.' }), 'staged'), 'A')
  })

  test('an untracked working-tree row is U instead of its porcelain marker', () => {
    const untracked = entry({ path: 'new.js', kind: 'untracked', x: '?', y: '?', untracked: true })
    assert.equal(changeRowLetter(untracked, 'changes'), 'U')
  })

  test('changeRow carries the same letter as the diff badge helper', () => {
    for (const mode of ['merge', 'staged', 'changes'] as const) {
      const row = entry({ path: 'a.js', x: 'R', y: 'C', conflict: mode === 'merge' })
      assert.equal(changeRow(row, mode).letter, changeRowLetter(row, mode), mode)
    }
  })
})

describe('groupChangeEntries', () => {
  test('returns no groups for no changes', () => {
    assert.deepEqual(groupChangeEntries([]), { mergeRows: [], stagedRows: [], changedRows: [] })
  })

  test('conflicts stay only in the merge group, with the conflict letter', () => {
    const groups = groupChangeEntries([
      entry({ path: 'merge.txt', kind: 'unmerged', x: 'U', y: 'U', conflict: true }),
    ])
    assert.deepEqual(paths(groups.mergeRows), ['merge.txt'])
    assert.equal(groups.mergeRows[0]?.letter, '!')
    assert.deepEqual(groups.stagedRows, [])
    assert.deepEqual(groups.changedRows, [])
  })

  test('a row changed in the index and the worktree is listed in both groups', () => {
    const groups = groupChangeEntries([entry({ path: 'src/app.js', x: 'M', y: 'M' })])
    assert.deepEqual(paths(groups.stagedRows), ['src/app.js'])
    assert.equal(groups.stagedRows[0]?.letter, 'M')
    assert.deepEqual(paths(groups.changedRows), ['src/app.js'])
    assert.equal(groups.changedRows[0]?.letter, 'M')
    assert.deepEqual(groups.mergeRows, [])
  })

  test('index-only, worktree-only and untracked rows land in the right group', () => {
    const groups = groupChangeEntries([
      entry({ path: 'staged.js', x: 'A', y: '.' }),
      entry({ path: 'changed.js', x: '.', y: 'D' }),
      entry({ path: 'new.js', kind: 'untracked', x: '?', y: '?', untracked: true }),
    ])
    assert.deepEqual(paths(groups.stagedRows), ['staged.js'])
    assert.deepEqual(paths(groups.changedRows), ['changed.js', 'new.js'])
    assert.equal(groups.changedRows[1]?.letter, 'U')
  })

  test('sorts every group by path with numeric runs and does not mutate the input', () => {
    const input = [
      entry({ path: 'src/b10.js', x: 'M' }),
      entry({ path: 'src2/a.js', x: 'M' }),
      entry({ path: 'src/b2.js', x: 'M' }),
      entry({ path: 'README.md', x: 'M' }),
    ]
    const snapshot = input.map((row) => row.path)
    const groups = groupChangeEntries(input)
    assert.deepEqual(paths(groups.stagedRows), [
      'README.md',
      'src/b2.js',
      'src/b10.js',
      'src2/a.js',
    ])
    assert.deepEqual(
      input.map((row) => row.path),
      snapshot,
    )
    assert.equal(
      Object.hasOwn(input[0] as object, 'letter'),
      false,
      'the input rows stay untouched',
    )
  })
})
