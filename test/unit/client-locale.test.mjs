/**
 * Direct unit tests for the browser half's locale dictionaries.
 *
 * These import `src/client/locale/{en,zh}.js` directly and check the invariant
 * the registration tests only assert indirectly: both dictionaries carry the
 * same keys, no value is empty, and every `{placeholder}` has a counterpart in
 * the other language. A source scan covers the keys the pure modules pass to
 * the locale binder.
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { en } from '../../src/client/locale/en.js'
import { zh } from '../../src/client/locale/zh.js'

const ENGLISH_KEYS = Object.keys(en)
const CHINESE_KEYS = Object.keys(zh)

/**
 * Interpolation names used by one dictionary entry.
 * @param {string} text - dictionary value.
 * @returns {string[]} sorted placeholder names.
 */
function placeholders(text) {
  return [...text.matchAll(/\{([A-Za-z]+)\}/g)].map((match) => match[1]).sort()
}

/**
 * Read one pure browser module so tests can scan the locale keys it uses.
 * @param {string} relativePath - path below `src/client/`.
 * @returns {string} module source.
 */
function moduleSource(relativePath) {
  return readFileSync(new URL(`../../src/client/${relativePath}`, import.meta.url), 'utf8')
}

describe('locale dictionaries', () => {
  test('English and Chinese expose the same key set', () => {
    assert.ok(ENGLISH_KEYS.length > 0)
    assert.deepEqual(ENGLISH_KEYS.slice().sort(), CHINESE_KEYS.slice().sort())
  })

  test('every entry is a non-empty string in both languages', () => {
    for (const key of ENGLISH_KEYS) {
      assert.equal(typeof en[key], 'string', `en ${key}`)
      assert.equal(typeof zh[key], 'string', `zh ${key}`)
      assert.notEqual(en[key].trim(), '', `en ${key} is empty`)
      assert.notEqual(zh[key].trim(), '', `zh ${key} is empty`)
    }
  })

  test('both languages interpolate the same placeholder names for every key', () => {
    for (const key of ENGLISH_KEYS) {
      assert.deepEqual(placeholders(zh[key]), placeholders(en[key]), `placeholders for ${key}`)
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
      assert.deepEqual(placeholders(en[key]), names, `en ${key}`)
      assert.deepEqual(placeholders(zh[key]), names, `zh ${key}`)
    }
    const allNames = [...new Set(ENGLISH_KEYS.flatMap((key) => placeholders(en[key])))].sort()
    assert.deepEqual(allNames, ['branch', 'hash', 'n', 'name', 'path'])
  })

  test('keys referenced by the pure modules exist in both dictionaries', () => {
    // The pure modules either pass a literal to `t(...)` or return/capture a
    // dictionary key (`statusKey` returns one, copy commands capture one), so
    // every key-shaped single-quoted literal in them must be a dictionary key.
    const keys = new Set()
    for (const source of ['git/format.js', 'menu/actions.js', 'menu/clipboard.js']) {
      const text = moduleSource(source)
      for (const match of text.matchAll(/'([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)'/g)) keys.add(match[1])
    }
    assert.ok(keys.size >= 30, `found only ${keys.size} locale keys in the pure modules`)
    for (const key of ['status.modified', 'time.years', 'error.network', 'menu.openDiff', 'menu.copiedPath', 'menu.copyFailed']) {
      assert.ok(keys.has(key), `the pure modules should reference ${key}`)
    }
    for (const key of keys) {
      assert.ok(key in en, `en is missing ${key}`)
      assert.ok(key in zh, `zh is missing ${key}`)
    }
  })
})
