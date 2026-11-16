// @ts-check
/**
 * Commit-graph layout on a row-and-column grid.
 *
 * A lane is a pending line heading for one commit. Every parent line keeps its
 * own lane until that parent's row: a commit can receive several still-active
 * lines in its row, and a merge commit can open a separate lane for each extra
 * parent. A lane change turns in a short horizontal channel on the source
 * commit's row, not in a long diagonal between adjacent commits. Each pending
 * lane also carries a continuous-branch identity so colors follow topology
 * instead of blindly following a reusable lane number.
 *
 * Pure data in and out: no React, no DOM, no plugin context, so the layout is
 * directly unit-testable.
 */

/** Width one lane takes at full size, in pixels. */
export const LANE_WIDTH = 12
/** Gap between a commit node and its text, and clearance after the last lane. */
export const LANE_PADDING = 6
/** Lane-span budget before lanes are squeezed; trailing clearance is added separately. */
export const MAX_GRAPH_WIDTH = 96
/** Narrowest lane pitch kept even when a wide graph has to be squeezed. */
export const MIN_LANE_WIDTH = 4
/** Height of a single-line commit row. */
export const ROW_HEIGHT = 28
/** Y of the node centre, aligned with the one-line commit information. */
export const NODE_Y = 14
/** Normal node radius; very narrow lanes reduce it to a two-pixel minimum. */
export const NODE_RADIUS = 4
/** Distance below a commit node at which lane crossings travel horizontally. */
export const CONNECTION_OFFSET = 6
/** Number of theme-supported lane colors. */
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
 * @property {number} color - palette slot of the branch the line belongs to.
 * @property {number} from - lane index at the edge's start.
 * @property {number} to - lane index at the edge's end.
 */

/**
 * One laid-out commit row.
 * @typedef {object} GraphRow
 * @property {string} oid - full commit identifier.
 * @property {number} lane - lane the commit's node sits in.
 * @property {number} color - palette slot of the node's branch.
 * @property {GraphEdge[]} edges - lines this row draws.
 */

/**
 * One SVG-ready edge of a row.
 * @typedef {object} GraphEdgeGeometry
 * @property {string} d - SVG path data.
 * @property {number} color - palette slot of the branch the line belongs to.
 */

/**
 * SVG geometry for one row.
 * @typedef {object} GraphRowGeometry
 * @property {number} width - graph column width in pixels.
 * @property {number} height - row height in pixels.
 * @property {{cx: number, cy: number, r: number}} node - node circle.
 * @property {number} textOffset - x at which this commit's information begins.
 * @property {GraphEdgeGeometry[]} edges - path per edge.
 */

/**
 * @typedef {object} LaneExpectation
 * @property {string} oid - commit this lane is heading toward.
 * @property {number} branch - continuous branch identity, independent of lane reuse.
 * @property {number} seq - creation order; the first expectation owns the node.
 */

/**
 * @typedef {GraphEdge & {branch: number}} PendingEdge
 */

/**
 * @typedef {object} PendingRow
 * @property {string} oid - full commit identifier.
 * @property {number} lane - lane the commit's node sits in.
 * @property {number} branch - branch supplying the node color.
 * @property {PendingEdge[]} edges - lines awaiting final palette colors.
 */

/**
 * Find the first unused lane slot.
 * @param {(LaneExpectation | null)[]} lanes - lane expectations at this row's top.
 * @returns {number} slot index, or -1 when every slot is taken.
 */
function firstFreeLane(lanes) {
  for (let index = 0; index < lanes.length; index += 1) {
    if (lanes[index] === null) return index
  }
  return -1
}

/**
 * Select the lane that first expected a commit. A newer connector may reserve a
 * free lane to the left of an older expectation, so lane order alone cannot
 * choose the node: the commit keeps the branch identity it was already
 * travelling on.
 * @param {(LaneExpectation | null)[]} lanes - lane expectations.
 * @param {string} oid - commit identifier.
 * @returns {number} lane index, or -1 when the commit is not expected yet.
 */
function selectLane(lanes, oid) {
  let selected = -1
  for (let index = 0; index < lanes.length; index += 1) {
    const lane = lanes[index]
    if (lane === null || lane.oid !== oid) continue
    if (selected === -1 || lane.seq < lanes[selected].seq) selected = index
  }
  return selected
}

/**
 * Find a free lane strictly to the right of a commit. Secondary-parent lines
 * only fan out in this direction; an empty lane on the left belongs to the
 * topology that already passed there and must not pull a new fork backwards.
 * @param {(LaneExpectation | null)[]} lanes - lane expectations.
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
 * Make every pair of branches in one visible group compete for a color. Groups
 * share either a row or the node at which their connecting lines converge.
 * @param {Map<number, Set<number>>} conflicts - neighboring branch identities.
 * @param {Set<number>} group - simultaneous or converging branches.
 * @returns {void}
 */
