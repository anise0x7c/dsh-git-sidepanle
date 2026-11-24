/**
 * Panel rendering, split geometry, collapsed sections and sticky headers.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createStatus } from '../support/fixtures.ts'
import type { TestElement, TestEventTarget } from '../support/types.ts'
import {
  buttonByLabel,
  collectElements,
  disposeUiLifetimes,
  elementOf,
  elementText,
  hasClass,
  loadUiPanel,
  mountGit,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

test('the panel renders branch, change groups, status letters, and the graph', async () => {
  const mounted = await mountGit()
  const text = mounted.harness.text()
  assert.match(text, /main/)
  assert.match(text, /origin\/main/)
  assert.match(text, /sections\.merge/)
  assert.match(text, /sections\.staged/)
  assert.match(text, /sections\.changes/)
  assert.match(text, /sections\.graph/)
  assert.match(text, /Fix the sidebar/)
  assert.match(text, /Initial commit/)
  const badges = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-graphBadge',
  )
  assert.deepEqual(
    badges.map((badge) => [
      badge.props['data-icon'],
      badge.props['data-color'],
      elementText(badge),
    ]),
    [
      ['target', 'ref', 'main'],
      ['cloud', 'remote', ''],
      ['tag', 'ref', 'v1.0'],
    ],
    'the checked-out branch is named, its upstream collapses into an icon badge',
  )
  assert.match(text, /app\.js/)
  assert.match(text, /README\.md/)
  assert.match(text, /merge\.txt/)
  assert.match(text, /\bU\b/)
  assert.match(text, /\bM\b/)
  assert.match(text, /!/)
  // The change list and the commit graph share one row style, so the panel has
  // a single compact row rhythm instead of one scale per section.
  const listedFiles = mounted.harness.findAll((element) => hasClass(element, 'dshgg-fileRow'))
  assert.ok(listedFiles.length > 0, 'no changed-file rows rendered')
  for (const row of listedFiles) {
    assert.ok(hasClass(row, 'dshgg-row'), 'a changed-file row does not use the shared row style')
  }
  const commits = mounted.harness.findAll((element) => hasClass(element, 'dshgg-graphRow'))
  assert.ok(commits.length > 0, 'no commit rows rendered')
  for (const row of commits) {
    assert.ok(hasClass(row, 'dshgg-row'), 'a commit row does not use the shared row style')
  }
  assert.ok(buttonByLabel(mounted.harness, 'refresh'))
  assert.ok(mounted.harness.findAll((element) => element.type === 'textarea').length === 1)
  const initial = mounted.calls.filter((call) => call.op === 'status')
  assert.ok(initial.length >= 1)
  assert.equal(typeof mounted.harness.hookStoreSize(), 'number')
  await mounted.harness.dispose()
})

test('change groups and graph are independent scroll panes with a resizable divider', async () => {
  const mounted = await mountGit()
  const panes = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-pane'),
  )
  assert.equal(panes.length, 2, 'the changes and graph each get a scroll pane')
  const [changesPane, graphPane] = panes
  assert.ok(changesPane)
  assert.ok(graphPane)
  for (const pane of panes) {
    assert.ok(String(pane.props.className).includes('dshgg-scroll'))
  }
  const sectionsIn = (pane: TestElement): unknown[] =>
    collectElements(pane, (element) => element.props['data-section'] !== undefined).map(
      (element) => element.props['data-section'],
    )
  assert.deepEqual(sectionsIn(changesPane), ['merge', 'staged', 'changes'])
  assert.deepEqual(sectionsIn(graphPane), ['graph'])
  assert.deepEqual(changesPane.props.style, { flex: '0 0 50%' })
  const divider = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) => candidate.props.role === 'separator')
    assert.ok(element, 'no split divider rendered')
    return element
  }
  assert.equal(divider().props['aria-orientation'], 'horizontal')
  assert.equal(divider().props['aria-valuemin'], 20)
  assert.equal(divider().props['aria-valuemax'], 80)
  assert.equal(divider().props['aria-valuenow'], 50)
  assert.equal(divider().props.tabIndex, 0)
  assert.match(String(divider().props['aria-label']), /split\.label/)
  mounted.harness.keydown(divider(), { key: 'ArrowDown' })
  await mounted.harness.flush()
  assert.equal(divider().props['aria-valuenow'], 55)
  const paneTop = (): TestElement | undefined =>
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-paneTop'),
    )[0]
  assert.deepEqual(paneTop()?.props.style, { flex: '0 0 55%' })

  const rect = { left: 0, top: 100, width: 320, height: 400, bottom: 500 }
  const target: TestEventTarget = {
    getBoundingClientRect: () => rect,
    focus() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => true,
    parentElement: { getBoundingClientRect: () => rect },
  }
  mounted.harness.pointer(divider(), 'down', {
    pointerId: 7,
    clientY: 200,
    currentTarget: target,
  })
  await mounted.harness.flush()
  assert.equal(divider().props['data-dragging'], 'true')
  mounted.harness.pointer(divider(), 'move', {
    pointerId: 7,
    clientY: 240,
    currentTarget: target,
  })
  await mounted.harness.flush()
  assert.equal(divider().props['aria-valuenow'], 65, 'a 40px drag over 400px moves 10%')
  assert.deepEqual(paneTop()?.props.style, { flex: '0 0 65%' })
  mounted.harness.pointer(divider(), 'move', {
    pointerId: 7,
    clientY: 900,
    currentTarget: target,
  })
  await mounted.harness.flush()
  assert.equal(divider().props['aria-valuenow'], 80, 'a drag beyond the edge clamps')
  mounted.harness.pointer(divider(), 'up', {
    pointerId: 7,
    clientY: 900,
    currentTarget: target,
  })
  await mounted.harness.flush()
  assert.equal(divider().props['data-dragging'], undefined)
  await mounted.harness.dispose()
})

test('a collapsed section folds its pane to the header row and leaves the divider inert', async () => {
  const mounted = await mountGit()
  const pane = (name: string): TestElement => {
    const [element] = mounted.harness.findAll((candidate) =>
      String(candidate.props?.className ?? '').includes(name),
    )
    assert.ok(element, `no ${name} pane rendered`)
    return element
  }
  const changesPane = (): TestElement => pane('dshgg-paneTop')
  const graphPane = (): TestElement => pane('dshgg-paneBottom')
  const divider = (): TestElement | undefined =>
    mounted.harness.findAll((candidate) => candidate.props.role === 'separator')[0]
  const sectionToggle = (id: string): TestElement => {
    const [section] = mounted.harness.findAll(
      (candidate) => candidate.type === 'section' && candidate.props['data-section'] === id,
    )
    assert.ok(section, `no ${id} section rendered`)
    const [toggle] = collectElements(
      section,
      (candidate) => candidate.type === 'button' && hasClass(candidate, 'dshgg-sectionToggle'),
    )
    assert.ok(toggle, `no ${id} section toggle rendered`)
    return toggle
  }
  const sectionBody = (id: string): TestElement | undefined => {
    const [section] = mounted.harness.findAll(
      (candidate) => candidate.type === 'section' && candidate.props['data-section'] === id,
    )
    assert.ok(section, `no ${id} section rendered`)
    return collectElements(section, (candidate) => hasClass(candidate, 'dshgg-sectionBody'))[0]
  }

  // Collapsing the graph folds the pane down to one header at the bottom edge,
  // keeps its rows mounted until the shrink has clipped them, and leaves the
  // divider visible but inert because there is no split left to move.
  mounted.harness.click(sectionToggle('graph'))
  await mounted.harness.flush()
  assert.deepEqual(graphPane().props.style, { flex: '0 0 30px' })
  assert.equal(graphPane().props['data-collapsed'], 'true')
  assert.deepEqual(changesPane().props.style, { flex: '1 1 50%' })
  assert.equal(changesPane().props['data-collapsed'], undefined)
  const foldedBody = sectionBody('graph')
  assert.ok(foldedBody, 'the graph rows stay mounted while the pane folds')
  assert.equal(foldedBody.props['aria-hidden'], 'true')
  assert.equal(foldedBody.props.inert, '')
  const inertDivider = divider()
  assert.ok(inertDivider, 'the divider stays visible while the pane is collapsed')
  assert.equal(inertDivider.props['aria-disabled'], 'true')
  assert.equal(inertDivider.props['data-disabled'], 'true')
  assert.equal(inertDivider.props.tabIndex, -1)
  assert.equal(inertDivider.props.onKeyDown, undefined, 'a collapsed divider takes no keys')
  assert.equal(inertDivider.props.onPointerDown, undefined, 'a collapsed divider takes no drag')
  assert.equal(inertDivider.props.onPointerMove, undefined)
  assert.equal(inertDivider.props.onPointerUp, undefined)
  assert.equal(inertDivider.props['data-dragging'], undefined)
  assert.equal(inertDivider.props['aria-valuenow'], 50, 'a collapsed divider moves no split')
  mounted.harness.runTimeouts()
  await mounted.harness.flush()
  assert.equal(sectionBody('graph'), undefined, 'the folded rows unmount when the fold is over')

  // Expanding it brings back the ratio that was in effect and a live divider.
  mounted.harness.click(sectionToggle('graph'))
  await mounted.harness.flush()
  assert.deepEqual(changesPane().props.style, { flex: '0 0 50%' })
  assert.deepEqual(graphPane().props.style, { flex: '1 1 0px' })
  assert.equal(graphPane().props['data-collapsed'], undefined)
  assert.equal(divider()?.props['aria-valuenow'], 50)
  assert.equal(divider()?.props.tabIndex, 0)
  assert.equal(divider()?.props['data-disabled'], undefined)

  // Collapsing every change group folds the change pane to its three headers
  // and hands the room to the graph, again with an inert divider.
  for (const id of ['merge', 'staged', 'changes']) {
    mounted.harness.click(sectionToggle(id))
    await mounted.harness.flush()
  }
  assert.deepEqual(changesPane().props.style, { flex: '0 0 94px' })
  assert.equal(changesPane().props['data-collapsed'], 'true')
  assert.deepEqual(graphPane().props.style, { flex: '1 1 0px' })
  assert.equal(divider()?.props['data-disabled'], 'true')
  assert.equal(divider()?.props.tabIndex, -1)

  // One expanded group brings the change pane's share back.
  mounted.harness.click(sectionToggle('staged'))
  await mounted.harness.flush()
  assert.deepEqual(changesPane().props.style, { flex: '0 0 50%' })
  assert.equal(divider()?.props['aria-valuenow'], 50)
  assert.equal(divider()?.props.tabIndex, 0)
  await mounted.harness.dispose()
})

test('a clean workspace keeps the change pane share of the split', async () => {
  const mounted = await mountGit({ status: createStatus({ files: [] }) })
  const [changesPane] = mounted.harness.findAll((candidate) =>
    String(candidate.props?.className ?? '').includes('dshgg-paneTop'),
  )
  assert.ok(changesPane, 'no change pane rendered')
  assert.deepEqual(
    changesPane.props.style,
    { flex: '0 0 50%' },
    'a pane that renders no section keeps its share',
  )
  assert.equal(
    changesPane.props['data-collapsed'],
    undefined,
    'no section means nothing is collapsed',
  )
  assert.equal(
    mounted.harness.findAll((candidate) => candidate.props.role === 'separator').length,
    1,
    'the divider is still offered',
  )
  await mounted.harness.dispose()
})

test('each section header belongs to its own section so only one can stick', async () => {
  const mounted = await mountGit()
  const sections = mounted.harness.findAll((element) => element.props['data-section'] !== undefined)
  assert.deepEqual(
    sections.map((section) => section.props['data-section']),
    ['merge', 'staged', 'changes', 'graph'],
  )
  for (const section of sections) {
    // A header only pins while its own section is in view when the section is
    // its containing block: the header is a direct child, never a sibling
    // shared by a stack of sections.
    const header = elementOf(section.children[0])
    assert.equal(
      header.props.className,
      'dshgg-sectionHeader',
      `${String(section.props['data-section'])} must lead with its own header`,
    )
  }
  await mounted.harness.dispose()
})

test('the graph header shows no commit count while group headers keep theirs', async () => {
  const mounted = await mountGit()
  const section = (id: string): TestElement => {
    const [element] = mounted.harness.findAll(
      (candidate) => candidate.props?.['data-section'] === id,
    )
    assert.ok(element, `no ${id} section rendered`)
    return element
  }
  const countChips = (id: string): TestElement[] =>
    collectElements(section(id), (element) =>
      String(element.props?.className ?? '')
        .split(' ')
        .includes('dshgg-sectionCount'),
    )
  assert.equal(
    countChips('graph').length,
    0,
    'the graph header shows no count of the loaded commits',
  )
  assert.deepEqual(
    countChips('staged').map((chip) => elementText(chip)),
    ['1'],
    'the staged group keeps its file count',
  )
  assert.deepEqual(
    countChips('changes').map((chip) => elementText(chip)),
    ['2'],
    'the changes group keeps its file count',
  )
  await mounted.harness.dispose()
})
