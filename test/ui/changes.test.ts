/**
 * Change list rows: grouping, file-type icons, status letters and the
 * Workspace header's list/tree view menu.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { ChangeEntry } from '../../src/shared/git.ts'
import { createStatus, STATUS } from '../support/fixtures.ts'
import type { TestElement } from '../support/types.ts'
import type { MountedGit } from '../support/ui-panel.ts'
import {
  buttonByLabel,
  buttonInside,
  collectElements,
  commitCard,
  dispatchDocumentPointerdown,
  disposeUiLifetimes,
  elementText,
  escapeKeydown,
  finishMotion,
  hasClass,
  isElement,
  loadUiPanel,
  mountGit,
  openCommitDetails,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

/** The Workspace section header that carries the view menu. */
function workspaceHeader(mounted: MountedGit): TestElement {
  const section = mounted.harness.findAll(
    (element) => element.props?.['data-section'] === 'workspace',
  )[0]
  assert.ok(section, 'no Workspace section rendered')
  const header = section.children.find(isElement)
  assert.ok(header, 'the Workspace section renders no header')
  return header
}

/** Every rendered changed-file row, optionally one path. */
function fileRows(mounted: MountedGit, title?: string): TestElement[] {
  return mounted.harness.findAll(
    (element) =>
      hasClass(element, 'dshgg-fileRow') && (title === undefined || element.props.title === title),
  )
}

/** Every rendered folder row. */
function folderRows(mounted: MountedGit): TestElement[] {
  return mounted.harness.findAll((element) => hasClass(element, 'dshgg-folderRow'))
}

/** The Workspace header's view-menu trigger. */
function viewTrigger(mounted: MountedGit): TestElement {
  return buttonInside(workspaceHeader(mounted), 'menu.view')
}

/** Items of the open Workspace view menu. */
function viewItems(mounted: MountedGit): TestElement[] {
  return mounted.harness.findAll((element) => hasClass(element, 'dshgg-menuItem'))
}

/** Labels of the open Workspace view menu's items. */
function viewLabels(mounted: MountedGit): string[] {
  return viewItems(mounted).map((item) => elementText(item))
}

/** Open the Workspace header's view menu. */
async function openViewMenu(mounted: MountedGit): Promise<void> {
  mounted.harness.click(viewTrigger(mounted))
  await mounted.harness.flush()
}

/** Choose one file view from the Workspace header's view menu. */
async function chooseView(
  mounted: MountedGit,
  label: 'menu.viewList' | 'menu.viewTree',
): Promise<void> {
  await openViewMenu(mounted)
  const [item] = viewItems(mounted).filter((element) => elementText(element) === label)
  assert.ok(item, `no view menu item labelled "${label}"`)
  mounted.harness.click(item)
  await mounted.harness.flush()
}

/** Indexes of the open menu's items that carry a check glyph. */
function markedItems(mounted: MountedGit): number[] {
  return viewItems(mounted)
    .map((item, index) =>
      collectElements(item, (element) => element.type === 'svg').length > 0 ? index : -1,
    )
    .filter((index) => index >= 0)
}

test('the change lists and commit details draw the host file-type icon for every file', async () => {
  const mounted = await mountGit({
    hostModules: {
      '@deepseek-ai/dsh-client-ui-primitives': {
        FileTypeIcon: (props: { path: string; size: number }) => ({
          type: 'svg',
          props: { 'data-file-type': props.path },
          children: [],
        }),
      },
    },
  })
  const fileRows = (): TestElement[] =>
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow'),
    )
  const glyphs = (rows: TestElement[]): string[] =>
    collectElements(rows, (element) => element.props['data-file-type'] !== undefined).map(
      (element) => String(element.props['data-file-type']),
    )
  const lists = fileRows()
  assert.equal(lists.length, 4)
  assert.deepEqual(
    glyphs(lists).sort(),
    ['README.md', 'merge.txt', 'src/app.js', 'src/app.js'],
    'every change-list row passes its path to the host icon',
  )
  await openCommitDetails(mounted)
  assert.equal(fileRows().length, 8, 'the underlay change rows stay mounted beneath the card')
  const details = collectElements(commitCard(mounted.harness), (element) =>
    hasClass(element, 'dshgg-fileRow'),
  )
  assert.equal(details.length, 4)
  assert.deepEqual(
    glyphs(details).sort(),
    ['docs/gone.md', 'src/added.js', 'src/app.js', 'src/renamed.js'],
    'every details row passes its path to the host icon',
  )
  await mounted.harness.dispose()
})

