/**
 * Direct unit tests for the browser half's pure formatting helpers.
 *
 * These import `src/client/git/format.ts` directly — no React, no plugin
 * context, no built `client.js`. `t` is a recording locale-binder stand-in that
 * returns a marker, so label assertions prove the text comes through `t`.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  baseName,
  errorText,
  formatAgo,
  isStaged,
  isUnstaged,
  parseRefs,
  STATUS_LETTERS,
  splitPath,
  statusKey,
  statusLetter,
} from '../../src/client/git/format.ts'
import type { LocaleBinder, LocaleParams } from '../../src/client/types/dsh.ts'

/** One changed-file row with every wire field the staging guards read. */
type ChangeEntry = Parameters<typeof isStaged>[0]
/**
 * Build one changed-file row; the staging guards read only x, y, conflict and
 * untracked, but the wire row always carries all of them.
 * @param x - index status character.
 * @param y - worktree status character.
 * @param conflict - unmerged row.
 * @param untracked - untracked row.
 * @returns changed-file row.
 */
function changedEntry(x: string, y: string, conflict = false, untracked = false): ChangeEntry {
  return {
    kind: untracked ? 'untracked' : conflict ? 'unmerged' : 'ordinary',
    x,
    y,
    path: 'src/app.js',
    conflict,
    untracked,
  }
}

/** One recorded translation call. */
interface TranslationCall {
  key: string
  params?: LocaleParams
}

/**
 * Locale-binder spy: records `(key, params)` and returns a marked string.
 * @returns translation spy and its call record.
 */
function recordingTranslator(): { t: LocaleBinder; calls: TranslationCall[] } {
  const calls: TranslationCall[] = []
  const t: LocaleBinder = (key, params) => {
    calls.push(params === undefined ? { key } : { key, params })
    return params === undefined ? `T(${key})` : `T(${key}:${String(params.n)})`
  }
  return { t, calls }
}

describe('statusLetter', () => {
  test('maps every porcelain status character to its display letter', () => {
    assert.deepEqual(STATUS_LETTERS, {
      '.': '',
      M: 'M',
      A: 'A',
      D: 'D',
      R: 'R',
      C: 'C',
      U: 'U',
      T: 'T',
      '?': 'U',
    })
    for (const [character, letter] of Object.entries(STATUS_LETTERS)) {
      assert.equal(statusLetter(character), letter, `character ${JSON.stringify(character)}`)
    }
  })

  test('renders an untracked marker as U', () => {
    assert.equal(statusLetter('?'), 'U')
  })

  test('renders characters without a display letter as empty', () => {
    for (const character of ['X', '!', '', undefined, null]) {
      assert.equal(statusLetter(character), '', `character ${String(character)}`)
    }
  })
})

describe('statusKey', () => {
  test('maps display letters to dictionary keys', () => {
    assert.equal(statusKey('M'), 'status.modified')
    assert.equal(statusKey('A'), 'status.added')
    assert.equal(statusKey('D'), 'status.deleted')
    assert.equal(statusKey('R'), 'status.renamed')
    assert.equal(statusKey('C'), 'status.copied')
    assert.equal(statusKey('U'), 'status.untracked')
    assert.equal(statusKey('!'), 'status.conflict')
    assert.equal(statusKey('T'), 'status.typeChanged')
  })

  test('falls back to modified for unknown or missing letters', () => {
    for (const letter of ['', 'X', undefined]) {
      assert.equal(statusKey(letter), 'status.modified', `letter ${String(letter)}`)
    }
  })
})

