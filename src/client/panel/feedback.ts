/**
 * Banner and empty-state building blocks.
 */

import type React from 'react'
import { createElement } from 'react'
import { CloseIcon } from '../icons.ts'
import { IconButton } from './controls.ts'

const h = createElement

/** Props of the inline banner. */
export interface BannerProps {
  /** Banner kind; defaults to `error`. */
  readonly kind?: 'error' | 'status'
  /** Headline. */
  readonly title: React.ReactNode
  /** Optional detail line. */
  readonly detail?: React.ReactNode
  /** Label of the retry action. */
  readonly retryLabel?: string
  /** Presence adds the retry action. */
  readonly onRetry?: () => void
  /** Accessible label of the dismiss action. */
  readonly dismissLabel?: string
  /** Presence adds the dismiss action. */
  readonly onDismiss?: () => void
}

/**
 * Render a banner with optional retry and dismiss actions.
 * @param props - banner props.
 * @returns the banner element.
 */
export function Banner(props: BannerProps): React.ReactElement {
  return h(
    'div',
    {
      className: 'dshgg-banner',
      'data-kind': props.kind ?? 'error',
      role: props.kind === 'error' ? 'alert' : 'status',
    },
    h(
      'span',
      { className: 'dshgg-bannerText' },
      h('span', null, props.title),
      props.detail === undefined || props.detail === ''
        ? null
        : h('div', { className: 'dshgg-bannerDetail' }, props.detail),
    ),
    h(
      'span',
      { className: 'dshgg-bannerActions' },
      props.onRetry === undefined
        ? null
        : h(
            'button',
            { type: 'button', className: 'dshgg-linkBtn', onClick: props.onRetry },
            props.retryLabel,
          ),
      props.onDismiss === undefined
        ? null
        : h(
            IconButton,
            { label: props.dismissLabel ?? 'Dismiss', onClick: props.onDismiss },
            h(CloseIcon, { size: 12 }),
          ),
    ),
  )
}

/** Props of the centered empty state. */
export interface EmptyStateProps {
  /** Large icon shown above the title. */
  readonly icon?: React.ReactNode
  /** Headline. */
  readonly title: React.ReactNode
  /** Optional description. */
  readonly desc?: React.ReactNode
  /** Optional action control. */
  readonly action?: React.ReactNode
}

/**
 * Render a centered empty state.
 * @param props - empty-state props.
 * @returns the state element.
 */
export function EmptyState(props: EmptyStateProps): React.ReactElement {
  return h(
    'div',
    { className: 'dshgg-state' },
    h('span', { className: 'dshgg-stateIcon' }, props.icon),
    h('p', { className: 'dshgg-stateTitle' }, props.title),
    props.desc === undefined ? null : h('p', { className: 'dshgg-stateDesc' }, props.desc),
    props.action === undefined ? null : h('div', { className: 'dshgg-stateAction' }, props.action),
  )
}