test('the workspace groups indent their rows one nesting level', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll((element) => hasClass(element, 'dshgg-fileRow'))
  assert.equal(rows.length, 4, 'the three change groups render one row per file')
  for (const [index, row] of rows.entries()) {
    assert.equal(
      row.props.style?.paddingLeft,
      '20px',
      `change row ${index} sits one level below the Workspace header`,
    )
  }
  await mounted.harness.dispose()
})

test('every flat file row puts its status letter at the row end', async () => {
  const mounted = await mountGit()
  const fileRows = (scope?: TestElement): TestElement[] =>
    scope === undefined
      ? mounted.harness.findAll((element) => hasClass(element, 'dshgg-fileRow'))
      : collectElements(scope, (element) => hasClass(element, 'dshgg-fileRow'))
  const assertStatusTrails = (row: TestElement, label: string): TestElement => {
    const children = row.children.filter(isElement)
    const first = children[0]
    assert.ok(first, `${label} renders element children`)
    assert.ok(hasClass(first, 'dshgg-rowIcon'), `${label} starts with its file icon`)
    const last = children[children.length - 1]
    assert.ok(last, `${label} renders a final element`)
    assert.ok(hasClass(last, 'dshgg-status'), `${label} ends with its status letter`)
    const actions = children.findIndex((child) => hasClass(child, 'dshgg-fileActions'))
    assert.ok(actions >= 0, `${label} renders its action slot`)
    assert.ok(actions < children.length - 1, `${label} keeps its actions before the status letter`)
    return last
  }

  const rows = fileRows()
  assert.equal(rows.length, 4, 'the three change groups render one row per file')
  for (const [index, row] of rows.entries()) {
    const status = assertStatusTrails(row, `change row ${index}`)
    assert.equal(
      status.props['data-status'],
      elementText(status),
      `change row ${index} keeps its status letter in the data attribute and the text`,
    )
  }

  await openCommitDetails(mounted)
  const details = fileRows(commitCard(mounted.harness))
  assert.equal(details.length, 4, 'the commit details list one row per file')
  for (const [index, row] of details.entries()) {
    const status = assertStatusTrails(row, `details row ${index}`)
    assert.equal(
      status.props['data-status'],
      elementText(status),
      `details row ${index} keeps its status letter in the data attribute and the text`,
    )
  }
  const app = details.find((row) => row.props.title === 'src/app.js')
  assert.ok(app, 'the modified app.js details row is rendered')
  const appStatus = assertStatusTrails(app, 'the app.js details row')
  assert.equal(appStatus.props['data-status'], 'M')
  assert.equal(elementText(appStatus), 'M')
  await mounted.harness.dispose()
})

test('the change lists and commit details keep the plain icon without a usable host icon', async () => {
  const mounted = await mountGit()
  const plainIcons = (scope?: TestElement): number => {
    const icons =
      scope === undefined
        ? mounted.harness.findAll((element) => hasClass(element, 'dshgg-rowIcon'))
        : collectElements(scope, (element) => hasClass(element, 'dshgg-rowIcon'))
    return icons.flatMap((icon) =>
      collectElements(
        icon,
        (element) => element.type === 'svg' && element.props.viewBox === '0 0 16 16',
      ),
    ).length
  }
  assert.equal(plainIcons(), 4, 'every change-list row falls back to the document icon')
  await openCommitDetails(mounted)
  assert.equal(
    plainIcons(commitCard(mounted.harness)),
    4,
    'every details row falls back to the document icon',
  )
  await mounted.harness.dispose()
})

