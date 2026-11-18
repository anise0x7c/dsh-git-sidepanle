/** Structural motion regressions; these do not measure browser animation. */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DETAILS_MOTION_MS, PROMPT_MOTION_MS } from '../../src/client/constants.ts'

const readSheet = (name: string): string =>
  readFileSync(new URL(`../../src/client/styles/${name}`, import.meta.url), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  )

// The details card's surface lives in its own sheet, so both are searched.
const css = [readSheet('motion.css'), readSheet('commit-detail.css')].join('\n')

/**
 * Read the declarations of one leaf rule.
 * @param selector - the exact selector text of the rule.
 * @returns its declarations joined across repeats in source order.
 */
function declarations(selector: string): string {
  const found = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => (match[1] ?? '').trim() === selector)
    .map((match) => match[2] ?? '')
  assert.ok(found.length > 0, `missing motion rule for ${selector}`)
  return found.join('\n')
}

/** Read one keyframe body. */
function keyframes(name: string): string {
  const body = new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1]
  assert.ok(body !== undefined, `missing @keyframes ${name}`)
  return body
}

test('the operation prompt rises from the pane bottom and lowers away again', () => {
  const wrapper = declarations('.dshgg-root .dshgg-promptMotion')
  assert.match(wrapper, /\bposition:\s*absolute\s*;/, 'the motion box lies out of flow')
  assert.match(wrapper, /\binset:\s*0\s*;/, 'it spans the pane it clips')
  assert.match(
    wrapper,
    /\boverflow:\s*clip\s*;/,
    'a translated card must not extend an ancestor scroll area or be scrolled into view',
  )
  assert.doesNotMatch(wrapper, /\bdisplay:\s*contents\s*;/)
  assert.match(wrapper, /\bpointer-events:\s*none\s*;/, 'the box passes pointer input through')
  const enter = declarations(
    '.dshgg-root .dshgg-promptMotion[data-phase="enter"] .dshgg-floating-panel',
  )
  const leave = declarations(
    '.dshgg-root .dshgg-promptMotion[data-phase="leave"] .dshgg-floating-panel',
  )
  assert.match(enter, new RegExp(`\\banimation:\\s*dshgg-prompt-rise\\s+${PROMPT_MOTION_MS}ms\\b`))
  assert.match(enter, /\bboth\b/, 'the entering card keeps its final position')
  assert.match(leave, new RegExp(`\\banimation:\\s*dshgg-prompt-lower\\s+${PROMPT_MOTION_MS}ms\\b`))
  assert.match(leave, /\bpointer-events:\s*none\s*;/, 'a leaving prompt takes no input')
  assert.match(keyframes('dshgg-prompt-rise'), /translateY\(calc\(100% \+ \d+px\)\)/)
  assert.match(keyframes('dshgg-prompt-lower'), /translateY\(calc\(100% \+ \d+px\)\)/)
})

test('the commit details view travels in from the right edge and back out', () => {
  const wrapper = declarations('.dshgg-root .dshgg-commitMotion')
  assert.match(wrapper, /\bposition:\s*absolute\s*;/, 'the card overlays the content')
  assert.match(wrapper, /\binset:\s*4px\s*;/, 'it keeps the pane edge gap')
  assert.match(wrapper, /\bz-index:\s*15\s*;/, 'it sits above the content and below the prompt')
  assert.match(wrapper, /\bpointer-events:\s*none\s*;/, 'the layer passes input to the card')
  const enter = declarations('.dshgg-root .dshgg-commitMotion[data-phase="enter"]')
  const leave = declarations('.dshgg-root .dshgg-commitMotion[data-phase="leave"]')
  assert.match(
    enter,
    new RegExp(`\\banimation:\\s*dshgg-details-enter\\s+${DETAILS_MOTION_MS}ms\\b`),
  )
  assert.match(
    leave,
    new RegExp(`\\banimation:\\s*dshgg-details-leave\\s+${DETAILS_MOTION_MS}ms\\b`),
  )
  assert.match(leave, /\bpointer-events:\s*none\s*;/)
  const card = declarations('.dshgg-root .dshgg-commitCard')
  assert.match(card, /\bbackground:\s*var\(--dsw-alias-bg-layer-1\)\s*;/)
  assert.match(card, /\bborder:\s*0\.5px\s+solid\s+var\(--dsw-alias-border-l1\)\s*;/)
  assert.match(card, /\bbox-shadow:\s*var\(--dsw-elevation-prominent\)\s*;/)
  assert.match(card, /\bpointer-events:\s*auto\s*;/)
  const leaveCard = declarations(
    '.dshgg-root .dshgg-commitMotion[data-phase="leave"] .dshgg-commitCard',
  )
  assert.match(leaveCard, /\bpointer-events:\s*none\s*;/, 'a leaving card takes no input')
  assert.match(keyframes('dshgg-details-enter'), /translateX\(calc\(100% \+ \d+px\)\)/)
  assert.match(keyframes('dshgg-details-leave'), /translateX\(calc\(100% \+ \d+px\)\)/)
})

test('reduced motion keeps both surfaces still', () => {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)')
  assert.ok(start !== -1, 'the motion sheet honors the system preference')
  const reduced = css.slice(start)
  assert.match(
    reduced,
    /\.dshgg-promptMotion\[data-phase\][^{]*\.dshgg-floating-panel[^{]*\{[^}]*animation:\s*none\s*;/,
  )
  assert.match(reduced, /\.dshgg-commitMotion\[data-phase\][^{]*\{[^}]*animation:\s*none\s*;/)
})

test('motion styles derive from layout, not from fixed colors', () => {
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|\brgba?\(|\bhsla?\(/i)
  assert.ok(Number.isInteger(PROMPT_MOTION_MS) && PROMPT_MOTION_MS > 0)
  assert.ok(Number.isInteger(DETAILS_MOTION_MS) && DETAILS_MOTION_MS > 0)
})
