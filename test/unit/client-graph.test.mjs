/**
 * Direct unit tests for the browser half's pure commit-graph layout.
 *
 * These import `src/client/git/graph.js` directly — no React, no DOM, no plugin
 * context. Expectations describe the visible graph: a linear history is one
 * lane, a merge fans its parents into their own lanes, a parent another branch
 * already expects stays on that branch's lane, and the geometry keeps the graph
 * column narrow by squeezing lanes instead of widening the column.
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LANE_COLORS,
  LANE_PADDING,
  LANE_WIDTH,
  MAX_GRAPH_WIDTH,
  MIN_LANE_WIDTH,
  NODE_Y,
  ROW_HEIGHT,
  computeGraph,
  edgePath,
  graphRowGeometry,
  laneStep,
} from '../../src/client/git/graph.js'

/**
 * Build one history commit record.
 * @param {string} oid - commit identifier.
 * @param {string[]} [parents] - parent identifiers.
 * @returns {{oid: string, parents: string[]}} commit.
 */
function commit(oid, parents = []) {
  return { oid, parents }
}

/**
 * Index laid-out rows by their commit id.
 * @param {object[]} rows - computed rows.
 * @returns {Record<string, object>} rows by oid.
 */
function byOid(rows) {
  return Object.fromEntries(rows.map((row) => [row.oid, row]))
}

/**
 * Reduce an edge list to a comparable shape.
 * @param {object[]} edges - row edges.
 * @returns {object[]} edges without implementation-only fields.
 */
function edgeShape(edges) {
  return edges.map((edge) => ({ kind: edge.kind, from: edge.from, to: edge.to, color: edge.color }))
}