test('a clean repository shows the clean text without a check icon', async () => {
  const mounted = await mountGit({ status: createStatus({ files: [] }) })
  const clean = mounted.harness.findAll(
    (element) => String(element.props?.className ?? '') === 'dshgg-clean',
  )[0]
  assert.ok(clean, 'no clean-workspace state rendered')
  assert.match(elementText(clean), /clean\.title/)
  assert.match(elementText(clean), /clean\.desc/)
  assert.equal(
    collectElements(clean, (element) => element.type === 'svg').length,
    0,
    'the clean state carries no icon',
  )
  assert.equal(
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-cleanIcon'),
    ).length,
    0,
  )
  await mounted.harness.dispose()
})

test('a conflicted file is listed directly under merge changes', async () => {
  const status = createStatus({
    files: [
      {
        kind: 'unmerged',
        x: 'U',
        y: 'U',
        path: 'src/deep/conflicted.txt',
        conflict: true,
        untracked: false,
      },
    ],
  })
  const mounted = await mountGit({ status })
  const text = mounted.harness.text()
  assert.match(text, /sections\.merge/)
  assert.match(text, /conflicted\.txt/)
  assert.match(text, /src\/deep/)
  assert.match(text, /!/)
  assert.equal(
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-folderRow'),
    ).length,
    0,
    'no folder rows are rendered',
  )
})

test('nested changed files stay in one flat path-sorted layer', async () => {
  const modified = (path: string): ChangeEntry => ({
    kind: 'ordinary',
    x: '.',
    y: 'M',
    path,
    conflict: false,
    untracked: false,
  })
  const status = createStatus({
    files: [
      modified('src/z/deep.js'),
      modified('src/a.js'),
      modified('docs/readme.md'),
      modified('a10.js'),
      modified('a2.js'),
    ],
  })
  const mounted = await mountGit({ status })
  const fileRows = mounted.harness.findAll((element) =>
    String(element.props?.className ?? '').includes('dshgg-fileRow'),
  )
  assert.deepEqual(
    fileRows.map((row) => row.props.title),
    ['a2.js', 'a10.js', 'docs/readme.md', 'src/a.js', 'src/z/deep.js'],
    'one row per file in path order, with no folder rows between them',
  )
  assert.equal(
    mounted.harness.findAll((element) =>
      String(element.props?.className ?? '').includes('dshgg-folderRow'),
    ).length,
    0,
  )
  const texts = fileRows.map(elementText)
  const readmeRowText = texts[2]
  const deepRowText = texts[4]
  assert.ok(readmeRowText, 'the docs file row rendered no text')
  assert.ok(deepRowText, 'the nested file row rendered no text')
  assert.ok(
    readmeRowText.includes('readme.md') && readmeRowText.includes('docs'),
    'the row shows the file name and its parent directory',
  )
  assert.ok(
    deepRowText.includes('deep.js') && deepRowText.includes('src/z'),
    'a nested file keeps its whole parent path on one line',
  )
  for (const row of fileRows)
    assert.equal(
      row.props.style?.paddingLeft,
      '20px',
      'a flat row takes the group nesting inset but no folder indentation',
    )
  await mounted.harness.dispose()
})

test('row actions stage and unstage through the Host', async () => {
  const mounted = await mountGit()
  const rows = mounted.harness.findAll(
    (element) =>
      String(element.props?.className ?? '').includes('dshgg-fileRow') &&
      element.props?.title === 'src/app.js',
  )
  assert.equal(rows.length, 2, 'the file appears staged and again unstaged')
  const stagedRow = rows[0]
  const unstagedRow = rows[1]
  assert.ok(stagedRow, 'the staged file row is missing')
  assert.ok(unstagedRow, 'the unstaged file row is missing')
  mounted.harness.click(buttonInside(unstagedRow, 'actions.stage'))
  await mounted.harness.flush()
  const stageCall = mounted.calls.find((call) => call.op === 'stage')
  assert.deepEqual(stageCall?.paths, ['src/app.js'])
  mounted.harness.click(buttonInside(stagedRow, 'actions.unstage'))
  await mounted.harness.flush()
  const unstageCall = mounted.calls.find((call) => call.op === 'unstage')
  assert.deepEqual(unstageCall?.paths, ['src/app.js'])
  await mounted.harness.dispose()
})

