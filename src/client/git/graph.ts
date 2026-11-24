/**
 * Commit-graph layout and drawing, ported from Code OSS's Source Control Graph:
 * microsoft/vscode `src/vs/workbench/contrib/scm/browser/scmHistory.ts`
 * (`toISCMHistoryItemViewModelArray`, `renderSCMHistoryItemGraph`,
 * `renderSCMHistoryGraphPlaceholder`) and `scmHistoryViewPane.ts`
 * (`HistoryItemRenderer._renderBadges`, `HistoryItemChangeRenderer`).
 * Copyright (c) Microsoft Corporation. Licensed under the MIT License.
 *
 * Every row carries the ordered swimlanes entering it from above (`input`) and
 * leaving it below (`output`); each swimlane is a line heading for one commit.
 * A commit's node sits on the leftmost input lane heading for it, its first
 * parent continues in that position, further lanes heading for the commit join
 * the node and end, every additional merge parent opens a lane at the right
 * end, and lanes right of an ended lane shift left. The constants, color
 * rotation, SVG path commands and badge grouping follow Code OSS; see the
 * change's design notes for the deliberate deviations (root commits keep other
 * lanes; node gaps are a mask rather than background-colored strokes; the lines
 * of the whole graph are one layer, so a lane crossing a row boundary is one
 * stroke instead of two; an expanded commit widens its own node lane, so VS
 * Code's wide change-row stroke starts at the row's top edge instead of its
 * bottom edge; the palette is restyled within its hue families).
 *
 * Pure data in and out: no React, no DOM, no plugin context, so the layout is
 * directly unit-testable.
 */

import type { GraphReference, GraphReferences } from '../types/domain.ts'
import type { ParsedRef, RefKind } from './format.ts'

/** Row height (Code OSS `SWIMLANE_HEIGHT`). */
export const SWIMLANE_HEIGHT = 22
/** Lane pitch; lane `i` is centered at `SWIMLANE_WIDTH * (i + 1)` (Code OSS `SWIMLANE_WIDTH`). */
export const SWIMLANE_WIDTH = 11
/**
 * Stroke of the node's own lane through an expanded commit's change rows (the
 * `highlightIndex` stroke of Code OSS `renderSCMHistoryGraphPlaceholder`).
 */
export const HIGHLIGHT_STROKE_WIDTH = 3
/** Radius of the turns of a shifting lane (Code OSS `SWIMLANE_CURVE_RADIUS`). */
export const SWIMLANE_CURVE_RADIUS = 5
/** Base node radius (Code OSS `CIRCLE_RADIUS`). */
export const CIRCLE_RADIUS = 4
/** Stroke of Code OSS's node circles (Code OSS `CIRCLE_STROKE_WIDTH`). */
export const CIRCLE_STROKE_WIDTH = 2
/**
 * How far above its own top edge, in pixels, a row also draws the lanes it takes
 * over from the row above. Within one color the whole graph is a single path, so
 * the overlap costs nothing; it is there for the few places where a lane changes
 * color at a row boundary, where the two colors cannot share one element and the
 * upper one would otherwise leave the shared device pixel half covered.
 */
export const ROW_OVERHANG = 1

/** The five rotation colors, in rotation order: gold, crimson, copper, emerald and violet, restyled from Code OSS's `scmGraph.foreground1`..`5`. */
export const LANE_COLORS = ['lane1', 'lane2', 'lane3', 'lane4', 'lane5'] as const

/** One rotation color. */
export type LaneColor = (typeof LANE_COLORS)[number]

/**
 * Fixed reference colors: `ref` is `scmGraph.historyItemRefColor` (checked-out
 * branch), `remote` is `historyItemRemoteRefColor` (its upstream) and `base`
 * is `historyItemBaseRefColor` (its base branch).
 */
export type RefColor = 'ref' | 'remote' | 'base'

/** Any graph color identifier. */
export type GraphColor = LaneColor | RefColor

/** A commit as the graph layout reads it. */
export interface GraphCommit {
  /** Full commit identifier. */
  readonly oid: string
  /** Parent identifiers, first parent first. */
  readonly parents?: readonly string[]
  /** References decorating the commit. */
  readonly refs?: readonly ParsedRef[]
}

/** One line heading for a commit (Code OSS `ISCMHistoryItemGraphNode`). */
export interface Swimlane {
  /** Commit the line heads for. */
  readonly id: string
  /** Line color. */
  readonly color: GraphColor
}

