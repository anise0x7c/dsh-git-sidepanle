// @ts-check
/**
 * Pure ordering for the browser half's flat change lists.
 *
 * The three change groups and a commit's changed files are single-layer lists,
 * so the only structural decision left is their display order: by
 * repository-relative path. `format.js` owns the row fields the list carries.
 */

/** @typedef {import('./format.js').ChangeEntry} ChangeEntry */

/**
 * Sort changed-file rows into the panel's single-layer display order.
 * Paths compare case-insensitively with numeric runs compared as numbers, so
 * `a2.js` precedes `a10.js`; equal paths keep their input order. The input
 * array is not mutated.
 * @param {ChangeEntry[]} entries - changed-file rows.
 * @returns {ChangeEntry[]} a new array in display order.
 */
export function sortChangeEntries(entries) {
  const collator = { numeric: true, sensitivity: 'base' }
  return [...entries].sort((left, right) => left.path.localeCompare(right.path, undefined, collator))
}