test('the Workspace header drops a view menu that marks the list', async () => {
  const mounted = await mountGit()
  const callsBefore = mounted.calls.length
  assert.equal(viewItems(mounted).length, 0, 'the menu starts closed')
  assert.equal(viewTrigger(mounted).props['aria-expanded'], false)
  await openViewMenu(mounted)
  assert.equal(viewTrigger(mounted).props['aria-haspopup'], 'menu')
  assert.equal(viewTrigger(mounted).props['aria-expanded'], true)
  assert.deepEqual(viewLabels(mounted), ['menu.viewList', 'menu.viewTree'])
  assert.deepEqual(markedItems(mounted), [0], 'only the view in effect carries a check mark')
  for (const item of viewItems(mounted)) {
    assert.equal(item.props.role, 'menuitemradio', 'a view is one choice of a radio group')
    assert.equal(
      item.props.disabled ?? false,
      false,
      'the view in effect stays selectable so choosing it only closes the menu',
    )
  }
  assert.equal(mounted.calls.length, callsBefore, 'opening the menu runs no Git operation')
  assert.equal(mounted.menu.opens.length, 0, 'the Workspace header keeps its own menu component')
  mounted.harness.click(viewItems(mounted)[1])
  await mounted.harness.flush()
  assert.equal(viewItems(mounted).length, 0, 'choosing a view closes the menu')
  await openViewMenu(mounted)
  assert.deepEqual(markedItems(mounted), [1], 'the menu marks the view now in effect')
  await mounted.harness.dispose()
})

test('the trigger toggles the view menu and Escape or an outside pointerdown closes it', async () => {
  const mounted = await mountGit()
  const callsBefore = mounted.calls.length
  await openViewMenu(mounted)
  assert.equal(viewItems(mounted).length, 2)
  const closed = escapeKeydown()
  await mounted.harness.flush()
  assert.equal(viewItems(mounted).length, 0, 'Escape closes the menu')
  assert.equal(closed.prevented, false, 'the menu does not consume the key')
  await openViewMenu(mounted)
  mounted.harness.click(viewTrigger(mounted))
  await mounted.harness.flush()
  assert.equal(viewItems(mounted).length, 0, 'the trigger closes the menu again')
  await openViewMenu(mounted)
  dispatchDocumentPointerdown({})
  await mounted.harness.flush()
  assert.equal(viewItems(mounted).length, 0, 'an outside pointerdown closes the menu')
  assert.equal(mounted.calls.length, callsBefore, 'closing the menu runs no Git operation')
  await mounted.harness.dispose()
})

test('a running Git operation keeps the view menu selectable', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const mounted = await mountGit({ pending: { op: 'stage', until: pending } })
  const unstaged = fileRows(mounted, 'src/app.js').at(-1)
  assert.ok(unstaged, 'the unstaged file row is missing')
  mounted.harness.click(buttonInside(unstaged, 'actions.stage'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'stage').length, 1)
  const busyRow = fileRows(mounted, 'src/app.js').at(-1)
  assert.ok(busyRow, 'the unstaged file row is missing while the operation runs')
  assert.equal(
    buttonInside(busyRow, 'actions.stage').props.disabled,
    true,
    'the running operation disables the row actions',
  )
  await openViewMenu(mounted)
  for (const item of viewItems(mounted))
    assert.equal(item.props.disabled ?? false, false, 'a view command never waits for Git')
  mounted.harness.click(viewItems(mounted)[1])
  await mounted.harness.flush()
  assert.deepEqual(
    folderRows(mounted).map((row) => elementText(row)),
    ['src', 'src'],
    'the tree view applies to every group while the operation runs',
  )
  release()
  await mounted.harness.flush()
  await mounted.harness.dispose()
})

