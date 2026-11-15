/**
 * Inline SVG icon components; all of them are sized from a single helper.
 */

import { createElement } from 'react'

const h = createElement

export function svgIcon(size, path, options = {}) {
  return h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: options.fill ?? 'none',
    stroke: options.fill === 'currentColor' ? 'none' : 'currentColor',
    strokeWidth: options.strokeWidth ?? 1.3,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
    className: options.className,
  }, path)
}

export function GitBranchIcon(props) {
  const size = props?.size ?? 16
  return svgIcon(size, [
    h('circle', { key: 'a', cx: 4.5, cy: 3.5, r: 1.6 }),
    h('circle', { key: 'b', cx: 4.5, cy: 12.5, r: 1.6 }),
    h('circle', { key: 'c', cx: 11.5, cy: 6.5, r: 1.6 }),
    h('path', { key: 'd', d: 'M4.5 5.1v5.8' }),
    h('path', { key: 'e', d: 'M11.5 8.1c0 2.1-2.4 3-7 3.4' }),
  ])
}

export function ArrowLeftIcon(props) {
  const size = props?.size ?? 14
  return svgIcon(size, [
    h('path', { key: 'a', d: 'M13 8H4' }),
    h('path', { key: 'b', d: 'M7.5 3.5 3 8l4.5 4.5' }),
  ])
}

export function ChevronRightIcon(props) {
  const size = props?.size ?? 12
  return svgIcon(size, h('path', { d: 'M6 3.5 10.5 8 6 12.5' }), { className: props?.className })
}

export function ChevronDownIcon(props) {
  const size = props?.size ?? 12
  return svgIcon(size, h('path', { d: 'M3.5 6 8 10.5 12.5 6' }), { className: props?.className })
}

export function RefreshIcon(props) {
  const size = props?.size ?? 14
  return svgIcon(size, [
    h('path', { key: 'a', d: 'M13 8a5 5 0 1 1-1.7-3.75' }),
    h('path', { key: 'b', d: 'M13 2.5v3.2H9.8' }),
  ])
}

export function PlusIcon(props) {
  const size = props?.size ?? 14
  return svgIcon(size, [h('path', { key: 'a', d: 'M8 3v10' }), h('path', { key: 'b', d: 'M3 8h10' })])
}

export function MinusIcon(props) {
  const size = props?.size ?? 14
  return svgIcon(size, h('path', { d: 'M3 8h10' }))
}

export function UndoIcon(props) {
  const size = props?.size ?? 14
  return svgIcon(size, [
    h('path', { key: 'a', d: 'M5.5 4.5 2.5 7.5l3 3' }),
    h('path', { key: 'b', d: 'M2.5 7.5H9a4 4 0 0 1 0 8H7' }),
  ])
}

export function CheckIcon(props) {
  const size = props?.size ?? 14
  return svgIcon(size, h('path', { d: 'M3 8.5 6.2 11.5 13 4.5' }))
}

export function CloseIcon(props) {
  const size = props?.size ?? 12
  return svgIcon(size, [h('path', { key: 'a', d: 'M4 4l8 8' }), h('path', { key: 'b', d: 'M12 4l-8 8' })])
}

export function FileIcon(props) {
  const size = props?.size ?? 14
  return svgIcon(size, [
    h('path', { key: 'a', d: 'M4 1.8h5l3 3v9.4H4z' }),
    h('path', { key: 'b', d: 'M9 1.8v3h3' }),
  ])
}

export function AlertIcon(props) {
  const size = props?.size ?? 16
  return svgIcon(size, [
    h('circle', { key: 'a', cx: 8, cy: 8, r: 6.4 }),
    h('path', { key: 'b', d: 'M8 4.8v4.2' }),
    h('path', { key: 'c', d: 'M8 11.6h.01' }),
  ])
}

export function CheckCircleIcon(props) {
  const size = props?.size ?? 28
  return svgIcon(size, [
    h('circle', { key: 'a', cx: 8, cy: 8, r: 6.4 }),
    h('path', { key: 'b', d: 'M5 8.2 7.2 10.4 11.2 6' }),
  ])
}
