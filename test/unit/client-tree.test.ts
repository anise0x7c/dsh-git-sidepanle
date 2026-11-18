/**
 * Direct unit tests for the commit-details folder tree builder.
 *
 * These import `src/client/git/tree.ts` directly — no React, no plugin context
 * and no DOM. Expectations describe the rendering contract: subfolders before
 * files at every level, name ordering with numeric runs compared as numbers,
 * unbranched folder chains collapsed into one row, rendered depth starting at
 * zero, and a pure build that neither mutates nor pre-sorts its input.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { FileTreeRow } from '../../src/client/git/tree.ts'
import { buildFileTree } from '../../src/client/git/tree.ts'

/** Minimal changed-file entry the tree builder accepts. */
interface Entry {
  path: string
  letter?: string
}

/**
 * Project rows to a compact `kind:path[:label]:depth` shape so a failed
 * comparison stays readable.
 * @param rows - tree rows in display order.
 * @returns one short string per row.
 */
function shape(rows: readonly FileTreeRow<Entry>[]): string[] {
  return rows.map((row) =>
    row.type === 'folder'
      ? `folder:${row.path}:${row.label}:${row.depth}`
      : `file:${row.entry.path}:${row.depth}`,
  )
}

describe('buildFileTree', () => {
  test('collapses an unbranched folder chain into one folder row', () => {
    const file = { path: 'a/b/c/file.ts' }
    const rows = buildFileTree([file])
    assert.deepEqual(rows, [
      { type: 'folder', path: 'a/b/c', label: 'a/b/c', depth: 0 },
      { type: 'file', entry: file, depth: 1 },
    ])
    const fileRow = rows[1]
    assert.ok(fileRow !== undefined && fileRow.type === 'file')
    assert.equal(fileRow.entry, file, 'the original entry object is returned by reference')
  })

  test('collapses only the unbranched ends of a branching tree', () => {
    const rows = buildFileTree([{ path: 'a/b/x.ts' }, { path: 'a/c/y.ts' }])
    assert.deepEqual(shape(rows), [
      'folder:a:a:0',
      'folder:a/b:b:1',
      'file:a/b/x.ts:2',
      'folder:a/c:c:1',
      'file:a/c/y.ts:2',
    ])
  })

  test('stops a collapsed chain at a folder that also holds a file', () => {
    const rows = buildFileTree([{ path: 'a/b/c/deep.ts' }, { path: 'a/file.ts' }])
    assert.deepEqual(shape(rows), [
      'folder:a:a:0',
      'folder:a/b/c:b/c:1',
      'file:a/b/c/deep.ts:2',
      'file:a/file.ts:1',
    ])
  })

  test('keeps subfolders before files and orders numeric names numerically', () => {
    const rows = buildFileTree([
      { path: 'b10.ts' },
      { path: 'b2.ts' },
      { path: 'a/x.ts' },
      { path: 'top.md' },
    ])
    assert.deepEqual(shape(rows), [
      'folder:a:a:0',
      'file:a/x.ts:1',
      'file:b2.ts:0',
      'file:b10.ts:0',
      'file:top.md:0',
    ])
  })

  test('keeps a folder and a file with the same name, folders first', () => {
    const rows = buildFileTree([{ path: 'a' }, { path: 'a/b' }])
    assert.deepEqual(shape(rows), ['folder:a:a:0', 'file:a/b:1', 'file:a:0'])
  })

  test('normalizes defensive slashes and leaves the input untouched', () => {
    const input = [{ path: '/a//b/' }, { path: '' }]
    const copy = input.map((entry) => ({ ...entry }))
    const rows = buildFileTree(input)
    assert.deepEqual(shape(rows), ['folder:a:a:0', 'file:/a//b/:1'])
    const fileRow = rows[1]
    assert.ok(fileRow !== undefined && fileRow.type === 'file')
    assert.equal(fileRow.entry, input[0], 'the entry object survives by reference')
    assert.deepEqual(input, copy, 'the input array and its entries are not mutated')
  })
})
