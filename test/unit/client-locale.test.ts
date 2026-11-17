/**
 * Direct unit tests for the browser half's locale dictionaries.
 *
 * These import `src/client/locale/{en,zh}.ts` directly and check the invariant
 * the registration tests only assert indirectly: both dictionaries carry the
 * same keys, no value is empty, and every `{placeholder}` has a counterpart in
 * the other language. A source scan covers the keys the pure modules pass to
 * the locale binder.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { en } from '../../src/client/locale/en.ts'
import { zh } from '../../src/client/locale/zh.ts'

/** Dictionary views indexed by arbitrary key, so the parity scans can address every entry. */
const ENGLISH: Readonly<Record<string, string>> = en
const CHINESE: Readonly<Record<string, string>> = zh
const ENGLISH_KEYS = Object.keys(ENGLISH)
const CHINESE_KEYS = Object.keys(CHINESE)

/**
 * Read the first capture group of a match known to contain one.
 * @param match - a regex match produced by a pattern with a capture group.
 * @returns the captured text.
 */
function firstCapture(match: RegExpMatchArray): string {
  const captured = match[1]
  assert.ok(captured !== undefined, 'the pattern must capture one group')
  return captured
}

/**
 * Read one dictionary entry after proving the key exists.
 * @param dictionary - one language dictionary.
 * @param key - entry key.
 * @param language - language label for the failure message.
 * @returns the entry text.
 */
function dictionaryEntry(
  dictionary: Readonly<Record<string, string>>,
  key: string,
  language: string,
): string {
  const value = dictionary[key]
  assert.ok(value !== undefined, `${language} is missing ${key}`)
  return value
}

/**
 * Interpolation names used by one dictionary entry.
 * @param text - dictionary value.
 * @returns sorted placeholder names.
 */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{([A-Za-z]+)\}/g)].map(firstCapture).sort()
}

/**
 * Read one pure browser module so tests can scan the locale keys it uses.
 * @param relativePath - path below `src/client/`.
 * @returns module source.
 */
function moduleSource(relativePath: string): string {
  return readFileSync(new URL(`../../src/client/${relativePath}`, import.meta.url), 'utf8')
}

describe('locale dictionaries', () => {
  test('English and Chinese expose the same key set', () => {
    assert.ok(ENGLISH_KEYS.length > 0)
    assert.deepEqual(ENGLISH_KEYS.slice().sort(), CHINESE_KEYS.slice().sort())
  })

  test('every entry is a non-empty string in both languages', () => {
    for (const key of ENGLISH_KEYS) {
      const english = dictionaryEntry(ENGLISH, key, 'en')
      const chinese = dictionaryEntry(CHINESE, key, 'zh')
      assert.equal(typeof english, 'string', `en ${key}`)
      assert.equal(typeof chinese, 'string', `zh ${key}`)
      assert.notEqual(english.trim(), '', `en ${key} is empty`)
      assert.notEqual(chinese.trim(), '', `zh ${key} is empty`)
    }
  })

  test('both languages interpolate the same placeholder names for every key', () => {
    for (const key of ENGLISH_KEYS) {
      assert.deepEqual(
        placeholders(dictionaryEntry(CHINESE, key, 'zh')),
        placeholders(dictionaryEntry(ENGLISH, key, 'en')),
        `placeholders for ${key}`,
      )
    }
  })

  test('the interpolation names are the declared ones', () => {
    const expected = {
      'branch.ahead': ['n'],
      'branch.behind': ['n'],
      'branch.upstream': ['name'],
      'commit.placeholder': ['branch'],
      'commit.done': ['hash'],
      'noRepo.desc': ['path'],
      'confirm.discardTitle': ['name'],
      'confirm.discardAllTitle': ['n'],
      'diff.from': ['path'],
      'time.minutes': ['n'],
    }
    for (const [key, names] of Object.entries(expected)) {
      assert.deepEqual(placeholders(dictionaryEntry(ENGLISH, key, 'en')), names, `en ${key}`)
      assert.deepEqual(placeholders(dictionaryEntry(CHINESE, key, 'zh')), names, `zh ${key}`)
    }
    const allNames = [
      ...new Set(ENGLISH_KEYS.flatMap((key) => placeholders(dictionaryEntry(ENGLISH, key, 'en')))),
    ].sort()
    assert.deepEqual(allNames, ['branch', 'hash', 'n', 'name', 'path'])
  })

  test('keys referenced by the pure modules exist in both dictionaries', () => {
    // The pure modules either pass a literal to `t(...)` or return/capture a
    // dictionary key (`statusKey` returns one, copy commands capture one), so
    // every key-shaped single-quoted literal in them must be a dictionary key.
    const keys = new Set<string>()
    for (const source of ['git/format.ts', 'menu/actions.ts', 'menu/clipboard.ts']) {
      const text = moduleSource(source)
      for (const match of text.matchAll(/'([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)'/g))
        keys.add(firstCapture(match))
    }
    assert.ok(keys.size >= 30, `found only ${keys.size} locale keys in the pure modules`)
    for (const key of [
      'status.modified',
      'time.years',
      'error.network',
      'menu.openDiff',
      'menu.copiedPath',
      'menu.copyFailed',
    ]) {
      assert.ok(keys.has(key), `the pure modules should reference ${key}`)
    }
    for (const key of keys) {
      assert.ok(key in ENGLISH, `en is missing ${key}`)
      assert.ok(key in CHINESE, `zh is missing ${key}`)
    }
  })
})
