/**
 * Copy for the discard confirmation dialog.
 */

import { baseName } from '../git/format.js'

export function confirmTitle(t, confirm) {
  if (confirm.kind === 'commitAll') return t('commit.emptyConfirm')
  if (confirm.kind === 'discardAll') return t('confirm.discardAllTitle', { n: confirm.entries.length })
  return t('confirm.discardTitle', { name: baseName(confirm.entry.path) })
}

export function confirmDescription(t, confirm) {
  if (confirm.kind === 'commitAll') return ''
  if (confirm.kind === 'discardAll') return t('confirm.discardAllDesc')
  return confirm.entry.untracked === true ? t('confirm.deleteUntrackedDesc') : t('confirm.discardDesc')
}

export function confirmActionLabel(t, confirm) {
  if (confirm.kind === 'commitAll') return t('commit.stageAll')
  return confirm.kind === 'discardAll' ? t('confirm.discardAll') : t('confirm.discard')
}
