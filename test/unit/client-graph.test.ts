/**
 * Direct unit tests for the browser half's pure commit-graph layout, a port of
 * VS Code's Source Control Graph.
 *
 * These import `src/client/git/graph.ts` directly — no React, no DOM, no plugin
 * context. Hand-written cases pin the visible VS Code behavior (swimlanes,
 * path commands, node shapes, colors, badges); an equivalence test compares
 * the port with a literal transcription of VS Code's algorithm on random
 * histories.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { ParsedRef } from '../../src/client/git/format.ts'
import { parseRefs } from '../../src/client/git/format.ts'
import type { GraphCommit, GraphRow } from '../../src/client/git/graph.ts'
import {
  badgeIcon,
  computeGraph,
  graphRowGeometry,
  LANE_COLORS,
  refBadges,
  referenceColors,
  SWIMLANE_HEIGHT,
  SWIMLANE_WIDTH,
  sortRefs,
} from '../../src/client/git/graph.ts'
import type { GraphReferences } from '../../src/client/types/domain.ts'
import type { OracleItem } from '../support/vscode-scm-history.ts'
import { renderGraph, toViewModels } from '../support/vscode-scm-history.ts'

/**
 * Build one history commit record.
 * @param oid - commit identifier.
 * @param parents - parent identifiers.
 * @param refs - decoration string.
 * @returns commit.
 */
function commit(oid: string, parents: string[] = [], refs = ''): GraphCommit {
  return { oid, parents, refs: parseRefs(refs) }
}

/**
 * Index laid-out rows by their commit id.
 * @param rows - computed rows.
 * @returns rows by oid.
 */
function byOid(rows: readonly GraphRow[]): Record<string, GraphRow> {
  return Object.fromEntries(rows.map((row) => [row.oid, row]))
}

/**
 * Path data of one row.
 * @param row - laid-out row.
 * @returns `[d, color]` pairs.
 */
function paths(row: GraphRow | undefined): [string, string][] {
  assert.ok(row)
  return graphRowGeometry(row).paths.map((path) => [path.d, path.color])
}

/**
 * Lane ids of a swimlane list.
 * @param lanes - swimlanes.
 * @returns ids and colors.
 */
function lanes(lanes: GraphRow['input']): string[] {
  return lanes.map((lane) => `${lane.id}:${lane.color}`)
}

const REFERENCES: GraphReferences = {
  current: { id: 'refs/heads/main', name: 'main', revision: 'head' },
  remote: { id: 'refs/remotes/origin/main', name: 'origin/main', revision: 'up' },
  base: { id: 'refs/remotes/origin/master', name: 'origin/master', revision: 'base' },
}

describe('VS Code constants', () => {
  test('uses the Source Control Graph row height, lane pitch and palette', () => {
    assert.equal(SWIMLANE_HEIGHT, 22)
    assert.equal(SWIMLANE_WIDTH, 11)
    assert.deepEqual([...LANE_COLORS], ['lane1', 'lane2', 'lane3', 'lane4', 'lane5'])
  })
})

