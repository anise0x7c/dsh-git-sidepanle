/**
 * Commit details card, its folder tree and its dismissal.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { CommitDetails } from '../../src/shared/git.ts'
import { COMMIT_DETAILS } from '../support/fixtures.ts'
import type { TestElement } from '../support/types.ts'
import {
  buttonByLabel,
  collectElements,
  commitBox,
  commitCard,
  disposeUiLifetimes,
  elementText,
  escapeKeydown,
  finishMotion,
  graphRows,
  hasClass,
  lastTarget,
  loadUiPanel,
  menuActionId,
  menuActions,
  mountGit,
  openCommitDetails,
  runMenuAction,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

test('commit details overlay the split and keep the chosen ratio', async () => {
  const mounted = await mountGit()
  const divider = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) => candidate.props.role === 'separator')
    assert.ok(element, 'no split divider rendered')
    return element
  }
  mounted.harness.keydown(divider(), { key: 'PageDown' })
  await mounted.harness.flush()
  assert.equal(divider().props['aria-valuenow'], 60)
  await openCommitDetails(mounted)
  assert.equal(
    divider().props['aria-valuenow'],
    60,
    'the split stays mounted beneath the details card at the chosen ratio',
  )
  assert.match(mounted.harness.text(), /commitDetails\.files/)
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await finishMotion(mounted.harness)
  assert.equal(divider().props['aria-valuenow'], 60)
  await mounted.harness.dispose()
})

test('commit details render the changed files as a collapsed folder tree', async () => {
  const treeDetails: CommitDetails = {
    ...COMMIT_DETAILS,
    files: [
      { path: 'src/app.js', letter: 'M' },
      { path: 'src/util/deep/b.ts', letter: 'A' },
      { path: 'docs/gone.md', letter: 'D' },
      { path: 'top.md', letter: 'M' },
    ],
  }
  const mounted = await mountGit({ commitDetails: treeDetails })
  await openCommitDetails(mounted)
  const card = commitCard(mounted.harness)
  const rows = collectElements(
    card,
    (element) => hasClass(element, 'dshgg-folderRow') || hasClass(element, 'dshgg-fileRow'),
  )
  assert.deepEqual(
    rows.map((row) =>
      hasClass(row, 'dshgg-folderRow')
        ? `folder:${String(row.props.title)}`
        : `file:${String(row.props.title)}`,
    ),
    [
      'folder:docs',
      'file:docs/gone.md',
      'folder:src',
      'folder:src/util/deep',
      'file:src/util/deep/b.ts',
      'file:src/app.js',
      'file:top.md',
    ],
    'folders precede files at every level and unused folder chains collapse',
  )
  assert.deepEqual(
    rows.map((row) => row.props.style?.paddingLeft),
    ['6px', '20px', '6px', '20px', '34px', '20px', '6px'],
    'each rendered nesting step indents the row another fourteen pixels',
  )
  const folderRows = rows.filter((row) => hasClass(row, 'dshgg-folderRow'))
  const fileRows = rows.filter((row) => hasClass(row, 'dshgg-fileRow'))
  for (const row of rows) {
    assert.ok(hasClass(row, 'dshgg-row'), 'every details row uses the shared row style')
  }
  assert.equal(folderRows.length, 3, 'docs, src and the collapsed src/util/deep chain')
  assert.equal(fileRows.length, 4, 'every changed file keeps exactly one row')
  const chain = folderRows.find((row) => row.props.title === 'src/util/deep')
  assert.ok(chain, 'the unbranched src/util chain renders as src/util/deep')
  assert.equal(chain.props.style?.paddingLeft, '20px', 'the collapsed chain takes one nesting step')
  assert.deepEqual(
    fileRows.map((row) => row.props.title),
    ['docs/gone.md', 'src/util/deep/b.ts', 'src/app.js', 'top.md'],
    'file rows keep their full repository-relative path as the tooltip',
  )
  assert.deepEqual(
    fileRows.map((row) => {
      const [status] = collectElements(row, (element) => hasClass(element, 'dshgg-status'))
      assert.ok(status, 'every file row keeps its status letter')
      return status.props['data-status']
    }),
    ['D', 'A', 'M', 'M'],
    'file rows keep the status letters their change entries carry',
  )
  const [count] = collectElements(card, (element) => hasClass(element, 'dshgg-sectionCount'))
  assert.ok(count, 'the files header keeps its count')
  assert.equal(elementText(count), '4', 'the header counts the changed files, not the tree rows')
  const openedTabsBefore = mounted.openedTabs.length
  const callsBefore = mounted.calls.length
  for (const folder of folderRows) {
    assert.equal(folder.props.role, 'button', 'folder rows are disclosure controls')
    assert.equal(folder.props.tabIndex, 0, 'folder rows take keyboard focus')
    assert.equal(folder.props['aria-expanded'], true, 'folders start expanded')
    const [toggle] = collectElements(folder, (element) => hasClass(element, 'dshgg-folderToggle'))
    assert.ok(toggle, 'every folder row reserves the disclosure slot')
    const [chevron] = collectElements(toggle, (element) => hasClass(element, 'dshgg-chevron'))
    assert.ok(chevron, 'the disclosure slot holds the expansion arrow')
    assert.equal(chevron.props['data-open'], 'true', 'an expanded folder points its arrow down')
    assert.equal(
      collectElements(folder, (element) => element.type === 'svg').length,
      1,
      'the folder row draws only its expansion arrow, not a folder glyph',
    )
  }
  await mounted.harness.flush()
  assert.equal(mounted.openedTabs.length, openedTabsBefore, 'rendering a folder row opens no diff')
  assert.equal(mounted.calls.length, callsBefore, 'rendering a folder row requests nothing')
  await mounted.harness.dispose()
})

test('a details folder collapses and expands by pointer and keyboard', async () => {
  const treeDetails: CommitDetails = {
    ...COMMIT_DETAILS,
    files: [
      { path: 'src/app.js', letter: 'M' },
      { path: 'src/util/deep/b.ts', letter: 'A' },
      { path: 'docs/gone.md', letter: 'D' },
      { path: 'top.md', letter: 'M' },
    ],
  }
  const mounted = await mountGit({ commitDetails: treeDetails })
  await openCommitDetails(mounted)
  const rows = (): TestElement[] =>
    collectElements(
      commitCard(mounted.harness),
      (element) => hasClass(element, 'dshgg-folderRow') || hasClass(element, 'dshgg-fileRow'),
    )
  const titles = (): unknown[] => rows().map((row) => row.props.title)
  const folder = (path: string): TestElement => {
    const [row] = rows().filter(
      (candidate) => hasClass(candidate, 'dshgg-folderRow') && candidate.props.title === path,
    )
    assert.ok(row, `no folder row rendered for ${path}`)
    return row
  }
  const arrow = (path: string): TestElement => {
    const [chevron] = collectElements(folder(path), (element) => hasClass(element, 'dshgg-chevron'))
    assert.ok(chevron, `no expansion arrow rendered for ${path}`)
    return chevron
  }
  const openedTabs = mounted.openedTabs.length
  const calls = mounted.calls.length

  mounted.harness.click(folder('src'))
  await mounted.harness.flush()
  assert.equal(folder('src').props['aria-expanded'], false, 'a pointer click collapses the folder')
  assert.equal(arrow('src').props['data-open'], 'false', 'the collapsed arrow points right')
  assert.deepEqual(
    titles(),
    ['docs', 'docs/gone.md', 'src', 'top.md'],
    'the collapsed folder keeps its row and hides every nested row',
  )
  assert.equal(
    collectElements(commitCard(mounted.harness), (element) => hasClass(element, 'dshgg-fileRow'))
      .length,
    2,
    'only the files outside the collapsed subtree remain',
  )

  mounted.harness.click(folder('src'))
  await mounted.harness.flush()
  assert.equal(folder('src').props['aria-expanded'], true, 'a second click expands the folder')
  assert.equal(arrow('src').props['data-open'], 'true', 'the expanded arrow points down')
  assert.deepEqual(
    titles(),
    ['docs', 'docs/gone.md', 'src', 'src/util/deep', 'src/util/deep/b.ts', 'src/app.js', 'top.md'],
    'expanding restores the subtree where it was',
  )

  mounted.harness.click(folder('src/util/deep'))
  await mounted.harness.flush()
  assert.equal(folder('src').props['aria-expanded'], true, 'the parent stays expanded')
  assert.deepEqual(
    titles(),
    ['docs', 'docs/gone.md', 'src', 'src/util/deep', 'src/app.js', 'top.md'],
    'collapsing a nested folder hides only its own descendants',
  )
  mounted.harness.click(folder('src/util/deep'))
  await mounted.harness.flush()

  let prevented = false
  mounted.harness.keydown(folder('docs'), {
    key: 'Enter',
    preventDefault: () => {
      prevented = true
    },
  })
  await mounted.harness.flush()
  assert.equal(prevented, true, 'keyboard activation consumes the key')
  assert.equal(folder('docs').props['aria-expanded'], false, 'Enter collapses the folder')
  assert.deepEqual(titles(), [
    'docs',
    'src',
    'src/util/deep',
    'src/util/deep/b.ts',
    'src/app.js',
    'top.md',
  ])
  mounted.harness.keydown(folder('docs'), { key: ' ' })
  await mounted.harness.flush()
  assert.equal(folder('docs').props['aria-expanded'], true, 'Space expands the folder')
  assert.equal(folder('docs').props.tabIndex, 0, 'the activated row stays focusable')
  assert.equal(mounted.openedTabs.length, openedTabs, 'toggling a folder opens no diff tab')
  assert.equal(mounted.calls.length, calls, 'toggling a folder requests nothing')

  mounted.harness.click(folder('src'))
  await mounted.harness.flush()
  assert.equal(folder('src').props['aria-expanded'], false)
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await finishMotion(mounted.harness)
  await openCommitDetails(mounted, 1)
  const reopened = collectElements(commitCard(mounted.harness), (element) =>
    hasClass(element, 'dshgg-folderRow'),
  )
  assert.equal(reopened.length, 3, 'the newly opened details render the same tree')
  for (const row of reopened) {
    assert.equal(
      row.props['aria-expanded'],
      true,
      'another commit opens every folder expanded again',
    )
  }
  await mounted.harness.dispose()
})

test('View Details shows a commit and a file opens the commit diff', async () => {
  const mounted = await mountGit()
  await openCommitDetails(mounted)

  const detailsCall = mounted.calls.find((call) => call.op === 'commit-details')
  assert.equal(detailsCall?.oid, 'a'.repeat(40))
  const card = commitCard(mounted.harness)
  const text = elementText(card)
  assert.match(text, /commitDetails\.files/)
  assert.match(text, /Fix the sidebar/)
  assert.match(text, /Ann/)
  assert.match(text, /A longer explanation of the fix\./)
  assert.match(text, /\.js/)
  assert.match(text, /app\.js/)
  assert.match(text, /added\.js/)
  assert.match(text, /renamed\.js/)
  assert.match(text, /old\.js/)
  assert.match(text, /gone\.md/)
  const folderRows = collectElements(card, (element) => hasClass(element, 'dshgg-folderRow'))
  assert.deepEqual(
    folderRows.map((row) => row.props.title),
    ['docs', 'src'],
    'commit files are grouped into folder rows',
  )
  assert.deepEqual(
    folderRows.map((row) => {
      const [label] = collectElements(row, (element) => hasClass(element, 'dshgg-folderName'))
      assert.ok(label, 'every folder row renders its name')
      return elementText(label)
    }),
    ['docs', 'src'],
    'each folder row shows its collapsed chain label',
  )
  for (const row of folderRows) {
    assert.deepEqual(
      row.props.style,
      { paddingLeft: '6px' },
      'root folder rows sit at the first nesting level',
    )
    assert.equal(row.props.role, 'button', 'folder rows are disclosure controls')
    assert.equal(row.props.tabIndex, 0, 'folder rows take keyboard focus')
    assert.equal(row.props['aria-expanded'], true, 'folders start expanded')
    assert.equal(hasClass(row, 'dshgg-fileRow'), false, 'folder rows are not file rows')
  }
  const commitTitles = collectElements(card, (element) => hasClass(element, 'dshgg-fileRow')).map(
    (row) => row.props.title,
  )
  assert.deepEqual(
    commitTitles,
    ['docs/gone.md', 'src/added.js', 'src/app.js', 'src/old.js → src/renamed.js'],
    'commit files are listed once each in path order',
  )
  assert.ok(buttonByLabel(mounted.harness, 'commitDetails.back'))
  assert.ok(commitBox(mounted.harness), 'the commit box stays mounted beneath the card')
  assert.equal(
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-split')).length,
    1,
    'the split stays mounted beneath the card',
  )
  const content = mounted.harness.findAll((element) => hasClass(element, 'dshgg-content'))[0]
  assert.ok(content, 'the panel content stays mounted beneath the card')
  assert.equal(content.props['aria-hidden'], 'true', 'the underlay is hidden from the tree')
  assert.equal(content.props.inert, '', 'the underlay takes no focus or input')

  const fileRows = collectElements(
    card,
    (element) => hasClass(element, 'dshgg-fileRow') && element.props?.title === 'src/app.js',
  )
  assert.equal(fileRows.length, 1, 'the changed file is listed once')
  mounted.harness.click(fileRows[0])
  const opened = mounted.openedTabs.at(-1)
  assert.ok(opened)
  assert.equal(opened.kind, 'git-diff')
  assert.equal(opened.options.params.path, 'src/app.js')
  assert.equal(opened.options.params.commit, 'a'.repeat(40))
  assert.equal(opened.options.params.shortOid, 'aaaaaaa')
  assert.equal(opened.options.params.status, 'M')

  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await finishMotion(mounted.harness)
  const after = mounted.harness.text()
  assert.match(after, /sections\.changes/)
  assert.doesNotMatch(after, /commitDetails\.files/)
  await mounted.harness.dispose()
})

test('the commit details view slides in from the right edge and back out', async (t) => {
  const mounted = await mountGit()
  t.after(() => mounted.harness.dispose())
  const wrappers = (): TestElement[] =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMotion'))
  const content = (): TestElement => {
    const [element] = mounted.harness.findAll((candidate) => hasClass(candidate, 'dshgg-content'))
    assert.ok(element, 'no panel content rendered')
    return element
  }
  const splitCount = (): number =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-split')).length
  assert.equal(wrappers().length, 0, 'no details motion is rendered while the split shows')
  assert.equal(splitCount(), 1)
  assert.equal(content().props['aria-hidden'], undefined)
  assert.equal(content().props.inert, undefined)
  await openCommitDetails(mounted)
  const [arriving] = wrappers()
  assert.ok(arriving, 'the details view has a motion surface')
  assert.equal(arriving.props['data-phase'], 'enter', 'the details view slides in')
  assert.equal(
    collectElements(arriving, (element) => hasClass(element, 'dshgg-commitView')).length,
    1,
    'the details view itself is the surface that moves',
  )
  const [card] = collectElements(arriving, (element) => hasClass(element, 'dshgg-commitCard'))
  assert.ok(card, 'the details view sits on the card surface')
  assert.equal(splitCount(), 1, 'the split stays mounted beneath the entering card')
  assert.equal(content().props['aria-hidden'], 'true', 'the entering card hides the underlay')
  assert.equal(content().props.inert, '', 'the entering card makes the underlay inert')
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await mounted.harness.flush()
  const [leaving] = wrappers()
  assert.ok(leaving)
  assert.equal(leaving.props['data-phase'], 'leave', 'returning slides the details view out')
  assert.match(
    elementText(leaving),
    /commitDetails\.files/,
    'the details content is still shown while it slides away',
  )
  assert.equal(splitCount(), 1, 'the split stays mounted while the card leaves')
  assert.equal(content().props['aria-hidden'], 'true', 'the leaving card still hides the underlay')
  assert.equal(content().props.inert, '', 'the leaving card still makes the underlay inert')
  await finishMotion(mounted.harness)
  assert.equal(wrappers().length, 0, 'the details view is removed once it has slid away')
  assert.equal(content().props['aria-hidden'], undefined)
  assert.equal(content().props.inert, undefined)
  assert.equal(splitCount(), 1, 'the change list remains mounted after the details view has left')
})

test('Escape closes the commit details without calling Git', async (t) => {
  const mounted = await mountGit()
  t.after(() => mounted.harness.dispose())
  const wrappers = (): TestElement[] =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMotion'))
  await openCommitDetails(mounted)
  const callCount = mounted.calls.length
  const escapeResult = escapeKeydown()
  await mounted.harness.flush()
  assert.deepEqual(escapeResult, { prevented: true, stopped: true }, 'the panel owns the key')
  const [leaving] = wrappers()
  assert.ok(leaving)
  assert.equal(leaving.props['data-phase'], 'leave', 'Escape uses the back-control transition')
  assert.match(elementText(leaving), /commitDetails\.files/, 'the content leaves before removal')
  assert.equal(mounted.calls.length, callCount, 'Escape runs no Git command')
  await finishMotion(mounted.harness)
  assert.equal(wrappers().length, 0, 'the card is removed after it slides away')
  assert.match(mounted.harness.text(), /sections\.changes/, 'the split is revealed in place')
})

test('Escape leaves an owned branch menu and a consumed host key alone', async (t) => {
  const mounted = await mountGit()
  t.after(() => mounted.harness.dispose())
  const wrappers = (): TestElement[] =>
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMotion'))
  const branchChip = (): TestElement => {
    const [chip] = mounted.harness.findAll(
      (element) => element.type === 'button' && hasClass(element, 'dshgg-branchChip'),
    )
    assert.ok(chip, 'no branch chip rendered')
    return chip
  }
  await openCommitDetails(mounted)
  mounted.harness.click(branchChip())
  await mounted.harness.flush()
  assert.equal(branchChip().props['aria-expanded'], true, 'the branch menu is open')

  const branchEscape = escapeKeydown()
  await mounted.harness.flush()
  assert.equal(branchEscape.prevented, false, 'the details card does not consume this Escape')
  assert.equal(branchChip().props['aria-expanded'], false, 'the branch menu closes instead')
  assert.equal(wrappers().length, 1, 'the details card stays open')
  assert.equal(wrappers()[0]?.props['data-phase'], 'enter')

  const consumed = escapeKeydown(true)
  await mounted.harness.flush()
  assert.deepEqual(consumed, { prevented: false, stopped: false }, 'a handled Escape is ignored')
  assert.equal(wrappers()[0]?.props['data-phase'], 'enter', 'the card is still open')

  const detailsEscape = escapeKeydown()
  await mounted.harness.flush()
  assert.equal(detailsEscape.prevented, true)
  assert.equal(wrappers()[0]?.props['data-phase'], 'leave', 'a later Escape closes the card')
})

test('Escape without details leaves the panel alone', async (t) => {
  const mounted = await mountGit()
  t.after(() => mounted.harness.dispose())
  const escapeResult = escapeKeydown()
  await mounted.harness.flush()
  assert.deepEqual(escapeResult, { prevented: false, stopped: false })
  assert.equal(
    mounted.harness.findAll((element) => hasClass(element, 'dshgg-commitMotion')).length,
    0,
    'no details view is opened',
  )
})

test('View Details stays available while an operation runs', async () => {
  let release = (): void => {}
  const until = new Promise<void>((resolve) => {
    release = resolve
  })
  const mounted = await mountGit({ pending: { op: 'stage', until } })
  const row = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  mounted.harness.contextmenu(row[row.length - 1], { clientX: 1, clientY: 2 })
  await runMenuAction(mounted.components, lastTarget(mounted.menu), 'stage')
  await mounted.harness.flush()
  const graphRow = graphRows(mounted.harness)[0]
  assert.ok(graphRow)
  mounted.harness.contextmenu(graphRow, { clientX: 1, clientY: 2 })
  const target = lastTarget(mounted.menu)
  assert.equal(target.value.busy, true)
  const actions = menuActions(mounted.components, target)
  assert.equal(actions[0]?.id, menuActionId('view-details'))
  assert.notEqual(actions[0]?.disabled, true)
  assert.equal(
    actions.find((action) => action.id === menuActionId('checkout-detached'))?.disabled,
    true,
  )
  await runMenuAction(mounted.components, target, 'view-details')
  await mounted.harness.flush()
  assert.match(mounted.harness.text(), /commitDetails\.files/)
  release()
  await mounted.harness.flush()
  await mounted.harness.dispose()
})

test('a stale View Details reports the target instead of opening', async () => {
  const mounted = await mountGit()
  const graphRow = graphRows(mounted.harness)[0]
  assert.ok(graphRow)
  mounted.harness.contextmenu(graphRow, { clientX: 1, clientY: 2 })
  const target = lastTarget(mounted.menu)
  const stale = { ...target, value: { ...target.value, oid: 'c'.repeat(40) } }
  await runMenuAction(mounted.components, stale, 'view-details')
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'commit-details').length, 0)
  assert.doesNotMatch(mounted.harness.text(), /commitDetails\.files/)
  assert.deepEqual(mounted.components.notifications.pop(), { text: 'menu.stale', success: false })
  await mounted.harness.dispose()
})
