/**
 * Near-end detection for the panel's scrolling panes.
 *
 * Pure and DOM-free: the panel passes the scroll metrics of one pane, so the
 * rule stays unit-testable without a browser.
 */

/** Distance from the end, in pixels, at which a pane starts loading its next page. */
export const NEAR_END_PX = 24

/** Scroll metrics of one pane. */
export interface ScrollPosition {
  /** Pixels the content is scrolled down. */
  readonly scrollTop: number
  /** Visible height of the pane in pixels. */
  readonly clientHeight: number
  /** Total height of the pane's content in pixels. */
  readonly scrollHeight: number
}

/**
 * Whether a pane is close enough to its end that the next page should load.
 * Scrolling fires slightly before the exact bottom and browsers may report
 * fractional offsets, so the rule keeps a small margin instead of comparing
 * for equality.
 * @param position - scroll metrics of the pane.
 * @returns true when the remaining distance is at most {@link NEAR_END_PX}.
 */
export function isNearEnd(position: ScrollPosition): boolean {
  return position.scrollHeight - position.scrollTop - position.clientHeight <= NEAR_END_PX
}
