/**
 * Watched-repository updates and status refresh ordering.
 *
 * Mounts the built bundle over the shared mini React harness and asserts
 * what the Host receives; see `support/ui-panel.ts` for the fixture.
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { HistoryResult, WatchState } from '../../src/shared/git.ts'
import { createStatus, STATUS } from '../support/fixtures.ts'
import {
  badgesIn,
  buttonByLabel,
  commitBox,
  deferred,
  disposeUiLifetimes,
  hasClass,
  holdSlowStatusPoll,
  loadUiPanel,
  mountGit,
  opCount,
} from '../support/ui-panel.ts'

afterEach(disposeUiLifetimes)

await loadUiPanel()

test('an external working-tree change refreshes the status without reloading the graph', async () => {
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({ watchState: () => counters })
  assert.equal(opCount(mounted, 'status'), 1)
  assert.equal(opCount(mounted, 'history'), 1)

  mounted.harness.runIntervals()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 1, 'an unchanged counter does not refresh')

  counters = { watching: true, worktree: 1, references: 0 }
  mounted.harness.runIntervals()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2, 'the working-tree counter refreshes the status')
  assert.equal(opCount(mounted, 'history'), 1, 'the loaded graph is not reloaded')
  assert.equal(opCount(mounted, 'references'), 0, 'a working-tree change is not a reference change')
  assert.match(mounted.harness.text(), /Fix the sidebar/, 'the loaded commits stay visible')
  await mounted.harness.dispose()
})

test('an external branch switch recolors and re-badges loaded rows in place', async () => {
  const history: HistoryResult = {
    commits: [
      {
        oid: 'a'.repeat(40),
        shortOid: 'aaaaaaa',
        author: 'Ann',
        authoredAt: 1_700_000_000,
        refs: 'HEAD -> refs/heads/main',
        parents: ['b'.repeat(40)],
        subject: 'Old tip',
      },
      {
        oid: 'b'.repeat(40),
        shortOid: 'bbbbbbb',
        author: 'Bob',
        authoredAt: 1_699_999_000,
        refs: 'refs/heads/feature',
        parents: [],
        subject: 'Feature tip',
      },
    ],
    hasMore: false,
    references: {
      current: { id: 'refs/heads/main', name: 'main', revision: 'a'.repeat(40) },
      remote: null,
      base: null,
    },
  }
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    history,
    watchState: () => counters,
    referencePages: [
      {
        current: { id: 'refs/heads/feature', name: 'feature', revision: 'b'.repeat(40) },
        remote: null,
        base: null,
      },
    ],
  })
  const rowsBefore = mounted.harness.findAll((element) => hasClass(element, 'dshgg-graphRow'))
  assert.equal(rowsBefore[0]?.props['data-current'], 'true')
  assert.deepEqual(
    badgesIn(rowsBefore[0]).map((badge) => badge.props['data-icon']),
    ['target'],
    'the checked-out branch starts on the old tip',
  )

  counters = { watching: true, worktree: 0, references: 1 }
  mounted.harness.runIntervals()
  await mounted.harness.flush()

  assert.equal(opCount(mounted, 'references'), 1)
  assert.equal(opCount(mounted, 'history'), 1, 'the loaded pages are kept')
  assert.equal(opCount(mounted, 'status'), 2, 'the branch header follows the switch')
  const rowsAfter = mounted.harness.findAll((element) => hasClass(element, 'dshgg-graphRow'))
  assert.equal(rowsAfter[0]?.props['data-current'], undefined)
  assert.equal(rowsAfter[1]?.props['data-current'], 'true')
  assert.deepEqual(
    badgesIn(rowsAfter[0]).map((badge) => badge.props['data-icon']),
    ['branch'],
    'the old tip keeps main as an ordinary branch badge',
  )
  const feature = badgesIn(rowsAfter[1])
  assert.equal(feature.length, 1)
  assert.equal(feature[0]?.props['data-icon'], 'target')
  assert.equal(feature[0]?.props['data-color'], 'ref')
  await mounted.harness.dispose()
})

test('a reference move outside the loaded rows reloads the newest graph page', async () => {
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    watchState: () => counters,
    referencePages: [
      {
        current: { id: 'refs/heads/main', name: 'main', revision: 'c'.repeat(40) },
        remote: null,
        base: null,
      },
    ],
  })
  counters = { watching: true, worktree: 0, references: 1 }
  mounted.harness.runIntervals()
  await mounted.harness.flush()

  assert.equal(opCount(mounted, 'references'), 1)
  assert.equal(opCount(mounted, 'status'), 2)
  assert.equal(opCount(mounted, 'history'), 2, 'the newest page is reloaded for the new tip')
  await mounted.harness.dispose()
})

test('a Host that cannot watch leaves the periodic status check in charge', async () => {
  const mounted = await mountGit({
    watchState: () => ({ watching: false, worktree: 0, references: 0 }),
  })
  assert.equal(opCount(mounted, 'status'), 1)
  mounted.harness.runIntervals()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2, 'the fallback poll keeps the panel current')
  assert.equal(opCount(mounted, 'references'), 0)
  assert.doesNotMatch(mounted.harness.text(), /error\.title/)
  await mounted.harness.dispose()
  assert.ok(
    mounted.calls.some((call) => call.op === 'unwatch'),
    'unmounting releases the subscription',
  )
})

test('a slow poll cannot overwrite the status refreshed after a write', async (t) => {
  const gate = deferred()
  const stale = createStatus({
    files: [
      {
        kind: 'untracked',
        x: '?',
        y: '?',
        path: 'poll-stale.txt',
        conflict: false,
        untracked: true,
      },
    ],
  })
  const fresh = createStatus({
    files: [
      { kind: 'ordinary', x: 'M', y: ' ', path: 'src/fresh.js', conflict: false, untracked: false },
    ],
  })
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    watchState: () => counters,
    statusPages: [STATUS, stale, fresh],
    statusGates: [undefined, gate.promise],
  })
  t.after(() => mounted.harness.dispose())
  await holdSlowStatusPoll(mounted, () => {
    counters = { watching: true, worktree: 1, references: 0 }
  })

  mounted.harness.click(buttonByLabel(mounted.harness, 'actions.stageAll'))
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'stage'), 1)
  assert.equal(
    opCount(mounted, 'status'),
    2,
    'the write does not start a second status RPC while one is in flight',
  )
  assert.equal(
    commitBox(mounted.harness)?.props.disabled,
    true,
    'the panel stays busy until the post-write read has answered',
  )

  gate.release()
  await mounted.harness.flush()
  assert.equal(
    opCount(mounted, 'status'),
    3,
    'exactly one follow-up read drains the queued refresh',
  )
  assert.match(mounted.harness.text(), /fresh\.js/, 'the post-write snapshot wins')
  assert.doesNotMatch(
    mounted.harness.text(),
    /poll-stale\.txt/,
    'the slow poll snapshot never becomes the final state',
  )
  assert.equal(commitBox(mounted.harness)?.props.disabled, false, 'busy clears after the follow-up')
})

test('repeated explicit refreshes during one read coalesce into one follow-up', async (t) => {
  const gate = deferred()
  const stale = createStatus({
    files: [
      {
        kind: 'untracked',
        x: '?',
        y: '?',
        path: 'poll-stale.txt',
        conflict: false,
        untracked: true,
      },
    ],
  })
  const fresh = createStatus({
    files: [
      {
        kind: 'ordinary',
        x: 'M',
        y: ' ',
        path: 'src/coalesced.js',
        conflict: false,
        untracked: false,
      },
    ],
  })
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    watchState: () => counters,
    statusPages: [STATUS, stale, fresh],
    statusGates: [undefined, gate.promise],
  })
  t.after(() => mounted.harness.dispose())
  await holdSlowStatusPoll(mounted, () => {
    counters = { watching: true, worktree: 1, references: 0 }
  })

  const refresh = buttonByLabel(mounted.harness, 'refresh')
  mounted.harness.click(refresh)
  mounted.harness.click(refresh)
  mounted.harness.click(refresh)
  await mounted.harness.flush()
  assert.equal(
    opCount(mounted, 'status'),
    2,
    'queued refreshes never start a concurrent status read',
  )

  gate.release()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 3, 'three requests fold into one follow-up read')
  assert.match(mounted.harness.text(), /coalesced\.js/)
  assert.doesNotMatch(mounted.harness.text(), /poll-stale\.txt/)
})

test('a failed status read still drains the queued retry', async (t) => {
  const gate = deferred()
  const fresh = createStatus({
    files: [
      {
        kind: 'untracked',
        x: '?',
        y: '?',
        path: 'src/retried.js',
        conflict: false,
        untracked: true,
      },
    ],
  })
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    watchState: () => counters,
    statusPages: [STATUS, STATUS, fresh],
    failStatusPages: [1],
    statusGates: [undefined, gate.promise],
  })
  t.after(() => mounted.harness.dispose())
  await holdSlowStatusPoll(mounted, () => {
    counters = { watching: true, worktree: 1, references: 0 }
  })

  mounted.harness.click(buttonByLabel(mounted.harness, 'refresh'))
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2)

  gate.release()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 3, 'the queued retry runs after the failure')
  assert.match(mounted.harness.text(), /retried\.js/, 'the retry answer is applied')
  assert.doesNotMatch(
    mounted.harness.text(),
    /error\.title/,
    'the successful retry clears the failed state',
  )
})

test('an unmounting panel does not run a queued status read', async (t) => {
  const gate = deferred()
  let counters: WatchState = { watching: true, worktree: 0, references: 0 }
  const mounted = await mountGit({
    watchState: () => counters,
    statusPages: [STATUS, STATUS, STATUS],
    statusGates: [undefined, gate.promise],
  })
  t.after(() => mounted.harness.dispose())
  await holdSlowStatusPoll(mounted, () => {
    counters = { watching: true, worktree: 1, references: 0 }
  })

  mounted.harness.click(buttonByLabel(mounted.harness, 'refresh'))
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2, 'the refresh is queued behind the read')

  await mounted.harness.dispose()
  gate.release()
  await mounted.harness.flush()
  assert.equal(opCount(mounted, 'status'), 2, 'unmounting drops the queued read')
})
