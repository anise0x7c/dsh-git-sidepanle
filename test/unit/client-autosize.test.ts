/**
 * Direct unit tests for the commit box's content-driven sizing: the pure height
 * rule, and the pass that measures an element and applies it.
 *
 * The element pass runs against a textarea stand-in and a stubbed computed
 * style, so no browser is needed.
 */

import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import {
  autoGrowTextArea,
  COMMIT_MESSAGE_MAX_LINES,
  fitTextArea,
  type TextAreaGeometry,
} from '../../src/client/panel/autosize.ts'

/** The commit box's geometry: 13px/20px text, 6px padding, a hairline border. */
const GEOMETRY: TextAreaGeometry = { lineHeight: 20, padding: 12, border: 1 }

/** Computed style the textarea reports, matching `.dshgg-commitMessage`. */
const COMPUTED_STYLE = {
  lineHeight: '20px',
  fontSize: '13px',
  paddingTop: '6px',
  paddingBottom: '6px',
  borderTopWidth: '0.5px',
  borderBottomWidth: '0.5px',
}

/** Content height the browser reports for `count` visual lines. */
function contentHeight(count: number): number {
  return count * GEOMETRY.lineHeight + GEOMETRY.padding
}

/** Border-box height of a box showing `count` lines. */
function boxHeight(count: number): number {
  return contentHeight(count) + GEOMETRY.border
}

/** A textarea stand-in: the sizing pass reads exactly these members. */
interface FakeArea {
  readonly style: { height: string; overflowY: string }
  scrollHeight: number
  clientWidth: number
}

/** Build one textarea stand-in. */
function fakeArea(scrollHeight: number, clientWidth = 300): FakeArea {
  return { style: { height: 'auto', overflowY: 'hidden' }, scrollHeight, clientWidth }
}

/** Build the element the sizing pass expects from a stand-in. */
function asTextArea(area: FakeArea): HTMLTextAreaElement {
  return area as unknown as HTMLTextAreaElement
}

/** Browser globals the pass reads, each restorable to an explicit `undefined`. */
interface StubbedGlobals {
  getComputedStyle?: ((element: Element) => CSSStyleDeclaration) | undefined
  ResizeObserver?: typeof ResizeObserver | undefined
}

const globals = globalThis as unknown as StubbedGlobals
const savedComputedStyle = globals.getComputedStyle
const savedResizeObserver = globals.ResizeObserver

/** Observers the stubbed constructor created, in creation order. */
const observers: FakeResizeObserver[] = []

/** Resize observer stand-in that lets a test report one resize. */
class FakeResizeObserver {
  readonly targets: Element[] = []
  disconnected = false
  constructor(readonly callback: ResizeObserverCallback) {
    observers.push(this)
  }

  observe(target: Element): void {
    this.targets.push(target)
  }

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true
  }

  /** Report one resize of the observed box. */
  report(): void {
    this.callback([], this as unknown as ResizeObserver)
  }
}

/** Install the browser globals the element pass reads. */
function installBrowserGlobals(): void {
  globals.getComputedStyle = () => COMPUTED_STYLE as unknown as CSSStyleDeclaration
  globals.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver
}

afterEach(() => {
  globals.getComputedStyle = savedComputedStyle
  globals.ResizeObserver = savedResizeObserver
  observers.length = 0
})

describe('sizing a textarea to its content', () => {
  test('a one-line message sits in one line', () => {
    assert.deepEqual(fitTextArea(contentHeight(1), GEOMETRY), {
      height: boxHeight(1),
      scrolls: false,
    })
  })

  test('every visual line the message wraps onto adds one line of height', () => {
    assert.deepEqual(fitTextArea(contentHeight(4), GEOMETRY), {
      height: boxHeight(4),
      scrolls: false,
    })
  })

  test('content shorter than one line still gets one line', () => {
    assert.deepEqual(fitTextArea(GEOMETRY.padding, GEOMETRY), {
      height: boxHeight(1),
      scrolls: false,
    })
  })

  test('the box stops at ten lines and starts scrolling', () => {
    assert.equal(COMMIT_MESSAGE_MAX_LINES, 10)
    assert.deepEqual(fitTextArea(contentHeight(10), GEOMETRY), {
      height: boxHeight(10),
      scrolls: false,
    })
    assert.deepEqual(fitTextArea(contentHeight(40), GEOMETRY), {
      height: boxHeight(10),
      scrolls: true,
    })
  })

  test('an unreadable line height grows to the content instead of collapsing', () => {
    assert.deepEqual(fitTextArea(200, { lineHeight: 0, padding: 12, border: 1 }), {
      height: 213,
      scrolls: false,
    })
  })
})

describe('applying the size to a textarea', () => {
  test('a wrapped message sets its line height and hides overflow', () => {
    installBrowserGlobals()
    const area = fakeArea(contentHeight(4))
    autoGrowTextArea(asTextArea(area))
    assert.equal(area.style.height, `${boxHeight(4)}px`)
    assert.equal(area.style.overflowY, 'hidden')
  })

  test('a message past ten lines keeps ten lines and scrolls', () => {
    installBrowserGlobals()
    const area = fakeArea(contentHeight(30))
    autoGrowTextArea(asTextArea(area))
    assert.equal(area.style.height, `${boxHeight(10)}px`)
    assert.equal(area.style.overflowY, 'auto')
  })

  test('a narrower box re-measures the same message, a taller one does not', () => {
    installBrowserGlobals()
    const area = fakeArea(contentHeight(2), 320)
    const detach = autoGrowTextArea(asTextArea(area))
    const observer = observers[0]
    assert.ok(observer !== undefined, 'no width watcher was installed')
    assert.deepEqual(observer.targets, [asTextArea(area)])

    area.scrollHeight = contentHeight(6)
    area.clientWidth = 220
    observer.report()
    assert.equal(area.style.height, `${boxHeight(6)}px`)

    // The height change a measurement causes must not re-enter the pass.
    area.style.height = 'unmeasured'
    observer.report()
    assert.equal(area.style.height, 'unmeasured')

    detach()
    assert.equal(observer.disconnected, true)
  })

  test('without a resize observer the first measurement still applies', () => {
    globals.getComputedStyle = () => COMPUTED_STYLE as unknown as CSSStyleDeclaration
    globals.ResizeObserver = undefined
    const area = fakeArea(contentHeight(3))
    const detach = autoGrowTextArea(asTextArea(area))
    assert.equal(area.style.height, `${boxHeight(3)}px`)
    assert.equal(observers.length, 0)
    detach()
  })
})