/** A reference with the color its badge uses. */
export interface ColoredRef extends ParsedRef {
  /** Badge color. */
  readonly color: GraphColor
}

/** One laid-out commit row (Code OSS `ISCMHistoryItemViewModel`). */
export interface GraphRow {
  /** Full commit identifier. */
  readonly oid: string
  /** `HEAD` for the checked-out commit, `node` otherwise. */
  readonly kind: 'HEAD' | 'node'
  /** Parent identifiers, first parent first. */
  readonly parents: readonly string[]
  /** Lanes entering the row from above. */
  readonly input: readonly Swimlane[]
  /** Lanes leaving the row below. */
  readonly output: readonly Swimlane[]
  /** Position of the node. */
  readonly lane: number
  /** Node color. */
  readonly color: GraphColor
  /** References in Code OSS's badge order, with their colors. */
  readonly refs: readonly ColoredRef[]
}

/** One stroked line of a row. */
export interface GraphPath {
  /** SVG path data, in Code OSS's command spelling. */
  readonly d: string
  /** Line color. */
  readonly color: GraphColor
  /** Stroke width in pixels; omitted for Code OSS's one-pixel lines. */
  readonly width?: number
}

/** Node shape: filled dot, merge ring with center dot, or checked-out ring. */
export type GraphNodeShape = 'node' | 'merge' | 'head'

/** One visible circle of a node, at rest and while its row is hovered. */
export interface GraphNodeCircle {
  /** `fill` paints a disc; `ring` strokes the circle without filling it. */
  readonly paint: 'fill' | 'ring'
  /** Radius at rest. */
  readonly r: number
  /** Radius while hovered. */
  readonly hoverR: number
  /** Ring stroke width at rest; zero for a disc. */
  readonly strokeWidth: number
  /** Ring stroke width while hovered; zero for a disc. */
  readonly hoverStrokeWidth: number
}

/** The node of one row. */
export interface GraphNodeGeometry {
  /** Node shape. */
  readonly shape: GraphNodeShape
  /** Centre x. */
  readonly cx: number
  /** Centre y. */
  readonly cy: number
  /** Node color. */
  readonly color: GraphColor
  /** Visible circles, back to front. */
  readonly circles: readonly GraphNodeCircle[]
  /** Radius around the centre in which lines are hidden at rest. */
  readonly gap: number
  /** Radius around the centre in which lines are hidden while hovered. */
  readonly hoverGap: number
}

/** SVG geometry for one row. */
export interface GraphRowGeometry {
  /** Graph cell width; the row's text begins right after it. */
  readonly width: number
  /** Row height. */
  readonly height: number
  /** Height above the row's top edge that the row's lines also cover. */
  readonly overhang: number
  /** Segments carrying the row's incoming lanes through the overhang above it. */
  readonly bridge: readonly GraphPath[]
  /** Lines of this row, in Code OSS's drawing order. */
  readonly paths: readonly GraphPath[]
  /** Node. */
  readonly node: GraphNodeGeometry
}

/** Badge icon, after Code OSS's codicons for each reference family. */
export type BadgeIcon = 'target' | 'branch' | 'cloud' | 'tag'

/** One reference badge (Code OSS `div.label`). */
export interface RefBadge {
  /** Badge background color. */
  readonly color: GraphColor
  /** Icon. */
  readonly icon: BadgeIcon
  /** Name shown beside the icon; only the first colored reference has one. */
  readonly name: string | null
  /** Number of references the badge stands for; shown when above one. */
  readonly count: number
  /** References the badge stands for. */
  readonly refs: readonly ColoredRef[]
}

/**
 * Rotate an index into a range (Code OSS `rot`).
 * @param index - index.
 * @param modulo - range size.
 * @returns index in `[0, modulo)`.
 */
function rot(index: number, modulo: number): number {
  return (modulo + (index % modulo)) % modulo
}

/**
 * Order of a reference family in the Git extension's decoration sort.
 * @param ref - reference.
 * @returns sort key.
 */
function familyOrder(ref: ParsedRef): number {
  if (ref.id.startsWith('refs/heads/')) return 1
  if (ref.id.startsWith('refs/remotes/')) return 2
  if (ref.id.startsWith('refs/tags/')) return 3
  return 99
}

