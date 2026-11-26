/**
 * One changed-file row plus the flat-list and tree renderers shared by the
 * change groups and the commit-details view.
 */

import type React from 'react'
import { createElement } from 'react'
import { splitPath, statusKey } from '../git/format.ts'
import type { FileTreeFolderRow, FileTreeRow } from '../git/tree.ts'
import { HostFileIcon } from '../host-file-icon.ts'
import { ChevronRightIcon, MinusIcon, PlusIcon, UndoIcon } from '../icons.ts'
import type { MenuTarget, MenuTriggerFactory } from '../menu/trigger.ts'
import type { LocaleBinder } from '../types/dsh.ts'
import { IconButton } from './controls.ts'

const h = createElement

/** Pixels one nesting level adds to a row's left inset. */
export const ROW_INDENT = 14

/** The fields a flat file row renders; working-tree and commit rows both fit. */
export interface FileRowEntry {
  /** Source family used in the element key. */
  readonly kind: string
  /** Index status character, when the row is a working-tree change. */
  readonly x?: string
  /** Worktree status character, when the row is a working-tree change. */
  readonly y?: string
  /** Repository-relative path. */
  readonly path: string
  /** Rename/copy source path. */
  readonly origPath?: string
  /** Display letter for the row's group. */
  readonly letter?: string
}

/** Group a flat file row belongs to. */
export type FileRowMode = 'merge' | 'staged' | 'changes' | 'commit'

/** Props of one file row. */
export interface FileRowProps<Entry extends FileRowEntry = FileRowEntry> {
  /** Row data. */
  readonly entry: Entry
  /** Display letter for the row's group. */
  readonly letter: string
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Whether an action is running. */
  readonly busy?: boolean
  /** Group the row belongs to. */
  readonly mode: FileRowMode
  /** Open the row's diff. */
  readonly onOpen: (entry: Entry) => void
  /** Stage the row. */
  readonly onStage: (entry: Entry) => void
  /** Unstage the row. */
  readonly onUnstage: (entry: Entry) => void
  /** Ask to discard the row. */
  readonly onDiscard?: (entry: Entry) => void
  /** Host trigger binding; null or absent disables the row menu. */
  readonly menuTrigger?: MenuTriggerFactory | null
  /** Captured menu target for this row. */
  readonly menuTarget?: MenuTarget
  /** Rendered nesting level; omitted for flat lists. */
  readonly depth?: number
  /** Extra left inset in pixels for rows nested under a parent section. */
  readonly indent?: number
  /** Whether to show the trailing dimmed directory; defaults to true. */
  readonly showDirectory?: boolean
}

/**
 * Render the file name with its parent directory on one line: the name keeps
 * the primary weight, and the dimmed directory keeps two equally named files
 * distinguishable in a flat list. The commit-details tree hides that directory
 * because its folder rows already carry the structure. The full path stays in
 * the row tooltip and in its accessible label.
 * @param props - file-row props.
 * @returns the row element.
 */
export function FileRow<Entry extends FileRowEntry>(
  props: FileRowProps<Entry>,
): React.ReactElement {
  const entry = props.entry
  const letter = props.letter
  const { dir, name } = splitPath(entry.path)
  const actionButtons: React.ReactNode[] = []
  if (props.mode === 'commit') {
    // Historical rows have no staging or discarding actions: the commit is
    // already recorded, so the row only opens its diff.
  } else if (props.mode === 'staged') {
    actionButtons.push(
      h(
        IconButton,
        {
          key: 'unstage',
          label: props.t('actions.unstage'),
          title: props.t('actions.unstage'),
          disabled: props.busy === true,
          onClick: (event) => {
            event.stopPropagation()
            props.onUnstage(entry)
          },
        },
        h(MinusIcon, { size: 14 }),
      ),
    )
  } else {
    actionButtons.push(
      h(
        IconButton,
        {
          key: 'stage',
          label: props.t('actions.stage'),
          title: props.t('actions.stage'),
          disabled: props.busy === true,
          onClick: (event) => {
            event.stopPropagation()
            props.onStage(entry)
          },
        },
        h(PlusIcon, { size: 14 }),
      ),
    )
    if (props.mode !== 'merge' && typeof props.onDiscard === 'function') {
      actionButtons.push(
        h(
          IconButton,
          {
            key: 'discard',
            label: props.t('actions.discard'),
            title: props.t('actions.discard'),
            disabled: props.busy === true,
            onClick: (event) => {
              event.stopPropagation()
              props.onDiscard?.(entry)
            },
          },
          h(UndoIcon, { size: 14 }),
        ),
      )
    }
  }
  const title = entry.origPath === undefined ? entry.path : `${entry.origPath} → ${entry.path}`
  const keyboard = {
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        props.onOpen(entry)
      }
    },
  }
  const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
  const rowProps: Record<string, unknown> =
    menuTrigger === null || props.menuTarget === undefined
      ? keyboard
      : menuTrigger(props.menuTarget, { ...keyboard, 'aria-haspopup': 'menu' })
  const paddingLeft =
    props.indent === undefined && props.depth === undefined
      ? undefined
      : `${6 + (props.indent ?? 0) + (props.depth ?? 0) * ROW_INDENT}px`
  return h(
    'div',
    {
      className: 'dshgg-row dshgg-fileRow',
      role: 'button',
      tabIndex: 0,
      'aria-label': `${props.t(statusKey(letter))} ${entry.path}`,
      title,
      onClick: () => props.onOpen(entry),
      ...rowProps,
      ...(paddingLeft === undefined ? {} : { style: { paddingLeft } }),
    },
    h('span', { className: 'dshgg-rowIcon' }, h(HostFileIcon, { path: entry.path, size: 16 })),
    h('span', { className: 'dshgg-fileName' }, name),
    entry.origPath === undefined
      ? null
      : h(
          'span',
          { className: 'dshgg-fileArrow', title: entry.origPath },
          `\u2190 ${splitPath(entry.origPath).name}`,
        ),
    dir === '' || props.showDirectory === false
      ? null
      : h('span', { className: 'dshgg-fileDir', title: entry.path }, dir),
    h('span', { className: 'dshgg-fileActions' }, actionButtons),
    h('span', { className: 'dshgg-status', 'data-status': letter }, letter),
  )
}