describe('computeGraph swimlanes', () => {
  test('returns no rows for no commits', () => {
    assert.deepEqual(computeGraph([]), [])
  })

  test('keeps a linear history on the first lane with one vertical line', () => {
    const rows = computeGraph([commit('c3', ['c2']), commit('c2', ['c1']), commit('c1')])
    assert.deepEqual(
      rows.map((row) => row.lane),
      [0, 0, 0],
    )
    assert.deepEqual(
      rows.map((row) => row.color),
      ['lane1', 'lane1', 'lane1'],
    )
    assert.deepEqual(paths(rows[0]), [['M 11 11 V 22', 'lane1']])
    assert.deepEqual(paths(rows[1]), [
      ['M 11 0 V 11', 'lane1'],
      ['M 11 11 V 22', 'lane1'],
    ])
    assert.deepEqual(paths(rows[2]), [['M 11 0 V 11', 'lane1']])
    assert.deepEqual(
      rows.map((row) => graphRowGeometry(row).width),
      [22, 22, 22],
      'one lane plus one position',
    )
  })

  test('fans a merge out to the right and joins its fork point with a quarter turn', () => {
    const rows = computeGraph([
      commit('d', ['c', 'b']),
      commit('c', ['a']),
      commit('b', ['a']),
      commit('a'),
    ])
    const row = byOid(rows)
    assert.deepEqual(lanes(row.d?.output ?? []), ['c:lane1', 'b:lane2'])
    assert.deepEqual(paths(row.d), [
      ['M 11 11 A 11 11 0 0 1 22 22 M 11 11 H 11', 'lane2'],
      ['M 11 11 V 22', 'lane1'],
    ])
    assert.deepEqual(paths(row.c), [
      ['M 22 0 V 22', 'lane2'],
      ['M 11 0 V 11', 'lane1'],
      ['M 11 11 V 22', 'lane1'],
    ])
    assert.equal(row.b?.lane, 1)
    assert.equal(row.b?.color, 'lane2')
    assert.deepEqual(lanes(row.b?.output ?? []), ['a:lane1', 'a:lane2'])
    assert.equal(row.a?.lane, 0, 'the node takes the leftmost lane heading for it')
    assert.deepEqual(
      paths(row.a),
      [
        ['M 22 0 A 11 11 0 0 1 11 11 H 11', 'lane2'],
        ['M 11 0 V 11', 'lane1'],
      ],
      'the second line keeps its own color until it reaches the node',
    )
    assert.equal(row.a?.color, 'lane1')
  })

  test('starts an unexpected branch tip on a new lane to the right', () => {
    const rows = computeGraph([commit('x', ['r']), commit('y', ['r']), commit('r')])
    const row = byOid(rows)
    assert.equal(row.y?.lane, 1)
    assert.equal(row.y?.color, 'lane2')
    assert.deepEqual(paths(row.y), [
      ['M 11 0 V 22', 'lane1'],
      ['M 22 11 V 22', 'lane2'],
    ])
    assert.deepEqual(paths(row.r), [
      ['M 22 0 A 11 11 0 0 1 11 11 H 11', 'lane2'],
      ['M 11 0 V 11', 'lane1'],
    ])
  })

  test('opens a new lane at the right end for a merge parent that is already expected', () => {
    const rows = computeGraph([
      commit('tip', ['main', 'side']),
      commit('main', ['shared']),
      commit('side', ['merge']),
      commit('merge', ['first', 'shared']),
      commit('first', ['base']),
      commit('shared', ['base']),
      commit('base'),
    ])
    const row = byOid(rows)
    assert.deepEqual(lanes(row.merge?.input ?? []), ['shared:lane1', 'merge:lane2'])
    assert.deepEqual(
      lanes(row.merge?.output ?? []),
      ['shared:lane1', 'first:lane2', 'shared:lane3'],
      'the merge parent gets its own lane although lane 0 already heads for it',
    )
    assert.deepEqual(paths(row.merge), [
      ['M 11 0 V 22', 'lane1'],
      ['M 22 11 A 11 11 0 0 1 33 22 M 22 11 H 22', 'lane3'],
      ['M 22 0 V 11', 'lane2'],
      ['M 22 11 V 22', 'lane2'],
    ])
    assert.equal(row.shared?.lane, 0)
    assert.deepEqual(paths(row.shared), [
      ['M 22 0 V 22', 'lane2'],
      ['M 33 0 A 11 11 0 0 1 22 11 H 11', 'lane3'],
      ['M 11 0 V 11', 'lane1'],
      ['M 11 11 V 22', 'lane1'],
    ])
  })

  test('shifts the lanes right of an ended lane one position left', () => {
    const rows = computeGraph([
      commit('x1', ['p']),
      commit('x2', ['p']),
      commit('y', ['q']),
      commit('p', ['o']),
      commit('q', ['o']),
      commit('o'),
    ])
    const row = byOid(rows)
    assert.deepEqual(lanes(row.p?.input ?? []), ['p:lane1', 'p:lane2', 'q:lane3'])
    assert.deepEqual(lanes(row.p?.output ?? []), ['o:lane1', 'q:lane3'])
    assert.deepEqual(paths(row.p), [
      ['M 22 0 A 11 11 0 0 1 11 11 H 11', 'lane2'],
      ['M 33 0 V 6 A 5 5 0 0 1 28 11 H 27 A 5 5 0 0 0 22 16 V 22', 'lane3'],
      ['M 11 0 V 11', 'lane1'],
      ['M 11 11 V 22', 'lane1'],
    ])
    assert.equal(graphRowGeometry(row.p as GraphRow).width, 44, 'three input lanes plus one')
    assert.equal(graphRowGeometry(row.q as GraphRow).width, 33)
  })

  test('keeps other lanes running past a root commit', () => {
    const rows = computeGraph([
      commit('a', ['b']),
      commit('orphan-tip', ['orphan-root']),
      commit('orphan-root'),
      commit('b'),
    ])
    const row = byOid(rows)
    assert.deepEqual(lanes(row['orphan-root']?.output ?? []), ['b:lane1'])
    assert.deepEqual(paths(row['orphan-root']), [
      ['M 11 0 V 22', 'lane1'],
      ['M 22 0 V 11', 'lane2'],
    ])
    assert.equal(row['orphan-root']?.color, 'lane2', 'a root node takes its incoming color')
    assert.equal(row.b?.lane, 0)
  })

  test('continues a line toward a parent outside the window', () => {
    const rows = computeGraph([commit('newest', ['older']), commit('older', ['outside'])])
    assert.deepEqual(paths(rows[1]), [
      ['M 11 0 V 11', 'lane1'],
      ['M 11 11 V 22', 'lane1'],
    ])
    assert.deepEqual(lanes(rows[1]?.output ?? []), ['outside:lane1'])
  })

  test('tolerates a missing or malformed parent list', () => {
    const rows = computeGraph([
      { oid: 'no-parents' },
      { oid: 'empty-parents', parents: [] },
      { oid: 'bad-parents', parents: [''] },
    ])
    assert.deepEqual(
      rows.map((row) => row.parents.length),
      [0, 0, 0],
    )
    assert.deepEqual(paths(rows[0]), [])
    assert.equal(rows[0]?.color, 'ref', 'a lone root takes the reference color like VS Code')
  })
})