function addColorConflicts(conflicts, group) {
  for (const left of group) {
    for (const right of group) {
      if (left >= right) continue
      conflicts.get(left)?.add(right)
      conflicts.get(right)?.add(left)
    }
  }
}

/**
 * Color continuous branches, not lane numbers. Saturation-degree ordering first
 * handles the most constrained branches, then each branch takes its preferred
 * color or the closest unused slot. If the whole palette is exhausted, preserve
 * distinct colors at a shared parent before ordinary cross-row visibility.
 * @param {Map<number, Set<number>>} conflicts - branch-color conflict graph.
 * @param {Map<number, Set<number>>} meetingConflicts - branches sharing a parent.
 * @returns {number[]} palette slot indexed by branch identity.
 */
function branchColors(conflicts, meetingConflicts) {
  const remaining = new Set(conflicts.keys())
  const colors = Array.from({ length: conflicts.size }, () => -1)
  while (remaining.size > 0) {
    let selected = -1
    let selectedSaturation = -1
    /** @type {Set<number>} */
    let taken = new Set()
    for (const branch of remaining) {
      const neighboringColors = new Set()
      for (const neighbor of conflicts.get(branch) ?? []) {
        if (colors[neighbor] !== -1) neighboringColors.add(colors[neighbor])
      }
      if (neighboringColors.size > selectedSaturation) {
        selected = branch
        selectedSaturation = neighboringColors.size
        taken = neighboringColors
      }
    }
    const preferred = selected % LANE_COLORS
    let color = preferred
    if (taken.size < LANE_COLORS) {
      for (let offset = 0; offset < LANE_COLORS; offset += 1) {
        const candidate = (preferred + offset) % LANE_COLORS
        if (!taken.has(candidate)) {
          color = candidate
          break
        }
      }
    } else {
      let bestCost = Infinity
      for (let offset = 0; offset < LANE_COLORS; offset += 1) {
        const candidate = (preferred + offset) % LANE_COLORS
        let cost = 0
        for (const neighbor of conflicts.get(selected) ?? []) {
          if (colors[neighbor] !== candidate) continue
          cost += meetingConflicts.get(selected)?.has(neighbor) === true ? 1_000_000 : 1
        }
        if (cost < bestCost) {
          bestCost = cost
          color = candidate
        }
      }
    }
    colors[selected] = color
    remaining.delete(selected)
  }
  return colors
}

/**
 * Lay commits out in branch lanes.
 * @param {GraphCommit[]} commits - commits in newest-first display order, with
 *   every parent after all of its children.
 * @returns {{rows: GraphRow[], laneCount: number}} laid-out rows and the number
 *   of lanes the graph needs at its widest.
 */
