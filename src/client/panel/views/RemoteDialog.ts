/**
 * Remote forms: add a remote (name and URL), remove one configured remote, or
 * publish the current branch (remote select).
 */

import type React from 'react'
import { createElement, useRef } from 'react'
import type { RemoteInfo } from '../../types/domain.ts'
import type { LocaleBinder } from '../../types/dsh.ts'
import { FloatingPanel, isCompositionKey } from '../FloatingPanel.ts'
import type { RemoteDialogState } from '../hooks/useRemoteActions.ts'

const h = createElement

/** Props of the remote forms. */
export interface RemoteDialogProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Current branch label shown in the publish copy and the progress notes. */
  readonly branch: string
  /** Configured remotes offered by the remove and publish selects. */
  readonly remotes: readonly RemoteInfo[]
  /** Open form and its current values. */
  readonly dialog: RemoteDialogState
  /** Current busy operation name, or null. */
  readonly busyName: string | null
  /** Existing action-failure presentation, kept inside the form. */
  readonly feedback?: React.ReactNode
  /** Change the remote selected by the remove or publish form. */
  readonly onSelect: (remote: string) => void
  /** Edit the name in the Add Remote form. */
  readonly onNameChange: (name: string) => void
  /** Edit the URL in the Add Remote form. */
  readonly onUrlChange: (url: string) => void
  /** Close without running Git. */
  readonly onCancel: () => void
  /** Submit the open form. */
  readonly onSubmit: () => void
}

/**
 * Render the open remote form.
 * @param props - remote-form props.
 * @returns the floating remote panel.
 */
export function RemoteDialog(props: RemoteDialogProps): React.ReactElement {
  const { dialog, t } = props
  const busy = props.busyName !== null
  const composing = useRef(false)
  const compositionHandlers = {
    onCompositionStart: () => {
      composing.current = true
    },
    onCompositionEnd: () => {
      composing.current = false
    },
  }
  if (dialog.kind === 'add') {
    const canSubmit = dialog.name.trim() !== '' && dialog.url.trim() !== ''
    const submit = (): void => {
      if (!busy && canSubmit) props.onSubmit()
    }
    const enter = (event: React.KeyboardEvent<HTMLInputElement>): void => {
      if (event.key !== 'Enter' || composing.current || isCompositionKey(event)) return
      event.preventDefault()
      submit()
    }
    return h(
      FloatingPanel,
      {
        title: t('remote.addTitle'),
        description: t('remote.addDesc'),
        cancelLabel: t('action.cancel'),
        submitLabel: t('remote.addAction'),
        busy,
        canSubmit,
        focusCancel: false,
        ...(props.busyName === 'add-remote'
          ? { progress: t('remote.adding', { name: dialog.name }) }
          : {}),
        feedback: props.feedback,
        onCancel: props.onCancel,
        onSubmit: submit,
      },
      h(
        'label',
        { className: 'dshgg-dialogField' },
        h('span', { className: 'dshgg-dialogLabel' }, t('remote.nameField')),
        h('input', {
          type: 'text',
          className: 'dshgg-dialogInput',
          'aria-label': t('remote.nameField'),
          value: dialog.name,
          maxLength: 200,
          autoFocus: true,
          readOnly: busy,
          ...compositionHandlers,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
            if (!busy) props.onNameChange(event.target.value)
          },
          onKeyDown: enter,
        }),
      ),
      h(
        'label',
        { className: 'dshgg-dialogField' },
        h('span', { className: 'dshgg-dialogLabel' }, t('remote.urlField')),
        h('input', {
          type: 'text',
          className: 'dshgg-dialogInput',
          'aria-label': t('remote.urlField'),
          placeholder: t('remote.urlPlaceholder'),
          value: dialog.url,
          maxLength: 4096,
          readOnly: busy,
          ...compositionHandlers,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
            if (!busy) props.onUrlChange(event.target.value)
          },
          onKeyDown: enter,
        }),
      ),
    )
  }
  const selectLabel = dialog.kind === 'remove' ? t('remote.removeLabel') : t('remote.selectRemote')
  const title = dialog.kind === 'remove' ? t('remote.removeTitle') : t('remote.publishTitle')
  const description =
    dialog.kind === 'remove'
      ? t('remote.removeDesc', { name: dialog.name })
      : t('remote.publishDesc', { branch: props.branch })
  const submitLabel =
    dialog.kind === 'remove' ? t('remote.removeAction') : t('remote.publishAction')
  const progress =
    dialog.kind === 'remove' && props.busyName === 'remove-remote'
      ? t('remote.removing', { name: dialog.name })
      : dialog.kind === 'publish' && props.busyName === 'publish'
        ? t('remote.publishing', { branch: props.branch })
        : undefined
  return h(
    FloatingPanel,
    {
      title,
      description,
      cancelLabel: t('action.cancel'),
      submitLabel,
      busy,
      canSubmit: dialog.name !== '',
      focusCancel: dialog.kind === 'remove',
      ...(progress === undefined ? {} : { progress }),
      feedback: props.feedback,
      onCancel: props.onCancel,
      onSubmit: props.onSubmit,
    },
    h(
      'label',
      { className: 'dshgg-dialogField' },
      h('span', { className: 'dshgg-dialogLabel' }, selectLabel),
      h(
        'select',
        {
          className: 'dshgg-dialogInput dshgg-dialogSelect',
          'aria-label': selectLabel,
          value: dialog.name,
          disabled: busy,
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
            if (!busy) props.onSelect(event.target.value)
          },
        },
        props.remotes.map((remote) =>
          h('option', { key: remote.name, value: remote.name }, remote.name),
        ),
      ),
    ),
  )
}