/**
 * Sort references the way Code OSS's Git extension reports them: local
 * branches, remote branches, tags, each by name.
 * @param refs - references.
 * @returns sorted copy.
 */
export function sortRefs(refs: readonly ParsedRef[]): ParsedRef[] {
  return refs.slice().sort((left, right) => {
    const order = familyOrder(left) - familyOrder(right)
    return order !== 0 ? order : left.name.localeCompare(right.name)
  })
}

/**
 * Build Code OSS's graph color map from the special references. Only these map
 * to a color; every other reference takes its node's color, as under Code OSS's
 * "All" filter.
 * @param references - special references, if known.
 * @returns color by reference id.
 */
export function referenceColors(
  references: GraphReferences | null | undefined,
): Map<string, RefColor> {
  const colors = new Map<string, RefColor>()
  const current = references?.current
  if (current === null || current === undefined) return colors
  colors.set(current.id, 'ref')
  if (references?.remote) colors.set(references.remote.id, 'remote')
  if (references?.base) colors.set(references.base.id, 'base')
  return colors
}

/**
 * The first fixed color among a commit's references (Code OSS
 * `getLabelColorIdentifier`).
 * @param refs - references in decoration-sort order.
 * @param colors - color map.
 * @returns fixed color, or undefined.
 */
function labelColor(
  refs: readonly ParsedRef[],
  colors: ReadonlyMap<string, RefColor>,
): RefColor | undefined {
  for (const ref of refs) {
    const color = colors.get(ref.id)
    if (color !== undefined) return color
  }
  return undefined
}

/**
 * Move the fixed-color references onto the commits they currently point at.
 *
 * A history read reports each commit's decoration as it was when the page was
 * fetched. After an external checkout or fetch the checked-out, upstream and
 * base references may point somewhere else, and re-reading those three is much
 * cheaper than refetching every loaded commit. Re-binding their badges here
 * keeps the loaded rows accurate in place; decorations of every other
 * reference stay as read until the next history load.
 * @param commits - loaded commits with their decoration refs.
 * @param references - current checked-out, upstream and base references.
 * @returns commits whose special-reference badges sit on the current targets.
 */
export function bindReferenceTargets(
  commits: readonly GraphCommit[],
  references: GraphReferences | null | undefined,
): GraphCommit[] {
  const special: readonly (readonly [GraphReference | null | undefined, RefKind])[] = [
    [references?.current, 'head'],
    [references?.remote, 'remote'],
    [references?.base, 'branch'],
  ]
  const moving = new Set<string>()
  const additions = new Map<string, ParsedRef[]>()
  for (const [reference, kind] of special) {
    // A detached HEAD names a commit, not a ref, and has no badge.
    if (reference === null || reference === undefined || !reference.id.startsWith('refs/')) continue
    moving.add(reference.id)
    const ref: ParsedRef = { id: reference.id, name: reference.name, kind }
    const target = additions.get(reference.revision)
    if (target === undefined) additions.set(reference.revision, [ref])
    else target.push(ref)
  }
  if (moving.size === 0) {
    // A detached HEAD still has to demote the branch badge the previous read
    // marked as checked out.
    const currentId = references?.current?.id
    if (currentId === undefined) return commits.slice()
    return commits.map((commit) => ({
      ...commit,
      refs: (commit.refs ?? []).map((ref) =>
        ref.kind === 'head' && ref.id !== currentId ? { ...ref, kind: 'branch' as const } : ref,
      ),
    }))
  }
  const currentId = references?.current?.id
  return commits.map((commit) => {
    const refs = (commit.refs ?? [])
      .filter((ref) => !moving.has(ref.id))
      .map((ref) =>
        ref.kind === 'head' && ref.id !== currentId ? { ...ref, kind: 'branch' as const } : ref,
      )
    const added = additions.get(commit.oid)
    if (added !== undefined) refs.push(...added)
    return { ...commit, refs }
  })
}

/**
 * Sanitize a parent list.
 * @param parents - raw parents.
 * @returns non-empty string parents.
 */
function cleanParents(parents: unknown): string[] {
  if (!Array.isArray(parents)) return []
  return parents.filter((parent): parent is string => typeof parent === 'string' && parent !== '')
}

