/**
 * Pure grouping for the three working-tree change lists.
 *
 * Each group is one flat list in path order; the display letter depends on the
 * group, so the rows the views receive are copies carrying that letter. No
 * React and no plugin context, so the grouping is directly unit-testable.
 */

import { isStaged, isUnstaged, statusLetter } from '../git/format.ts'
import { sortChangeEntries } from '../git/list.ts'
import type { ChangeEntry, ChangeRow } from '../types/domain.ts'

/** Change group a row belongs to, matching the section and menu section ids. */
export type ChangeGroupMode = 'merge' | 'staged' | 'changes'

/** The three sorted groups the change views render. */
export interface ChangeGroups {
  /** Conflicted files; each row is always `!`. */
  readonly mergeRows: readonly ChangeRow[]
  /** Staged files; each row takes its index half. */
  readonly stagedRows: readonly ChangeRow[]
  /** Unstaged files; an untracked row is `U`, otherwise the worktree half. */
  readonly changedRows: readonly ChangeRow[]
}

/**
 * Display letter of one row in a group. A row listed in the merge group is
 * always `!`; a staged row takes its index half; a working-tree row is `U` when
 * untracked, otherwise its worktree half.
 * @param entry - changed-file row.
 * @param mode - group the row is listed in.
 * @returns display letter the row and its diff tab badge use.
 */
export function changeRowLetter(entry: ChangeEntry, mode: ChangeGroupMode): string {
  if (mode === 'merge') return '!'
  if (mode === 'staged') return statusLetter(entry.x)
  return entry.untracked === true ? 'U' : statusLetter(entry.y)
}

/**
 * Copy one row with the letter its group renders.
 * @param entry - changed-file row.
 * @param mode - group the row is listed in.
 * @returns copied row carrying the display letter.
 */
export function changeRow(entry: ChangeEntry, mode: ChangeGroupMode): ChangeRow {
  return { ...entry, letter: changeRowLetter(entry, mode) }
}

/**
 * Split and sort the status rows into the three groups the panel renders.
 * Conflicts are excluded from the staged and unstaged groups by the staging
 * guards; a row changed in both halves is listed in both, as before.
 * @param files - changed-file rows from the Host status.
 * @returns the sorted rows of all three groups.
 */
export function groupChangeEntries(files: readonly ChangeEntry[]): ChangeGroups {
  const mergeFiles = files.filter((entry) => entry.conflict === true)
  const stagedFiles = files.filter((entry) => isStaged(entry))
  const changedFiles = files.filter((entry) => isUnstaged(entry))
  return {
    mergeRows: sortChangeEntries(mergeFiles).map((entry) => changeRow(entry, 'merge')),
    stagedRows: sortChangeEntries(stagedFiles).map((entry) => changeRow(entry, 'staged')),
    changedRows: sortChangeEntries(changedFiles).map((entry) => changeRow(entry, 'changes')),
  }
}

/**
 * Ids of the change groups a pane actually renders, in display order.
 * @param groups - the three sorted groups.
 * @returns the ids of the groups that have rows, so an empty group takes no
 * section and no header.
 */
export function visibleChangeGroups(groups: ChangeGroups): ChangeGroupMode[] {
  const visible: ChangeGroupMode[] = []
  if (groups.mergeRows.length > 0) visible.push('merge')
  if (groups.stagedRows.length > 0) visible.push('staged')
  if (groups.changedRows.length > 0) visible.push('changes')
  return visible
}
