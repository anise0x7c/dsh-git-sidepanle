/**
 * Change-group view state: the file view the Workspace menu selects and the
 * folders each group's tree hides. It lives with the mounted panel, so a
 * refresh, a collapsed section or the details card never resets it, while
 * closing the tab starts again from the flat list.
 */

import { useCallback, useState } from 'react'
import type { ChangeView } from '../../types/domain.ts'
import type { ChangeGroupMode } from '../change-groups.ts'
import type { CollapsedFolders } from '../change-view.ts'
import { NO_COLLAPSED_FOLDERS, toggleCollapsedFolder } from '../change-view.ts'

/** Change-group view state and its handlers. */
export interface ChangeViewState {
  /** File view every group renders. */
  readonly view: ChangeView
  /** Folders each group's tree hides. */
  readonly collapsedFolders: CollapsedFolders
  /** Switch every group to one file view. */
  readonly setView: (view: ChangeView) => void
  /** Collapse or expand one folder of one group. */
  readonly toggleFolder: (mode: ChangeGroupMode, path: string) => void
}

/**
 * Own the change groups' file view and their folder expansion state.
 * @returns the view in effect, the per-group collapsed folders and their setters.
 */
export function useChangeView(): ChangeViewState {
  const [view, setView] = useState<ChangeView>('list')
  const [collapsedFolders, setCollapsedFolders] = useState<CollapsedFolders>(NO_COLLAPSED_FOLDERS)
  const toggleFolder = useCallback((mode: ChangeGroupMode, path: string): void => {
    setCollapsedFolders((current) => toggleCollapsedFolder(current, mode, path))
  }, [])
  return { view, collapsedFolders, setView, toggleFolder }
}