export function computeGraph(commits) {
  /** @type {(LaneExpectation | null)[]} */
  const lanes = []
  /** @type {PendingRow[]} */
  const pendingRows = []
  /** @type {Map<number, Set<number>>} */
  const conflicts = new Map()
  /** @type {Map<string, Set<number>>} */
  const arrivals = new Map()
  const listed = new Set(commits.map((commit) => commit.oid))
  let branchCount = 0
  let expectationCount = 0
  let laneCount = 0

  /** @returns {number} a branch identity created in deterministic traversal order. */
  const createBranch = () => {
    const branch = branchCount
    branchCount += 1
    conflicts.set(branch, new Set())
    return branch
  }

  /** @returns {number} an expectation creation order. */
  const nextExpectation = () => {
    const seq = expectationCount
    expectationCount += 1
    return seq
  }

  for (const commit of commits) {
    const parents = Array.isArray(commit.parents)
      ? commit.parents.filter((parent) => typeof parent === 'string' && parent !== '')
      : []
    let lane = selectLane(lanes, commit.oid)
    const isNewLane = lane === -1
    if (isNewLane) {
      lane = firstFreeLane(lanes)
      if (lane === -1) {
        lane = lanes.length
        lanes.push(null)
      }
      lanes[lane] = { oid: commit.oid, branch: createBranch(), seq: nextExpectation() }
    }
    const expectation = lanes[lane]
    if (expectation === null) continue
    const branch = expectation.branch
    /** @type {PendingEdge[]} */
    const edges = []
    for (let index = 0; index < lanes.length; index += 1) {
      const activity = lanes[index]
      if (activity === null || index === lane) continue
      if (activity.oid === commit.oid) {
        // Another branch expects this same node. Keep its line distinct until
        // this row, where it joins the selected node and retires its lane.
        edges.push({ kind: 'in', branch: activity.branch, color: 0, from: index, to: lane })
        lanes[index] = null
        continue
      }
      edges.push({ kind: 'through', branch: activity.branch, color: 0, from: index, to: index })
    }
    if (!isNewLane) edges.push({ kind: 'in', branch, color: 0, from: lane, to: lane })

    // Every parent line owns a lane until that parent's row. The first parent
    // keeps this lane; a secondary parent opens the nearest free lane on the
    // right, even when another line already expects the same parent. Only a
    // parent below the visible window may fold into its existing line early,
    // because it has no row where both lines could join a node.
    lanes[lane] = null
    for (let index = 0; index < parents.length; index += 1) {
      const parent = parents[index]
      let target = lane
      let edgeBranch = branch
      let reuseExpectation = false
      if (index === 0) {
        // A first parent stays in this lane even when another branch already
        // expects it. Both expectations are consumed at the actual parent row.
      } else {
        const expected = selectLane(lanes, parent)
        if (expected !== -1 && !listed.has(parent)) {
          target = expected
          reuseExpectation = true
        } else {
          target = freeLaneRight(lanes, lane)
          if (expected === -1) edgeBranch = createBranch()
        }
      }
      if (!reuseExpectation) {
        lanes[target] = { oid: parent, branch: edgeBranch, seq: nextExpectation() }
      }
      if (listed.has(parent)) {
        const meeting = arrivals.get(parent) ?? new Set()
        meeting.add(edgeBranch)
        arrivals.set(parent, meeting)
      }
      edges.push({ kind: 'out', branch: edgeBranch, color: 0, from: lane, to: target })
    }
    const row = { oid: commit.oid, lane, branch, edges }
    pendingRows.push(row)
    addColorConflicts(conflicts, new Set([branch, ...edges.map((edge) => edge.branch)]))
    laneCount = Math.max(laneCount, lane + 1)
    for (const edge of edges) laneCount = Math.max(laneCount, edge.from + 1, edge.to + 1)
  }

  /** @type {Map<number, Set<number>>} */
  const meetingConflicts = new Map()
  for (const branch of conflicts.keys()) meetingConflicts.set(branch, new Set())
  for (const meeting of arrivals.values()) {
    addColorConflicts(conflicts, meeting)
    addColorConflicts(meetingConflicts, meeting)
  }
  const colors = branchColors(conflicts, meetingConflicts)
  const rows = pendingRows.map((row) => ({
    oid: row.oid,
    lane: row.lane,
    color: colors[row.branch],
    edges: row.edges.map(({ branch, ...edge }) => ({
      ...edge,
      color: colors[branch],
    })),
  }))
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
 * Build one grid edge. Same-column edges are vertical. Lane-changing edges turn
 * into a horizontal channel on the source commit's row, then round into the
 * destination column. The second corner's radius depends on row space, not on
 * how many lanes the horizontal segment crosses.
 *
 * The caller supplies descending row coordinates: y2 must not precede y1.
 * @param {number} x1 - start x.
 * @param {number} y1 - start y.
 * @param {number} x2 - end x.
 * @param {number} y2 - end y.
 * @returns {string} SVG path data.
 */
export function edgePath(x1, y1, x2, y2) {
  if (x1 === x2) return `M${round(x1)} ${round(y1)}V${round(y2)}`
  if (y2 <= y1) return `M${round(x1)} ${round(y1)}L${round(x2)} ${round(y2)}`
  const channelY = y1 + Math.min(CONNECTION_OFFSET, (y2 - y1) / 2)
  const radius = Math.min(LANE_WIDTH / 2, Math.abs(x2 - x1) / 2, (y2 - channelY) / 2)
  const direction = x2 > x1 ? 1 : -1
  const first = x1 + direction * radius
  const second = x2 - direction * radius
  const endY = channelY + radius
  return `M${round(x1)} ${round(y1)}Q${round(x1)} ${round(channelY)} ${round(first)} ${round(channelY)}H${round(second)}Q${round(x2)} ${round(channelY)} ${round(x2)} ${round(endY)}V${round(y2)}`
}

/**
 * Build one row's SVG geometry. The whole graph shares one lane pitch, so the
 * caller must pass the lane count of the widest row. The text offset instead
 * follows the current node, regardless of the width needed by other rows.
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
    const startY = edge.kind === 'out' ? NODE_Y : 0
    const endY = edge.kind === 'in' ? NODE_Y : ROW_HEIGHT
    return { d: edgePath(x(edge.from), startY, x(edge.to), endY), color: edge.color }
  })
  const radius = Math.max(2, Math.min(NODE_RADIUS, step * 0.4))
  let textOffset = round(x(row.lane) + radius + LANE_PADDING)
  // A neighboring line occupies this row's text band too. Leave only the
  // clearance its rightmost actual lane needs instead of reserving every lane
  // from the widest row or drawing text through that line.
  for (const edge of row.edges) {
    const furthest = Math.max(x(edge.from), x(edge.to))
    if (furthest > x(row.lane)) {
      textOffset = Math.max(textOffset, round(furthest + LANE_PADDING))
    }
  }
  return {
    width,
    height: ROW_HEIGHT,
    node: { cx: x(row.lane), cy: NODE_Y, r: radius },
    textOffset,
    edges,
  }
}
