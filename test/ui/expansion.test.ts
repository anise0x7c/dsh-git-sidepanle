/**
 * Inline commit expansion and its file rows.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { COMMIT_DETAILS } from '../support/fixtures.ts'
import type { TestElement } from '../support/types.ts'
import {
  buttonByLabel,
  buttonByText,
  changeRows,
  collectElements,
  commitCard,
  disposeUiLifetimes,
  elementText,
  finishMotion,
  graphRows,
  hasClass,
  lastTarget,
  loadUiPanel,
  type MountedGit,
  menuActionId,
  menuActions,
  mountGit,
  openCommitDetails,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

test('clicking a commit expands its files inline and a file opens the commit diff', async () => {
  const mounted = await mountGit()
  const graphRow = graphRows(mounted.harness)[0]
  assert.ok(graphRow, 'no graph row rendered')
  assert.equal(graphRow.props['aria-expanded'], false)
  mounted.harness.click(graphRow)
  await mounted.harness.flush()

  assert.equal(mounted.calls.find((call) => call.op === 'commit-details')?.oid, 'a'.repeat(40))
  const text = mounted.harness.text()
  assert.doesNotMatch(text, /commitDetails\.files/, 'the details view does not open')
  assert.ok(
    mounted.harness.findAll((element) => element.props.role === 'separator').length > 0,
    'the split stays in place',
  )
  assert.equal(mounted.harness.findAll((element) => element.type === 'textarea').length, 1)
  assert.equal(graphRows(mounted.harness)[0]?.props['aria-expanded'], true)
  const rows = changeRows(mounted.harness)
  for (const row of rows) {
    assert.ok(hasClass(row, 'dshgg-row'), 'an expanded file row uses the shared row style')
  }
  assert.deepEqual(
    rows.map((row) => row.props.title),
    ['docs/gone.md', 'src/added.js', 'src/app.js', 'src/old.js → src/renamed.js'],
    'the changed files follow the commit row in path order',
  )
  const app = rows[2]
  assert.ok(app)
  assert.match(elementText(app), /app\.js/)
  assert.match(elementText(app), /src/)
  assert.match(elementText(app), /M/)
  assert.equal(
    collectElements(app, (element) =>
      String(element.props?.className ?? '').includes('dshgg-rowIcon'),
    ).length,
    1,
    'every file row carries its file icon',
  )
  const statuses = collectElements(app, (element) =>
    String(element.props?.className ?? '').includes('dshgg-status'),
  )
  assert.equal(statuses[0]?.props['data-status'], 'M')

  // Rows render in document order: the first commit, its files, then the next commit.
  const order = mounted.harness
    .findAll((element) => {
      const name = String(element.props?.className ?? '')
      return name
        .split(' ')
        .some((token) => ['dshgg-graphRow', 'dshgg-graphChange'].includes(token))
    })
    .map((element) =>
      String(element.props.className).includes('dshgg-graphRow') ? 'commit' : 'file',
    )
  assert.deepEqual(order, ['commit', 'file', 'file', 'file', 'file', 'commit'])

  mounted.harness.click(app)
  const opened = mounted.openedTabs.at(-1)
  assert.ok(opened)
  assert.equal(opened.kind, 'git-diff')
  assert.equal(opened.options.params.path, 'src/app.js')
  assert.equal(opened.options.params.commit, 'a'.repeat(40))
  assert.equal(opened.options.params.shortOid, 'aaaaaaa')
  assert.equal(opened.options.params.status, 'M')

  const renamed = changeRows(mounted.harness)[3]
  assert.ok(renamed)
  mounted.harness.keydown(renamed, { key: 'Enter' })
  assert.equal(mounted.openedTabs.at(-1)?.options.params.origPath, 'src/old.js')

  mounted.harness.click(graphRows(mounted.harness)[0])
  await mounted.harness.flush()
  assert.equal(changeRows(mounted.harness).length, 0, 'activating again collapses the list')
  assert.equal(graphRows(mounted.harness)[0]?.props['aria-expanded'], false)
  assert.equal(
    mounted.calls.filter((call) => call.op === 'commit-details').length,
    1,
    'collapsing reads nothing',
  )
  await mounted.harness.dispose()
})

test('the expanded file rows draw the host file-type icon for their path', async () => {
  const requested: Array<{ path: string; size: number }> = []
  const mounted = await mountGit({
    hostModules: {
      '@deepseek-ai/dsh-client-ui-primitives': {
        FileTypeIcon: (props: { path: string; size: number }) => {
          requested.push({ path: props.path, size: props.size })
          return { type: 'svg', props: { 'data-file-type': props.path }, children: [] }
        },
      },
    },
  })
  mounted.harness.click(graphRows(mounted.harness)[0])
  await mounted.harness.flush()
  const icons = collectElements(
    changeRows(mounted.harness),
    (element) => element.props['data-file-type'] !== undefined,
  )
  assert.deepEqual(
    icons.map((element) => element.props['data-file-type']),
    ['docs/gone.md', 'src/added.js', 'src/app.js', 'src/renamed.js'],
    'each expanded row passes the changed file path to the host icon',
  )
  assert.ok(
    requested.length >= icons.length && requested.every((props) => props.size === 16),
    'the host icon keeps the row 16-pixel slot',
  )
  await mounted.harness.dispose()
})

test('the file rows keep the plain icon without a usable host icon', async () => {
  const plain = (mounted: MountedGit): TestElement[] =>
    collectElements(changeRows(mounted.harness), (element) =>
      String(element.props?.className ?? '').includes('dshgg-rowIcon'),
    ).flatMap((icon) =>
      collectElements(
        icon,
        (element) => element.type === 'svg' && element.props.viewBox === '0 0 16 16',
      ),
    )
  const cases: Array<Record<string, unknown> | undefined> = [
    undefined,
    { '@deepseek-ai/dsh-client-ui-primitives': { FileTypeIcon: 'nope' } },
  ]
  for (const hostModules of cases) {
    const mounted = hostModules === undefined ? await mountGit() : await mountGit({ hostModules })
    mounted.harness.click(graphRows(mounted.harness)[0])
    await mounted.harness.flush()
    assert.equal(changeRows(mounted.harness).length, 4)
    assert.equal(plain(mounted).length, 4, 'every row falls back to the document icon')
    assert.equal(
      mounted.harness.findAll((element) => element.props['data-file-type'] !== undefined).length,
      0,
      'no host icon is drawn',
    )
    await mounted.harness.dispose()
  }
})

test('the line layer runs the expanded commit lanes through its file rows', async () => {
  const mounted = await mountGit()
  const layer = (): TestElement => {
    const [element] = mounted.harness.findAll(
      (candidate) => candidate.props?.className === 'dshgg-graphLayer',
    )
    assert.ok(element, 'no line layer rendered')
    return element
  }
  assert.equal(layer().props.height, 44)
  mounted.harness.click(graphRows(mounted.harness)[0])
  await mounted.harness.flush()
  assert.equal(layer().props.height, 44 + 4 * 22, 'every file row adds one row height')
  const wide = collectElements(layer(), (element) => element.props?.['data-width'] === '3')
  assert.equal(wide.length, 1, 'the node lane is wide in its own row and through the file rows')
  assert.match(String(wide[0]?.props.d), /^M 11 11 V 22 M 11 22 V 44 M 11 44 V 66/)
  const lanes = collectElements(changeRows(mounted.harness)[0] as TestElement, (element) =>
    String(element.props?.className ?? '').includes('dshgg-graphChangeLanes'),
  )
  assert.equal(lanes[0]?.props.style?.width, '22px', 'one lane leaves the commit')
  await mounted.harness.dispose()
})

test('several commits stay expanded and the keyboard toggles a row', async () => {
  const mounted = await mountGit()
  const [first] = graphRows(mounted.harness)
  assert.ok(first)
  mounted.harness.keydown(first, { key: 'Enter' })
  await mounted.harness.flush()
  assert.equal(changeRows(mounted.harness).length, 4)
  const second = graphRows(mounted.harness)[1]
  assert.ok(second)
  mounted.harness.keydown(second, { key: ' ' })
  await mounted.harness.flush()
  assert.equal(changeRows(mounted.harness).length, 8, 'both commits list their files')
  assert.deepEqual(
    mounted.calls.filter((call) => call.op === 'commit-details').map((call) => call.oid),
    ['a'.repeat(40), 'b'.repeat(40)],
  )
  mounted.harness.keydown(graphRows(mounted.harness)[0] as TestElement, { key: 'Enter' })
  await mounted.harness.flush()
  assert.equal(changeRows(mounted.harness).length, 4, 'only the toggled commit collapses')
  assert.doesNotMatch(mounted.harness.text(), /commitDetails\.files/)
  await mounted.harness.dispose()
})

test('a commit without file changes says so in its expanded row and its details', async () => {
  const commitDetails = {
    commit: COMMIT_DETAILS.commit,
    files: [],
    truncated: false,
  }
  const mounted = await mountGit({ commitDetails })
  mounted.harness.click(graphRows(mounted.harness)[0] as TestElement)
  await mounted.harness.flush()
  const rows = changeRows(mounted.harness)
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.props['data-note'], 'empty')
  assert.match(elementText(rows[0] as TestElement), /commitDetails\.empty/)

  await openCommitDetails(mounted)
  assert.match(elementText(commitCard(mounted.harness)), /commitDetails\.empty/)
  assert.equal(
    collectElements(commitCard(mounted.harness), (element) => hasClass(element, 'dshgg-fileRow'))
      .length,
    0,
  )
  await mounted.harness.dispose()
})

test('a capped commit list ends with a note row', async () => {
  const mounted = await mountGit({ commitDetails: { ...COMMIT_DETAILS, truncated: true } })
  mounted.harness.click(graphRows(mounted.harness)[0] as TestElement)
  await mounted.harness.flush()
  const rows = changeRows(mounted.harness)
  assert.equal(rows.length, 5)
  assert.equal(rows.at(-1)?.props['data-note'], 'truncated')
  await mounted.harness.dispose()
})

test('a failed expanded read reports the failure and retries in place', async () => {
  const mounted = await mountGit({ failOp: 'commit-details' })
  mounted.harness.click(graphRows(mounted.harness)[0] as TestElement)
  await mounted.harness.flush()
  const rows = changeRows(mounted.harness)
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.props['data-note'], 'failure')
  assert.match(elementText(rows[0] as TestElement), /git said no/)
  mounted.harness.click(buttonByText(mounted.harness, 'retry'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'commit-details').length, 2)
  assert.doesNotMatch(mounted.harness.text(), /commitDetails\.files/)
  await mounted.harness.dispose()
})

test('a failed commit read reports the failure and retries', async () => {
  const mounted = await mountGit({ failOp: 'commit-details' })
  await openCommitDetails(mounted)
  assert.match(mounted.harness.text(), /error\.title/)
  assert.ok(
    mounted.components.notifications.some(
      (notification) => !notification.success && notification.text === 'git said no',
    ),
    'the failure is reported as a non-success notification',
  )
  const before = mounted.calls.filter((call) => call.op === 'commit-details').length
  mounted.harness.click(buttonByText(mounted.harness, 'retry'))
  await mounted.harness.flush()
  assert.equal(mounted.calls.filter((call) => call.op === 'commit-details').length, before + 1)
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await finishMotion(mounted.harness)
  assert.match(mounted.harness.text(), /sections\.changes/)
  await mounted.harness.dispose()
})

test('returning from details keeps the expanded commits', async () => {
  const mounted = await mountGit()
  mounted.harness.click(graphRows(mounted.harness)[0] as TestElement)
  await mounted.harness.flush()
  assert.equal(changeRows(mounted.harness).length, 4)
  await openCommitDetails(mounted, 1)
  assert.equal(mounted.calls.at(-1)?.oid, 'b'.repeat(40))
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await finishMotion(mounted.harness)
  assert.equal(changeRows(mounted.harness).length, 4)
  assert.equal(graphRows(mounted.harness)[0]?.props['aria-expanded'], true)
  await mounted.harness.dispose()
})

test('past-commit files offer copy-only context menus', async () => {
  const mounted = await mountGit()
  await openCommitDetails(mounted)
  const fileRows = collectElements(
    commitCard(mounted.harness),
    (element) => hasClass(element, 'dshgg-fileRow') && element.props?.title === 'src/app.js',
  )
  assert.equal(fileRows.length, 1)
  mounted.harness.contextmenu(fileRows[0], { clientX: 7, clientY: 8 })
  const open = mounted.menu.opens.at(-1)
  assert.ok(open, 'no past-commit menu target was bound')
  const target = open.target
  assert.equal(target.value.kind, 'commitFile')
  assert.equal(target.value.path, 'src/app.js')
  assert.equal(target.value.cwd, '/repo')
  assert.deepEqual(
    menuActions(mounted.components, target).map((action) => action.id),
    [menuActionId('copy-relative'), menuActionId('copy-path')],
  )
  mounted.harness.click(buttonByLabel(mounted.harness, 'commitDetails.back'))
  await finishMotion(mounted.harness)

  mounted.harness.click(graphRows(mounted.harness)[0] as TestElement)
  await mounted.harness.flush()
  const inline = changeRows(mounted.harness).find((row) => row.props.title === 'src/app.js')
  assert.ok(inline)
  assert.equal(inline.props['aria-haspopup'], 'menu')
  const before = mounted.calls.length
  mounted.harness.contextmenu(inline, { clientX: 3, clientY: 4 })
  const inlineTarget = lastTarget(mounted.menu)
  assert.equal(inlineTarget.value.kind, 'commitFile')
  assert.equal(inlineTarget.value.path, 'src/app.js')
  assert.equal(inlineTarget.value.cwd, '/repo')
  assert.deepEqual(
    menuActions(mounted.components, inlineTarget).map((action) => action.id),
    [menuActionId('copy-relative'), menuActionId('copy-path')],
  )
  assert.equal(mounted.calls.length, before, 'opening the menu calls nothing')
  await mounted.harness.dispose()
})
