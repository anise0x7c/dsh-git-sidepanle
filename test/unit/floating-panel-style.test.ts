/** Structural CSS regressions; these do not pretend to measure browser layout. */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const css = readFileSync(new URL('../../src/client/styles.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** Leaf rules suffice for declarations, including rules nested in @supports. */
function leafRules(source: string) {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1]
      .trim()
      .split(',')
      .map((selector) => selector.trim()),
    declarations: match[2],
  }))
}

const rules = leafRules(css)

/** Read a public selector's combined declarations in source order. */
function declarations(selector: string, source = css): string {
  const found = leafRules(source).filter((rule) => rule.selectors.includes(selector))
  assert.ok(found.length > 0, `missing CSS contract for ${selector}`)
  return found.map((rule) => rule.declarations).join('\n')
}

/** Extract a complete conditional block without assuming its nested rule count. */
function supportBlocks(): string[] {
  const blocks: string[] = []
  for (const match of css.matchAll(/@supports\b[^{}]*\{/g)) {
    const start = match.index
    let depth = 1
    let end = start + match[0].length
    for (; end < css.length && depth > 0; end += 1) {
      if (css[end] === '{') depth += 1
      if (css[end] === '}') depth -= 1
    }
    blocks.push(css.slice(start, end))
  }
  return blocks
}

test('floating CSS anchors an isolated nonmodal layer without changing split geometry', () => {
  const root = declarations('.dshgg-root')
  const layer = declarations('.dshgg-root .dshgg-floating-panel-layer')
  const card = declarations('.dshgg-root .dshgg-floating-panel')
  assert.match(root, /\bposition:\s*relative\s*;/)
  assert.match(root, /\bisolation:\s*isolate\s*;/)
  assert.match(layer, /\bposition:\s*absolute\s*;/)
  assert.match(layer, /\binset:\s*[^;]+;/, 'layer is bounded by the panel, not the viewport')
  assert.match(
    layer,
    /\bpointer-events:\s*none\s*;/,
    'the nonmodal layer does not block list controls',
  )
  assert.match(card, /\bpointer-events:\s*auto\s*;/, 'the card itself remains interactive')
  assert.match(card, /\bwidth:\s*100%\s*;/)
  assert.doesNotMatch(card, /\bmax-width\s*:/, 'wide panes must not retain a centered width cap')
  assert.match(card, /\bmax-height:\s*(?:100%|calc\([^;]+\))\s*;/)
  assert.match(card, /\bbox-sizing:\s*border-box\s*;/)
  assert.doesNotMatch(layer + card, /\bposition:\s*fixed\s*;/)
  for (const rule of rules) {
    for (const selector of rule.selectors.filter((value) => value.includes('.dshgg-floating-'))) {
      assert.match(selector, /^\.dshgg-root\s/, `floating styles stay plugin-scoped: ${selector}`)
    }
  }
})

test('floating CSS fills the pane with equal gutters while preserving content and button spacing', () => {
  const layer = declarations('.dshgg-root .dshgg-floating-panel-layer')
  const body = declarations('.dshgg-root .dshgg-floating-panel-body')
  const footer = declarations('.dshgg-root .dshgg-floating-panel-footer')
  const actions = declarations('.dshgg-root .dshgg-floating-panel-footer .dshgg-btn')
  assert.match(layer, /\binset:\s*4px\s*;/, 'left, right and bottom gutters stay equal')
  assert.match(layer, /\bjustify-content:\s*flex-end\s*;/)
  assert.match(body, /\bpadding:\s*12px\s+8px\s*;/)
  assert.match(footer, /\bpadding:\s*10px\s+8px\s*;/)
  assert.match(actions, /\bpadding:\s*6px\s+12px\s*;/)
  assert.match(actions, /\bmin-height:\s*28px\s*;/)
})

test('floating CSS has native frosted enhancement and a solid theme fallback', () => {
  const card = declarations('.dshgg-root .dshgg-floating-panel')
  assert.match(card, /\bborder-radius:\s*var\(--dsw-[^;]+;/)
  assert.match(card, /\bbox-shadow:\s*var\(--dsw-[^;]*elevation-prominent[^;]*\)\s*;/)
  const fallback = declarations(
    '.dshgg-root .dshgg-floating-panel',
    supportBlocks().reduce((source, block) => source.replace(block, ''), css),
  )
  assert.match(
    fallback,
    /\bbackground(?:-color)?:\s*var\(--dsw-alias-bg-layer-1\)\s*;/,
    'the unfiltered card uses the native solid layer, not the translucent menu fill',
  )
  assert.doesNotMatch(
    fallback,
    /\bbackground(?:-color)?:[^;]*(?:transparent|color-mix)/,
    'solid readability does not depend on backdrop filtering support',
  )
  const filtered = supportBlocks().filter((block) => block.includes('.dshgg-floating-panel'))
  assert.ok(
    filtered.some((block) => /@supports[^{}]*backdrop-filter/.test(block)),
    'frosting is a progressive enhancement behind feature detection',
  )
  assert.ok(
    filtered.some((block) =>
      /backdrop-filter:\s*var\(--dsw-[^;]*backdrop-filter[^;]*\)/.test(block),
    ),
  )
  assert.ok(
    filtered.some((block) =>
      /background(?:-color)?:[^;]*(?:color-mix\(|var\(--dsw-[^;]*menu)/.test(block),
    ),
  )
  const floating = rules
    .filter((rule) => rule.selectors.some((selector) => selector.includes('.dshgg-floating-')))
    .map((rule) => rule.declarations)
    .join('\n')
  assert.doesNotMatch(
    floating,
    /#[\da-f]{3,8}\b|\brgba?\(|\bhsla?\(/i,
    'surface colors and effects derive from host theme tokens, not fixed colors',
  )
})

test('floating CSS scrolls short-panel content while keeping a wrapping footer reachable', () => {
  const card = declarations('.dshgg-root .dshgg-floating-panel')
  const body = declarations('.dshgg-root .dshgg-floating-panel-body')
  const footer = declarations('.dshgg-root .dshgg-floating-panel-footer')
  assert.match(card, /\bdisplay:\s*flex\s*;/)
  assert.match(card, /\bflex-direction:\s*column\s*;/)
  assert.match(card, /\bmin-height:\s*0\s*;/)
  assert.match(card, /\boverflow-x:\s*hidden\s*;/)
  assert.match(
    card,
    /\boverflow-y:\s*auto\s*;/,
    'the whole card can scroll as an extreme fallback when wrapped actions exceed its height',
  )
  assert.doesNotMatch(
    card,
    /\boverflow:\s*(?:hidden|clip)\s*;/,
    'a nonshrinking oversized footer must never be permanently clipped',
  )
  assert.match(body, /\bmin-height:\s*0\s*;/)
  assert.match(body, /\boverflow-y:\s*auto\s*;/)
  assert.match(body, /\boverflow-x:\s*hidden\s*;/)
  assert.match(body, /\boverflow-wrap:\s*anywhere\s*;/, 'long unbroken filenames and refs can wrap')
  assert.match(footer, /\bflex(?:-shrink)?:\s*(?:none|0(?:\s+0\s+auto)?)\s*;/)
  assert.match(footer, /\bflex-wrap:\s*wrap\s*;/)
  assert.match(footer, /\bmin-width:\s*0\s*;/)
  const actions = declarations('.dshgg-root .dshgg-floating-panel-footer .dshgg-btn')
  assert.match(
    actions,
    /\bwhite-space:\s*normal\s*;/,
    'localized labels are not clipped to one line',
  )
  assert.match(actions, /\boverflow-wrap:\s*anywhere\s*;/)
  assert.match(actions, /\bheight:\s*auto\s*;/)
  assert.match(actions, /\bmax-width:\s*100%\s*;/)
  const fields = declarations('.dshgg-dialogInput')
  assert.match(fields, /\bmin-width:\s*0\s*;/)
  assert.match(fields, /\bwidth:\s*100%\s*;/)
  assert.match(fields, /\bbox-sizing:\s*border-box\s*;/)
})
