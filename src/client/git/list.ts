/**
 * Pure ordering for the browser half's flat change lists.
 *
 * The three change groups and a commit's changed files are single-layer lists,
 * so the only structural decision left is their display order: by
 * repository-relative path. `format.ts` owns the row fields the list carries.
 */

/**
 * Sort rows into the panel's single-layer display order.
 * Paths compare case-insensitively with numeric runs compared as numbers, so
 * `a2.js` precedes `a10.js`; equal paths keep their input order. The input
 * array is not mutated.
 * @param entries - rows carrying a repository-relative path.
 * @returns a new array in display order.
 */
export function sortChangeEntries<Entry extends { path: string }>(
  entries: readonly Entry[],
): Entry[] {
  const collator: Intl.CollatorOptions = { numeric: true, sensitivity: 'base' }
  return [...entries].sort((left, right) =>
    left.path.localeCompare(right.path, undefined, collator),
  )
}
