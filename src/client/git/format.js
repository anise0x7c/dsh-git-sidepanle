/**
 * Pure formatting and status helpers: status letters, staging state, names,
 * refs and relative time. No React and no plugin context, so tests can import
 * it directly.
 */

export const STATUS_LETTERS = {
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

export function statusLetter(character) {
  return STATUS_LETTERS[character] ?? ''
}

export function statusKey(letter) {
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

export function isStaged(entry) {
  return entry.conflict !== true && entry.x !== '.' && entry.x !== '?' && entry.x !== '!'
}

export function isUnstaged(entry) {
  return entry.conflict !== true && (entry.y !== '.' || entry.x === '?')
}

export function baseName(path) {
  const index = path.lastIndexOf('/')
  return index < 0 ? path : path.slice(index + 1)
}

export function formatAgo(t, authoredAt) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - authoredAt)
  if (seconds < 45) return t('time.now')
  if (seconds < 3600) return t('time.minutes', { n: Math.max(1, Math.round(seconds / 60)) })
  if (seconds < 86400) return t('time.hours', { n: Math.round(seconds / 3600) })
  if (seconds < 604800) return t('time.days', { n: Math.round(seconds / 86400) })
  if (seconds < 2592000) return t('time.weeks', { n: Math.round(seconds / 604800) })
  if (seconds < 31536000) return t('time.months', { n: Math.round(seconds / 2592000) })
  return t('time.years', { n: Math.round(seconds / 31536000) })
}

export function parseRefs(refs) {
  if (typeof refs !== 'string' || refs === '') return []
  return refs.split(', ').filter((label) => label !== '').map((label) => {
    if (label.startsWith('HEAD -> ')) return { label: label.slice('HEAD -> '.length), kind: 'head' }
    if (label === 'HEAD') return { label: 'HEAD', kind: 'head' }
    if (label.startsWith('tag: ')) return { label: label.slice('tag: '.length), kind: 'tag' }
    if (label.includes('/')) return { label, kind: 'remote' }
    return { label, kind: 'branch' }
  })
}

export function errorText(t, failure) {
  if (failure === null || failure === undefined) return t('error.unknown')
  const code = failure.code
  if (code === 'git-unavailable') return t('gitUnavailable.desc')
  if (code === 'network') return t('error.network')
  if (code === 'forbidden') return t('error.forbidden')
  if (code === 'not-a-repository') return t('noRepo.title')
  if (code === 'discard-unborn') return t('error.discardUnborn')
  return failure.message || t('error.unknown')
}
