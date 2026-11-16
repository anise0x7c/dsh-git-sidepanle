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

/** A commit as the graph layout reads it. */
export interface GraphCommit {
  /** Full commit identifier. */
  readonly oid: string
  /** Parent identifiers, first parent first. */
  readonly parents?: readonly string[]
}

/**
 * One line the row has to draw. `through` passes a lane from the row's top edge
 * to its bottom edge; `in` connects a lane from the top edge into the node; `out`
 * connects the node to a parent lane at the bottom edge.
 */
export interface GraphEdge {
  /** Edge shape. */
  readonly kind: 'through' | 'in' | 'out'
  /** Palette slot of the branch the line belongs to. */
  readonly color: number
  /** Lane index at the edge's start. */
  readonly from: number
  /** Lane index at the edge's end. */
  readonly to: number
}

/** One laid-out commit row. */
export interface GraphRow {
  /** Full commit identifier. */
  readonly oid: string
  /** Lane the commit's node sits in. */
  readonly lane: number
  /** Palette slot of the node's branch. */
  readonly color: number
  /** Lines this row draws. */
  readonly edges: GraphEdge[]
}

/** One SVG-ready edge of a row. */
export interface GraphEdgeGeometry {
  /** SVG path data. */
  readonly d: string
  /** Palette slot of the branch the line belongs to. */
  readonly color: number
}

/** SVG geometry for one row. */
export interface GraphRowGeometry {
  /** Graph column width in pixels. */
  readonly width: number
  /** Row height in pixels. */
  readonly height: number
  /** Node circle. */
  readonly node: { readonly cx: number; readonly cy: number; readonly r: number }
  /** x at which this commit's information begins. */
  readonly textOffset: number
  /** Path per edge. */
  readonly edges: GraphEdgeGeometry[]
}

/** One lane's pending expectation for a commit. */
interface LaneExpectation {
  /** Commit this lane is heading toward. */
  readonly oid: string
  /** Continuous branch identity, independent of lane reuse. */
  readonly branch: number
  /** Creation order; the first expectation owns the node. */
  readonly seq: number
}

/** An edge before its palette color is final. */
interface PendingEdge extends GraphEdge {
  /** Continuous branch identity supplying the final color. */
  readonly branch: number
}

/** One row before its palette colors are final. */
interface PendingRow {
  /** Full commit identifier. */
  readonly oid: string
  /** Lane the commit's node sits in. */
  readonly lane: number
  /** Branch supplying the node color. */
  readonly branch: number
  /** Lines awaiting final palette colors. */
  readonly edges: PendingEdge[]
}

/**
 * Find the first unused lane slot.
 * @param lanes - lane expectations at this row's top.
 * @returns slot index, or -1 when every slot is taken.
 */
