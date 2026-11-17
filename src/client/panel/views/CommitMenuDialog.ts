/** Theme-token driven naming and deletion dialogs for graph menu commands. */

import type React from 'react'
import { createElement, useRef } from 'react'
import type { LocaleBinder } from '../../types/dsh.ts'
import { FloatingPanel, isCompositionKey } from '../FloatingPanel.ts'
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
  /** Existing action-failure presentation, kept inside the operation panel. */
  readonly feedback?: React.ReactNode
  /** Edit the branch or tag name. */
  readonly onNameChange: (name: string) => void
  /** Edit an optional tag annotation. */
  readonly onMessageChange: (message: string) => void
  /** Close without running Git. */
  readonly onCancel: () => void
  /** Trigger the confirmed operation. */
  readonly onSubmit: () => void
}

/** Render a reference-operation form; its hook still owns restoring graph focus. */
export function CommitMenuDialog(props: CommitMenuDialogProps): React.ReactElement {
  const { dialog, t } = props
  const composing = useRef(false)
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
  const canSubmit = dialog.kind === 'deleteBranch' || dialog.name.trim() !== ''
  const submit = (): void => {
    if (!props.busy && canSubmit) props.onSubmit()
  }
  const enter = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey || composing.current || isCompositionKey(event))
      return
    event.preventDefault()
    submit()
  }
  const annotationEnter = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (
      event.key !== 'Enter' ||
      (!event.ctrlKey && !event.metaKey) ||
      composing.current ||
      isCompositionKey(event)
    )
      return
    event.preventDefault()
    submit()
  }
  const compositionHandlers = {
    onCompositionStart: () => {
      composing.current = true
    },
    onCompositionEnd: () => {
      composing.current = false
    },
  }
  return h(
    FloatingPanel,
    {
      title,
      description,
      busy: props.busy,
      canSubmit,
      focusCancel: dialog.kind === 'deleteBranch',
      cancelLabel: t('action.cancel'),
      submitLabel: title,
      progress,
      feedback: props.feedback,
      onCancel: props.onCancel,
      onSubmit: submit,
    },
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
            ...compositionHandlers,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              if (!props.busy) props.onNameChange(event.target.value)
            },
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
            ...compositionHandlers,
            onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
              if (!props.busy) props.onMessageChange(event.target.value)
            },
            onKeyDown: annotationEnter,
          }),
          h('span', { className: 'dshgg-dialogHint' }, t('menu.tagMessageHint')),
        ),
  )
}