describe('computeGraph colors', () => {
  test('rotates five colors per new lane and wraps on the sixth', () => {
    const parents = Array.from({ length: 6 }, (_, index) => `p${index}`)
    const rows = computeGraph([
      commit('octopus', parents),
      ...parents.map((oid) => commit(oid, [`${oid}-outside`])),
    ])
    assert.deepEqual(
      rows[0]?.output.map((lane) => lane.color),
      ['lane1', 'lane2', 'lane3', 'lane4', 'lane5', 'lane1'],
    )
  })

  test('colors the checked-out, upstream and base lines with fixed colors', () => {
    const rows = computeGraph(
      [
        commit('head', ['up'], 'HEAD -> refs/heads/main'),
        commit('up', ['base'], 'refs/remotes/origin/main'),
        commit('base', ['old'], 'refs/remotes/origin/master, refs/heads/master'),
        commit('old'),
      ],
      REFERENCES,
    )
    const row = byOid(rows)
    assert.equal(row.head?.kind, 'HEAD')
    assert.equal(row.head?.color, 'ref')
    assert.deepEqual(lanes(row.head?.output ?? []), ['up:ref'])
    assert.equal(row.up?.color, 'remote')
    assert.equal(row.base?.color, 'base')
    assert.deepEqual(
      row.base?.refs.map((ref) => `${ref.name}:${ref.color}`),
      ['origin/master:base', 'master:base'],
      'the base reference comes first and the local branch takes the node color',
    )
    assert.equal(row.old?.color, 'base', 'a first parent continues its child color')
    assert.equal(row.old?.kind, 'node')
  })

  test('a merge parent carrying a special reference takes its color', () => {
    const rows = computeGraph(
      [
        commit('merge', ['first', 'up']),
        commit('first', ['root']),
        commit('up', ['root'], 'refs/remotes/origin/main'),
        commit('root'),
      ],
      REFERENCES,
    )
    assert.deepEqual(lanes(rows[0]?.output ?? []), ['first:lane1', 'up:remote'])
  })

  test('maps only the special references when a current reference exists', () => {
    assert.deepEqual(
      [...referenceColors(REFERENCES)],
      [
        ['refs/heads/main', 'ref'],
        ['refs/remotes/origin/main', 'remote'],
        ['refs/remotes/origin/master', 'base'],
      ],
    )
    assert.deepEqual([...referenceColors({ ...REFERENCES, current: null })], [])
    assert.deepEqual([...referenceColors(null)], [])
  })
})