/**
 * Lay commits out in swimlanes (Code OSS `toISCMHistoryItemViewModelArray`).
 * @param commits - commits in topological display order, newest first.
 * @param references - checked-out, upstream and base references.
 * @returns one row per commit.
 */
export function computeGraph(
  commits: readonly GraphCommit[],
  references?: GraphReferences | null,
): GraphRow[] {
  const colors = referenceColors(references)
  const sortedRefs = new Map<string, ParsedRef[]>()
  for (const commit of commits) {
    if (!sortedRefs.has(commit.oid)) sortedRefs.set(commit.oid, sortRefs(commit.refs ?? []))
  }
  const currentRevision = references?.current?.revision
  const currentId = references?.current?.id
  const remoteId = references?.remote?.id
  const baseId = references?.base?.id
  const rows: GraphRow[] = []
  let colorIndex = -1

  for (const commit of commits) {
    const parents = cleanParents(commit.parents)
    const refs = sortedRefs.get(commit.oid) ?? []
    const commitLabelColor = labelColor(refs, colors)
    const input = rows.at(-1)?.output.map((lane) => ({ ...lane })) ?? []
    const output: Swimlane[] = []
    let firstParentAdded = false

    // Continue the first parent in the node's position; drop the commit's
    // other incoming lanes. Code OSS skips this loop for a parentless commit and
    // so drops every lane; the port keeps the unrelated ones.
    for (const lane of input) {
      if (lane.id === commit.oid) {
        const first = parents[0]
        if (!firstParentAdded && first !== undefined) {
          output.push({ id: first, color: commitLabelColor ?? lane.color })
          firstParentAdded = true
        }
        continue
      }
      output.push({ ...lane })
    }

    // Every parent not continued above opens a lane at the right end.
    for (let index = firstParentAdded ? 1 : 0; index < parents.length; index += 1) {
      const parent = parents[index]
      if (parent === undefined) continue
      let color: GraphColor | undefined =
        index === 0 ? commitLabelColor : labelColor(sortedRefs.get(parent) ?? [], colors)
      if (color === undefined) {
        colorIndex = rot(colorIndex + 1, LANE_COLORS.length)
        color = LANE_COLORS[colorIndex] ?? 'lane1'
      }
      output.push({ id: parent, color })
    }

    const inputIndex = input.findIndex((lane) => lane.id === commit.oid)
    const lane = inputIndex !== -1 ? inputIndex : input.length
    const color: GraphColor =
      parents.length > 0 && lane < output.length
        ? (output[lane]?.color ?? 'ref')
        : lane < input.length
          ? (input[lane]?.color ?? 'ref')
          : 'ref'

    const coloredRefs: ColoredRef[] = refs.map((ref) => ({
      ...ref,
      color: colors.get(ref.id) ?? color,
    }))
    /**
     * Code OSS `compareHistoryItemRefs` order.
     * @param ref - colored reference.
     * @returns sort key.
     */
    const badgeOrder = (ref: ColoredRef): number => {
      if (ref.id === currentId) return 1
      if (ref.id === remoteId) return 2
      if (ref.id === baseId) return 3
      return 4
    }
    coloredRefs.sort((left, right) => badgeOrder(left) - badgeOrder(right))

    rows.push({
      oid: commit.oid,
      kind: currentRevision !== undefined && commit.oid === currentRevision ? 'HEAD' : 'node',
      parents,
      input,
      output,
      lane,
      color,
      refs: coloredRefs,
    })
  }
  return rows
}

/**
 * Lane centre x.
 * @param lane - lane index.
 * @returns pixel x.
 */
function laneX(lane: number): number {
  return SWIMLANE_WIDTH * (lane + 1)
}

/**
 * A straight vertical line (Code OSS `drawVerticalLine`).
 * @param x - x.
 * @param y1 - start y.
 * @param y2 - end y.
 * @returns SVG path data.
 */
function verticalLine(x: number, y1: number, y2: number): string {
  return `M ${x} ${y1} V ${y2}`
}

/**
 * Find the last lane heading for a commit.
 * @param lanes - lanes.
 * @param id - commit identifier.
 * @returns index, or -1.
 */
function findLastIndex(lanes: readonly Swimlane[], id: string): number {
  for (let index = lanes.length - 1; index >= 0; index -= 1) {
    if (lanes[index]?.id === id) return index
  }
  return -1
}

