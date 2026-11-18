/** Structural motion regressions; these do not measure browser animation. */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DETAILS_MOTION_MS, PROMPT_MOTION_MS } from '../../src/client/constants.ts'

const css = readFileSync(
  new URL('../../src/client/styles/motion.css', import.meta.url),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '')

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
  assert.match(wrapper, /\bdisplay:\s*contents\s*;/, 'the motion wrapper has no box of its own')
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
  const enter = declarations('.dshgg-commitMotion[data-phase="enter"]')
  const leave = declarations('.dshgg-commitMotion[data-phase="leave"]')
  assert.match(
    enter,
    new RegExp(`\\banimation:\\s*dshgg-details-enter\\s+${DETAILS_MOTION_MS}ms\\b`),
  )
  assert.match(
    leave,
    new RegExp(`\\banimation:\\s*dshgg-details-leave\\s+${DETAILS_MOTION_MS}ms\\b`),
  )
  assert.match(leave, /\bpointer-events:\s*none\s*;/)
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
