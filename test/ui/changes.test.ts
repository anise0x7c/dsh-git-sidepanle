/**
 * Change list rows: grouping, file-type icons and status letters.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { ChangeEntry } from '../../src/shared/git.ts'
import { createStatus } from '../support/fixtures.ts'
import type { TestElement } from '../support/types.ts'
import {
  buttonInside,
  collectElements,
  commitCard,
  disposeUiLifetimes,
  elementText,
  hasClass,
  isElement,
  loadUiPanel,
  mountGit,
  openCommitDetails,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

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
    assert.equal(row.props.style, undefined, 'a flat row needs no indentation')
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