/**
 * Segments that carry the row's incoming lanes through the overhang above its
 * top edge (see `ROW_OVERHANG`). Every incoming lane arrives at the row's top
 * edge in its own position, and the row above leaves that position at its
 * bottom edge, so one short segment per lane joins the two rows' strokes.
 * @param input - lanes entering the row.
 * @param offset - distance from the top of the graph, in pixels.
 * @returns one path per incoming lane, in lane order.
 */
function bridgePaths(input: readonly Swimlane[], offset: number): GraphPath[] {
  const paths: GraphPath[] = []
  for (let index = 0; index < input.length; index += 1) {
    const lane = input[index]
    if (lane === undefined) continue
    paths.push({
      d: `M ${laneX(index)} ${offset - ROW_OVERHANG} V ${offset}`,
      color: lane.color,
    })
  }
  return paths
}

/**
 * Node circles and gaps per shape. Visible radii equal Code OSS's circles after
 * their background-colored strokes: a normal node is a 4px disc with a gap to
 * 6px; a merge node a 2px dot inside a ring from 4 to 5px with a gap to 7px;
 * the checked-out node a ring from 4 to 6px with a gap to 8px. On hover Code OSS
 * makes the outer stroke transparent, so the outer edge grows by its half
 * stroke and the outer gap closes.
 */
const NODE_SHAPES: Record<
  GraphNodeShape,
  { circles: GraphNodeCircle[]; gap: number; hoverGap: number }
> = {
  node: {
    circles: [{ paint: 'fill', r: 4, hoverR: 5, strokeWidth: 0, hoverStrokeWidth: 0 }],
    gap: 6,
    hoverGap: 5,
  },
  merge: {
    circles: [
      { paint: 'ring', r: 4.5, hoverR: 5, strokeWidth: 1, hoverStrokeWidth: 2 },
      { paint: 'fill', r: 2, hoverR: 2, strokeWidth: 0, hoverStrokeWidth: 0 },
    ],
    gap: 7,
    hoverGap: 6,
  },
  head: {
    circles: [{ paint: 'ring', r: 5, hoverR: 5.5, strokeWidth: 2, hoverStrokeWidth: 3 }],
    gap: 8,
    hoverGap: 7,
  },
}

/**
 * Build one row's SVG geometry (Code OSS `renderSCMHistoryItemGraph`). Every y
 * lands in the graph's own coordinates, so a path that carries several rows can
 * be built by calling this once per row with the row's offset.
 * @param row - laid-out row.
 * @param offset - distance from the top of the graph, in pixels, added to every y.
 * @param expanded - whether the row's changes are listed below it; the lane
 *   from its node down into those rows is then drawn at the wide stroke.
 * @returns geometry for the row.
 */
