/**
 * Pure formatting and status helpers: status letters, staging state, names,
 * refs and relative time. No React and no plugin context, so tests can import
 * it directly.
 */

import type { ChangeEntry, Failure } from '../types/domain.ts'
import type { LocaleBinder } from '../types/dsh.ts'

/** One parsed commit ref decoration. */
export interface ParsedRef {
  /** Ref name without its decoration prefix. */
  readonly label: string
  /** Decoration family. */
  readonly kind: 'head' | 'tag' | 'remote' | 'branch'
}

/**
 * Display letters for porcelain status characters; an untracked `?` renders as
 * `U`, and a character without a letter renders as an empty string.
 */
export const STATUS_LETTERS: Record<string, string> = {
  '.': '',
  M: 'M',
  A: 'A',
  D: 'D',
  R: 'R',
  C: 'C',
  U: 'U',
  T: 'T',
  '?': 'U',
}

/**
 * Map one porcelain status character to its display letter.
 * @param character - porcelain status character (`M`, `?`, ...).
 * @returns display letter; empty when there is no mapping.
 */
export function statusLetter(character: string | null | undefined): string {
  if (typeof character !== 'string') return ''
  return STATUS_LETTERS[character] ?? ''
}

/**
 * Map a display letter to its status dictionary key.
 * @param letter - display letter (`M`, `!`, ...).
 * @returns dictionary key; unknown letters read as modified.
 */
export function statusKey(letter: string | null | undefined): string {
  if (letter === 'M') return 'status.modified'
  if (letter === 'A') return 'status.added'
  if (letter === 'D') return 'status.deleted'
  if (letter === 'R') return 'status.renamed'
  if (letter === 'C') return 'status.copied'
  if (letter === 'U') return 'status.untracked'
  if (letter === '!') return 'status.conflict'
  if (letter === 'T') return 'status.typeChanged'
  return 'status.modified'
}

/**
 * Whether the index half of a row belongs in the staged group.
 * @param entry - changed-file row.
 * @returns true when the row has staged changes.
 */
export function isStaged(entry: ChangeEntry): boolean {
  return entry.conflict !== true && entry.x !== '.' && entry.x !== '?' && entry.x !== '!'
}

/**
 * Whether the worktree half of a row belongs in the unstaged group; untracked
 * rows count as unstaged.
 * @param entry - changed-file row.
 * @returns true when the row has unstaged changes.
 */
export function isUnstaged(entry: ChangeEntry): boolean {
  return entry.conflict !== true && (entry.y !== '.' || entry.x === '?')
}

/**
 * Split a repository-relative path into its parent directory and file name.
 * Only forward slashes separate segments; a trailing slash yields an empty
 * file name.
 * @param path - repository-relative path.
 * @returns parent directory (empty at the root) and last segment.
 */
export function splitPath(path: string): { dir: string; name: string } {
  const index = path.lastIndexOf('/')
  return index < 0
    ? { dir: '', name: path }
    : { dir: path.slice(0, index), name: path.slice(index + 1) }
}

/**
 * Take the last `/`-separated segment of a repository-relative path.
 * @param path - repository-relative path.
 * @returns final path segment.
 */
export function baseName(path: string): string {
  return splitPath(path).name
}

/**
 * Render an author timestamp as localized relative time.
 * @param t - locale binder.
 * @param authoredAt - author timestamp in Unix seconds.
 * @returns localized relative-time text.
 */
export function formatAgo(t: LocaleBinder, authoredAt: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - authoredAt)
  if (seconds < 45) return t('time.now')
  if (seconds < 3600) return t('time.minutes', { n: Math.max(1, Math.round(seconds / 60)) })
  if (seconds < 86400) return t('time.hours', { n: Math.round(seconds / 3600) })
  if (seconds < 604800) return t('time.days', { n: Math.round(seconds / 86400) })
  if (seconds < 2592000) return t('time.weeks', { n: Math.round(seconds / 604800) })
  if (seconds < 31536000) return t('time.months', { n: Math.round(seconds / 2592000) })
  return t('time.years', { n: Math.round(seconds / 31536000) })
}

/**
 * Parse a commit's `refs` decoration string.
 * @param refs - decoration string; nullish and non-strings are ignored.
 * @returns refs in decoration order.
 */
export function parseRefs(refs: unknown): ParsedRef[] {
  if (typeof refs !== 'string' || refs === '') return []
  return refs
    .split(', ')
    .filter((label) => label !== '')
    .map((label) => {
      if (label.startsWith('HEAD -> '))
        return { label: label.slice('HEAD -> '.length), kind: 'head' }
      if (label === 'HEAD') return { label: 'HEAD', kind: 'head' }
      if (label.startsWith('tag: ')) return { label: label.slice('tag: '.length), kind: 'tag' }
      if (label.includes('/')) return { label, kind: 'remote' }
      return { label, kind: 'branch' }
    })
}

/**
 * Drop refs that only repeat a branch already named by another ref in the same
 * decoration. `main` + `origin/main` and `feature/x` + `origin/feature/x` each
 * name one branch, and the sidebar's commit rows are too narrow to print both;
 * the part after the first slash is what the two spellings share.
 * @param refs - parsed refs in decoration order.
 * @returns refs without a duplicate spelling of another ref.
 */
export function distinctRefs(refs: readonly ParsedRef[]): ParsedRef[] {
  const labels = new Set(refs.map((ref) => ref.label))
  return refs.filter((ref) => {
    const slash = ref.label.indexOf('/')
    return slash < 0 || !labels.has(ref.label.slice(slash + 1))
  })
}

/**
 * Choose the localized text for a failure surfaced by the RPC caller.
 * @param t - locale binder.
 * @param failure - failure envelope.
 * @returns localized description, or the Host message when unmapped.
 */
export function errorText(t: LocaleBinder, failure: Failure | null | undefined): string {
  if (failure === null || failure === undefined) return t('error.unknown')
  const code = failure.code
  if (code === 'git-unavailable') return t('gitUnavailable.desc')
  if (code === 'network') return t('error.network')
  if (code === 'forbidden') return t('error.forbidden')
  if (code === 'not-a-repository') return t('noRepo.title')
  if (code === 'discard-unborn') return t('error.discardUnborn')
  if (code === 'unknown-commit') return t('error.unknownCommit')
  return failure.message || t('error.unknown')
}
