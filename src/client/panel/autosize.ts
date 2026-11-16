/**
 * Content-driven sizing for the commit message box.
 *
 * {@link fitTextArea} is the pure height rule and {@link autoGrowTextArea} the
 * only function that touches an element, so the arithmetic stays unit-testable
 * without a browser or a real textarea.
 */

/** Lines the commit message box shows before its message starts scrolling. */
export const COMMIT_MESSAGE_MAX_LINES = 10

/** Vertical box measurements of a textarea, in pixels. */
export interface TextAreaGeometry {
  /** Height of one line of text. */
  readonly lineHeight: number
  /** Padding above and below the text, together. */
  readonly padding: number
  /** Border width above and below the box, together. */
  readonly border: number
}

/** Size a textarea needs for the content it holds. */
export interface TextAreaFit {
  /** Border-box height to apply, in pixels. */
  readonly height: number
  /** Whether the content is taller than the last visible line. */
  readonly scrolls: boolean
}

/**
 * Fit a textarea's border-box height to its content, between one line and
 * `maxLines` lines.
 * @param contentHeight - content height the browser reports, padding included
 * and border excluded, as `scrollHeight` does.
 * @param geometry - the box's vertical measurements.
 * @param maxLines - last line the box grows to before the content scrolls.
 * @returns the height to apply and whether the content needs scrolling.
 */
export function fitTextArea(
  contentHeight: number,
  geometry: TextAreaGeometry,
  maxLines: number = COMMIT_MESSAGE_MAX_LINES,
): TextAreaFit {
  const { lineHeight, padding, border } = geometry
  if (!(lineHeight > 0)) {
    // Without a readable line height the box cannot be counted in lines;
    // showing the whole message beats collapsing it to its padding.
    return { height: contentHeight + padding + border, scrolls: false }
  }
  const tallest = lineHeight * Math.max(1, maxLines) + padding
  const height = Math.min(Math.max(contentHeight, lineHeight + padding), tallest) + border
  return { height, scrolls: contentHeight > tallest }
}

/**
 * Read one computed length as pixels.
 * @param value - a computed style value such as `'20px'`.
 * @returns the pixel count, or 0 when the value is not a length.
 */
function pixels(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Make a textarea follow its content and the width it is given: as tall as the
 * text needs, one line at the least and {@link COMMIT_MESSAGE_MAX_LINES} lines
 * at the most.
 * @param area - the textarea to size.
 * @returns a function that stops watching the box's width.
 */
export function autoGrowTextArea(area: HTMLTextAreaElement): () => void {
  const grow = (): void => {
    // `auto` reports the height the content needs, not the height the previous
    // pass applied, so every measurement starts from the same state.
    area.style.height = 'auto'
    const style = getComputedStyle(area)
    const fit = fitTextArea(area.scrollHeight, {
      // The stylesheet sets the line height through the font shorthand; the
      // fallback only matters if a future font leaves it at `normal`.
      lineHeight: pixels(style.lineHeight) || pixels(style.fontSize) * 1.5,
      padding: pixels(style.paddingTop) + pixels(style.paddingBottom),
      border: pixels(style.borderTopWidth) + pixels(style.borderBottomWidth),
    })
    area.style.height = `${fit.height}px`
    area.style.overflowY = fit.scrolls ? 'auto' : 'hidden'
  }
  grow()
  if (typeof ResizeObserver === 'undefined') return () => {}
  let width = area.clientWidth
  const observer = new ResizeObserver(() => {
    // A height change also resizes the box, and re-measuring on it would loop
    // through `height: auto`; only a width change can rewrap the text.
    if (area.clientWidth === width) return
    width = area.clientWidth
    grow()
  })
  observer.observe(area)
  return () => {
    observer.disconnect()
  }
}
