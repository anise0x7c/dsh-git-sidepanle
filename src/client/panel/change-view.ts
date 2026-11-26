/**
 * Pure view state for the change groups: which file view the Workspace menu
 * selects and which folders each group's tree hides. No React and no plugin
 * context, so the folder rules are directly unit-testable.
 */

import type { ChangeGroupMode } from './change-groups.ts'

/** Collapsed folder paths of every group, keyed by group id. */
export type CollapsedFolders = Readonly<Record<ChangeGroupMode, ReadonlySet<string>>>

/** State used before the user collapses any folder. */
export const NO_COLLAPSED_FOLDERS: CollapsedFolders = {
  merge: new Set(),
  staged: new Set(),
  changes: new Set(),
}

/**
 * Collapse or expand one folder of one group's tree. The other groups keep
 * their own sets, so a folder shared by two groups toggles independently.
 * @param current - collapsed folders per group.
 * @param mode - group that owns the folder.
 * @param path - repository-relative folder path.
 * @returns the next per-group state.
 */
export function toggleCollapsedFolder(
  current: CollapsedFolders,
  mode: ChangeGroupMode,
  path: string,
): CollapsedFolders {
  const next = new Set(current[mode])
  if (next.has(path)) next.delete(path)
  else next.add(path)
  return { ...current, [mode]: next }
}
