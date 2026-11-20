/**
 * Copy for the discard confirmation dialog.
 */

import { baseName } from '../git/format.ts'
import type { ChangeEntry } from '../types/domain.ts'
import type { LocaleBinder } from '../types/dsh.ts'
import type { StageAllCommitMode } from './commit-mode.ts'

/** The confirmation dialog the panel currently shows. */
export type ConfirmState =
  | { readonly kind: 'commitAll'; readonly mode: StageAllCommitMode }
  | { readonly kind: 'discard'; readonly entry: ChangeEntry }
  | { readonly kind: 'discardAll'; readonly entries: readonly ChangeEntry[] }

/**
 * Resolve the dialog title.
 * @param t - locale binder.
 * @param confirm - open confirmation.
 * @returns localized title.
 */
export function confirmTitle(t: LocaleBinder, confirm: ConfirmState): string {
  if (confirm.kind === 'commitAll') return t('commit.emptyConfirm')
  if (confirm.kind === 'discardAll')
    return t('confirm.discardAllTitle', { n: confirm.entries.length })
  return t('confirm.discardTitle', { name: baseName(confirm.entry.path) })
}

/**
 * Resolve the dialog description.
 * @param t - locale binder.
 * @param confirm - open confirmation.
 * @returns localized description; empty when the title needs no detail.
 */
export function confirmDescription(t: LocaleBinder, confirm: ConfirmState): string {
  if (confirm.kind === 'commitAll') return ''
  if (confirm.kind === 'discardAll') return t('confirm.discardAllDesc')
  return confirm.entry.untracked === true
    ? t('confirm.deleteUntrackedDesc')
    : t('confirm.discardDesc')
}

/**
 * Resolve the confirm button label.
 * @param t - locale binder.
 * @param confirm - open confirmation.
 * @returns localized action label.
 */
export function confirmActionLabel(t: LocaleBinder, confirm: ConfirmState): string {
  if (confirm.kind === 'commitAll') return t('commit.stageAll')
  return confirm.kind === 'discardAll' ? t('confirm.discardAll') : t('confirm.discard')
}
