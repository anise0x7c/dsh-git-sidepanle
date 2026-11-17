/**
 * Classify one filesystem watch event as a working-tree/index change, a
 * reference change, or noise to ignore.
 *
 * The repository is watched by two watchers: a recursive one over the working
 * tree and a non-recursive one over the Git metadata directory, plus a
 * recursive one over its `refs` tree. Events from the first watcher describe
 * files the user edited; events from the metadata watcher describe the index
 * (staging) and `HEAD`, packed refs, branch refs, tags and configuration. The
 * classification decides which counters the browser has to re-read, so it must
 * stay conservative: an unknown metadata file is a reference change, because a
 * cheap reference read is always safe and a missed one leaves stale colors.
 *
 * Pure functions: no filesystem, no timers, so the rules are unit-testable.
 */

/** What one watch event requires the panel to re-read. */
export type WatchChange = 'worktree' | 'references' | 'ignore'

/** Git metadata files that change the working-tree/index view. */
const INDEX_FILES = new Set(['index'])

/** Git metadata files that can move `HEAD` or a reference. */
const REFERENCE_FILES = new Set([
  'HEAD',
  'packed-refs',
  'config',
  'FETCH_HEAD',
  'ORIG_HEAD',
  'MERGE_HEAD',
  'CHERRY_PICK_HEAD',
  'REVERT_HEAD',
  'AUTO_MERGE',
  'COMMIT_EDITMSG',
])

/** Git metadata subdirectories whose direct changes never affect the view. */
const IDLE_DIRECTORIES = new Set(['objects', 'info', 'hooks', 'lfs', 'logs', 'worktrees'])

/**
 * Split a watch event's file name into path segments.
 * Recursive watchers report platform separators, so both are accepted.
 * @param filename - event file name relative to the watched directory.
 * @returns non-empty segments, or an empty list when the name is unknown.
 */
function segmentsOf(filename: string | null | undefined): string[] {
  if (typeof filename !== 'string' || filename === '') return []
  return filename.split(/[\\/]/).filter((segment) => segment !== '')
}

/**
 * Classify an event from the working-tree watcher.
 *
 * Events under `.git` are ignored: the Git metadata watcher reports the same
 * change with a more precise classification. Everything else is a working-tree
 * change, including files Git currently ignores, because an edited ignore file
 * can change what `git status` reports.
 * @param filename - event file name relative to the repository root.
 * @returns change kind.
 */
export function classifyWorktreeEntry(filename: string | null | undefined): WatchChange {
  const segments = segmentsOf(filename)
  if (segments.length === 0) return 'worktree'
  return segments[0] === '.git' ? 'ignore' : 'worktree'
}

/**
 * Classify an event from the Git metadata watcher.
 *
 * `index` is a staging change; `HEAD`, `packed-refs`, configured remotes and
 * the heads/tags/remotes trees are reference changes. Transient lock files and
 * object/info/hook/log trees are ignored: the real entry changes when the
 * operation finishes, and reacting to a lock would refresh a half-written
 * repository. An unknown metadata entry is treated as a reference change.
 * @param filename - event file name relative to the Git metadata directory.
 * @returns change kind.
 */
export function classifyGitDirectoryEntry(filename: string | null | undefined): WatchChange {
  const segments = segmentsOf(filename)
  if (segments.length === 0) return 'references'
  const first = segments[0] ?? ''
  const name = segments.at(-1) ?? ''
  if (name.endsWith('.lock')) return 'ignore'
  if (first === 'refs') return 'references'
  if (IDLE_DIRECTORIES.has(first)) return 'ignore'
  if (INDEX_FILES.has(name)) return 'worktree'
  if (REFERENCE_FILES.has(name)) return 'references'
  return 'references'
}