function firstFreeLane(lanes: readonly (LaneExpectation | null)[]): number {
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
 * @param lanes - lane expectations.
 * @param oid - commit identifier.
 * @returns lane index, or -1 when the commit is not expected yet.
 */
function selectLane(lanes: readonly (LaneExpectation | null)[], oid: string): number {
  let selected = -1
  let selectedSequence = Number.POSITIVE_INFINITY
  for (let index = 0; index < lanes.length; index += 1) {
    const lane = lanes[index]
    if (lane === null || lane === undefined || lane.oid !== oid) continue
    if (lane.seq < selectedSequence) {
      selected = index
      selectedSequence = lane.seq
    }
  }
  return selected
}

/**
 * Find a free lane strictly to the right of a commit. Secondary-parent lines
 * only fan out in this direction; an empty lane on the left belongs to the
 * topology that already passed there and must not pull a new fork backwards.
 * @param lanes - lane expectations.
 * @param lane - source commit's lane.
 * @returns a free slot, or the next slot to append on the right.
 */
function freeLaneRight(lanes: readonly (LaneExpectation | null)[], lane: number): number {
  for (let index = lane + 1; index < lanes.length; index += 1) {
    if (lanes[index] === null) return index
  }
  return lanes.length
}

/**
 * Make every pair of branches in one visible group compete for a color. Groups
 * share either a row or the node at which their connecting lines converge.
 * @param conflicts - neighboring branch identities.
 * @param group - simultaneous or converging branches.
 */
function addColorConflicts(conflicts: Map<number, Set<number>>, group: ReadonlySet<number>): void {
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
 * @param conflicts - branch-color conflict graph.
 * @param meetingConflicts - branches sharing a parent.
 * @returns palette slot indexed by branch identity.
 */
function branchColors(
  conflicts: Map<number, Set<number>>,
  meetingConflicts: Map<number, Set<number>>,
): number[] {
  const remaining = new Set(conflicts.keys())
  const colors = Array.from({ length: conflicts.size }, () => -1)
  while (remaining.size > 0) {
    let selected = -1
    let selectedSaturation = -1
    let taken = new Set<number>()
    for (const branch of remaining) {
      const neighboringColors = new Set<number>()
      for (const neighbor of conflicts.get(branch) ?? []) {
        const neighborColor = colors[neighbor]
        if (neighborColor !== undefined && neighborColor !== -1)
          neighboringColors.add(neighborColor)
      }
      if (neighboringColors.size > selectedSaturation) {
        selected = branch
        selectedSaturation = neighboringColors.size
        taken = neighboringColors
      }
    }
    if (selected === -1) break
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
      let bestCost = Number.POSITIVE_INFINITY
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
 * @param commits - commits in newest-first display order, with every parent
 *   after all of its children.
 * @returns laid-out rows and the number of lanes the graph needs at its widest.
 */
export function computeGraph(commits: readonly GraphCommit[]): {
  rows: GraphRow[]
  laneCount: number
} {
  const lanes: (LaneExpectation | null)[] = []
  const pendingRows: PendingRow[] = []
  const conflicts = new Map<number, Set<number>>()
  const arrivals = new Map<string, Set<number>>()
  const listed = new Set(commits.map((commit) => commit.oid))
  let branchCount = 0
  let expectationCount = 0
  let laneCount = 0

  /** @returns a branch identity created in deterministic traversal order. */
  const createBranch = (): number => {
    const branch = branchCount
    branchCount += 1
    conflicts.set(branch, new Set())
    return branch
  }

  /** @returns an expectation creation order. */
  const nextExpectation = (): number => {
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
    if (expectation === null || expectation === undefined) continue
    const branch = expectation.branch
    const edges: PendingEdge[] = []
    for (let index = 0; index < lanes.length; index += 1) {
      const activity = lanes[index]
      if (activity === null || activity === undefined || index === lane) continue
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
      if (parent === undefined) continue
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
        const meeting = arrivals.get(parent) ?? new Set<number>()
        meeting.add(edgeBranch)
        arrivals.set(parent, meeting)
      }
      edges.push({ kind: 'out', branch: edgeBranch, color: 0, from: lane, to: target })
    }
    const row: PendingRow = { oid: commit.oid, lane, branch, edges }
    pendingRows.push(row)
    addColorConflicts(conflicts, new Set([branch, ...edges.map((edge) => edge.branch)]))
    laneCount = Math.max(laneCount, lane + 1)
    for (const edge of edges) laneCount = Math.max(laneCount, edge.from + 1, edge.to + 1)
  }

  const meetingConflicts = new Map<number, Set<number>>()
  for (const branch of conflicts.keys()) meetingConflicts.set(branch, new Set())
  for (const meeting of arrivals.values()) {
    addColorConflicts(conflicts, meeting)
    addColorConflicts(meetingConflicts, meeting)
  }
  const colors = branchColors(conflicts, meetingConflicts)
  const rows = pendingRows.map((row) => ({
    oid: row.oid,
    lane: row.lane,
    color: colors[row.branch] ?? 0,
    edges: row.edges.map(({ branch: edgeBranch, ...edge }) => ({
      ...edge,
      color: colors[edgeBranch] ?? 0,
    })),
  }))
  return { rows, laneCount }
}

/**
 * Pixel pitch of one lane, squeezing a wide graph into the width budget instead
 * of letting it eat the commit text.
 * @param laneCount - lanes the graph needs.
 * @returns lane pitch in pixels.
 */
export function laneStep(laneCount: number): number {
  if (laneCount <= 0) return LANE_WIDTH
  return Math.max(MIN_LANE_WIDTH, Math.min(LANE_WIDTH, MAX_GRAPH_WIDTH / laneCount))
}

/**
 * Round a coordinate to two decimals so path data stays compact.
 * @param value - coordinate.
 * @returns rounded coordinate.
 */
function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Build one grid edge. Same-column edges are vertical. Lane-changing edges turn
 * into a horizontal channel on the source commit's row, then round into the
 * destination column. The second corner's radius depends on row space, not on
 * how many lanes the horizontal segment crosses.
 *
 * The caller supplies descending row coordinates: y2 must not precede y1.
 * @param x1 - start x.
 * @param y1 - start y.
 * @param x2 - end x.
 * @param y2 - end y.
 * @returns SVG path data.
 */
export function edgePath(x1: number, y1: number, x2: number, y2: number): string {
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
 * @param row - laid-out row.
 * @param laneCount - lanes the graph needs at its widest.
 * @returns geometry for the row's `<svg>`.
 */
export function graphRowGeometry(row: GraphRow, laneCount: number): GraphRowGeometry {
  const step = laneStep(laneCount)
  const width = laneCount <= 0 ? step : laneCount * step + LANE_PADDING
  /**
   * Lane centre x.
   * @param lane - lane index.
   * @returns pixel x.
   */
  const x = (lane: number): number => lane * step + step / 2
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
