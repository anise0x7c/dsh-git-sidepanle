/**
 * Commit message box: the textarea, its hint, and the split commit button.
 */

import type React from 'react'
import { createElement, useLayoutEffect, useRef } from 'react'
import { CheckIcon, ChevronDownIcon } from '../../icons.ts'
import type { LocaleBinder } from '../../types/dsh.ts'
import { autoGrowTextArea } from '../autosize.ts'
import type { CommitMode } from '../commit-mode.ts'
import { CommitMenu } from './CommitMenu.ts'

const h = createElement

/** Props of the commit message box. */
export interface CommitBoxProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Current commit message. */
  readonly message: string
  /** Hint shown on the main button. */
  readonly hint: string
  /** Textarea placeholder. */
  readonly placeholder: string
  /** Current busy operation name or null. */
  readonly busy: string | null
  /** Whether the action menu is open. */
  readonly menuOpen: boolean
  /** Wrapper the action menu renders inside for outside-press dismissal. */
  readonly menuWrapRef: React.RefObject<HTMLDivElement>
  /** Toggle the action menu. */
  readonly onToggleMenu: () => void
  /** Run the chosen commit variant. */
  readonly onChoose: (mode: CommitMode) => void
  /** Whether the current branch tracks an upstream. */
  readonly canPush: boolean
  /** Message change handler. */
  readonly onChange: (message: string) => void
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
  const disabled = props.message.trim() === '' || props.busy !== null
  const committing =
    props.busy === 'commit' ||
    props.busy === 'amend' ||
    props.busy === 'commit-push' ||
    props.busy === 'commit-sync'
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
          props.onChoose('commit')
        }
      },
    }),
    h(
      'div',
      {
        className: 'dshgg-commitActions',
        ref: props.menuWrapRef,
        'data-disabled': disabled ? 'true' : undefined,
      },
      h(
        'button',
        {
          type: 'button',
          className: 'dshgg-btn dshgg-btnPrimary dshgg-commitMain',
          disabled,
          title: props.hint,
          onClick: () => props.onChoose('commit'),
        },
        h(CheckIcon, { size: 14 }),
        committing ? t('commit.committing') : t('commit.action'),
      ),
      h('span', { className: 'dshgg-commitDivider', 'aria-hidden': 'true' }),
      h(
        'button',
        {
          type: 'button',
          className: 'dshgg-btn dshgg-btnPrimary dshgg-commitExpand',
          'aria-label': t('commit.menu'),
          title: t('commit.menu'),
          'aria-haspopup': 'menu',
          'aria-expanded': props.menuOpen,
          disabled,
          onClick: props.onToggleMenu,
        },
        h(ChevronDownIcon, { size: 12 }),
      ),
      props.menuOpen
        ? h(CommitMenu, {
            t,
            blocked: disabled,
            canPush: props.canPush,
            onChoose: props.onChoose,
          })
        : null,
    ),
  )
}
