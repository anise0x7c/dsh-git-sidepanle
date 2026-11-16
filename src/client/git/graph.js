// @ts-check
/**
 * Commit-graph layout: turn a newest-first commit list into branch lanes, one
 * row per commit, with the edges each row has to draw.
 *
 * The layout is the classic "swimlane" model. A lane is a pending line heading
 * for one commit; the lane list is the state at the top edge of a row. A commit
 * either arrives on the lane already expecting it (an ordinary history line) or
 * is the first commit seen for its branch (a new lane starts). Its parents
 * continue the line, open fan-out lanes, or meet a lane another branch already
 * opened, which draws the merge curve into that lane.
 *
 * Pure data in and out: no React, no DOM, no plugin context, so the layout is
 * directly unit-testable.
 */

/** Width one lane takes at full size, in pixels. */
export const LANE_WIDTH = 12
/** Clearance after the last lane, keeping strokes away from the commit text. */
export const LANE_PADDING = 6
/** Lane-span budget before lanes are squeezed; trailing clearance is added separately. */
export const MAX_GRAPH_WIDTH = 96
/** Narrowest lane pitch kept even when a wide graph has to be squeezed. */
export const MIN_LANE_WIDTH = 4
/** Height of one commit row; the row's two text lines fill the same box. */
export const ROW_HEIGHT = 40
/** Y of the node centre: level with the subject line, the row's primary text. */
export const NODE_Y = 14
/** Number of colors the lane palette cycles through. */
export const LANE_COLORS = 6

/**
 * A commit as the Host history response reports it.
 * @typedef {object} GraphCommit
 * @property {string} oid - full commit identifier.
 * @property {string[]} [parents] - parent identifiers, first parent first.
 */

/**
 * One line the row has to draw. `through` passes a lane from the row's top edge
 * to its bottom edge; `in` connects a lane from the top edge into the node; `out`
 * connects the node to a parent lane at the bottom edge.
 * @typedef {object} GraphEdge
 * @property {'through' | 'in' | 'out'} kind - edge shape.
 * @property {number} color - palette slot of the lane the line belongs to.
 * @property {number} from - lane index at the edge's start.
 * @property {number} to - lane index at the edge's end.
 */

/**
 * One laid-out commit row.
 * @typedef {object} GraphRow
 * @property {string} oid - full commit identifier.
 * @property {number} lane - lane the commit's node sits in.
 * @property {number} color - palette slot of the node's lane.
 * @property {GraphEdge[]} edges - lines this row draws.
 */

/**
 * One SVG-ready edge of a row.
 * @typedef {object} GraphEdgeGeometry
 * @property {string} d - SVG path data.
 * @property {number} color - palette slot of the lane the line belongs to.
 */

/**
 * SVG geometry for one row.
 * @typedef {object} GraphRowGeometry
 * @property {number} width - graph column width in pixels.
 * @property {number} height - row height in pixels.
 * @property {{cx: number, cy: number, r: number}} node - node circle.
 * @property {GraphEdgeGeometry[]} edges - path per edge.
 */

/**
 * Find the first unused lane slot.
 * @param {(string | null)[]} lanes - lane expectations at this row's top edge.
 * @returns {number} slot index, or -1 when every slot is taken.
 */
function firstFreeLane(lanes) {
  for (let index = 0; index < lanes.length; index += 1) {
    if (lanes[index] === null) return index
  }
  return -1
}

/**
 * Find a free lane strictly to the right of a commit. Secondary-parent lines
 * only fan out in this direction; an empty lane on the left belongs to the
 * topology that already passed there and must not pull a new fork backwards.
 * @param {(string | null)[]} lanes - lane expectations.
 * @param {number} lane - source commit's lane.
 * @returns {number} a free slot, or the next slot to append on the right.
 */
function freeLaneRight(lanes, lane) {
  for (let index = lane + 1; index < lanes.length; index += 1) {
    if (lanes[index] === null) return index
  }
  return lanes.length
}

/**
 * Lay commits out in branch lanes.
 * @param {GraphCommit[]} commits - commits in newest-first display order, with
 *   every parent after all of its children.
 * @returns {{rows: GraphRow[], laneCount: number}} laid-out rows and the number
 *   of lanes the graph needs at its widest.
 */