describe('isStaged and isUnstaged', () => {
  test('a row changed in the index and the working tree counts in both groups', () => {
    const entry = changedEntry('M', 'M')
    assert.equal(isStaged(entry), true)
    assert.equal(isUnstaged(entry), true)
  })

  test('an index-only change is staged and not unstaged', () => {
    const entry = changedEntry('M', '.')
    assert.equal(isStaged(entry), true)
    assert.equal(isUnstaged(entry), false)
  })

  test('a working-tree-only change is unstaged and not staged', () => {
    const entry = changedEntry('.', 'M')
    assert.equal(isStaged(entry), false)
    assert.equal(isUnstaged(entry), true)
  })

  test('an untracked row is unstaged only', () => {
    const entry = changedEntry('?', '?', false, true)
    assert.equal(isStaged(entry), false)
    assert.equal(isUnstaged(entry), true)
  })

  test('an untracked index marker counts as unstaged even when y is clean', () => {
    const entry = changedEntry('?', '.', false, true)
    assert.equal(isStaged(entry), false)
    assert.equal(isUnstaged(entry), true)
  })

  test('conflicted rows never appear in either change group', () => {
    for (const [x, y] of [
      ['U', 'U'],
      ['A', 'A'],
      ['A', 'U'],
    ]) {
      const entry = changedEntry(x, y, true)
      assert.equal(isStaged(entry), false, `staged for ${x}${y}`)
      assert.equal(isUnstaged(entry), false, `unstaged for ${x}${y}`)
    }
  })
})

describe('baseName', () => {
  test('returns the last slash-separated segment', () => {
    assert.equal(baseName('src/app.js'), 'app.js')
    assert.equal(baseName('src/lib/file with spaces.js'), 'file with spaces.js')
  })

  test('returns a top-level name unchanged', () => {
    assert.equal(baseName('README.md'), 'README.md')
  })

  test('only splits on forward slashes; a trailing slash yields an empty name', () => {
    assert.equal(baseName('src/lib/'), '')
    assert.equal(baseName('C:\\repo\\app.js'), 'C:\\repo\\app.js')
  })
})

describe('splitPath', () => {
  test('splits the parent directory from the file name', () => {
    assert.deepEqual(splitPath('src/lib/app.js'), { dir: 'src/lib', name: 'app.js' })
    assert.deepEqual(splitPath('README.md'), { dir: '', name: 'README.md' })
  })

  test('only splits on forward slashes; a trailing slash yields an empty name', () => {
    assert.deepEqual(splitPath('src/lib/'), { dir: 'src/lib', name: '' })
    assert.deepEqual(splitPath('C:\\repo\\app.js'), { dir: '', name: 'C:\\repo\\app.js' })
  })
})

describe('formatAgo', () => {
  test('selects the relative-time bucket at the implementation thresholds', () => {
    const originalNow = Date.now
    const nowSeconds = 1_700_000_000
    Date.now = () => nowSeconds * 1000
    const cases: Array<[age: number, key: string, n?: number]> = [
      [0, 'time.now'],
      [44, 'time.now'],
      [45, 'time.minutes', 1],
      [89, 'time.minutes', 1],
      [90, 'time.minutes', 2],
      [3599, 'time.minutes', 60],
      [3600, 'time.hours', 1],
      [7199, 'time.hours', 2],
      [86399, 'time.hours', 24],
      [86400, 'time.days', 1],
      [604799, 'time.days', 7],
      [604800, 'time.weeks', 1],
      [2591999, 'time.weeks', 4],
      [2592000, 'time.months', 1],
      [31535999, 'time.months', 12],
      [31536000, 'time.years', 1],
      [63072000, 'time.years', 2],
    ]
    try {
      for (const [age, key, n] of cases) {
        const { t, calls } = recordingTranslator()
        const result = formatAgo(t, nowSeconds - age)
        const expected = n === undefined ? { key } : { key, params: { n } }
        assert.deepEqual(calls, [expected], `age ${age}`)
        assert.equal(result, n === undefined ? `T(${key})` : `T(${key}:${n})`)
      }
    } finally {
      Date.now = originalNow
    }
  })

  test('a commit timestamp in the future renders as just now', () => {
    const originalNow = Date.now
    const nowSeconds = 1_700_000_000
    Date.now = () => nowSeconds * 1000
    try {
      const { t, calls } = recordingTranslator()
      formatAgo(t, nowSeconds + 300)
      assert.deepEqual(calls, [{ key: 'time.now' }])
    } finally {
      Date.now = originalNow
    }
  })
})