/** Row wiring shared by every flat list. */
export interface FileRowsContext<Entry extends FileRowEntry> {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Whether an action is running. */
  readonly busy: boolean
  /** Group the rows belong to. */
  readonly mode: FileRowMode
  /** Open one row's diff. */
  readonly onOpen: (entry: Entry) => void
  /** Stage one row. */
  readonly onStage: (entry: Entry) => void
  /** Unstage one row. */
  readonly onUnstage: (entry: Entry) => void
  /** Ask to discard one row. */
  readonly onDiscard: (entry: Entry) => void
  /** Host trigger binding; null disables row menus. */
  readonly menuTrigger: MenuTriggerFactory | null
  /** Captured menu target for one row. */
  readonly menuTarget?: (entry: Entry) => MenuTarget
  /** Extra left inset shared by every row of this list. */
  readonly indent?: number
}

/**
 * Build one file-row element, optionally indented for the folder tree.
 * @param entry - row data.
 * @param context - row wiring.
 * @param treeDepth - nesting level for tree rows; omitted for flat lists.
 * @returns the file-row element.
 */
function fileRowElement<Entry extends FileRowEntry>(
  entry: Entry,
  context: FileRowsContext<Entry>,
  treeDepth?: number,
): React.ReactElement {
  const target = context.menuTarget === undefined ? undefined : context.menuTarget(entry)
  return h(FileRow<Entry>, {
    key: `file:${entry.kind}:${entry.path}:${entry.x}:${entry.y}:${entry.letter ?? ''}`,
    entry,
    letter: entry.letter ?? '',
    t: context.t,
    busy: context.busy,
    mode: context.mode,
    onOpen: context.onOpen,
    onStage: context.onStage,
    onUnstage: context.onUnstage,
    onDiscard: context.onDiscard,
    menuTrigger: context.menuTrigger,
    ...(treeDepth === undefined ? {} : { depth: treeDepth, showDirectory: false }),
    ...(context.indent === undefined ? {} : { indent: context.indent }),
    ...(target === undefined ? {} : { menuTarget: target }),
  })
}

/**
 * Render one flat list of changed-file rows.
 * @param entries - rows in display order, carrying the display `letter` where one applies.
 * @param context - row wiring.
 * @returns one file-row element per entry.
 */
export function renderFileRows<Entry extends FileRowEntry>(
  entries: readonly Entry[],
  context: FileRowsContext<Entry>,
): React.ReactElement[] {
  return entries.map((entry) => fileRowElement(entry, context))
}

/**
 * Render one folder row of the commit-details tree as a disclosure control: an
 * expansion arrow replaces the folder glyph, and the row toggles its whole
 * subtree by pointer, Enter or Space without opening a diff or a menu.
 * @param props - folder row data and its toggle handler.
 * @returns the folder row element.
 */
export function FileFolderRow(props: {
  readonly folder: FileTreeFolderRow
  readonly onToggle: (path: string) => void
  /** Extra left inset in pixels for a tree nested under a parent section. */
  readonly indent?: number
}): React.ReactElement {
  const folder = props.folder
  const open = !folder.collapsed
  return h(
    'div',
    {
      className: 'dshgg-row dshgg-folderRow',
      role: 'button',
      tabIndex: 0,
      'aria-expanded': open,
      title: folder.path,
      style: { paddingLeft: `${6 + (props.indent ?? 0) + folder.depth * ROW_INDENT}px` },
      onClick: () => props.onToggle(folder.path),
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        props.onToggle(folder.path)
      },
    },
    h(
      'span',
      { className: 'dshgg-folderToggle' },
      h(
        'span',
        { className: 'dshgg-chevron', 'data-open': open ? 'true' : 'false' },
        h(ChevronRightIcon, { size: 12 }),
      ),
    ),
    h('span', { className: 'dshgg-folderName' }, folder.label),
  )
}

/** Row wiring of the commit-details folder tree. */
export interface FileTreeContext<Entry extends FileRowEntry> extends FileRowsContext<Entry> {
  /** Collapse or expand one folder row's subtree. */
  readonly onToggleFolder: (path: string) => void
}

/**
 * Render the commit-details folder tree.
 * @param rows - tree rows in display order.
 * @param context - row wiring shared with the flat lists plus the folder toggle.
 * @returns one folder or file row element per row.
 */
export function renderFileTree<Entry extends FileRowEntry>(
  rows: readonly FileTreeRow<Entry>[],
  context: FileTreeContext<Entry>,
): React.ReactElement[] {
  return rows.map((row) =>
    row.type === 'folder'
      ? h(FileFolderRow, {
          key: `folder:${row.path}`,
          folder: row,
          onToggle: context.onToggleFolder,
          ...(context.indent === undefined ? {} : { indent: context.indent }),
        })
      : fileRowElement(row.entry, context, row.depth),
  )
}