test('the tree view groups every change group into folders', async () => {
  const mounted = await mountGit()
  await chooseView(mounted, 'menu.viewTree')
  const folders = folderRows(mounted)
  assert.deepEqual(
    folders.map((row) => elementText(row)),
    ['src', 'src'],
    'the staged and the unstaged group each draw their own src folder',
  )
  assert.equal(fileRows(mounted).length, 4, 'every changed file keeps one row in the tree')
  assert.equal(
    fileRows(mounted, 'src/app.js').length,
    2,
    'a partially staged file stays in both groups',
  )
  for (const folder of folders) {
    assert.equal(folder.props.role, 'button', 'a change-group folder is a disclosure control')
    assert.equal(folder.props.tabIndex, 0, 'a folder row takes keyboard focus')
    assert.equal(folder.props['aria-expanded'], true, 'folders start expanded')
    assert.equal(
      folder.props.style?.paddingLeft,
      '20px',
      'a root folder takes only the group nesting inset',
    )
  }
  for (const row of fileRows(mounted, 'src/app.js')) {
    assert.equal(
      row.props.style?.paddingLeft,
      '34px',
      'a file below a folder is one indentation step deeper',
    )
    assert.ok(!elementText(row).includes('src'), 'the folder row carries the directory in the tree')
    const [status] = collectElements(row, (element) => hasClass(element, 'dshgg-status'))
    assert.ok(status, 'a tree file row keeps its status letter')
    assert.equal(elementText(status), status.props['data-status'])
  }
  for (const row of [...fileRows(mounted, 'README.md'), ...fileRows(mounted, 'merge.txt')]) {
    assert.equal(row.props.style?.paddingLeft, '20px', 'a root-level file stays at folder depth')
  }
  await mounted.harness.dispose()
})

test('a folder row hides only its own group and the tree state survives the list', async () => {
  const mounted = await mountGit()
  await chooseView(mounted, 'menu.viewTree')
  const stagedFolder = folderRows(mounted)[0]
  assert.ok(stagedFolder, 'the staged group renders no folder row')
  mounted.harness.click(stagedFolder)
  await mounted.harness.flush()
  const collapsed = folderRows(mounted)
  assert.equal(collapsed[0]?.props['aria-expanded'], false, 'the clicked folder collapses')
  assert.equal(collapsed[1]?.props['aria-expanded'], true, 'the other group keeps its folder open')
  assert.equal(fileRows(mounted, 'src/app.js').length, 1, 'only the staged subtree is hidden')
  mounted.harness.keydown(collapsed[0], { key: 'Enter' })
  await mounted.harness.flush()
  assert.equal(
    folderRows(mounted)[0]?.props['aria-expanded'],
    true,
    'Enter expands the folder again',
  )
  mounted.harness.click(folderRows(mounted)[0])
  await mounted.harness.flush()
  await chooseView(mounted, 'menu.viewList')
  assert.equal(folderRows(mounted).length, 0, 'the flat list renders no folder row')
  assert.equal(fileRows(mounted).length, 4, 'the flat list keeps one row per file')
  const [flatApp] = fileRows(mounted, 'src/app.js')
  assert.ok(flatApp, 'the flat list lost the staged file row')
  assert.ok(elementText(flatApp).includes('src'), 'the flat list shows the directory again')
  await chooseView(mounted, 'menu.viewTree')
  const restored = folderRows(mounted)
  assert.equal(restored[0]?.props['aria-expanded'], false, 'the collapsed folder stays collapsed')
  assert.equal(restored[1]?.props['aria-expanded'], true)
  assert.equal(fileRows(mounted, 'src/app.js').length, 1)
  await mounted.harness.dispose()
})