describe('computeGraph', () => {
  test('returns no rows and no lanes for no commits', () => {
    assert.deepEqual(computeGraph([]), { rows: [], laneCount: 0 })
  })

  test('keeps a linear history on one lane', () => {
    const { rows, laneCount } = computeGraph([
      commit('c3', ['c2']),
      commit('c2', ['c1']),
      commit('c1'),
    ])
    assert.equal(laneCount, 1)
    assert.deepEqual(rows.map((row) => row.oid), ['c3', 'c2', 'c1'])
    assert.deepEqual(rows.map((row) => row.lane), [0, 0, 0])
    assert.deepEqual(rows.map((row) => row.color), [0, 0, 0])
    assert.deepEqual(edges(rows[0]), [{ kind: 'out', from: 0, to: 0, color: 0 }])
    assert.deepEqual(edges(rows[1]), [
      { kind: 'in', from: 0, to: 0, color: 0 },
      { kind: 'out', from: 0, to: 0, color: 0 },
    ])
    assert.deepEqual(edges(rows[2]), [{ kind: 'in', from: 0, to: 0, color: 0 }])
  })

  test('keeps parallel first-parent chains vertical until their shared parent', () => {
    const { rows, laneCount } = computeGraph([
      commit('tip', ['main', 'side-2']),
      commit('main', ['base']),
      commit('side-2', ['side-1']),
      commit('side-1', ['base']),
      commit('base'),
    ])
    const row = byOid(rows)
    assert.equal(laneCount, 2)
    assert.deepEqual(edges(row['side-2']), [
      { kind: 'through', from: 0, to: 0, color: 0 },
      { kind: 'in', from: 1, to: 1, color: 1 },
      { kind: 'out', from: 1, to: 1, color: 1 },
    ])
    assert.deepEqual(edges(row['side-1']), [
      { kind: 'through', from: 0, to: 0, color: 0 },
      { kind: 'in', from: 1, to: 1, color: 1 },
      { kind: 'out', from: 1, to: 1, color: 1 },
    ], 'the intermediate update must not turn toward the already-reserved base')
    assert.deepEqual(edges(row.base), [
      { kind: 'in', from: 1, to: 0, color: 1 },
      { kind: 'in', from: 0, to: 0, color: 0 },
    ])
    assert.equal(row.base.lane, 0)
    const geometry = graphRowGeometry(row.base, laneCount)
    assert.equal(geometry.edges[0].d, 'M18 0Q18 6 14 6H10Q6 6 6 10V14')
    assert.equal(geometry.textOffset, 24, 'the subject clears the arriving line by six pixels')
  })

  test('keeps a secondary-parent line in its own lane until the shared parent', () => {
    const { rows, laneCount } = computeGraph([
      commit('head', ['main', 'side']),
      commit('main', ['shared']),
      commit('side', ['merge']),
      commit('merge', ['first', 'shared']),
      commit('first'),
      commit('shared'),
    ])
    const row = byOid(rows)
    assert.equal(laneCount, 3)
    assert.equal(row.merge.lane, 1)
    assert.deepEqual(edges(row.merge), [
      { kind: 'through', from: 0, to: 0, color: 0 },
      { kind: 'in', from: 1, to: 1, color: 1 },
      { kind: 'out', from: 1, to: 1, color: 1 },
      { kind: 'out', from: 1, to: 2, color: 1 },
    ], 'the second parent opens its own lane instead of joining the reserved shared lane')
    assert.deepEqual(edges(row.first), [
      { kind: 'through', from: 0, to: 0, color: 0 },
      { kind: 'through', from: 2, to: 2, color: 1 },
      { kind: 'in', from: 1, to: 1, color: 1 },
    ], 'the intermediate row keeps the arriving line vertical')
    assert.deepEqual(edges(row.shared), [
      { kind: 'in', from: 2, to: 0, color: 1 },
      { kind: 'in', from: 0, to: 0, color: 0 },
    ], 'both lanes reach the shared node and turn there')
    const geometry = graphRowGeometry(row.shared, laneCount)
    assert.equal(geometry.edges[0].d, 'M30 0Q30 6 26 6H10Q6 6 6 10V14')
    assert.equal(geometry.textOffset, 36, 'the subject clears the arriving lane')
  })

  test('keeps the node on the lane that first expected it when a connector opens to its left', () => {
    const { rows, laneCount } = computeGraph([
      commit('tip', ['a', 'b', 'c', 's']),
      commit('a'),
      commit('b', ['m']),
      commit('c'),
      commit('m', ['p', 's']),
      commit('p'),
      commit('s'),
    ])
    const row = byOid(rows)
    assert.deepEqual(edges(row.m), [
      { kind: 'through', from: 3, to: 3, color: 3 },
      { kind: 'in', from: 1, to: 1, color: 1 },
      { kind: 'out', from: 1, to: 1, color: 1 },
      { kind: 'out', from: 1, to: 2, color: 1 },
    ], 'the connector opens the free lane between its source and the older expectation')
    assert.equal(row.s.lane, 3, 'the older expectation keeps the node and its branch color')
    assert.equal(row.s.color, 3)
    assert.deepEqual(edges(row.s), [
      { kind: 'in', from: 2, to: 3, color: 1 },
      { kind: 'in', from: 3, to: 3, color: 3 },
    ], 'the connector joins the older lane at the shared node')
    assert.equal(laneCount, 4)
    assert.deepEqual(graphRowGeometry(row.s, laneCount).edges, [
      { d: 'M30 0Q30 6 34 6H38Q42 6 42 10V14', color: 1 },
      { d: 'M42 0V14', color: 3 },
    ], 'a left-side incoming line still turns inside the graph column')
    assert.equal(graphRowGeometry(row.s, laneCount).textOffset, 52, 'the right-hand node keeps its text beside it')
  })

  test('folds a secondary parent below the visible window into its existing line', () => {
    const { rows, laneCount } = computeGraph([
      commit('m1', ['a', 'outside']),
      commit('a', ['m2']),
      commit('m2', ['first', 'outside']),
      commit('first'),
    ])
    const row = byOid(rows)
    assert.equal(laneCount, 2, 'an invisible parent does not open another trailing lane')
    assert.equal(row.outside, undefined)
    assert.deepEqual(edges(row.m2), [
      { kind: 'through', from: 1, to: 1, color: 1 },
      { kind: 'in', from: 0, to: 0, color: 0 },
      { kind: 'out', from: 0, to: 0, color: 0 },
      { kind: 'out', from: 0, to: 1, color: 0 },
    ], 'the connector keeps the source color and joins the line already heading below the window')
  })

  test('fans a merge commit into one lane per parent', () => {
    const { rows, laneCount } = computeGraph([
      commit('d', ['c', 'b']),
      commit('c', ['a']),
      commit('b', ['a']),
      commit('a'),
    ])
    const row = byOid(rows)
    assert.equal(laneCount, 2)
    assert.equal(row.d.lane, 0)
    assert.equal(row.c.lane, 0)
    assert.equal(row.b.lane, 1)
    assert.equal(row.a.lane, 0)
    assert.equal(row.d.color, 0)
    assert.equal(row.b.color, 1)
    assert.deepEqual(edges(row.d), [
      { kind: 'out', from: 0, to: 0, color: 0 },
      { kind: 'out', from: 0, to: 1, color: 1 },
    ])
    assert.deepEqual(edges(row.c), [
      { kind: 'through', from: 1, to: 1, color: 1 },
      { kind: 'in', from: 0, to: 0, color: 0 },
      { kind: 'out', from: 0, to: 0, color: 0 },
    ])
    // Both first-parent chains stay vertical until their common parent.
    assert.deepEqual(edges(row.b), [
      { kind: 'through', from: 0, to: 0, color: 0 },
      { kind: 'in', from: 1, to: 1, color: 1 },
      { kind: 'out', from: 1, to: 1, color: 1 },
    ])
    assert.deepEqual(edges(row.a), [
      { kind: 'in', from: 1, to: 0, color: 1 },
      { kind: 'in', from: 0, to: 0, color: 0 },
    ])
    assert.deepEqual(graphRowGeometry(row.a, laneCount).edges, [
      { d: 'M18 0Q18 6 14 6H10Q6 6 6 10V14', color: 1 },
      { d: 'M6 0V14', color: 0 },
    ])
  })

  test('starts a new lane for a branch tip and joins it at the shared parent', () => {
    const { rows, laneCount } = computeGraph([
      commit('x', ['r']),
      commit('y', ['r']),
      commit('r'),
    ])
    const row = byOid(rows)
    assert.equal(laneCount, 2)
    assert.deepEqual(edges(row.x), [{ kind: 'out', from: 0, to: 0, color: 0 }])
    assert.deepEqual(edges(row.y), [
      { kind: 'through', from: 0, to: 0, color: 0 },
      { kind: 'out', from: 1, to: 1, color: 1 },
    ])
    assert.deepEqual(edges(row.r), [
      { kind: 'in', from: 1, to: 0, color: 1 },
      { kind: 'in', from: 0, to: 0, color: 0 },
    ])
  })

  test('opens a new secondary-parent lane to the right without wrapping into a left-side vacancy', () => {
    const { rows, laneCount } = computeGraph([
      commit('tip', ['left', 'merge', 'occupied']),
      commit('left'),
      commit('merge', ['first', 'secondary']),
      commit('occupied'),
      commit('first'),
      commit('secondary'),
    ])
    const row = byOid(rows)
    assert.equal(laneCount, 4)
    assert.equal(row.merge.lane, 1)
    assert.equal(row.secondary.lane, 3, 'lane 0 is free and lane 2 is occupied, so append lane 3')
    assert.deepEqual(edges(row.merge), [
      { kind: 'through', from: 2, to: 2, color: 2 },
      { kind: 'in', from: 1, to: 1, color: 1 },
      { kind: 'out', from: 1, to: 1, color: 1 },
      { kind: 'out', from: 1, to: 3, color: 3 },
    ])
  })

  test('separates colors at a shared parent even when a high lane matches its palette slot', () => {
    const history = [
      commit('tip', ['a', 'b', 'c', 'd', 'e', 'f']),
      commit('a', ['shared']),
      commit('b', ['base', 'high']),
      commit('c'),
      commit('d'),
      commit('e'),
      commit('f'),
      commit('base', ['shared']),
      commit('high', ['shared']),
      commit('shared'),
    ]
    const row = byOid(computeGraph(history).rows)
    assert.equal(row.high.lane, 6, 'the fixture exercises the six-color palette boundary')
    const incoming = [row.base, row.high].map((branch) => branch.edges.find((edge) => edge.kind === 'out').color)
    assert.equal(new Set([...incoming, row.shared.color]).size, 3)
    assert.notEqual(row.high.color, row.shared.color)
    const join = row.high.edges.find((edge) => edge.kind === 'out')
    assert.equal(join.color, row.high.color, 'the join reserves its source color, not the target lane color')
  })

  test('leaves a lane pointing below the visible history when a parent is not listed', () => {
    const commits = [commit('newest', ['older']), commit('older', ['outside-window'])]
    const { rows, laneCount } = computeGraph(commits)
    assert.equal(laneCount, 1)
    assert.deepEqual(edges(rows[0]), [{ kind: 'out', from: 0, to: 0, color: 0 }])
    // The last row keeps drawing toward a parent that never appears.
    assert.deepEqual(edges(rows[1]), [
      { kind: 'in', from: 0, to: 0, color: 0 },
      { kind: 'out', from: 0, to: 0, color: 0 },
    ])
  })

  test('keeps an octopus merge on one lane per parent and cycles the palette', () => {
    const parents = Array.from({ length: LANE_COLORS + 1 }, (_, index) => `p${index}`)
    const commits = [commit('octopus', parents), ...parents.map((oid) => commit(oid))]
    const { rows, laneCount } = computeGraph(commits)
    assert.equal(laneCount, parents.length)
    assert.deepEqual(rows[0].edges.map((edge) => edge.to), parents.map((_, index) => index))
    assert.equal(rows[0].edges[LANE_COLORS].color, 0, 'the palette cycles after the last color')
    assert.equal(rows[0].color, 0)
    // Every parent starts on the lane the fan-out opened for it.
    parents.forEach((parent, index) => {
      const row = rows.find((entry) => entry.oid === parent)
      assert.equal(row.lane, index)
    })
  })

  test('reserves a different join color when simultaneous branches exhaust the palette', () => {
    const leaves = Array.from({ length: 7 }, (_, index) => `p${index}`)
    const history = [
      commit('tip', leaves),
      ...leaves.map((oid, index) => commit(oid, index === 0 || index === 6 ? ['root'] : [])),
      commit('root'),
    ]
    const layout = computeGraph(history)
    const row = byOid(layout.rows)
    assert.equal(new Set(layout.rows[0].edges.map((edge) => edge.color)).size, LANE_COLORS)
    const join = row.root.edges.find((edge) => edge.kind === 'in' && edge.from === 6)
    const target = row.root.edges.find((edge) => edge.kind === 'in' && edge.from === row.p0.lane)
    assert.notEqual(join.color, target.color, 'reuse occurs away from the point where the two branches meet')
    assert.equal(join.color, row.p6.color)
    assert.notEqual(row.p0.edges.find((edge) => edge.kind === 'out').color, join.color)
    assert.deepEqual(graphRowGeometry(row.root, layout.laneCount).edges.map((edge) => edge.d), [
      'M78 0Q78 6 74 6H10Q6 6 6 10V14',
      'M6 0V14',
    ])
  })

  test('tolerates a missing or malformed parent list', () => {
    const { rows, laneCount } = computeGraph([
      { oid: 'no-parents' },
      { oid: 'empty-parents', parents: [] },
      { oid: 'bad-parents', parents: [''] },
    ])
    assert.equal(laneCount, 1)
    assert.deepEqual(rows.map((row) => row.oid), ['no-parents', 'empty-parents', 'bad-parents'])
    assert.deepEqual(edges(rows[0]), [])
  })
})

