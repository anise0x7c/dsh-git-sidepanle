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

// The details card's surface and the toolbar's activity bar live in their own
// sheets, so every sheet that can change their motion is searched.
const css = [
  readSheet('motion.css'),
  readSheet('commit-detail.css'),
  readSheet('toolbar.css'),
].join('\n')

/**
 * Read the declarations of one leaf rule.
 * @param selector - the exact selector text of the rule.
 * @param source - stylesheet text; defaults to both searched sheets.
 * @returns its declarations joined across repeats in source order.
 */
function declarations(selector: string, source = css): string {
  const found = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
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
  assert.doesNotMatch(card, /\bbox-shadow\s*:/, 'the card no longer paints a shadow')
  assert.match(card, /\bpointer-events:\s*auto\s*;/)
  const leaveCard = declarations(
    '.dshgg-root .dshgg-commitMotion[data-phase="leave"] .dshgg-commitCard',
  )
  assert.match(leaveCard, /\bpointer-events:\s*none\s*;/, 'a leaving card takes no input')
  assert.match(keyframes('dshgg-details-enter'), /translateX\(calc\(100% \+ \d+px\)\)/)
  assert.match(keyframes('dshgg-details-leave'), /translateX\(calc\(100% \+ \d+px\)\)/)
})

test('the details card borrows the operation prompt native frosted material', () => {
  const supportsAt = css.indexOf('@supports (backdrop-filter: blur(1px))')
  assert.ok(supportsAt !== -1, 'frosting is a progressive enhancement behind feature detection')
  const fallback = css.slice(0, supportsAt)
  const card = declarations('.dshgg-root .dshgg-commitCard', fallback)
  assert.match(card, /\bbackground:\s*var\(--dsw-alias-bg-layer-1\)\s*;/, 'a solid theme surface')
  assert.doesNotMatch(card, /\bbackdrop-filter\s*:/, 'the fallback needs no filtering')

  const filtered = css.slice(supportsAt)
  const frosted = declarations('.dshgg-root .dshgg-commitCard', filtered)
  assert.match(
    frosted,
    /\bbackground:\s*var\(--dsw-specific-menu, var\(--dsw-alias-bg-layer-1\)\)\s*;/,
    'the card uses the shared translucent menu surface',
  )
  assert.match(frosted, /\bbackdrop-filter:\s*var\(--dsw-menu-backdrop-filter\)\s*;/)
  assert.match(frosted, /-webkit-backdrop-filter:\s*var\(--dsw-menu-backdrop-filter\)\s*;/)
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

test('the toolbar loading bar sweeps its track and stills under reduced motion', () => {
  const track = declarations('.dshgg-progress')
  assert.match(track, /\bposition:\s*absolute\s*;/, 'the bar does not take toolbar layout height')
  assert.match(track, /\bbottom:\s*0\s*;/, 'the bar rides the toolbar edge')
  assert.match(track, /\boverflow:\s*hidden\s*;/, 'the track clips the moving segment')
  assert.match(track, /\bpointer-events:\s*none\s*;/, 'the indicator takes no input')
  const bar = declarations('.dshgg-progressBar')
  assert.match(bar, /\banimation:\s*dshgg-progress-slide\s+[^;]+\s+infinite\s*;/)
  assert.match(bar, /\bbackground:\s*var\(--dsw-[^;]+;/, 'the bar uses a host theme token')
  const sweep = keyframes('dshgg-progress-slide')
  assert.match(sweep, /translateX\(-100%\)/, 'the segment starts beyond the left edge')
  assert.match(sweep, /translateX\(\d+%\)/, 'the segment ends beyond the right edge')
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(
    declarations('.dshgg-progressBar', reduced),
    /\banimation:\s*none\s*;/,
    'reduced motion holds the bar still',
  )
})

test('motion styles derive from layout, not from fixed colors', () => {
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|\brgba?\(|\bhsla?\(/i)
  assert.ok(Number.isInteger(PROMPT_MOTION_MS) && PROMPT_MOTION_MS > 0)
  assert.ok(Number.isInteger(DETAILS_MOTION_MS) && DETAILS_MOTION_MS > 0)
})