test('the chosen view and folder states survive a status refresh', async () => {
  const refreshed = createStatus({
    files: [
      ...STATUS.files,
      {
        kind: 'ordinary',
        x: '.',
        y: 'M',
        path: 'docs/notes.md',
        conflict: false,
        untracked: false,
      },
    ],
  })
  const mounted = await mountGit({ statusPages: [STATUS, refreshed] })
  await chooseView(mounted, 'menu.viewTree')
  mounted.harness.click(folderRows(mounted)[0])
  await mounted.harness.flush()
  const statusCalls = mounted.calls.filter((call) => call.op === 'status').length
  mounted.harness.click(buttonByLabel(mounted.harness, 'refresh'))
  await mounted.harness.flush()
  assert.ok(
    mounted.calls.filter((call) => call.op === 'status').length > statusCalls,
    'the refresh reads the status again',
  )
  const folders = folderRows(mounted)
  assert.deepEqual(
    folders.map((row) => elementText(row)),
    ['src', 'docs', 'src'],
    'the refreshed tree lists the new folder without leaving the tree view',
  )
  assert.equal(folders[0]?.props['aria-expanded'], false, 'the collapsed folder stays collapsed')
  assert.equal(folders[1]?.props['aria-expanded'], true)
  assert.equal(folders[2]?.props['aria-expanded'], true)
  assert.equal(fileRows(mounted, 'docs/notes.md').length, 1, 'the refreshed file is listed')
  assert.equal(fileRows(mounted, 'src/app.js').length, 1, 'the collapsed subtree stays hidden')
  await mounted.harness.dispose()
})

test('the chosen view survives a commit card opening and closing', async () => {
  const mounted = await mountGit()
  await chooseView(mounted, 'menu.viewTree')
  await openCommitDetails(mounted)
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await finishMotion(mounted.harness)
  assert.deepEqual(
    folderRows(mounted).map((row) => elementText(row)),
    ['src', 'src'],
    'the change lists are still trees after returning from the details card',
  )
  const workspaceToggle = (): TestElement => {
    const [toggle] = collectElements(workspaceHeader(mounted), (element) =>
      hasClass(element, 'dshgg-sectionToggle'),
    )
    assert.ok(toggle, 'the Workspace header has no collapse toggle')
    return toggle
  }
  mounted.harness.click(workspaceToggle())
  await finishMotion(mounted.harness)
  assert.equal(workspaceToggle().props['aria-expanded'], false, 'the Workspace section collapses')
  assert.equal(folderRows(mounted).length, 0, 'a collapsed Workspace hides its rows')
  mounted.harness.click(workspaceToggle())
  await finishMotion(mounted.harness)
  assert.deepEqual(
    folderRows(mounted).map((row) => elementText(row)),
    ['src', 'src'],
    'the tree view survives collapsing and expanding the Workspace section',
  )
  await mounted.harness.dispose()
})

test('switching views runs no Git and opens no diff', async () => {
  const mounted = await mountGit()
  const callsBefore = mounted.calls.length
  await chooseView(mounted, 'menu.viewTree')
  await chooseView(mounted, 'menu.viewList')
  assert.equal(mounted.calls.length, callsBefore, 'switching views requests nothing')
  assert.deepEqual(mounted.openedTabs, [], 'switching views opens no diff tab')
  await mounted.harness.dispose()
})

test('a clean workspace still offers both views', async () => {
  const mounted = await mountGit({ status: createStatus({ files: [] }) })
  const callsBefore = mounted.calls.length
  await chooseView(mounted, 'menu.viewTree')
  assert.equal(folderRows(mounted).length, 0)
  assert.equal(fileRows(mounted).length, 0)
  assert.match(elementText(workspaceHeader(mounted)), /sections\.workspace/)
  assert.match(mounted.harness.text(), /clean\.title/)
  assert.equal(
    mounted.calls.length,
    callsBefore,
    'choosing a view in a clean workspace runs no Git',
  )
  await openViewMenu(mounted)
  assert.deepEqual(viewLabels(mounted), ['menu.viewList', 'menu.viewTree'])
  assert.deepEqual(markedItems(mounted), [1], 'a clean workspace keeps the view it chose')
  await mounted.harness.dispose()
})