describe('parseRefs', () => {
  test('returns no refs for missing, non-string, or empty decorations', () => {
    for (const input of [undefined, null, '', 42, {}]) {
      assert.deepEqual(parseRefs(input), [], `input ${String(input)}`)
    }
  })

  test('classifies full decorations the way VS Code does', () => {
    assert.deepEqual(
      parseRefs(
        'HEAD -> refs/heads/feature/x, tag: refs/tags/v2, refs/remotes/origin/feature/x, refs/heads/main',
      ),
      [
        { id: 'refs/heads/feature/x', name: 'feature/x', kind: 'head' },
        { id: 'refs/tags/v2', name: 'v2', kind: 'tag' },
        { id: 'refs/remotes/origin/feature/x', name: 'origin/feature/x', kind: 'remote' },
        { id: 'refs/heads/main', name: 'main', kind: 'branch' },
      ],
    )
  })

  test('keeps a local branch with a slash local', () => {
    assert.deepEqual(parseRefs('refs/heads/fix/wps365'), [
      { id: 'refs/heads/fix/wps365', name: 'fix/wps365', kind: 'branch' },
    ])
  })

  test('skips a detached HEAD marker and remote HEAD pointers', () => {
    assert.deepEqual(parseRefs('HEAD, refs/remotes/origin/HEAD, refs/remotes/origin/main'), [
      { id: 'refs/remotes/origin/main', name: 'origin/main', kind: 'remote' },
    ])
  })

  test('falls back to short spellings', () => {
    assert.deepEqual(parseRefs('HEAD -> main, tag: v1.0, origin/main, origin/HEAD, dev'), [
      { id: 'refs/heads/main', name: 'main', kind: 'head' },
      { id: 'refs/tags/v1.0', name: 'v1.0', kind: 'tag' },
      { id: 'refs/remotes/origin/main', name: 'origin/main', kind: 'remote' },
      { id: 'refs/heads/dev', name: 'dev', kind: 'branch' },
    ])
  })

  test('skips empty comma-separated segments and unknown ref namespaces', () => {
    assert.deepEqual(parseRefs('refs/heads/main, , refs/stash'), [
      { id: 'refs/heads/main', name: 'main', kind: 'branch' },
    ])
  })
})

describe('errorText', () => {
  test('maps a missing failure to the unknown error text', () => {
    const { t } = recordingTranslator()
    assert.equal(errorText(t, null), 'T(error.unknown)')
    assert.equal(errorText(t, undefined), 'T(error.unknown)')
  })

  test('maps known failure codes to their localized descriptions', () => {
    const { t } = recordingTranslator()
    assert.equal(errorText(t, { code: 'git-unavailable' }), 'T(gitUnavailable.desc)')
    assert.equal(errorText(t, { code: 'network', message: 'ignored' }), 'T(error.network)')
    assert.equal(errorText(t, { code: 'forbidden' }), 'T(error.forbidden)')
    assert.equal(errorText(t, { code: 'not-a-repository' }), 'T(noRepo.title)')
    assert.equal(errorText(t, { code: 'discard-unborn' }), 'T(error.discardUnborn)')
  })

  test('shows the failure message for unmapped codes, falling back to unknown', () => {
    const { t, calls } = recordingTranslator()
    assert.equal(errorText(t, { code: 'internal', message: 'git said no' }), 'git said no')
    assert.deepEqual(calls, [])
    assert.equal(errorText(t, { code: 'internal', message: '' }), 'T(error.unknown)')
    assert.equal(errorText(t, { message: 'bare message' }), 'bare message')
    assert.equal(errorText(t, { message: '' }), 'T(error.unknown)')
  })
})