describe('reference badges', () => {
  test('shows the checked-out branch by name and its upstream as an icon', () => {
    const [row] = computeGraph(
      [commit('head', ['x'], 'HEAD -> refs/heads/main, refs/remotes/origin/main')],
      REFERENCES,
    )
    assert.ok(row)
    assert.deepEqual(
      refBadges(row.refs).map((badge) => [badge.icon, badge.name, badge.color, badge.count]),
      [
        ['target', 'main', 'ref', 1],
        ['cloud', null, 'remote', 1],
      ],
    )
  })

  test('colors ordinary references with their node and groups them by icon', () => {
    const [row] = computeGraph([
      commit(
        'tip',
        ['x'],
        'refs/heads/dev, refs/remotes/origin/dev, refs/remotes/fork/dev, tag: refs/tags/v2, tag: refs/tags/v1',
      ),
    ])
    assert.ok(row)
    assert.deepEqual(
      refBadges(row.refs).map((badge) => [badge.icon, badge.name, badge.color, badge.count]),
      [
        ['branch', 'dev', 'lane1', 1],
        ['cloud', null, 'lane1', 2],
        ['tag', null, 'lane1', 2],
      ],
    )
  })

  test('groups remaining references by color before icon', () => {
    const [row] = computeGraph(
      [
        commit(
          'base',
          ['x'],
          'refs/heads/feature, refs/remotes/origin/main, refs/remotes/origin/master, refs/heads/master',
        ),
      ],
      REFERENCES,
    )
    assert.ok(row)
    assert.deepEqual(
      refBadges(row.refs).map((badge) => [badge.icon, badge.name, badge.color, badge.count]),
      [
        ['cloud', 'origin/main', 'remote', 1],
        ['cloud', null, 'base', 1],
        ['branch', null, 'remote', 2],
      ],
    )
  })

  test('sorts references by family and name and maps families to icons', () => {
    const refs: ParsedRef[] = parseRefs(
      'tag: refs/tags/v1, refs/remotes/origin/b, refs/heads/z, refs/heads/a',
    )
    assert.deepEqual(
      sortRefs(refs).map((ref) => ref.name),
      ['a', 'z', 'origin/b', 'v1'],
    )
    assert.deepEqual((['head', 'branch', 'remote', 'tag'] as const).map(badgeIcon), [
      'target',
      'branch',
      'cloud',
      'tag',
    ])
  })

  test('has no badge for a commit without references', () => {
    assert.deepEqual(refBadges([]), [])
  })
})

describe('graphRowGeometry nodes', () => {
  test('draws a filled dot with a gap that closes on hover', () => {
    const [row] = computeGraph([commit('a', ['b'])])
    assert.ok(row)
    const node = graphRowGeometry(row).node
    assert.deepEqual(
      { shape: node.shape, cx: node.cx, cy: node.cy, gap: node.gap, hoverGap: node.hoverGap },
      { shape: 'node', cx: 11, cy: 11, gap: 6, hoverGap: 5 },
    )
    assert.deepEqual(node.circles, [
      { paint: 'fill', r: 4, hoverR: 5, strokeWidth: 0, hoverStrokeWidth: 0 },
    ])
  })

  test('draws a merge as a ring around a dot', () => {
    const [row] = computeGraph([commit('m', ['a', 'b'])])
    assert.ok(row)
    const node = graphRowGeometry(row).node
    assert.equal(node.shape, 'merge')
    assert.equal(node.gap, 7)
    assert.deepEqual(
      node.circles.map((circle) => [circle.paint, circle.r, circle.strokeWidth]),
      [
        ['ring', 4.5, 1],
        ['fill', 2, 0],
      ],
    )
  })

  test('draws the checked-out commit as a hollow ring, even when it merges', () => {
    const [row] = computeGraph([commit('head', ['a', 'b'], 'HEAD -> refs/heads/main')], {
      ...REFERENCES,
      current: { id: 'refs/heads/main', name: 'main', revision: 'head' },
    })
    assert.ok(row)
    const node = graphRowGeometry(row).node
    assert.equal(node.shape, 'head')
    assert.equal(node.gap, 8)
    assert.equal(node.hoverGap, 7)
    assert.deepEqual(
      node.circles.map((circle) => [circle.paint, circle.r, circle.strokeWidth]),
      [['ring', 5, 2]],
    )
  })

  test('places a node on its lane centre', () => {
    const rows = computeGraph([commit('x', ['r']), commit('y', ['r']), commit('r')])
    assert.equal(graphRowGeometry(rows[1] as GraphRow).node.cx, 22)
  })
})

