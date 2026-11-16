/**
 * Direct unit tests for the browser half's pure flat change-list ordering.
 *
 * These import `src/client/git/list.js` directly — no React and no plugin
 * context. Expectations describe the implementation: one layer ordered by
 * repository-relative path, case-insensitively and with numeric runs compared
 * as numbers; the input rows are carried through unchanged.
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { sortChangeEntries } from '../../src/client/git/list.js'

/**
 * Build a list input entry. The extra field proves the original row record is
 * carried through the sort.
 * @param {string} path - repository-relative path.
 * @returns {object} entry.
 */
function entry(path) {
  return { path, source: `row:${path}` }
}

/**
 * Read the paths of sorted rows.
 * @param {object[]} entries - rows.
 * @returns {string[]} paths in display order.
 */
function paths(entries) {
  return entries.map((row) => row.path)
}

describe('sortChangeEntries', () => {
  test('returns no rows for no changes', () => {
    assert.deepEqual(sortChangeEntries([]), [])
  })

  test('orders rows by repository-relative path', () => {
    assert.deepEqual(paths(sortChangeEntries([
      entry('src/b.js'),
      entry('README.md'),
      entry('src/a.js'),
      entry('src2/a.js'),
    ])), ['README.md', 'src/a.js', 'src/b.js', 'src2/a.js'])
  })

  test('compares case-insensitively and numeric runs as numbers', () => {
    assert.deepEqual(paths(sortChangeEntries([
      entry('a10.js'),
      entry('B.js'),
      entry('a2.js'),
      entry('a1.js'),
      entry('b.js'),
    ])), ['a1.js', 'a2.js', 'a10.js', 'B.js', 'b.js'])
  })

  test('keeps the original row records and does not mutate the input', () => {
    const first = entry('src/b.js')
    const second = entry('src/a.js')
    const input = [first, second]
    const sorted = sortChangeEntries(input)
    assert.deepEqual(paths(sorted), ['src/a.js', 'src/b.js'])
    assert.equal(sorted[0], second)
    assert.equal(sorted[1], first)
    assert.deepEqual(paths(input), ['src/b.js', 'src/a.js'])
    assert.equal(sorted[0].source, 'row:src/a.js')
  })

  test('keeps the input order for rows whose paths compare equal', () => {
    const upper = entry('A.js')
    const lower = entry('a.js')
    assert.deepEqual(sortChangeEntries([upper, lower]), [upper, lower])
    assert.deepEqual(sortChangeEntries([lower, upper]), [lower, upper])
  })
})
