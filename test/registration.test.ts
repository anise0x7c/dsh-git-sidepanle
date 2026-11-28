import assert from 'node:assert/strict'
import test from 'node:test'
import { createFakeContext, loadClientBundle } from './support/fake-ctx.ts'

const { registration, styleTags } = await loadClientBundle()

/** Registration never renders: React remains an inert external dependency. */
function evaluateFactory() {
  return registration.factory((specifier) => {
    assert.equal(specifier, 'react')
    return {}
  })
}

test('evaluating the factory has no DOM or service registration side effects', () => {
  const before = styleTags.length
  const plugin = evaluateFactory()
  assert.equal(typeof plugin.apply, 'function')
  assert.equal(styleTags.length, before)
})

/** Apply a plugin with an explicitly owned effect lifetime. */
function applyWithCleanup(plugin = evaluateFactory()) {
  const fake = createFakeContext()
  const cleanups: Array<() => void> = []
  fake.ctx.effect = (setup) => {
    const result = setup()
    const cleanup = typeof result === 'function' ? result : () => {}
    cleanups.push(cleanup)
    return cleanup
  }
  plugin.apply(fake.ctx)
  return () => {
    for (const cleanup of [...cleanups].reverse()) cleanup()
  }
}

test('styles are shared while applied and removed only after the last owner disposes', () => {
  const before = styleTags.length
  const disposeFirst = applyWithCleanup()
  assert.equal(styleTags.length, before + 1)
  const disposeSecond = applyWithCleanup()
  assert.equal(styleTags.length, before + 1)
  disposeFirst()
  disposeFirst()
  assert.equal(styleTags.length, before + 1)
  disposeSecond()
  disposeSecond()
  assert.equal(styleTags.length, before)
})

test('an adopted stylesheet is refreshed but never removed by the adopting lifetime', () => {
  const before = styleTags.length
  const tag = document.createElement('style')
  tag.setAttribute('data-plugin', 'dsh-git-sidepanel')
  tag.textContent = '/* previous module stylesheet */'
  document.head.appendChild(tag)
  const dispose = applyWithCleanup()
  try {
    assert.equal(styleTags.length, before + 1)
    assert.match(tag.textContent, /\.dshgg-/)
    dispose()
    assert.equal(styleTags.length, before + 1)
  } finally {
    dispose()
    tag.remove()
  }
  assert.equal(styleTags.length, before)
})

for (const service of ['shortcuts', 'contextMenus'] as const) {
  test(`a missing ${service} service does not abort other registrations`, (context) => {
    const warning = context.mock.method(console, 'warn', () => {})
    const fake = createFakeContext()
    const originalInject = fake.ctx.inject
    fake.ctx.inject = (services, callback) => {
      if (services.some((name) => name === service)) throw new Error(`missing ${service}`)
      originalInject(services, callback)
    }
    assert.doesNotThrow(() => evaluateFactory().apply(fake.ctx))
    assert.equal(fake.records.tabTypes.length, 2)
    assert.equal(fake.records.slots.length, 4)
    assert.equal(fake.records.localeDictionaries.length, 1)
    assert.equal(
      service === 'shortcuts' ? fake.menu.contributions.length : fake.records.shortcuts.length,
      1,
    )
    assert.equal(warning.mock.callCount(), 1)
    assert.equal(
      warning.mock.calls[0]?.arguments[0],
      service === 'shortcuts'
        ? '[git-sidepanel] shortcut registration failed'
        : '[git-sidepanel] context menu binding failed',
    )
  })

  test(`a throwing ${service} registration remains an isolated optional failure`, (context) => {
    const warning = context.mock.method(console, 'warn', () => {})
    const fake = createFakeContext()
    if (service === 'shortcuts') {
      fake.ctx.inject(['shortcuts'], (scoped) => {
        scoped.shortcuts.register = () => {
          throw new Error('registration failed')
        }
      })
    } else {
      fake.menu.contextMenus.register = () => {
        throw new Error('registration failed')
      }
    }
    assert.doesNotThrow(() => evaluateFactory().apply(fake.ctx))
    assert.equal(fake.records.tabTypes.length, 2)
    assert.equal(fake.records.slots.length, 4)
    assert.equal(
      service === 'shortcuts' ? fake.menu.contributions.length : fake.records.shortcuts.length,
      1,
    )
    assert.equal(warning.mock.callCount(), 1)
    assert.equal(
      warning.mock.calls[0]?.arguments[0],
      service === 'shortcuts'
        ? '[git-sidepanel] shortcut registration failed'
        : '[git-sidepanel] context menu registration failed',
    )
  })
}