export function computeGraph(commits) {
  /** @type {(string | null)[]} */
  let lanes = []
  /** @type {GraphRow[]} */
  const rows = []
  let laneCount = 0
  for (const commit of commits) {
    const parents = Array.isArray(commit.parents)
      ? commit.parents.filter((parent) => typeof parent === 'string' && parent !== '')
      : []
    let lane = lanes.indexOf(commit.oid)
    const isNewLane = lane === -1
    if (isNewLane) {
      lane = firstFreeLane(lanes)
      if (lane === -1) {
        lane = lanes.length
        lanes.push(null)
      }
      lanes[lane] = commit.oid
    }
    /** @type {GraphEdge[]} */
    const edges = []
    // Lanes heading for some later commit simply pass through this row.
    for (let index = 0; index < lanes.length; index += 1) {
      if (lanes[index] === null || index === lane) continue
      edges.push({ kind: 'through', color: index % LANE_COLORS, from: index, to: index })
    }
    if (!isNewLane) edges.push({ kind: 'in', color: lane % LANE_COLORS, from: lane, to: lane })
    // Retire this expectation before routing its parents. The first parent
    // inherits the node lane, so an ordinary history line stays vertical. A
    // secondary parent opens strictly to the right instead of wrapping around
    // inactive slots and cutting across the left-hand topology.
    lanes[lane] = null
    for (let index = 0; index < parents.length; index += 1) {
      const parent = parents[index]
      let target = lanes.indexOf(parent)
      // Preserve a joining branch's color up to the existing target. A new
      // lane takes its own color, including a first parent continuing straight.
      let color = lane % LANE_COLORS
      if (target === -1) {
        target = index === 0 ? lane : freeLaneRight(lanes, lane)
        lanes[target] = parent
        color = target % LANE_COLORS
      }
      edges.push({ kind: 'out', color, from: lane, to: target })
    }
    laneCount = Math.max(laneCount, lane + 1)
    for (const edge of edges) laneCount = Math.max(laneCount, edge.from + 1, edge.to + 1)
    rows.push({ oid: commit.oid, lane, color: lane % LANE_COLORS, edges })
  }
  return { rows, laneCount }
}

/**
 * Pixel pitch of one lane, squeezing a wide graph into the width budget instead
 * of letting it eat the commit text.
 * @param {number} laneCount - lanes the graph needs.
 * @returns {number} lane pitch in pixels.
 */
export function laneStep(laneCount) {
  if (laneCount <= 0) return LANE_WIDTH
  return Math.max(MIN_LANE_WIDTH, Math.min(LANE_WIDTH, MAX_GRAPH_WIDTH / laneCount))
}

/**
 * Round a coordinate to two decimals so path data stays compact.
 * @param {number} value - coordinate.
 * @returns {number} rounded coordinate.
 */
function round(value) {
  return Math.round(value * 100) / 100
}

/**
 * Build the SVG path of one edge. Lines between lanes bend with a vertical
 * tangent at both ends, which is what makes forks and merges read as smooth
 * curves instead of diagonals.
 * @param {number} x1 - start x.
 * @param {number} y1 - start y.
 * @param {number} x2 - end x.
 * @param {number} y2 - end y.
 * @returns {string} SVG path data.
 */
export function edgePath(x1, y1, x2, y2) {
  if (x1 === x2) return `M${round(x1)} ${round(y1)}V${round(y2)}`
  // Mirrored control points form the same balanced S-curve for a fork and a
  // join. Both vertically tangent ends stay between their lane centres, so
  // squeezing the column cannot make a connector loop back horizontally.
  const bend = (y2 - y1) / 2
  return `M${round(x1)} ${round(y1)}C${round(x1)} ${round(y1 + bend)} ${round(x2)} ${round(y2 - bend)} ${round(x2)} ${round(y2)}`
}

/**
 * Build one row's SVG geometry. The whole graph shares one lane pitch, so the
 * caller must pass the lane count of the widest row.
 * @param {GraphRow} row - laid-out row.
 * @param {number} laneCount - lanes the graph needs at its widest.
 * @returns {GraphRowGeometry} geometry for the row's `<svg>`.
 */
export function graphRowGeometry(row, laneCount) {
  const step = laneStep(laneCount)
  const width = laneCount <= 0 ? step : laneCount * step + LANE_PADDING
  /**
   * Lane centre x.
   * @param {number} lane - lane index.
   * @returns {number} pixel x.
   */
  const x = (lane) => lane * step + step / 2
  const edges = row.edges.map((edge) => {
    const startY = edge.kind === 'through' ? 0 : edge.kind === 'out' ? NODE_Y : 0
    const endY = edge.kind === 'in' ? NODE_Y : ROW_HEIGHT
    return { d: edgePath(x(edge.from), startY, x(edge.to), endY), color: edge.color }
  })
  return {
    width,
    height: ROW_HEIGHT,
    node: { cx: x(row.lane), cy: NODE_Y, r: Math.max(2, Math.min(3.4, step * 0.3)) },
    edges,
  }
}
