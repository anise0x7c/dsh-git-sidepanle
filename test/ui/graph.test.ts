/**
 * Commit graph drawing, swimlanes and history paging.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { HistoryResult } from '../../src/shared/git.ts'
import type { TestElement } from '../support/types.ts'
import {
  buttonByLabel,
  collectElements,
  disposeUiLifetimes,
  elementOf,
  elementText,
  hasClass,
  isElement,
  loadUiPanel,
  mountGit,
  pagedHistory,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

test('scrolling the graph pane to its end appends the next page of commits', async () => {
  const pages = pagedHistory()
  const mounted = await mountGit({ historyPages: [pages.first, pages.second] })
  const rows = (): TestElement[] =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-graphRow'))
  const graphPane = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) =>
      String(candidate.props?.className ?? '').includes('dshgg-paneBottom'),
    )
    assert.ok(element, 'no graph pane rendered')
    return element
  }
  assert.equal(rows().length, 2)
  // A scroll far from the end keeps the loaded page.
  mounted.harness.scroll(graphPane(), { scrollTop: 0, clientHeight: 400, scrollHeight: 1000 })
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((request) => request.op === 'history').length, 1)
  // Reaching the end loads the next page with the offset of the loaded rows.
  mounted.harness.scroll(graphPane(), { scrollTop: 580, clientHeight: 400, scrollHeight: 1000 })
  await mounted.harness.flush()
  const historyCalls = mounted.calls.filter((request) => request.op === 'history')
  assert.equal(historyCalls.length, 2)
  assert.equal(historyCalls[1]?.offset, 2)
  assert.equal(rows().length, 3)
  assert.match(mounted.harness.text(), /Root commit/)
  assert.equal(
    mounted.harness.findAll(
      (element) => element.type === 'button' && elementText(element) === 'graph.loadMore',
    ).length,
    0,
    'the last page offers no further loading',
  )
  await mounted.harness.dispose()
})

test('the end of the graph offers the next page as a control', async () => {
  const pages = pagedHistory()
  const mounted = await mountGit({ historyPages: [pages.first, pages.second] })
  const loadMore = (): TestElement[] =>
    mounted.harness.findAll(
      (element) => element.type === 'button' && elementText(element) === 'graph.loadMore',
    )
  assert.equal(loadMore().length, 1)
  const [button] = loadMore()
  assert.ok(button)
  mounted.harness.click(button)
  await mounted.harness.flush()
  const historyCalls = mounted.calls.filter((request) => request.op === 'history')
  assert.equal(historyCalls[1]?.offset, 2)
  assert.match(mounted.harness.text(), /Root commit/)
  assert.equal(loadMore().length, 0)
  await mounted.harness.dispose()
})

test('a failed earlier page keeps the loaded rows and can be retried', async () => {
  const pages = pagedHistory()
  const mounted = await mountGit({
    historyPages: [pages.first, pages.second],
    failHistoryPages: [1],
  })
  const rows = (): TestElement[] =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-graphRow'))
  const graphPane = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) =>
      String(candidate.props?.className ?? '').includes('dshgg-paneBottom'),
    )
    assert.ok(element, 'no graph pane rendered')
    return element
  }
  mounted.harness.scroll(graphPane(), { scrollTop: 580, clientHeight: 400, scrollHeight: 1000 })
  await mounted.harness.flush()
  assert.equal(rows().length, 2, 'the loaded rows stay visible')
  assert.match(mounted.harness.text(), /git said no/)
  const retry = mounted.harness.findAll(
    (element) => element.type === 'button' && elementText(element) === 'retry',
  )
  assert.equal(retry.length, 1)
  const [button] = retry
  assert.ok(button)
  mounted.harness.click(button)
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((request) => request.op === 'history').length, 3)
  assert.equal(rows().length, 3)
  assert.match(mounted.harness.text(), /Root commit/)
  await mounted.harness.dispose()
})

test('refresh returns the graph to the first page', async () => {
  const pages = pagedHistory()
  const mounted = await mountGit({ historyPages: [pages.first, pages.second, pages.first] })
  const rows = (): TestElement[] =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-graphRow'))
  const graphPane = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) =>
      String(candidate.props?.className ?? '').includes('dshgg-paneBottom'),
    )
    assert.ok(element, 'no graph pane rendered')
    return element
  }
  mounted.harness.scroll(graphPane(), { scrollTop: 580, clientHeight: 400, scrollHeight: 1000 })
  await mounted.harness.flush()
  assert.equal(rows().length, 3)
  mounted.harness.click(buttonByLabel(mounted.harness, 'refresh'))
  await mounted.harness.flush()
  const historyCalls = mounted.calls.filter((request) => request.op === 'history')
  assert.equal(historyCalls.length, 3)
  assert.equal(historyCalls[2]?.offset, undefined, 'a refresh asks for the first page')
  assert.equal(rows().length, 2)
  assert.equal(
    mounted.harness.findAll(
      (element) => element.type === 'button' && elementText(element) === 'graph.loadMore',
    ).length,
    1,
    'the refreshed first page can load earlier commits again',
  )
  await mounted.harness.dispose()
})

test('the commit graph draws one line layer and a node per row', async () => {
  const mounted = await mountGit()
  const layers = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphLayer',
  )
  assert.equal(layers.length, 1, 'the rows share one layer')
  const [layer] = layers
  assert.ok(layer)
  assert.equal(layer.props['aria-hidden'], 'true')
  assert.equal(layer.props.width, 22, 'one lane plus one position')
  assert.equal(layer.props.height, 44, 'two rows')
  assert.equal(layer.props.viewBox, '0 0 22 44')
  const [mask] = collectElements(layer, (element) => element.type === 'mask')
  assert.ok(mask)
  assert.equal(mask.props.maskUnits, 'userSpaceOnUse')
  assert.equal(mask.props.height, 44, 'the mask covers the whole layer')
  const gaps = collectElements(mask, (element) => element.type === 'circle')
  assert.deepEqual(
    gaps.map((gap) => [
      gap.props.className,
      gap.props.cx,
      gap.props.cy,
      gap.props.r,
      gap.props.fill,
    ]),
    [
      ['dshgg-graphGap', 11, 11, 8, 'black'],
      ['dshgg-graphGap', 11, 33, 6, 'black'],
    ],
    'the gap cuts the lines around each node',
  )
  const [lines] = collectElements(layer, (element) => element.type === 'g')
  assert.ok(lines)
  assert.equal(lines.props.mask, `url(#${String(mask.props.id)})`)
  const cells = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphSvg',
  )
  assert.equal(cells.length, 2, 'one graph cell per commit row')
  for (const cell of cells) {
    assert.equal(cell.props.height, 22, 'a cell is one row high')
    assert.equal(
      collectElements(cell, (element) => element.type === 'path').length,
      0,
      'the cell holds no lines',
    )
  }
  assert.deepEqual(
    cells.map((cell) => cell.props.viewBox),
    ['0 0 22 22', '0 0 22 22'],
  )
  const nodes = mounted.harness.findAll(
    (element) => element.type === 'circle' && element.props.className === 'dshgg-graphNode',
  )
  assert.deepEqual(
    nodes.map((node) => [
      node.props['data-shape'],
      node.props['data-paint'],
      node.props.cx,
      node.props.cy,
      node.props.r,
    ]),
    [
      ['head', 'ring', 11, 11, 5],
      ['node', 'fill', 11, 11, 4],
    ],
    'the checked-out commit is a ring and the root a filled dot',
  )
  assert.equal(nodes[0]?.props.style?.stroke, 'var(--dshgg-scm-ref)')
  assert.equal(nodes[1]?.props.style?.fill, 'var(--dshgg-scm-ref)')
  const paths = mounted.harness.findAll(
    (element) => element.type === 'path' && element.props.className === 'dshgg-graphEdge',
  )
  assert.deepEqual(
    paths.map((path) => [path.props.d, path.props.style?.stroke]),
    [['M 11 11 V 22 M 11 21 V 22 M 11 22 V 33', 'var(--dshgg-scm-ref)']],
    'both rows are one path, and the second row also covers the pixel above it',
  )
  const rows = mounted.harness.findAll((element) => hasClass(element, 'dshgg-graphRow'))
  assert.deepEqual(
    rows.map((row) => row.props['data-current']),
    ['true', undefined],
    'only the checked-out commit renders bold',
  )
  await mounted.harness.dispose()
})

test('hovering a row closes its node gap in the line layer', async () => {
  const mounted = await mountGit()
  const body = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphBody',
  )[0]
  assert.ok(body)
  const gaps = (): [unknown, unknown][] =>
    mounted.harness
      .findAll(
        (element) => element.type === 'circle' && element.props.className === 'dshgg-graphGap',
      )
      .map((gap) => [gap.props.cy, gap.props.r])
  assert.deepEqual(gaps(), [
    [11, 8],
    [33, 6],
  ])
  const rows = mounted.harness.findAll((element) => hasClass(element, 'dshgg-graphRow'))
  const enter = rows[1]?.props.onMouseEnter as (() => void) | undefined
  assert.equal(typeof enter, 'function', 'the row reports the pointer')
  enter?.()
  await mounted.harness.flush()
  assert.deepEqual(
    gaps(),
    [
      [11, 8],
      [33, 5],
    ],
    'the hovered row keeps the smaller gap',
  )
  const leave = rows[1]?.props.onMouseLeave as (() => void) | undefined
  leave?.()
  await mounted.harness.flush()
  assert.deepEqual(
    gaps(),
    [
      [11, 8],
      [33, 6],
    ],
    'the gap restores when the pointer leaves',
  )
  await mounted.harness.dispose()
})

test('a merge fans out to the right and joins its fork point like Code OSS', async () => {
  const now = Math.floor(Date.now() / 1000)
  const history: HistoryResult = {
    commits: [
      {
        oid: 'd'.repeat(40),
        shortOid: 'ddddddd',
        author: 'Ann',
        authoredAt: now,
        refs: 'HEAD -> refs/heads/main',
        subject: 'Merge feature',
        parents: ['c'.repeat(40), 'b'.repeat(40)],
      },
      {
        oid: 'c'.repeat(40),
        shortOid: 'ccccccc',
        author: 'Ann',
        authoredAt: now - 60,
        refs: '',
        subject: 'Main work',
        parents: ['a'.repeat(40)],
      },
      {
        oid: 'b'.repeat(40),
        shortOid: 'bbbbbbb',
        author: 'Bob',
        authoredAt: now - 120,
        refs: 'refs/heads/feature/x, refs/remotes/origin/feature/x',
        subject: 'Feature work',
        parents: ['a'.repeat(40)],
      },
      {
        oid: 'a'.repeat(40),
        shortOid: 'aaaaaaa',
        author: 'Bob',
        authoredAt: now - 180,
        refs: 'tag: refs/tags/v1.0',
        subject: 'Initial commit',
        parents: [],
      },
    ],
    hasMore: false,
    references: {
      current: { id: 'refs/heads/main', name: 'main', revision: 'd'.repeat(40) },
      remote: null,
      base: null,
    },
  }
  const mounted = await mountGit({ history })
  const rows = mounted.harness.findAll((element) => hasClass(element, 'dshgg-graphRow'))
  assert.equal(rows.length, 4)
  const cells = rows.map((row) => elementOf(row.children[0]))
  assert.deepEqual(
    cells.map((cell) => cell.props.width),
    [33, 33, 33, 33],
  )
  const nodeOf = (cell: TestElement): TestElement => {
    const [node] = collectElements(cell, (element) => element.props.className === 'dshgg-graphNode')
    assert.ok(node)
    return node
  }
  assert.deepEqual(
    cells.map((cell) => [nodeOf(cell).props['data-shape'], nodeOf(cell).props['data-color']]),
    [
      ['head', 'ref'],
      ['node', 'ref'],
      ['node', 'lane1'],
      ['node', 'ref'],
    ],
  )
  assert.equal(nodeOf(cells[2] as TestElement).props.cx, 22, 'the side branch sits on lane 1')
  assert.equal(
    collectElements(cells[0] as TestElement, (element) => element.type === 'path').length,
    0,
    'the row cell holds only its node',
  )
  const [layer] = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphLayer',
  )
  assert.ok(layer)
  const layerPaths = collectElements(layer, (element) => element.type === 'path')
  assert.deepEqual(
    layerPaths.map((path) => path.props['data-color']),
    ['lane1', 'ref'],
    'one path per color for the whole graph',
  )
  assert.match(
    String(layerPaths[0]?.props.d),
    /^M 11 11 A 11 11 0 0 1 22 22 M 11 11 H 11 /,
    'the merge opens its second parent on the first row',
  )
  assert.match(
    String(layerPaths[0]?.props.d),
    /M 22 66 A 11 11 0 0 1 11 77 H 11$/,
    'the branch joins the fork point three rows below',
  )
  assert.match(
    String(layerPaths[1]?.props.d),
    /^M 11 11 V 22 M 11 21 V 22 M 11 22 V 33 M 11 33 V 44 M 11 43 V 44 M 11 44 V 66 /,
    'the checked-out lane runs through every row, bridging the row edges',
  )
  const labels = mounted.harness.findAll(
    (element) => element.props.className === 'dshgg-graphLabel',
  )
  assert.deepEqual(
    labels.map((label) =>
      label.children.filter(isElement).map((child) => [child.props.className, elementText(child)]),
    ),
    [
      [
        ['dshgg-graphSubject', 'Merge feature'],
        ['dshgg-graphAuthor', 'Ann'],
      ],
      [
        ['dshgg-graphSubject', 'Main work'],
        ['dshgg-graphAuthor', 'Ann'],
      ],
      [
        ['dshgg-graphSubject', 'Feature work'],
        ['dshgg-graphAuthor', 'Bob'],
      ],
      [
        ['dshgg-graphSubject', 'Initial commit'],
        ['dshgg-graphAuthor', 'Bob'],
      ],
    ],
    'each row shows the subject and the author, like Code OSS',
  )
  const featureBadges = collectElements(
    rows[2] as TestElement,
    (element) => element.props.className === 'dshgg-graphBadge',
  )
  assert.deepEqual(
    featureBadges.map((badge) => [
      badge.props['data-icon'],
      badge.props.style?.backgroundColor,
      elementText(badge),
    ]),
    [
      ['branch', 'var(--dshgg-scm-lane1)', 'feature/x'],
      ['cloud', 'var(--dshgg-scm-lane1)', ''],
    ],
    'ordinary references take their node color',
  )
  assert.equal(
    mounted.harness.findAll((element) =>
      /dshgg-graph(Hash|Time|Meta)/.test(String(element.props?.className ?? '')),
    ).length,
    0,
    'identifier and time move to the tooltip',
  )
  const title = rows[2]?.props.title
  assert.ok(typeof title === 'string')
  assert.match(title, /feature\/x, origin\/feature\/x/)
  assert.match(title, /bbbbbbb Feature work/)
  assert.match(title, /Bob/)
  assert.match(title, /time\./)
  await mounted.harness.dispose()
})

test('lanes right of a joined lane shift left with Code OSS curves', async () => {
  const now = Math.floor(Date.now() / 1000)
  const oid = (char: string): string => char.repeat(40)
  const entry = (id: string, parents: string[], refs = '') => ({
    oid: oid(id),
    shortOid: id.repeat(7),
    author: 'Ann',
    authoredAt: now,
    refs,
    subject: `commit ${id}`,
    parents: parents.map(oid),
  })
  const history: HistoryResult = {
    commits: [
      entry('a', ['d']),
      entry('b', ['d']),
      entry('c', ['e']),
      entry('d', ['f']),
      entry('e', ['f']),
      entry('f', []),
    ],
    hasMore: false,
    references: { current: null, remote: null, base: null },
  }
  const mounted = await mountGit({ history })
  const cells = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphSvg',
  )
  assert.deepEqual(
    cells.map((cell) => cell.props.width),
    [22, 33, 44, 44, 33, 33],
    'text begins after each row’s own graph cell',
  )
  const joinRow = cells[3]
  assert.ok(joinRow)
  assert.equal(
    collectElements(joinRow, (element) => element.type === 'path').length,
    0,
    'the row cell holds only its node',
  )
  const [layer] = mounted.harness.findAll(
    (element) => element.type === 'svg' && element.props.className === 'dshgg-graphLayer',
  )
  assert.ok(layer)
  const layerPaths = collectElements(layer, (element) => element.type === 'path')
  assert.deepEqual(
    layerPaths.map((path) => path.props['data-color']),
    ['lane1', 'lane2', 'lane3'],
  )
  assert.match(
    String(layerPaths[2]?.props.d),
    /M 33 66 V 72 A 5 5 0 0 1 28 77 H 27 A 5 5 0 0 0 22 82 V 88/,
    'the lane right of the ended one turns into its new position on the join row',
  )
  assert.match(
    String(layerPaths[1]?.props.d),
    /M 22 66 A 11 11 0 0 1 11 77 H 11/,
    'the fork point curve sits on the join row, not on the row below',
  )
  const gaps = collectElements(layer, (element) => element.props.className === 'dshgg-graphGap')
  assert.deepEqual(
    gaps.map((gap) => [gap.props.cy, gap.props.r]),
    [
      [11, 6],
      [33, 6],
      [55, 6],
      [77, 6],
      [99, 6],
      [121, 6],
    ],
    'one node gap per row, in the layer coordinates',
  )
  await mounted.harness.dispose()
})
