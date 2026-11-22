/**
 * Pure rules for the resizable change/history split: the allowed ratio range,
 * pointer-to-ratio mapping and keyboard steps. No React and no DOM.
 */

/** Default share of the split height given to the change pane. */
export const DEFAULT_SPLIT_RATIO = 0.5

/** Smallest share either pane may take, so both stay usable. */
export const MIN_SPLIT_RATIO = 0.2

/** Largest share the change pane may take. */
export const MAX_SPLIT_RATIO = 0.8

/** Ratio change for one arrow-key press. */
export const SPLIT_STEP = 0.05

/**
 * Clamp one ratio to the usable range.
 * @param ratio - requested share of the change pane.
 * @returns a finite ratio between the minimum and the maximum.
 */
export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return DEFAULT_SPLIT_RATIO
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio))
}

/**
 * Translate a pointer drag into a clamped split ratio.
 * @param startRatio - ratio held when the drag began.
 * @param startY - client Y where the drag began.
 * @param clientY - current client Y.
 * @param height - split container height.
 * @returns the requested ratio, or the starting ratio when the container has no height.
 */
export function dragSplitRatio(
  startRatio: number,
  startY: number,
  clientY: number,
  height: number,
): number {
  if (
    !Number.isFinite(startY) ||
    !Number.isFinite(clientY) ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    return clampSplitRatio(startRatio)
  }
  return clampSplitRatio(startRatio + (clientY - startY) / height)
}

/** Inline flex sizing of one split pane. */
export interface PaneSizing {
  /** `flex` shorthand that replaces the pane's stylesheet default. */
  readonly flex?: string
  /** Share of the split height, used while both panes are expanded. */
  readonly flexBasis?: string
}

/** How the two panes are sized and whether the divider is offered. */
export interface SplitSizing {
  /** Inline style of the change pane. */
  readonly changes: PaneSizing
  /** Inline style of the graph pane. */
  readonly graph: PaneSizing
  /** Whether the divider between the panes is offered. */
  readonly divider: boolean
}

/**
 * Whether every section a pane renders is collapsed.
 * @param sections - ids of the sections the pane renders, in display order.
 * @param open - open state per section id.
 * @returns true when the pane renders at least one section and none is open.
 */
export function allSectionsCollapsed(
  sections: readonly string[],
  open: Readonly<Record<string, boolean>>,
): boolean {
  return sections.length > 0 && sections.every((id) => open[id] !== true)
}

/**
 * Size the two panes. A pane whose sections are all collapsed keeps only their
 * headers instead of its share of the split, so the other pane takes the room
 * and the divider is not offered; the ratio is untouched and comes back with
 * the first expanded section.
 * @param options - split ratio and which panes are collapsed.
 * @returns inline sizing of both panes and the divider's visibility.
 */
export function splitSizing(options: {
  readonly ratio: number
  readonly changesCollapsed: boolean
  readonly graphCollapsed: boolean
}): SplitSizing {
  const ratio = clampSplitRatio(options.ratio)
  const percent = `${Math.round(ratio * 1000) / 10}%`
  return {
    // The graph rests last in the split, so when it keeps only its header the
    // change pane takes every remaining pixel whether or not it is collapsed
    // itself; that keeps the graph header at the panel's bottom edge either way.
    changes: options.graphCollapsed
      ? { flex: '1 1 0' }
      : options.changesCollapsed
        ? { flex: '0 0 auto' }
        : { flexBasis: percent },
    graph: options.graphCollapsed ? { flex: '0 0 auto' } : {},
    divider: !options.changesCollapsed && !options.graphCollapsed,
  }
}

/**
 * Apply a keyboard gesture to the split ratio.
 * @param ratio - current share of the change pane.
 * @param key - `KeyboardEvent.key`.
 * @returns the next ratio, or null when the key is not a resize gesture.
 */
export function adjustSplitRatio(ratio: number, key: string): number | null {
  if (key === 'ArrowUp') return clampSplitRatio(ratio - SPLIT_STEP)
  if (key === 'ArrowDown') return clampSplitRatio(ratio + SPLIT_STEP)
  if (key === 'PageUp') return clampSplitRatio(ratio - SPLIT_STEP * 2)
  if (key === 'PageDown') return clampSplitRatio(ratio + SPLIT_STEP * 2)
  if (key === 'Home') return MIN_SPLIT_RATIO
  if (key === 'End') return MAX_SPLIT_RATIO
  return null
}
