/**
 * Commit message box: the textarea, its hint, and the commit button.
 */

import type React from 'react'
import { createElement, useLayoutEffect, useRef } from 'react'
import type { LocaleBinder } from '../../types/dsh.ts'
import { autoGrowTextArea } from '../autosize.ts'

const h = createElement

/** Props of the commit message box. */
export interface CommitBoxProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Current commit message. */
  readonly message: string
  /** Hint shown next to the button. */
  readonly hint: string
  /** Textarea placeholder. */
  readonly placeholder: string
  /** Current busy operation name or null. */
  readonly busy: string | null
  /** Message change handler. */
  readonly onChange: (message: string) => void
  /** Commit request handler. */
  readonly onCommit: () => void
}

/**
 * Render the commit box.
 * @param props - commit box props.
 * @returns commit box element.
 */
export function CommitBox(props: CommitBoxProps): React.ReactElement {
  const t = props.t
  const messageArea = useRef<HTMLTextAreaElement | null>(null)
  // Size the box before it paints, so a message that is already wrapped when the
  // panel shows it never flashes at one line.
  useLayoutEffect(() => {
    const area = messageArea.current
    if (area === null) return
    return autoGrowTextArea(area)
  }, [props.message])
  return h(
    'div',
    { className: 'dshgg-commitBox' },
    h('textarea', {
      ref: messageArea,
      className: 'dshgg-commitMessage',
      value: props.message,
      rows: 1,
      spellCheck: false,
      placeholder: props.placeholder,
      'aria-label': t('commit.action'),
      disabled: props.busy !== null,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
        props.onChange(event.target.value),
      onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault()
          props.onCommit()
        }
      },
    }),
    h(
      'div',
      { className: 'dshgg-commitRow' },
      h('span', { className: 'dshgg-commitHint', title: props.hint }, props.hint),
      h(
        'button',
        {
          type: 'button',
          className: 'dshgg-btn dshgg-btnPrimary',
          disabled: props.message.trim() === '' || props.busy !== null,
          onClick: props.onCommit,
        },
        props.busy === 'commit' ? t('commit.committing') : t('commit.action'),
      ),
    ),
  )
}
