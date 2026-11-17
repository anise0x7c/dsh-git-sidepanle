/** Theme-token driven naming and deletion dialogs for graph menu commands. */

import type React from 'react'
import { createElement, useId } from 'react'
import type { LocaleBinder } from '../../types/dsh.ts'
import type { CommitMenuDialog as CommitMenuDialogState } from '../hooks/useCommitMenuActions.ts'

const h = createElement

/** Props of {@link CommitMenuDialog}. */
export interface CommitMenuDialogProps {
  /** Open graph operation dialog. */
  readonly dialog: CommitMenuDialogState
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Operation running: keep text visible and controls inactive but focused. */
  readonly busy: boolean
  /** Edit the branch or tag name. */
  readonly onNameChange: (name: string) => void
  /** Edit an optional tag annotation. */
  readonly onMessageChange: (message: string) => void
  /** Close without running Git. */
  readonly onCancel: () => void
  /** Trigger the confirmed operation. */
  readonly onSubmit: () => void
}

/**
 * Render one operation dialog under the panel's feedback area. Creation inputs
 * receive focus; a destructive confirmation starts on Cancel. Escape cancels
 * while idle. A failed submission keeps both the text and the logical focus.
 * @param props - open state and handlers supplied by the graph-action hook.
 * @returns operation dialog element.
 */
export function CommitMenuDialog(props: CommitMenuDialogProps): React.ReactElement {
  const { dialog, t } = props
  const descriptionId = useId()
  const title =
    dialog.kind === 'createBranch'
      ? t('menu.createBranch')
      : dialog.kind === 'createTag'
        ? t('menu.createTag')
        : t('menu.deleteBranch')
  const description =
    dialog.kind === 'createBranch'
      ? t('menu.createBranchAt', { hash: dialog.oid.slice(0, 7) })
      : dialog.kind === 'createTag'
        ? t('menu.createTagAt', { hash: dialog.oid.slice(0, 7) })
        : t('menu.deleteBranchConfirm', { name: dialog.branch })
  const progress =
    dialog.kind === 'createBranch'
      ? t('menu.creatingBranch')
      : dialog.kind === 'createTag'
        ? t('menu.creatingTag')
        : t('menu.deletingBranch')
  const enter = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    props.onSubmit()
  }
  const annotationEnter = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return
    event.preventDefault()
    props.onSubmit()
  }
  return h(
    'div',
    {
      className: 'dshgg-confirm',
      role: 'alertdialog',
      'aria-label': title,
      'aria-describedby': descriptionId,
      'aria-busy': props.busy,
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Escape' || props.busy) return
        event.preventDefault()
        event.stopPropagation()
        props.onCancel()
      },
    },
    h(
      'div',
      { className: 'dshgg-confirmText' },
      h('div', { className: 'dshgg-confirmTitle' }, title),
      h('div', { id: descriptionId, className: 'dshgg-confirmDesc' }, description),
      dialog.kind === 'deleteBranch'
        ? null
        : h(
            'label',
            { className: 'dshgg-dialogField' },
            h('span', { className: 'dshgg-dialogLabel' }, t('menu.referenceName')),
            h('input', {
              type: 'text',
              className: 'dshgg-dialogInput',
              'aria-label': t('menu.referenceName'),
              value: dialog.name,
              maxLength: 200,
              autoFocus: true,
              readOnly: props.busy,
              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                props.onNameChange(event.target.value),
              onKeyDown: enter,
            }),
          ),
      dialog.kind !== 'createTag'
        ? null
        : h(
            'label',
            { className: 'dshgg-dialogField' },
            h('span', { className: 'dshgg-dialogLabel' }, t('menu.tagMessage')),
            h('textarea', {
              className: 'dshgg-dialogInput dshgg-dialogMessage',
              'aria-label': t('menu.tagMessage'),
              value: dialog.message,
              maxLength: 20_000,
              rows: 3,
              readOnly: props.busy,
              onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
                props.onMessageChange(event.target.value),
              onKeyDown: annotationEnter,
            }),
            h('span', { className: 'dshgg-dialogHint' }, t('menu.tagMessageHint')),
          ),
      props.busy ? h('div', { className: 'dshgg-dialogHint', role: 'status' }, progress) : null,
    ),
    h(
      'div',
      { className: 'dshgg-confirmActions' },
      h(
        'button',
        {
          type: 'button',
          className: 'dshgg-btn dshgg-btnGhost',
          autoFocus: dialog.kind === 'deleteBranch',
          'aria-disabled': props.busy ? 'true' : undefined,
          onClick: () => {
            if (!props.busy) props.onCancel()
          },
        },
        t('action.cancel'),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dshgg-btn dshgg-btnPrimary',
          disabled: !props.busy && dialog.kind !== 'deleteBranch' && dialog.name.trim() === '',
          'aria-disabled':
            props.busy || (dialog.kind !== 'deleteBranch' && dialog.name.trim() === '')
              ? 'true'
              : undefined,
          onClick: props.onSubmit,
        },
        title,
      ),
    ),
  )
}