export function graphRowGeometry(row: GraphRow, offset = 0, expanded = false): GraphRowGeometry {
  const { input, output, parents } = row
  const circleIndex = row.lane
  const paths: GraphPath[] = []
  const W = SWIMLANE_WIDTH
  const H = SWIMLANE_HEIGHT
  /** A y coordinate of this row, in the graph's coordinates. */
  const y = (value: number): number => value + offset

  let outputIndex = 0
  for (let index = 0; index < input.length; index += 1) {
    const lane = input[index]
    if (lane === undefined) continue
    if (lane.id === row.oid) {
      if (index !== circleIndex) {
        // Another lane heading for this commit: draw ╯ then ─ into the node.
        paths.push({
          d: [
            `M ${laneX(index)} ${y(0)}`,
            `A ${W} ${W} 0 0 1 ${W * index} ${y(W)}`,
            `H ${laneX(circleIndex)}`,
          ].join(' '),
          color: lane.color,
        })
      } else if (parents.length > 0) {
        outputIndex += 1
      }
      continue
    }
    const next = output[outputIndex]
    if (next === undefined || lane.id !== next.id) continue
    if (index === outputIndex) {
      paths.push({ d: verticalLine(laneX(index), y(0), y(H)), color: lane.color })
    } else {
      // A lane shifting left: | then ╯ then ─ then ╭ then |.
      paths.push({
        d: [
          `M ${laneX(index)} ${y(0)}`,
          `V ${y(6)}`,
          `A ${SWIMLANE_CURVE_RADIUS} ${SWIMLANE_CURVE_RADIUS} 0 0 1 ${laneX(index) - SWIMLANE_CURVE_RADIUS} ${y(H / 2)}`,
          `H ${laneX(outputIndex) + SWIMLANE_CURVE_RADIUS}`,
          `A ${SWIMLANE_CURVE_RADIUS} ${SWIMLANE_CURVE_RADIUS} 0 0 0 ${laneX(outputIndex)} ${y(H / 2 + SWIMLANE_CURVE_RADIUS)}`,
          `V ${y(H)}`,
        ].join(' '),
        color: lane.color,
      })
    }
    outputIndex += 1
  }

  // Additional parents: ─ from the node then ╮ into their lane.
  for (let index = 1; index < parents.length; index += 1) {
    const parent = parents[index]
    if (parent === undefined) continue
    const parentIndex = findLastIndex(output, parent)
    const lane = output[parentIndex]
    if (parentIndex === -1 || lane === undefined) continue
    paths.push({
      d: [
        `M ${W * parentIndex} ${y(H / 2)}`,
        `A ${W} ${W} 0 0 1 ${W * (parentIndex + 1)} ${y(H)}`,
        `M ${W * parentIndex} ${y(H / 2)}`,
        `H ${laneX(circleIndex)}`,
      ].join(' '),
      color: lane.color,
    })
  }

  const inputIndex = input.findIndex((lane) => lane.id === row.oid)
  const incoming = input[inputIndex]
  if (incoming !== undefined) {
    // The line arriving from the commit above stays one pixel wide; the node
    // below it is what widens, so the wide line begins at the node itself.
    paths.push({ d: verticalLine(laneX(circleIndex), y(0), y(H / 2)), color: incoming.color })
  }
  if (parents.length > 0) {
    const d = verticalLine(laneX(circleIndex), y(H / 2), y(H))
    paths.push(
      expanded ? { d, color: row.color, width: HIGHLIGHT_STROKE_WIDTH } : { d, color: row.color },
    )
  }

  const shape: GraphNodeShape = row.kind === 'HEAD' ? 'head' : parents.length > 1 ? 'merge' : 'node'
  const shapeSpec = NODE_SHAPES[shape]
  return {
    width: W * (Math.max(input.length, output.length, 1) + 1),
    height: H,
    overhang: ROW_OVERHANG,
    bridge: bridgePaths(input, offset),
    paths,
    node: {
      shape,
      cx: laneX(circleIndex),
      cy: y(W),
      color: row.color,
      circles: shapeSpec.circles,
      gap: shapeSpec.gap,
      hoverGap: shapeSpec.hoverGap,
    },
  }
}

/** One node gap the graph's line layer cuts around. */
export interface GraphGap {
  /** Index of the row the node belongs to. */
  readonly row: number
  /** Gap centre x, in the layer's coordinates. */
  readonly cx: number
  /** Gap centre y, in the layer's coordinates. */
  readonly cy: number
  /** Radius that hides the lines at rest. */
  readonly gap: number
  /** Radius that hides the lines while the row is hovered. */
  readonly hoverGap: number
}

/**
 * Lines of one change row under an expanded commit (Code OSS
 * `renderSCMHistoryGraphPlaceholder(outputSwimlanes, highlightIndex)`): every
 * lane leaving the commit runs vertically through the row in its own position
 * and color, and the lane in the node's position is drawn wider. Code OSS's
 * highlight index is the node's input position, or the input count when no lane
 * expected the commit, which is exactly the row's `lane`.
 * @param row - laid-out commit row whose changes are listed.
 * @param offset - distance of the change row from the top of the graph, in pixels.
 * @returns one path per outgoing lane, in lane order.
 */
export function graphPlaceholderPaths(row: GraphRow, offset = 0): GraphPath[] {
  const paths: GraphPath[] = []
  for (let index = 0; index < row.output.length; index += 1) {
    const lane = row.output[index]
    if (lane === undefined) continue
    const d = verticalLine(laneX(index), offset, offset + SWIMLANE_HEIGHT)
    paths.push(
      index === row.lane
        ? { d, color: lane.color, width: HIGHLIGHT_STROKE_WIDTH }
        : { d, color: lane.color },
    )
  }
  return paths
}

/**
 * Width of the graph area of a change row under an expanded commit (Code OSS
 * `SWIMLANE_WIDTH * (outputSwimlanes.length + 1)`); the row's icon begins
 * right after it.
 * @param row - laid-out commit row whose changes are listed.
 * @returns graph area width in pixels.
 */
