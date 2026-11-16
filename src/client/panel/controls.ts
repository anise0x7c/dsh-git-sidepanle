/**
 * Icon button used by the panel toolbar and section headers.
 */

import type React from 'react'
import { createElement } from 'react'

const h = createElement

/** Props of the shared icon button. */
export interface IconButtonProps {
  /** Accessible label. */
  readonly label: string
  /** Tooltip; defaults to the label. */
  readonly title?: string
  /** Disable the control. */
  readonly disabled?: boolean
  /** Mark the control as spinning, for the refresh control. */
  readonly spinning?: boolean
  /** Activation handler. */
  readonly onClick?: React.MouseEventHandler<HTMLButtonElement>
  /** Icon element. */
  readonly children?: React.ReactNode
}

/**
 * Render the shared icon button.
 * @param props - button props.
 * @returns the button element.
 */
export function IconButton(props: IconButtonProps): React.ReactElement {
  return h(
    'button',
    {
      type: 'button',
      className: 'dshgg-iconBtn',
      'aria-label': props.label,
      title: props.title ?? props.label,
      disabled: props.disabled === true,
      onClick: props.onClick,
      'data-spinning': props.spinning === true ? 'true' : undefined,
    },
    props.children,
  )
}
