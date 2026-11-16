/**
 * Commit-graph layout and drawing, ported from VS Code's Source Control Graph:
 * microsoft/vscode `src/vs/workbench/contrib/scm/browser/scmHistory.ts`
 * (`toISCMHistoryItemViewModelArray`, `renderSCMHistoryItemGraph`) and
 * `scmHistoryViewPane.ts` (`HistoryItemRenderer._renderBadges`).
 * Copyright (c) Microsoft Corporation. Licensed under the MIT License.
 *
 * Every row carries the ordered swimlanes entering it from above (`input`) and
 * leaving it below (`output`); each swimlane is a line heading for one commit.
 * A commit's node sits on the leftmost input lane heading for it, its first
 * parent continues in that position, further lanes heading for the commit join
 * the node and end, every additional merge parent opens a lane at the right
 * end, and lanes right of an ended lane shift left. The constants, color
 * rotation, SVG path commands and badge grouping match VS Code; see the
 * change's design notes for the two deliberate deviations (root commits keep
 * other lanes; node gaps are masks rather than background-colored strokes).
 *
 * Pure data in and out: no React, no DOM, no plugin context, so the layout is
 * directly unit-testable.
 */

import type { GraphReferences } from '../types/domain.ts'
import type { ParsedRef, RefKind } from './format.ts'

/** Row height (VS Code `SWIMLANE_HEIGHT`). */
export const SWIMLANE_HEIGHT = 22
/** Lane pitch; lane `i` is centered at `SWIMLANE_WIDTH * (i + 1)` (VS Code `SWIMLANE_WIDTH`). */
export const SWIMLANE_WIDTH = 11
/** Radius of the turns of a shifting lane (VS Code `SWIMLANE_CURVE_RADIUS`). */
export const SWIMLANE_CURVE_RADIUS = 5
/** Base node radius (VS Code `CIRCLE_RADIUS`). */
export const CIRCLE_RADIUS = 4
/** Stroke of VS Code's node circles (VS Code `CIRCLE_STROKE_WIDTH`). */
export const CIRCLE_STROKE_WIDTH = 2

/** VS Code's `scmGraph.foreground1`..`5`, in rotation order. */
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

/** One line heading for a commit (VS Code `ISCMHistoryItemGraphNode`). */
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

/** One laid-out commit row (VS Code `ISCMHistoryItemViewModel`). */
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
  /** References in VS Code's badge order, with their colors. */
  readonly refs: readonly ColoredRef[]
}

/** One stroked line of a row. */
export interface GraphPath {
  /** SVG path data, in VS Code's command spelling. */
  readonly d: string
  /** Line color. */
  readonly color: GraphColor
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
  /** Lines, in VS Code's drawing order. */
  readonly paths: readonly GraphPath[]
  /** Node. */
  readonly node: GraphNodeGeometry
}

/** Badge icon, after VS Code's codicons for each reference family. */
export type BadgeIcon = 'target' | 'branch' | 'cloud' | 'tag'

/** One reference badge (VS Code `div.label`). */
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
 * Rotate an index into a range (VS Code `rot`).
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
 * Sort references the way VS Code's Git extension reports them: local
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
 * Build VS Code's graph color map from the special references. Only these map
 * to a color; every other reference takes its node's color, as under VS Code's
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
 * The first fixed color among a commit's references (VS Code
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
 * Sanitize a parent list.
 * @param parents - raw parents.
 * @returns non-empty string parents.
 */
function cleanParents(parents: unknown): string[] {
  if (!Array.isArray(parents)) return []
  return parents.filter((parent): parent is string => typeof parent === 'string' && parent !== '')
}

/**
 * Lay commits out in swimlanes (VS Code `toISCMHistoryItemViewModelArray`).
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
    // other incoming lanes. VS Code skips this loop for a parentless commit and
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
     * VS Code `compareHistoryItemRefs` order.
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
 * A straight vertical line (VS Code `drawVerticalLine`).
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
 * Node circles and gaps per shape. Visible radii equal VS Code's circles after
 * their background-colored strokes: a normal node is a 4px disc with a gap to
 * 6px; a merge node a 2px dot inside a ring from 4 to 5px with a gap to 7px;
 * the checked-out node a ring from 4 to 6px with a gap to 8px. On hover VS Code
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
 * Build one row's SVG geometry (VS Code `renderSCMHistoryItemGraph`).
 * @param row - laid-out row.
 * @returns geometry for the row's `<svg>`.
 */
export function graphRowGeometry(row: GraphRow): GraphRowGeometry {
  const { input, output, parents } = row
  const circleIndex = row.lane
  const paths: GraphPath[] = []
  const W = SWIMLANE_WIDTH
  const H = SWIMLANE_HEIGHT

  let outputIndex = 0
  for (let index = 0; index < input.length; index += 1) {
    const lane = input[index]
    if (lane === undefined) continue
    if (lane.id === row.oid) {
      if (index !== circleIndex) {
        // Another lane heading for this commit: draw ╯ then ─ into the node.
        paths.push({
          d: [
            `M ${laneX(index)} 0`,
            `A ${W} ${W} 0 0 1 ${W * index} ${W}`,
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
      paths.push({ d: verticalLine(laneX(index), 0, H), color: lane.color })
    } else {
      // A lane shifting left: | then ╯ then ─ then ╭ then |.
      paths.push({
        d: [
          `M ${laneX(index)} 0`,
          'V 6',
          `A ${SWIMLANE_CURVE_RADIUS} ${SWIMLANE_CURVE_RADIUS} 0 0 1 ${laneX(index) - SWIMLANE_CURVE_RADIUS} ${H / 2}`,
          `H ${laneX(outputIndex) + SWIMLANE_CURVE_RADIUS}`,
          `A ${SWIMLANE_CURVE_RADIUS} ${SWIMLANE_CURVE_RADIUS} 0 0 0 ${laneX(outputIndex)} ${H / 2 + SWIMLANE_CURVE_RADIUS}`,
          `V ${H}`,
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
        `M ${W * parentIndex} ${H / 2}`,
        `A ${W} ${W} 0 0 1 ${W * (parentIndex + 1)} ${H}`,
        `M ${W * parentIndex} ${H / 2}`,
        `H ${laneX(circleIndex)}`,
      ].join(' '),
      color: lane.color,
    })
  }

  const inputIndex = input.findIndex((lane) => lane.id === row.oid)
  const incoming = input[inputIndex]
  if (incoming !== undefined) {
    paths.push({ d: verticalLine(laneX(circleIndex), 0, H / 2), color: incoming.color })
  }
  if (parents.length > 0) {
    paths.push({ d: verticalLine(laneX(circleIndex), H / 2, H), color: row.color })
  }

  const shape: GraphNodeShape = row.kind === 'HEAD' ? 'head' : parents.length > 1 ? 'merge' : 'node'
  const shapeSpec = NODE_SHAPES[shape]
  return {
    width: W * (Math.max(input.length, output.length, 1) + 1),
    height: H,
    paths,
    node: {
      shape,
      cx: laneX(circleIndex),
      cy: W,
      color: row.color,
      circles: shapeSpec.circles,
      gap: shapeSpec.gap,
      hoverGap: shapeSpec.hoverGap,
    },
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
 * Group a row's references into VS Code's badges: the first reference with
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