export function graphPlaceholderWidth(row: GraphRow): number {
  return SWIMLANE_WIDTH * (row.output.length + 1)
}

/** All of a graph's lines, drawn as one layer. */
export interface GraphLayer {
  /**
   * One path per color and stroke width, in the order they first appear. Every
   * row's segments go into the same element, because a single element is
   * rasterized once: a lane that crosses a row boundary keeps exactly the
   * coverage it has anywhere else instead of being split into two antialiased
   * strokes that leave a seam between them.
   */
  readonly paths: readonly GraphPath[]
  /** Node gaps, top to bottom. */
  readonly gaps: readonly GraphGap[]
  /** Layer width; the widest row's cell. */
  readonly width: number
  /** Layer height; one row height per commit row and per inserted change row. */
  readonly height: number
}

/**
 * Collect every row's lines into one layer for the whole graph.
 * @param rows - laid-out rows, top to bottom.
 * @param inserted - number of change rows listed below each commit row, by row
 *   index; a missing or non-positive entry inserts none.
 * @returns the layer's paths, node gaps and size.
 */
export function graphLayer(
  rows: readonly GraphRow[],
  inserted: readonly number[] = [],
): GraphLayer {
  const segments = new Map<string, { color: GraphColor; width: number | undefined; d: string[] }>()
  const gaps: GraphGap[] = []
  let width = 0
  let top = 0
  const add = (path: GraphPath): void => {
    const key = `${path.color}:${path.width ?? 1}`
    const entry = segments.get(key)
    if (entry === undefined)
      segments.set(key, { color: path.color, width: path.width, d: [path.d] })
    else entry.d.push(path.d)
  }
  rows.forEach((row, index) => {
    const count = inserted[index] ?? 0
    const geometry = graphRowGeometry(row, top, count > 0)
    width = Math.max(width, geometry.width)
    for (const path of [...geometry.bridge, ...geometry.paths]) add(path)
    gaps.push({
      row: index,
      cx: geometry.node.cx,
      cy: geometry.node.cy,
      gap: geometry.node.gap,
      hoverGap: geometry.node.hoverGap,
    })
    top += SWIMLANE_HEIGHT
    for (let child = 0; child < count; child += 1) {
      for (const path of graphPlaceholderPaths(row, top)) add(path)
      width = Math.max(width, graphPlaceholderWidth(row))
      top += SWIMLANE_HEIGHT
    }
  })
  return {
    paths: [...segments.values()].map(({ color, width: stroke, d }) =>
      stroke === undefined ? { d: d.join(' '), color } : { d: d.join(' '), color, width: stroke },
    ),
    gaps,
    width,
    height: top,
  }
}

/**
 * Badge icon of a reference family (the Git extension's `Icons`).
 * @param kind - reference family.
 * @returns badge icon.
 */
export function badgeIcon(kind: RefKind): BadgeIcon {
  if (kind === 'head') return 'target'
  if (kind === 'remote') return 'cloud'
  if (kind === 'tag') return 'tag'
  return 'branch'
}

/**
 * Group a row's references into Code OSS's badges: the first reference with
 * its name, then one icon badge per color and icon, in first-seen order.
 * @param refs - colored references in badge order.
 * @returns badges.
 */
export function refBadges(refs: readonly ColoredRef[]): RefBadge[] {
  const badges: RefBadge[] = []
  const remaining = refs.slice()
  const first = remaining[0]
  if (first !== undefined) {
    badges.push({
      color: first.color,
      icon: badgeIcon(first.kind),
      name: first.name,
      count: 1,
      refs: [first],
    })
    remaining.shift()
  }
  const byColor = new Map<GraphColor, ColoredRef[]>()
  for (const ref of remaining) {
    const group = byColor.get(ref.color)
    if (group === undefined) byColor.set(ref.color, [ref])
    else group.push(ref)
  }
  for (const [color, group] of byColor) {
    const byIcon = new Map<BadgeIcon, ColoredRef[]>()
    for (const ref of group) {
      const icon = badgeIcon(ref.kind)
      const members = byIcon.get(icon)
      if (members === undefined) byIcon.set(icon, [ref])
      else members.push(ref)
    }
    for (const [icon, members] of byIcon) {
      badges.push({ color, icon, name: null, count: members.length, refs: members })
    }
  }
  return badges
}
