/**
 * Commit message box: the textarea, its hint, and the commit button.
 */

import { createElement } from 'react'

const h = createElement

/**
 * @param {object} props - commit box props.
 * @param {Function} props.t - locale binder.
 * @param {string} props.message - current commit message.
 * @param {string} props.hint - hint shown next to the button.
 * @param {string} props.placeholder - textarea placeholder.
 * @param {string|null} props.busy - current busy operation name or null.
 * @param {Function} props.onChange - message change handler.
 * @param {Function} props.onCommit - commit request handler.
 * @returns {object} commit box element.
 */
export function CommitBox(props) {
  const t = props.t
  return h('div', { className: 'dshgg-commitBox' },
    h('textarea', {
      className: 'dshgg-commitMessage',
      value: props.message,
      rows: 3,
      spellCheck: false,
      placeholder: props.placeholder,
      'aria-label': t('commit.action'),
      disabled: props.busy !== null,
      onChange: (event) => props.onChange(event.target.value),
      onKeyDown: (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault()
          props.onCommit()
        }
      },
    }),
    h('div', { className: 'dshgg-commitRow' },
      h('span', { className: 'dshgg-commitHint', title: props.hint }, props.hint),
      h('button', {
        type: 'button',
        className: 'dshgg-btn dshgg-btnPrimary',
        disabled: props.message.trim() === '' || props.busy !== null,
        onClick: props.onCommit,
      }, props.busy === 'commit' ? t('commit.committing') : t('commit.action'))))
}
