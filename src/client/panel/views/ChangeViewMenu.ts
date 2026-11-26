/**
 * The Workspace header's view menu: the ellipsis button that drops the change
 * groups' file views, drawn like the commit graph header's remote overflow menu.
 *
 * The trigger and its dropdown live in one component, so the section header
 * only has to place it among its actions. The checked view is the one the
 * change groups render now; choosing it again is a no-op that closes the menu.
 */

import type React from 'react'
import { createElement, useEffect, useRef, useState } from 'react'
import { CheckIcon, MoreIcon } from '../../icons.ts'
import type { ChangeView } from '../../types/domain.ts'
import type { LocaleBinder } from '../../types/dsh.ts'

const h = createElement

/** Props of the Workspace header's view menu. */
export interface ChangeViewMenuProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** File view the change groups render. */
  readonly view: ChangeView
  /** Switch every change group to one file view. */
  readonly onChange: (view: ChangeView) => void
}

/**
 * Render the Workspace header's view menu.
 * @param props - view-menu props.
 * @returns the trigger and, while it is open, its dropdown.
 */
export function ChangeViewMenu(props: ChangeViewMenuProps): React.ReactElement {
  const t = props.t
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent): void => {
      const element = wrap.current
      if (
        element !== null &&
        typeof Node !== 'undefined' &&
        event.target instanceof Node &&
        element.contains(event.target)
      )
        return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      // Escape only closes the dropdown; the host still sees the key.
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])
  /**
   * Build one choose-a-view item.
   * @param view - file view the item selects.
   * @param label - localized view name.
   * @returns the menu item element.
   */
  const item = (view: ChangeView, label: string): React.ReactElement =>
    h(
      'button',
      {
        key: view,
        type: 'button',
        role: 'menuitemradio',
        className: 'dshgg-menuItem',
        'aria-checked': props.view === view,
        onClick: () => {
          setOpen(false)
          trigger.current?.focus()
          props.onChange(view)
        },
      },
      h(
        'span',
        { className: 'dshgg-menuCheck' },
        props.view === view ? h(CheckIcon, { size: 12 }) : null,
      ),
      h('span', { className: 'dshgg-menuLabel' }, label),
    )
  return h(
    'div',
    { className: 'dshgg-viewWrap', ref: wrap },
    h(
      'button',
      {
        type: 'button',
        className: 'dshgg-iconBtn',
        'aria-label': t('menu.view'),
        title: t('menu.view'),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        ref: trigger,
        onClick: () => setOpen((value) => !value),
      },
      h(MoreIcon, { size: 14 }),
    ),
    open
      ? h(
          'div',
          {
            className: 'dshgg-menu dshgg-menuEnd',
            role: 'menu',
            'aria-label': t('menu.view'),
          },
          item('list', t('menu.viewList')),
          item('tree', t('menu.viewTree')),
        )
      : null,
  )
}