describe('laneStep', () => {
  test('uses the full lane pitch while the graph fits the width budget', () => {
    assert.equal(laneStep(0), LANE_WIDTH)
    assert.equal(laneStep(1), LANE_WIDTH)
    assert.equal(laneStep(Math.floor(MAX_GRAPH_WIDTH / LANE_WIDTH)), LANE_WIDTH)
  })

  test('squeezes lanes inside the width budget and never below the minimum', () => {
    const squeezed = laneStep(16)
    assert.ok(squeezed < LANE_WIDTH)
    assert.equal(squeezed * 16, MAX_GRAPH_WIDTH)
    assert.equal(laneStep(10_000), MIN_LANE_WIDTH)
  })
})

describe('graphRowGeometry', () => {
  const row = {
    oid: 'row',
    lane: 0,
    color: 0,
    edges: [
      { kind: 'in', color: 0, from: 0, to: 0 },
      { kind: 'through', color: 1, from: 1, to: 1 },
      { kind: 'out', color: 1, from: 0, to: 1 },
    ],
  }

  test('turns into an in-row channel instead of bending across the whole row', () => {
    const geometry = graphRowGeometry(row, 2)
    assert.equal(geometry.height, ROW_HEIGHT)
    assert.equal(ROW_HEIGHT, 28)
    assert.equal(geometry.width, 2 * LANE_WIDTH + LANE_PADDING)
    assert.equal(geometry.textOffset, 24)
    assert.ok(geometry.textOffset > 18, 'the subject cannot overlap the neighboring through line')
    assert.equal(geometry.edges.length, 3)
    assert.deepEqual(geometry.edges[0], { d: `M6 0V${NODE_Y}`, color: 0 })
    assert.deepEqual(geometry.edges[1], { d: 'M18 0V28', color: 1 })
    assert.deepEqual(geometry.edges[2], { d: `M6 ${NODE_Y}Q6 20 10 20H14Q18 20 18 24V28`, color: 1 })
  })

  test('slightly enlarges the node on the one-line commit row', () => {
    const geometry = graphRowGeometry(row, 2)
    assert.deepEqual(geometry.node, { cx: 6, cy: NODE_Y, r: 4 })
  })

  test('follows a right-hand node instead of forcing text beyond the widest lane', () => {
    const geometry = graphRowGeometry({ ...row, lane: 1 }, 5)
    assert.equal(geometry.width, 5 * LANE_WIDTH + LANE_PADDING)
    assert.equal(geometry.textOffset, 28)
    assert.ok(geometry.textOffset < geometry.width)
  })

  test('clears active right-hand lines without imposing the widest lane on quiet rows', () => {
    const crossing = graphRowGeometry({
      ...row,
      edges: [{ kind: 'out', color: 1, from: 0, to: 3 }],
    }, 4)
    assert.equal(crossing.textOffset, 48)
    const quiet = graphRowGeometry({ ...row, edges: [] }, 4)
    assert.equal(quiet.textOffset, 16)
    const incoming = graphRowGeometry({
      ...row,
      lane: 3,
      edges: [{ kind: 'out', color: 1, from: 3, to: 0 }],
    }, 4)
    assert.equal(incoming.textOffset, 52)
  })

  test('squeezes wide lanes and reserves clearance beyond their rightmost node', () => {
    const wide = graphRowGeometry({ ...row, lanes: 0, edges: [] }, 24)
    assert.equal(wide.width, 24 * Math.max(MIN_LANE_WIDTH, MAX_GRAPH_WIDTH / 24) + LANE_PADDING)
    assert.ok(wide.node.r >= 2)
    assert.ok(wide.node.cx - wide.node.r >= 0)
    assert.ok(wide.node.cx + wide.node.r <= wide.width - LANE_PADDING)
  })

  test('mirrors a leftward join and keeps it inside the graph column', () => {
    const geometry = graphRowGeometry({
      ...row,
      lane: 1,
      edges: [{ kind: 'out', color: 1, from: 1, to: 0 }],
    }, 2)
    assert.deepEqual(geometry.edges, [{ d: `M18 ${NODE_Y}Q18 20 14 20H10Q6 20 6 24V28`, color: 1 }])
    assert.ok(geometry.node.cx < geometry.width)
  })
})

describe('edgePath', () => {
  test('keeps a same-lane edge vertical', () => {
    assert.equal(edgePath(12, 0, 12, 28), 'M12 0V28')
  })

  test('uses mirrored turns around a horizontal row channel', () => {
    assert.equal(edgePath(0, 0, 12, 12), 'M0 0Q0 6 3 6H9Q12 6 12 9V12')
    assert.equal(edgePath(12, 0, 0, 12), 'M12 0Q12 6 9 6H3Q0 6 0 9V12')
  })

  test('keeps turn curvature bounded as more lanes are crossed', () => {
    assert.equal(edgePath(6, NODE_Y, 90, 28), `M6 ${NODE_Y}Q6 20 10 20H86Q90 20 90 24V28`)
    assert.equal(edgePath(90, NODE_Y, 6, 28), `M90 ${NODE_Y}Q90 20 86 20H10Q6 20 6 24V28`)
  })
})

/**
 * Shorthand for {@link edgeShape}.
 * @param {object} row - laid-out row.
 * @returns {object[]} comparable edges.
 */
function edges(row) {
  return edgeShape(row.edges)
}
