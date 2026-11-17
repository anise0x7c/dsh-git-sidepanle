/**
 * The commit graph's drawing primitives: the theme color reference, the one line
 * layer that carries every row's swimlanes, and the node cell of one row.
 *
 * Presentational only; the layout comes from the pure `git/graph.ts`.
 */

import type React from 'react'
import { createElement } from 'react'
import type { GraphColor, GraphLayer, GraphRowGeometry } from '../../../git/graph.ts'

const h = createElement

/**
 * CSS value of a graph color identifier.
 * @param color - graph color.
 * @returns `var(--dshgg-scm-…)` reference.
 */
export function graphColorValue(color: GraphColor): string {
  return `var(--dshgg-scm-${color})`
}

/** Props of the rows' shared line layer. */
export interface GraphBodyProps {
  /** The whole graph's lines and node gaps. */
  readonly layer: GraphLayer
  /** Document-unique id of the layer's mask. */
  readonly maskId: string
  /** Row whose node gap is closed, if any. */
  readonly hovered: number | null
  /** The commit rows. */
  readonly children?: React.ReactNode
}

/**
 * The graph's rows and the one layer that draws their lines. The layer takes the
 * rows as children so a hover only re-renders the layer and its mask, never the
 * rows themselves.
 * @param props - layer, hovered row and rows.
 * @returns the rows with their line layer.
 */
export function GraphBody(props: GraphBodyProps): React.ReactElement {
  const layer = props.layer
  return h(
    'div',
    { className: 'dshgg-graphBody' },
    h(
      'svg',
      {
        className: 'dshgg-graphLayer',
        width: layer.width,
        height: layer.height,
        viewBox: `0 0 ${layer.width} ${layer.height}`,
        'aria-hidden': 'true',
        focusable: false,
      },
      h(
        'defs',
        null,
        h(
          'mask',
          {
            id: props.maskId,
            maskUnits: 'userSpaceOnUse',
            x: 0,
            y: 0,
            width: layer.width,
            height: layer.height,
          },
          h('rect', { x: 0, y: 0, width: layer.width, height: layer.height, fill: 'white' }),
          layer.gaps.map((gap) =>
            h('circle', {
              key: `gap:${gap.row}`,
              className: 'dshgg-graphGap',
              cx: gap.cx,
              cy: gap.cy,
              r: props.hovered === gap.row ? gap.hoverGap : gap.gap,
              fill: 'black',
            }),
          ),
        ),
      ),
      h(
        'g',
        { className: 'dshgg-graphLines', mask: `url(#${props.maskId})` },
        layer.paths.map((path, index) =>
          h('path', {
            key: `${path.color}:${index}`,
            className: 'dshgg-graphEdge',
            'data-color': path.color,
            d: path.d,
            style: { stroke: graphColorValue(path.color) },
          }),
        ),
      ),
    ),
    props.children,
  )
}

/**
 * The row's cell (VS Code `renderSCMHistoryItemGraph`): the node on top of the
 * section's line layer, sized to the row's graph width so the text starts right
 * after it. The node circles carry their hover radii as custom properties for
 * the stylesheet.
 * @param props - row geometry.
 * @returns the SVG cell.
 */
export function GraphCell(props: { geometry: GraphRowGeometry }): React.ReactElement {
  const geometry = props.geometry
  const node = geometry.node
  return h(
    'svg',
    {
      className: 'dshgg-graphSvg',
      width: geometry.width,
      height: geometry.height,
      viewBox: `0 0 ${geometry.width} ${geometry.height}`,
      'aria-hidden': 'true',
      focusable: false,
    },
    node.circles.map((circle, index) =>
      h('circle', {
        key: `node:${index}`,
        className: 'dshgg-graphNode',
        'data-shape': node.shape,
        'data-paint': circle.paint,
        'data-color': node.color,
        cx: node.cx,
        cy: node.cy,
        r: circle.r,
        ...(circle.paint === 'ring'
          ? {
              fill: 'none',
              strokeWidth: circle.strokeWidth,
              style: {
                stroke: graphColorValue(node.color),
                '--dshgg-node-hover-r': `${circle.hoverR}px`,
                '--dshgg-node-hover-stroke': `${circle.hoverStrokeWidth}px`,
              },
            }
          : {
              style: {
                fill: graphColorValue(node.color),
                '--dshgg-node-hover-r': `${circle.hoverR}px`,
              },
            }),
      }),
    ),
  )
}
