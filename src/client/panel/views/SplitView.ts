/**
 * Two vertically stacked, independently scrolling panes with a draggable
 * divider. The surrounding panel owns the ratio, so opening commit details and
 * returning keeps the user's chosen split.
 */

import type React from 'react'
import { createElement, useRef, useState } from 'react'
import {
  adjustSplitRatio,
  clampSplitRatio,
  dragSplitRatio,
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
} from '../split.ts'

const h = createElement

/** Props of the resizable two-pane view. */
export interface SplitViewProps {
  /** Share of the split height given to the change pane. */
  readonly ratio: number
  /** Receives a clamped ratio while dragging or using the keyboard. */
  readonly onRatioChange: (ratio: number) => void
  /** Accessible name of the divider. */
  readonly label: string
  /** Divider tooltip. */
  readonly hint: string
  /** Upper pane: the change groups. */
  readonly changes: React.ReactNode
  /** Lower pane: the commit graph. */
  readonly graph: React.ReactNode
  /** Scroll handler of the graph pane; the panel pages history from it. */
  readonly onGraphScroll?: (event: React.UIEvent<HTMLDivElement>) => void
  /** Ref of the graph pane, used to return it to the newest commits. */
  readonly graphRef?: React.RefObject<HTMLDivElement | null>
}

/** Pointer position and ratio captured when a drag begins. */
interface DragStart {
  /** Client Y where the drag began. */
  readonly y: number
  /** Ratio that was in effect when the drag began. */
  readonly ratio: number
}

/**
 * Render the two scroll panes and their resize divider.
 * @param props - pane content, ratio and divider copy.
 * @returns the split container.
 */
export function SplitView(props: SplitViewProps): React.ReactElement {
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<DragStart | null>(null)
  const ratio = clampSplitRatio(props.ratio)
  const percent = `${Math.round(ratio * 1000) / 10}%`

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStart.current = { y: event.clientY, ratio }
    setDragging(true)
  }

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    const start = dragStart.current
    const container = event.currentTarget.parentElement
    if (start === null || container === null) return
    const { height } = container.getBoundingClientRect()
    props.onRatioChange(dragSplitRatio(start.ratio, start.y, event.clientY, height))
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (dragStart.current === null) return
    dragStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragging(false)
  }

  const handleKey = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const next = adjustSplitRatio(ratio, event.key)
    if (next === null) return
    event.preventDefault()
    props.onRatioChange(next)
  }

  return h(
    'div',
    { className: 'dshgg-split' },
    h(
      'div',
      { className: 'dshgg-scroll dshgg-paneTop', style: { flexBasis: percent } },
      props.changes,
    ),
    h(
      'div',
      {
        className: 'dshgg-splitter',
        role: 'separator',
        'aria-orientation': 'horizontal',
        'aria-label': props.label,
        'aria-valuemin': Math.round(MIN_SPLIT_RATIO * 100),
        'aria-valuemax': Math.round(MAX_SPLIT_RATIO * 100),
        'aria-valuenow': Math.round(ratio * 100),
        'data-dragging': dragging === true ? 'true' : undefined,
        tabIndex: 0,
        title: props.hint,
        onPointerDown: beginDrag,
        onPointerMove: moveDrag,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        onKeyDown: handleKey,
      },
      h('span', { className: 'dshgg-splitterLine' }),
    ),
    h(
      'div',
      {
        className: 'dshgg-scroll dshgg-paneBottom',
        ref: props.graphRef,
        onScroll: props.onGraphScroll,
      },
      props.graph,
    ),
  )
}
