/**
 * Unit tests for the watch-event classification.
 *
 * The rules decide which counters the panel re-reads, so they are tested as a
 * table: the filesystem watchers themselves are covered in the Host suite.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { classifyGitDirectoryEntry, classifyWorktreeEntry } from '../../src/host/watch/classify.ts'

describe('classifyWorktreeEntry', () => {
  const cases: ReadonlyArray<readonly [string | null, string]> = [
    ['src/app.ts', 'worktree'],
    ['README.md', 'worktree'],
    ['nested/deep/file.txt', 'worktree'],
    ['src\\app.ts', 'worktree'],
    ['src/.gitkeep', 'worktree'],
    ['node_modules/pkg/index.js', 'worktree'],
    ['', 'worktree'],
    [null, 'worktree'],
    ['.git', 'ignore'],
    ['.git/index', 'ignore'],
    ['.git/HEAD', 'ignore'],
    ['.git/refs/heads/main', 'ignore'],
    ['.git\\HEAD', 'ignore'],
  ]

  for (const [filename, expected] of cases) {
    test(`${JSON.stringify(filename)} is ${expected}`, () => {
      assert.equal(classifyWorktreeEntry(filename), expected)
    })
  }
})

describe('classifyGitDirectoryEntry', () => {
  const cases: ReadonlyArray<readonly [string | null, string]> = [
    ['HEAD', 'references'],
    ['packed-refs', 'references'],
    ['config', 'references'],
    ['FETCH_HEAD', 'references'],
    ['ORIG_HEAD', 'references'],
    ['COMMIT_EDITMSG', 'references'],
    ['index', 'worktree'],
    ['index.lock', 'ignore'],
    ['HEAD.lock', 'ignore'],
    ['packed-refs.lock', 'ignore'],
    ['refs', 'references'],
    ['refs/heads/main', 'references'],
    ['refs/heads/main.lock', 'ignore'],
    ['refs/tags/v1.0', 'references'],
    ['refs\\heads\\main', 'references'],
    ['objects', 'ignore'],
    ['objects/ab/cdef', 'ignore'],
    ['info/exclude', 'ignore'],
    ['hooks/pre-commit', 'ignore'],
    ['logs/HEAD', 'ignore'],
    ['worktrees/linked', 'ignore'],
    ['some-unknown-file', 'references'],
    ['', 'references'],
    [null, 'references'],
  ]

  for (const [filename, expected] of cases) {
    test(`${JSON.stringify(filename)} is ${expected}`, () => {
      assert.equal(classifyGitDirectoryEntry(filename), expected)
    })
  }
})
