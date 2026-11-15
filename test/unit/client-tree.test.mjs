/**
 * Direct unit tests for the browser half's pure change-tree builder.
 *
 * These import `src/client/git/tree.js` directly — no React and no plugin
 * context. Expectations describe the implementation: folders group their
 * entries, sort folders before files, use numeric-aware case-insensitive name
 * ordering, and keep single-child folder chains nested rather than flattening
 * them.
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTree, collectTreePaths } from '../../src/client/git/tree.js'

/**
 * Build a tree input entry. The extra field proves the original row record is
 * carried through into the file node.
 * @param {string} path - repository-relative path.
 * @returns {object} entry.
 */
function entry(path) {
  return { path, source: `row:${path}` }
}

/**
 * Strip implementation-only details (`folders` maps, row references) so tests
 * compare the rendered hierarchy only.
 * @param {object[]} nodes - tree nodes.
 * @returns {object[]} comparable shape.
 */
function shape(nodes) {
  return nodes.map((node) => (node.type === 'folder'
    ? { type: 'folder', name: node.name, path: node.path, children: shape(node.children) }
    : { type: 'file', name: node.name, path: node.path }))
}

describe('buildTree', () => {
  test('returns no nodes for no entries', () => {
    assert.deepEqual(buildTree([]), [])
  })

  test('keeps top-level files as file nodes carrying the original entry', () => {
    const first = entry('README.md')
    const tree = buildTree([first])
    assert.deepEqual(shape(tree), [{ type: 'file', name: 'README.md', path: 'README.md' }])
    assert.equal(tree[0].type, 'file')
    assert.equal(tree[0].entry, first)
  })

  test('sorts folders before files regardless of name order', () => {
    const tree = buildTree([entry('z.txt'), entry('a/b.txt')])
    assert.deepEqual(shape(tree), [
      { type: 'folder', name: 'a', path: 'a', children: [{ type: 'file', name: 'b.txt', path: 'a/b.txt' }] },
      { type: 'file', name: 'z.txt', path: 'z.txt' },
    ])
  })

  test('sorts names case-insensitively and numerically, folders and files separately', () => {
    const tree = buildTree([
      entry('z.js'),
      entry('b/file.js'),
      entry('A/file.js'),
      entry('file10.js'),
      entry('file2.js'),
      entry('a10/x.js'),
      entry('a2/x.js'),
    ])
    assert.deepEqual(shape(tree), [
      { type: 'folder', name: 'A', path: 'A', children: [{ type: 'file', name: 'file.js', path: 'A/file.js' }] },
      { type: 'folder', name: 'a2', path: 'a2', children: [{ type: 'file', name: 'x.js', path: 'a2/x.js' }] },
      { type: 'folder', name: 'a10', path: 'a10', children: [{ type: 'file', name: 'x.js', path: 'a10/x.js' }] },
      { type: 'folder', name: 'b', path: 'b', children: [{ type: 'file', name: 'file.js', path: 'b/file.js' }] },
      { type: 'file', name: 'file2.js', path: 'file2.js' },
      { type: 'file', name: 'file10.js', path: 'file10.js' },
      { type: 'file', name: 'z.js', path: 'z.js' },
    ])
  })

  test('groups files that share a folder into one node', () => {
    const tree = buildTree([entry('src/b.js'), entry('src/a.js'), entry('root.txt')])
    assert.deepEqual(shape(tree), [
      {
        type: 'folder',
        name: 'src',
        path: 'src',
        children: [
          { type: 'file', name: 'a.js', path: 'src/a.js' },
          { type: 'file', name: 'b.js', path: 'src/b.js' },
        ],
      },
      { type: 'file', name: 'root.txt', path: 'root.txt' },
    ])
  })

  test('nests intermediate folders, putting the nested folder before its sibling files', () => {
    const tree = buildTree([
      entry('root.txt'),
      entry('src/a.js'),
      entry('src/b.js'),
      entry('src/nested/c.js'),
    ])
    assert.deepEqual(shape(tree), [
      {
        type: 'folder',
        name: 'src',
        path: 'src',
        children: [
          {
            type: 'folder',
            name: 'nested',
            path: 'src/nested',
            children: [{ type: 'file', name: 'c.js', path: 'src/nested/c.js' }],
          },
          { type: 'file', name: 'a.js', path: 'src/a.js' },
          { type: 'file', name: 'b.js', path: 'src/b.js' },
        ],
      },
      { type: 'file', name: 'root.txt', path: 'root.txt' },
    ])
  })

  test('keeps a single-child folder chain nested instead of flattening it', () => {
    const tree = buildTree([entry('one/two/three/four.js')])
    assert.deepEqual(shape(tree), [{
      type: 'folder',
      name: 'one',
      path: 'one',
      children: [{
        type: 'folder',
        name: 'two',
        path: 'one/two',
        children: [{
          type: 'folder',
          name: 'three',
          path: 'one/two/three',
          children: [{ type: 'file', name: 'four.js', path: 'one/two/three/four.js' }],
        }],
      }],
    }])
  })
})

describe('collectTreePaths', () => {
  test('returns the path of a file node', () => {
    const [file] = buildTree([entry('README.md')])
    assert.deepEqual(collectTreePaths(file), ['README.md'])
  })

  test('returns every descendant file path of a folder in display order', () => {
    const tree = buildTree([
      entry('b/z.js'),
      entry('b/a/y.js'),
      entry('b/a/x.js'),
      entry('root.txt'),
    ])
    const folder = tree.find((node) => node.name === 'b')
    assert.deepEqual(collectTreePaths(folder), ['b/a/x.js', 'b/a/y.js', 'b/z.js'])
    assert.deepEqual(collectTreePaths(tree.find((node) => node.name === 'root.txt')), ['root.txt'])
  })

  test('walks nested single-child folders', () => {
    const [folder] = buildTree([entry('one/two/three/four.js')])
    assert.deepEqual(collectTreePaths(folder), ['one/two/three/four.js'])
  })
})
