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
    // The side branch's line joins the already-open first-parent lane instead
    // of opening a duplicate lane for the shared parent.
    assert.deepEqual(edges(row.b), [
      { kind: 'through', from: 0, to: 0, color: 0 },
      { kind: 'in', from: 1, to: 1, color: 1 },
      { kind: 'out', from: 1, to: 0, color: 1 },
    ])
    assert.deepEqual(edges(row.a), [{ kind: 'in', from: 0, to: 0, color: 0 }])
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
      { kind: 'out', from: 1, to: 0, color: 1 },
    ])
    assert.deepEqual(edges(row.r), [{ kind: 'in', from: 0, to: 0, color: 0 }])
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

  test('draws vertical lines as straight paths and lane changes as curves', () => {
    const geometry = graphRowGeometry(row, 2)
    assert.equal(geometry.height, ROW_HEIGHT)
    assert.equal(geometry.width, 2 * LANE_WIDTH + LANE_PADDING)
    assert.equal(geometry.edges.length, 3)
    assert.deepEqual(geometry.edges[0], { d: `M6 0V${NODE_Y}`, color: 0 })
    assert.deepEqual(geometry.edges[1], { d: 'M18 0V40', color: 1 })
    assert.deepEqual(geometry.edges[2], { d: `M6 ${NODE_Y}C6 27 18 27 18 40`, color: 1 })
  })

  test('places the node on the subject line of the row', () => {
    const geometry = graphRowGeometry(row, 2)
    assert.deepEqual(geometry.node, { cx: 6, cy: NODE_Y, r: 3.4 })
  })

  test('squeezes wide lanes and reserves clearance beyond their rightmost node', () => {
    const wide = graphRowGeometry({ ...row, lanes: 0, edges: [] }, 24)
    assert.equal(wide.width, 24 * Math.max(MIN_LANE_WIDTH, MAX_GRAPH_WIDTH / 24) + LANE_PADDING)
    assert.ok(wide.node.r >= 2)
    assert.ok(wide.node.cx - wide.node.r >= 0)
    assert.ok(wide.node.cx + wide.node.r <= wide.width - LANE_PADDING)
  })

  test('keeps leftward joining curves symmetric and inside the graph column', () => {
    const geometry = graphRowGeometry({
      ...row,
      lane: 1,
      edges: [{ kind: 'out', color: 1, from: 1, to: 0 }],
    }, 2)
    assert.deepEqual(geometry.edges, [{ d: `M18 ${NODE_Y}C18 27 6 27 6 40`, color: 1 }])
    assert.ok(geometry.node.cx < geometry.width)
  })
})

describe('edgePath', () => {
  test('keeps a same-lane edge vertical', () => {
    assert.equal(edgePath(12, 0, 12, 40), 'M12 0V40')
  })

  test('uses mirrored vertical tangents for a lane-change edge', () => {
    assert.equal(edgePath(0, 0, 12, 12), 'M0 0C0 6 12 6 12 12')
    assert.equal(edgePath(12, 0, 0, 12), 'M12 0C12 6 0 6 0 12')
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
