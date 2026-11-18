/**
 * Pure folder-tree builder for the commit-details changed-file list. It groups
 * the flat list into folders and files, collapses unbranched folder chains into
 * a single label, and never touches React or the plugin context.
 */

/** One rendered folder row, with a collapsed chain folded into its label. */
export interface FileTreeFolderRow {
  /** Row kind discriminator. */
  readonly type: 'folder'
  /** Repository-relative path of the chain's deepest folder. */
  readonly path: string
  /** Display label: chain folder names joined by `/`. */
  readonly label: string
  /** Rendered nesting level, root-level rows are 0. */
  readonly depth: number
}

/** One rendered file row. */
export interface FileTreeFileRow<Entry extends { path: string }> {
  /** Row kind discriminator. */
  readonly type: 'file'
  /** The changed-file entry this row renders. */
  readonly entry: Entry
  /** Rendered nesting level, root-level rows are 0. */
  readonly depth: number
}

/** A rendered row of the commit-details file tree. */
export type FileTreeRow<Entry extends { path: string }> = FileTreeFolderRow | FileTreeFileRow<Entry>

/** Mutable folder node used while building the tree. */
interface FolderNode<Entry extends { path: string }> {
  /** Folder name, the last path segment that created it. */
  readonly name: string
  /** Repository-relative path from the tree root to this folder. */
  readonly path: string
  /** Child folders, keyed by name. */
  readonly folders: Map<string, FolderNode<Entry>>
  /** Files directly inside this folder. */
  readonly files: Entry[]
}

/** Name ordering shared by folders and files. */
const NAME_ORDER: Intl.CollatorOptions = { numeric: true, sensitivity: 'base' }

/**
 * Split a repository-relative path into its non-empty segments. Empty segments
 * from doubled, leading or trailing slashes are ignored defensively.
 * @param path - repository-relative path.
 * @returns path segments, empty when the path has none.
 */
function pathSegments(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '')
}

/**
 * Compare two display names numerically and case-insensitively.
 * @param a - first name.
 * @param b - second name.
 * @returns locale comparison result.
 */
function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, NAME_ORDER)
}

/**
 * Take the final non-empty segment of a path.
 * @param path - repository-relative path.
 * @returns file name, or the whole path when it has no segment.
 */
function fileName(path: string): string {
  const segments = pathSegments(path)
  return segments[segments.length - 1] ?? path
}

/**
 * Create the mutable root node; the root itself is never rendered.
 * @returns an empty folder node with an empty path.
 */
function createRoot<Entry extends { path: string }>(): FolderNode<Entry> {
  return { name: '', path: '', folders: new Map(), files: [] }
}

/**
 * Insert one entry below its folder chain, creating missing folders.
 * @param root - mutable tree root.
 * @param entry - changed-file entry to insert.
 */
function insertEntry<Entry extends { path: string }>(root: FolderNode<Entry>, entry: Entry): void {
  const segments = pathSegments(entry.path)
  if (segments.length === 0) return
  let parent = root
  for (const name of segments.slice(0, -1)) {
    let child = parent.folders.get(name)
    if (child === undefined) {
      child = {
        name,
        path: parent.path === '' ? name : `${parent.path}/${name}`,
        folders: new Map(),
        files: [],
      }
      parent.folders.set(name, child)
    }
    parent = child
  }
  parent.files.push(entry)
}

/**
 * Order two folder nodes by name, then by path for names that compare equal.
 * @param a - first folder.
 * @param b - second folder.
 * @returns comparison result.
 */
function compareFolders<Entry extends { path: string }>(
  a: FolderNode<Entry>,
  b: FolderNode<Entry>,
): number {
  const byName = compareNames(a.name, b.name)
  if (byName !== 0) return byName
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
}

/**
 * Order two entries by file name, then by full path for names that compare
 * equal.
 * @param a - first entry.
 * @param b - second entry.
 * @returns comparison result.
 */
function compareFiles<Entry extends { path: string }>(a: Entry, b: Entry): number {
  const byName = compareNames(fileName(a.path), fileName(b.path))
  if (byName !== 0) return byName
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
}

/**
 * Append one folder node's rendered rows: subfolders before files, with each
 * unbranched folder chain collapsed into one row.
 * @param node - folder whose children are rendered.
 * @param depth - rendered depth of this folder's children.
 * @param rows - output rows.
 */
function appendFolderRows<Entry extends { path: string }>(
  node: FolderNode<Entry>,
  depth: number,
  rows: FileTreeRow<Entry>[],
): void {
  const folders = [...node.folders.values()].sort(compareFolders)
  for (const starting of folders) {
    let deepest = starting
    let label = starting.name
    while (deepest.files.length === 0 && deepest.folders.size === 1) {
      const child = deepest.folders.values().next().value
      if (child === undefined) break
      deepest = child
      label += `/${child.name}`
    }
    rows.push({ type: 'folder', path: deepest.path, label, depth })
    appendFolderRows(deepest, depth + 1, rows)
  }
  const files = [...node.files].sort(compareFiles)
  for (const entry of files) rows.push({ type: 'file', entry, depth })
}

/**
 * Build the commit-details folder tree from changed-file entries. Subfolders
 * are emitted before files at every level, each unbranched folder chain
 * collapses into one indented row, and the input is neither mutated nor
 * required to be pre-sorted.
 * @param entries - changed-file entries, in any order.
 * @returns folder and file rows in display order.
 */
export function buildFileTree<Entry extends { path: string }>(
  entries: readonly Entry[],
): FileTreeRow<Entry>[] {
  const root = createRoot<Entry>()
  for (const entry of entries) insertEntry(root, entry)
  const rows: FileTreeRow<Entry>[] = []
  appendFolderRows(root, 0, rows)
  return rows
}
