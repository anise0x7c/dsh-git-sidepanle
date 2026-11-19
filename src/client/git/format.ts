/**
 * Pure formatting and status helpers: status letters, staging state, names,
 * refs and relative time. No React and no plugin context, so tests can import
 * it directly.
 */

import type { ChangeEntry, Failure } from '../types/domain.ts'
import type { LocaleBinder } from '../types/dsh.ts'

/**
 * Reference family, as VS Code's Git extension classifies a decoration:
 * `head` is the checked-out branch, `branch` another local branch, `remote` a
 * remote-tracking branch and `tag` a tag.
 */
export type RefKind = 'head' | 'branch' | 'remote' | 'tag'

/** One parsed commit ref decoration. */
export interface ParsedRef {
  /** Full ref name such as `refs/heads/main`. */
  readonly id: string
  /** Display name such as `main`, `origin/main` or `v1.0`. */
  readonly name: string
  /** Reference family. */
  readonly kind: RefKind
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

const HEADS = 'refs/heads/'
const REMOTES = 'refs/remotes/'
const TAGS = 'refs/tags/'

/**
 * Classify one decoration entry. Full names (`git log --decorate=full`) are
 * classified exactly; a short spelling falls back to a local branch, or to a
 * remote-tracking branch when it contains a slash.
 * @param label - one decoration entry without `HEAD -> ` / `tag: ` prefixes.
 * @param head - whether the entry followed `HEAD -> `.
 * @param tag - whether the entry followed `tag: `.
 * @returns parsed ref, or null when the entry is not shown as a reference.
 */
function classifyRef(label: string, head: boolean, tag: boolean): ParsedRef | null {
  if (label === '') return null
  if (tag) {
    const name = label.startsWith(TAGS) ? label.slice(TAGS.length) : label
    return { id: `${TAGS}${name}`, name, kind: 'tag' }
  }
  if (label.startsWith(HEADS)) {
    const name = label.slice(HEADS.length)
    return { id: label, name, kind: head ? 'head' : 'branch' }
  }
  if (label.startsWith(REMOTES)) {
    const name = label.slice(REMOTES.length)
    // A remote's default-branch pointer only repeats another remote branch.
    if (name.endsWith('/HEAD')) return null
    return { id: label, name, kind: 'remote' }
  }
  if (label.startsWith(TAGS)) {
    const name = label.slice(TAGS.length)
    return { id: label, name, kind: 'tag' }
  }
  if (label.startsWith('refs/')) return null
  if (head || !label.includes('/')) {
    return { id: `${HEADS}${label}`, name: label, kind: head ? 'head' : 'branch' }
  }
  if (label.endsWith('/HEAD')) return null
  return { id: `${REMOTES}${label}`, name: label, kind: 'remote' }
}

/**
 * Parse a commit's `refs` decoration string into the references VS Code's Git
 * extension shows: the checked-out branch, local branches, remote-tracking
 * branches and tags. A detached `HEAD` marker and a remote's `HEAD` pointer are
 * not references of their own and are skipped.
 * @param refs - decoration string; nullish and non-strings are ignored.
 * @returns refs in decoration order.
 */
export function parseRefs(refs: unknown): ParsedRef[] {
  if (typeof refs !== 'string' || refs === '') return []
  const parsed: ParsedRef[] = []
  for (const entry of refs.split(', ')) {
    if (entry === '' || entry === 'HEAD') continue
    let ref: ParsedRef | null
    if (entry.startsWith('HEAD -> ')) ref = classifyRef(entry.slice('HEAD -> '.length), true, false)
    else if (entry.startsWith('tag: ')) ref = classifyRef(entry.slice('tag: '.length), false, true)
    else ref = classifyRef(entry, false, false)
    if (ref !== null) parsed.push(ref)
  }
  return parsed
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
  if (code === 'not-untracked') return t('error.notUntracked')
  if (code === 'no-upstream') return t('remote.noUpstream')
  if (code === 'no-current-branch') return t('remote.noBranch')
  if (code === 'unborn-branch') return t('remote.unborn')
  if (code === 'unknown-remote') return t('remote.unknownRemote')
  if (code === 'remote-exists') return t('remote.exists')
  if (code === 'unknown-remote-branch') return t('remote.unknownBranch')
  if (code === 'no-remotes') return t('remote.noRemotes')
  if (code === 'remote-timeout') return t('remote.timeout')
  return failure.message || t('error.unknown')
}
