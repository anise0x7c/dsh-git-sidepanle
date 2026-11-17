/**
 * Direct unit tests for the browser half's clipboard fallback.
 *
 * `copyToClipboard` is the only function with DOM access, so these tests stand in
 * fake `navigator`/`document` globals and restore the real descriptors in every
 * path. The fallback textarea must never outlive one attempt, even when the
 * WebView copy primitive throws.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { copyToClipboard } from '../../src/client/menu/clipboard.ts'

/** Minimal textarea the fallback creates. */
interface FakeTextArea {
  value: string
  readonly style: Record<string, string>
  setAttribute(name: string, value: string): void
  select(): void
}

/** Document stand-in plus the children currently attached to its body. */
interface FakeDocument {
  readonly document: {
    readonly body: {
      appendChild(area: FakeTextArea): FakeTextArea
      removeChild(area: FakeTextArea): FakeTextArea
    }
    readonly execCommand?: () => boolean
    createElement(): FakeTextArea
  }
  readonly children: FakeTextArea[]
}

/**
 * Build a fake document whose copy primitive behaves as asked.
 * @param options - execCommand result and whether selecting the textarea throws.
 * @returns fake document and its live body children.
 */
function fakeDocument(options: {
  readonly execCommand?: () => boolean
  readonly selectThrows?: boolean
}): FakeDocument {
  const children: FakeTextArea[] = []
  const body = {
    appendChild(area: FakeTextArea): FakeTextArea {
      children.push(area)
      return area
    },
    removeChild(area: FakeTextArea): FakeTextArea {
      const index = children.indexOf(area)
      assert.notEqual(index, -1, 'the fallback textarea was already detached')
      children.splice(index, 1)
      return area
    },
  }
  const document = {
    body,
    ...(options.execCommand === undefined ? {} : { execCommand: options.execCommand }),
    createElement(): FakeTextArea {
      return {
        value: '',
        style: {},
        setAttribute: () => {},
        select: () => {
          if (options.selectThrows === true) throw new Error('selection failed')
        },
      }
    },
  }
  return { document, children }
}

/**
 * Replace the clipboard-related globals for one test.
 * @param values - fake globals; a missing entry removes the global.
 * @returns restores the previous descriptors.
 */
function installGlobals(values: {
  readonly navigator?: unknown
  readonly document?: unknown
}): () => void {
  const names = ['navigator', 'document'] as const
  const saved = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  )
  for (const name of names) {
    const value = values[name]
    if (value === undefined) Reflect.deleteProperty(globalThis, name)
    else Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  }
  return () => {
    for (const name of names) {
      const descriptor = saved.get(name)
      if (descriptor === undefined) Reflect.deleteProperty(globalThis, name)
      else Object.defineProperty(globalThis, name, descriptor)
    }
  }
}

describe('copyToClipboard', () => {
  test('uses the async clipboard API when it is available', async () => {
    const copied: string[] = []
    const restore = installGlobals({
      navigator: {
        clipboard: {
          writeText: async (text: string) => {
            copied.push(text)
          },
        },
      },
      document: fakeDocument({}).document,
    })
    try {
      assert.equal(await copyToClipboard('src/app.js'), true)
      assert.deepEqual(copied, ['src/app.js'])
    } finally {
      restore()
    }
  })

  test('falls back to execCommand when the clipboard write rejects', async () => {
    const fake = fakeDocument({ execCommand: () => true })
    const restore = installGlobals({
      navigator: {
        clipboard: {
          writeText: async () => {
            throw new Error('denied')
          },
        },
      },
      document: fake.document,
    })
    try {
      assert.equal(await copyToClipboard('src/app.js'), true)
      assert.equal(fake.children.length, 0, 'the fallback textarea was detached')
    } finally {
      restore()
    }
  })

  test('removes the fallback textarea when execCommand throws', async () => {
    const fake = fakeDocument({
      execCommand: () => {
        throw new Error('copy unavailable')
      },
    })
    const restore = installGlobals({ navigator: {}, document: fake.document })
    try {
      assert.equal(await copyToClipboard('src/app.js'), false)
      assert.equal(fake.children.length, 0, 'a throwing copy must not leave the textarea behind')
    } finally {
      restore()
    }
  })

  test('removes the fallback textarea when selecting it throws', async () => {
    const fake = fakeDocument({ execCommand: () => true, selectThrows: true })
    const restore = installGlobals({ navigator: {}, document: fake.document })
    try {
      assert.equal(await copyToClipboard('src/app.js'), false)
      assert.equal(fake.children.length, 0)
    } finally {
      restore()
    }
  })

  test('reports failure when neither copy path exists', async () => {
    const fake = fakeDocument({})
    const restore = installGlobals({ navigator: {}, document: fake.document })
    try {
      assert.equal(await copyToClipboard('src/app.js'), false)
      assert.equal(fake.children.length, 0)
    } finally {
      restore()
    }
  })
})
