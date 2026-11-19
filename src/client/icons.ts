/**
 * Inline SVG icon components; all of them are sized from a single helper.
 */

import type React from 'react'
import { createElement } from 'react'

const h = createElement

/** Props every icon component accepts. */
export interface IconProps {
  /** Icon edge length in pixels. */
  readonly size?: number
  /** Extra class name. */
  readonly className?: string
}

/** Presentation options for {@link svgIcon}. */
interface SvgIconOptions {
  /** SVG fill; defaults to `none`. */
  readonly fill?: string
  /** Stroke width; defaults to 1.3. */
  readonly strokeWidth?: number
  /** Extra class name; undefined means no extra class. */
  readonly className?: string | undefined
}

/** A React component that draws one inline SVG icon. */
export type IconComponent = (props: IconProps) => React.ReactElement

/**
 * Build one inline SVG with the shared sizing and accessibility attributes.
 * @param size - edge length in pixels.
 * @param path - child shapes.
 * @param options - fill, stroke width and class name.
 * @returns the SVG element.
 */
export function svgIcon(
  size: number,
  path: React.ReactNode,
  options: SvgIconOptions = {},
): React.ReactElement {
  return h(
    'svg',
    {
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
    },
    path,
  )
}

export function GitBranchIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 16
  return svgIcon(size, [
    h('circle', { key: 'a', cx: 4.5, cy: 3.5, r: 1.6 }),
    h('circle', { key: 'b', cx: 4.5, cy: 12.5, r: 1.6 }),
    h('circle', { key: 'c', cx: 11.5, cy: 6.5, r: 1.6 }),
    h('path', { key: 'd', d: 'M4.5 5.1v5.8' }),
    h('path', { key: 'e', d: 'M11.5 8.1c0 2.1-2.4 3-7 3.4' }),
  ])
}

export function ArrowLeftIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 14
  return svgIcon(size, [
    h('path', { key: 'a', d: 'M13 8H4' }),
    h('path', { key: 'b', d: 'M7.5 3.5 3 8l4.5 4.5' }),
  ])
}

export function ChevronRightIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 12
  return svgIcon(size, h('path', { d: 'M6 3.5 10.5 8 6 12.5' }), { className: props?.className })
}

export function ChevronDownIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 12
  return svgIcon(size, h('path', { d: 'M3.5 6 8 10.5 12.5 6' }), { className: props?.className })
}

export function RefreshIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 14
  return svgIcon(size, [
    h('path', { key: 'a', d: 'M13 8a5 5 0 1 1-1.7-3.75' }),
    h('path', { key: 'b', d: 'M13 2.5v3.2H9.8' }),
  ])
}

export function PlusIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 14
  return svgIcon(size, [
    h('path', { key: 'a', d: 'M8 3v10' }),
    h('path', { key: 'b', d: 'M3 8h10' }),
  ])
}

export function MinusIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 14
  return svgIcon(size, h('path', { d: 'M3 8h10' }))
}

export function UndoIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 14
  return svgIcon(size, [
    h('path', { key: 'a', d: 'M5.5 4.5 2.5 7.5l3 3' }),
    h('path', { key: 'b', d: 'M2.5 7.5H9a4 4 0 0 1 0 8H7' }),
  ])
}

export function CheckIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 14
  return svgIcon(size, h('path', { d: 'M3 8.5 6.2 11.5 13 4.5' }))
}

/** Overflow ellipsis, after VS Code's `ellipsis` codicon. */
export function MoreIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 16
  return svgIcon(
    size,
    [
      h('circle', { key: 'a', cx: 3.5, cy: 8, r: 1.1, fill: 'currentColor', stroke: 'none' }),
      h('circle', { key: 'b', cx: 8, cy: 8, r: 1.1, fill: 'currentColor', stroke: 'none' }),
      h('circle', { key: 'c', cx: 12.5, cy: 8, r: 1.1, fill: 'currentColor', stroke: 'none' }),
    ],
    { className: props?.className },
  )
}

export function CloseIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 12
  return svgIcon(size, [
    h('path', { key: 'a', d: 'M4 4l8 8' }),
    h('path', { key: 'b', d: 'M12 4l-8 8' }),
  ])
}

export function FileIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 14
  return svgIcon(size, [
    h('path', { key: 'a', d: 'M4 1.8h5l3 3v9.4H4z' }),
    h('path', { key: 'b', d: 'M9 1.8v3h3' }),
  ])
}

export function AlertIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 16
  return svgIcon(size, [
    h('circle', { key: 'a', cx: 8, cy: 8, r: 6.4 }),
    h('path', { key: 'b', d: 'M8 4.8v4.2' }),
    h('path', { key: 'c', d: 'M8 11.6h.01' }),
  ])
}

/** Checked-out branch reference, after VS Code's `target` codicon. */
export function TargetIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 16
  return svgIcon(
    size,
    [
      h('circle', { key: 'a', cx: 8, cy: 8, r: 6 }),
      h('circle', { key: 'b', cx: 8, cy: 8, r: 3.5 }),
      h('circle', { key: 'c', cx: 8, cy: 8, r: 1, fill: 'currentColor' }),
    ],
    { strokeWidth: 1.1, className: props?.className },
  )
}

/** Remote-tracking branch reference, after VS Code's `cloud` codicon. */
export function CloudIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 16
  return svgIcon(
    size,
    h('path', {
      d: 'M4.6 12.5h7.1a2.8 2.8 0 0 0 .4-5.57A4.2 4.2 0 0 0 4 6.3a3.1 3.1 0 0 0 .6 6.2z',
    }),
    { strokeWidth: 1.1, className: props?.className },
  )
}

/** Tag reference, after VS Code's `tag` codicon. */
export function TagIcon(props: IconProps): React.ReactElement {
  const size = props?.size ?? 16
  return svgIcon(
    size,
    [
      h('path', { key: 'a', d: 'M2.5 2.5h5l6 6-5 5-6-6z' }),
      h('circle', { key: 'b', cx: 5.4, cy: 5.4, r: 1 }),
    ],
    { strokeWidth: 1.1, className: props?.className },
  )
}
