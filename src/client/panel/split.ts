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