/**
 * Deterministic pseudo-random generator (mulberry32).
 * @param seed - seed.
 * @returns generator in [0, 1).
 */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A random history in display order: every commit has one to three parents,
 * each older than the commit or outside the window, and some carry branch,
 * remote and tag references.
 * @param seed - seed.
 * @param size - number of commits.
 * @returns commits.
 */
function randomHistory(seed: number, size: number): GraphCommit[] {
  const next = random(seed)
  const ids = Array.from({ length: size }, (_, index) => `c${index}`)
  const names = ['main', 'dev', 'feature/x', 'release']
  return ids.map((oid, index) => {
    const parents = new Set<string>()
    const count = next() < 0.25 ? (next() < 0.2 ? 3 : 2) : 1
    while (parents.size < count) {
      const later = size - index - 1
      if (later === 0 || next() < 0.05) parents.add(`outside-${index}-${parents.size}`)
      else parents.add(ids[index + 1 + Math.floor(next() * Math.min(later, 8))] as string)
    }
    const decorations: string[] = []
    if (index === 0) decorations.push('HEAD -> refs/heads/main')
    if (next() < 0.15) decorations.push(`refs/heads/${names[Math.floor(next() * names.length)]}`)
    if (next() < 0.1) decorations.push('refs/remotes/origin/main')
    if (next() < 0.1) decorations.push('refs/remotes/origin/master')
    if (next() < 0.1) decorations.push(`tag: refs/tags/v${index}`)
    return commit(oid, [...parents], decorations.join(', '))
  })
}

describe('equivalence with VS Code', () => {
  test('matches VS Code swimlanes, paths, node colors and badge colors on random histories', () => {
    const references: GraphReferences = {
      current: { id: 'refs/heads/main', name: 'main', revision: 'c0' },
      remote: { id: 'refs/remotes/origin/main', name: 'origin/main', revision: 'x' },
      base: { id: 'refs/remotes/origin/master', name: 'origin/master', revision: 'y' },
    }
    for (let seed = 1; seed <= 200; seed += 1) {
      const history = randomHistory(seed, 40)
      const ours = computeGraph(history, references)
      const colorMap = new Map<string, string | undefined>([
        ['refs/heads/main', 'ref'],
        ['refs/remotes/origin/main', 'remote'],
        ['refs/remotes/origin/master', 'base'],
      ])
      for (const entry of history) {
        for (const ref of entry.refs ?? [])
          if (!colorMap.has(ref.id)) colorMap.set(ref.id, undefined)
      }
      const items: OracleItem[] = history.map((entry) => ({
        id: entry.oid,
        parentIds: [...(entry.parents ?? [])],
        references: sortRefs(entry.refs ?? []).map((ref) => ({ id: ref.id, name: ref.name })),
      }))
      const theirs = toViewModels(
        items,
        colorMap,
        references.current ?? undefined,
        references.remote ?? undefined,
        references.base ?? undefined,
      )
      assert.equal(ours.length, theirs.length)
      ours.forEach((row, index) => {
        const model = theirs[index]
        assert.ok(model)
        const where = `seed ${seed}, row ${index}`
        assert.equal(row.kind, model.kind, where)
        assert.deepEqual(row.input, model.inputSwimlanes, `${where} input`)
        assert.deepEqual(row.output, model.outputSwimlanes, `${where} output`)
        const rendered = renderGraph(model)
        const geometry = graphRowGeometry(row)
        assert.equal(row.lane, rendered.circleIndex, `${where} lane`)
        assert.equal(row.color, rendered.circleColor, `${where} color`)
        assert.equal(geometry.width, rendered.width, `${where} width`)
        assert.deepEqual(
          geometry.paths.map((path) => [path.d, path.color]),
          rendered.paths.map((path) => [path.d.trim(), path.color]),
          `${where} paths`,
        )
        assert.deepEqual(
          row.refs.map((ref) => [ref.id, ref.color]),
          (model.historyItem.references ?? []).map((ref) => [ref.id, ref.color]),
          `${where} references`,
        )
      })
    }
  })
})
