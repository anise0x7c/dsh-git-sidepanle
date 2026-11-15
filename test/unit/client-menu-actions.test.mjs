/**
 * Direct unit tests for the browser half's pure context-menu action resolver.
 *
 * These import `src/client/menu/actions.js` directly — no React, no plugin
 * context, no built `client.js`. `resolveMenuActions` receives the captured
 * target's VALUE, exactly as the shared host registry hands it to a
 * contribution; never the `{ kind, value }` wrapper a trigger received (the
 * 7cac4e6 defect). Published command ids are `<contributionId>/<actionId>`.
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { MENU_CONTRIBUTION_ID } from '../../src/client/constants.js'
import { menuAction, resolveMenuActions } from '../../src/client/menu/actions.js'
import { panelCommands } from '../../src/client/menu/bus.js'
import { menuTarget } from '../../src/client/menu/trigger.js'

const SESSION = 'session-1'
const PANEL = 'git-panel-7'
/** Locale binder stand-in; the marker proves labels are routed through `t`. */
const t = (key) => `T(${key})`
/** Toast recorder stand-in for copy commands. */
const notify = () => {}

/**
 * A captured file row value with overridable fields.
 * @param {object} [overrides] - fields to replace.
 * @returns {object} captured target value.
 */
function fileValue(overrides = {}) {
  return { sessionId: SESSION, panelId: PANEL, kind: 'file', section: 'changes', path: 'src/app.js', cwd: '/repo', ...overrides }
}

/**
 * Published ids of resolved actions (`<contributionId>/<actionId>`).
 * @param {object[]} actions - resolved actions.
 * @returns {string[]} published command ids.
 */
function publishedIds(actions) {
  return actions.map((action) => `${MENU_CONTRIBUTION_ID}/${action.id}`)
}

/**
 * Resolve actions for a captured value.
 * @param {object} value - captured target value.
 * @returns {object[]} resolved actions.
 */
function actionsFor(value) {
  return resolveMenuActions(value, t, notify)
}

/**
 * Labels of resolved actions.
 * @param {object[]} actions - resolved actions.
 * @returns {string[]} labels.
 */
function labelsOf(actions) {
  return actions.map((action) => action.label)
}

/**
 * Find one resolved action by its contribution-relative id.
 * @param {object[]} actions - resolved actions.
 * @param {string} id - action id.
 * @returns {object} action.
 */
function actionById(actions, id) {
  const action = actions.find((candidate) => candidate.id === id)
  assert.ok(action, `no action "${id}" in ${JSON.stringify(publishedIds(actions))}`)
  return action
}

/**
 * Run a callback while subscribing to the shared command bus.
 * @param {() => void} run - emits commands through action callbacks.
 * @returns {object[]} emitted commands.
 */
function captureCommands(run) {
  const emitted = []
  const unsubscribe = panelCommands.subscribe((command) => emitted.push(command))
  try {
    run()
  } finally {
    unsubscribe()
  }
  return emitted
}

/**
 * Run one copy action with a stubbed clipboard.
 * @param {() => Promise<void>} writeText - clipboard writer.
 * @param {object} value - captured target value.
 * @param {string} id - action id to run.
 * @returns {Promise<object[]>} recorded toast calls.
 */
async function runCopy(writeText, value, id) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  try {
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText } }, configurable: true })
    const notes = []
    const actions = resolveMenuActions(value, t, (text, success) => notes.push({ text, success }))
    await actionById(actions, id).run()
    return notes
  } finally {
    if (previous === undefined) delete globalThis.navigator
    else Object.defineProperty(globalThis, 'navigator', previous)
  }
}

describe('menuAction', () => {
  test('builds the action shape and merges presentation extras', () => {
    const run = () => {}
    assert.deepEqual(menuAction('open', 'Open', run), { id: 'open', label: 'Open', run })
    assert.deepEqual(menuAction('discard', 'Discard', run, { danger: true, disabled: true }), {
      id: 'discard',
      label: 'Discard',
      run,
      danger: true,
      disabled: true,
    })
  })
})

describe('resolveMenuActions guards', () => {
  test('resolves nothing without a captured object value', () => {
    for (const value of [null, undefined, 'file', 42, true]) {
      assert.deepEqual(resolveMenuActions(value, t, notify), [], `value ${String(value)}`)
    }
  })

  test('resolves nothing without a session id, for every target kind', () => {
    const kinds = ['file', 'folder', 'section', 'commit', 'diff']
    for (const kind of kinds) {
      const complete = { kind, section: 'changes', path: 'src/a.js', paths: ['src/a.js'], oid: 'a'.repeat(40), subject: 'Fix it' }
      assert.deepEqual(resolveMenuActions({ ...complete }, t, notify), [], `${kind} without a session`)
      assert.deepEqual(resolveMenuActions({ ...complete, sessionId: '' }, t, notify), [], `${kind} with an empty session`)
      assert.deepEqual(resolveMenuActions({ ...complete, sessionId: 42 }, t, notify), [], `${kind} with a non-string session`)
    }
  })

  test('resolves nothing for an unknown target kind', () => {
    assert.deepEqual(resolveMenuActions({ sessionId: SESSION, kind: 'unknown' }, t, notify), [])
  })

  test('every listed object resolves at least one command (7cac4e6 regression)', () => {
    const listed = [
      ['changed file', fileValue()],
      ['staged file', fileValue({ section: 'staged' })],
      ['untracked file', fileValue({ path: 'README.md', untracked: true })],
      ['conflicted file', fileValue({ section: 'merge', path: 'merge.txt', conflict: true })],
      ['folder', { sessionId: SESSION, kind: 'folder', section: 'changes', path: 'src', paths: ['src/a.js'] }],
      ['changes group', { sessionId: SESSION, kind: 'section', section: 'changes' }],
      ['staged group', { sessionId: SESSION, kind: 'section', section: 'staged' }],
      ['merge group', { sessionId: SESSION, kind: 'section', section: 'merge' }],
      ['graph group', { sessionId: SESSION, kind: 'section', section: 'graph' }],
      ['commit', { sessionId: SESSION, kind: 'commit', oid: 'a'.repeat(40), shortOid: 'aaaaaaa', subject: 'Fix it' }],
      ['diff', { sessionId: SESSION, kind: 'diff', path: 'src/app.js' }],
    ]
    for (const [label, value] of listed) {
      assert.ok(actionsFor(value).length > 0, `${label} resolved an empty menu`)
    }
  })

  test('the captured wrapper is not accepted in place of its value (7cac4e6)', () => {
    const wrapper = menuTarget(SESSION, 'file', { panelId: PANEL, section: 'changes', path: 'src/app.js', cwd: '/repo' })
    // The registry calls `resolve(target.value, signal)`; passing the wrapper
    // itself has no session id and must not resolve anything.
    assert.deepEqual(resolveMenuActions(wrapper, t, notify), [])
    assert.deepEqual(publishedIds(resolveMenuActions(wrapper.value, t, notify)), [
      `${MENU_CONTRIBUTION_ID}/open`,
      `${MENU_CONTRIBUTION_ID}/stage`,
      `${MENU_CONTRIBUTION_ID}/discard`,
      `${MENU_CONTRIBUTION_ID}/copy-relative`,
      `${MENU_CONTRIBUTION_ID}/copy-path`,
    ])
  })
})

describe('resolveMenuActions for files', () => {
  test('a changed file offers open, stage, discard, and both copy paths', () => {
    const actions = actionsFor(fileValue())
    assert.deepEqual(publishedIds(actions), [
      `${MENU_CONTRIBUTION_ID}/open`,
      `${MENU_CONTRIBUTION_ID}/stage`,
      `${MENU_CONTRIBUTION_ID}/discard`,
      `${MENU_CONTRIBUTION_ID}/copy-relative`,
      `${MENU_CONTRIBUTION_ID}/copy-path`,
    ])
    assert.deepEqual(labelsOf(actions), [
      t('menu.openDiff'),
      t('actions.stage'),
      t('actions.discard'),
      t('menu.copyRelativePath'),
      t('menu.copyPath'),
    ])
    assert.equal(actions[0].separatorBefore, undefined)
    assert.equal(actions[0].danger, undefined)
    assert.equal(actions[1].separatorBefore, true)
    assert.equal(actions[2].danger, true)
    assert.equal(actions[3].separatorBefore, true)
    assert.equal(actions[4].separatorBefore, undefined)
    for (const action of actions) assert.equal(typeof action.run, 'function')
  })

  test('a staged file offers unstaging instead of staging and discarding', () => {
    const actions = actionsFor(fileValue({ section: 'staged' }))
    assert.deepEqual(publishedIds(actions), [
      `${MENU_CONTRIBUTION_ID}/open`,
      `${MENU_CONTRIBUTION_ID}/unstage`,
      `${MENU_CONTRIBUTION_ID}/copy-relative`,
      `${MENU_CONTRIBUTION_ID}/copy-path`,
    ])
    assert.equal(actionById(actions, 'open').label, t('menu.openDiff'))
    assert.equal(actionById(actions, 'unstage').separatorBefore, true)
    assert.equal(actionById(actions, 'unstage').label, t('actions.unstage'))
  })

  test('an untracked file in the changes group offers staging, not a special command', () => {
    const actions = actionsFor(fileValue({ path: 'README.md', untracked: true }))
    assert.deepEqual(publishedIds(actions), [
      `${MENU_CONTRIBUTION_ID}/open`,
      `${MENU_CONTRIBUTION_ID}/stage`,
      `${MENU_CONTRIBUTION_ID}/discard`,
      `${MENU_CONTRIBUTION_ID}/copy-relative`,
      `${MENU_CONTRIBUTION_ID}/copy-path`,
    ])
  })

  test('a conflicted file in the merge group can be staged but not discarded', () => {
    const actions = actionsFor(fileValue({ section: 'merge', path: 'merge.txt', conflict: true }))
    assert.deepEqual(publishedIds(actions), [
      `${MENU_CONTRIBUTION_ID}/open`,
      `${MENU_CONTRIBUTION_ID}/stage`,
      `${MENU_CONTRIBUTION_ID}/copy-relative`,
      `${MENU_CONTRIBUTION_ID}/copy-path`,
    ])
    assert.equal(actionById(actions, 'stage').danger, undefined)
  })

  test('an unknown section falls back to the changes group', () => {
    assert.deepEqual(publishedIds(actionsFor(fileValue({ section: 'renamed' }))), [
      `${MENU_CONTRIBUTION_ID}/open`,
      `${MENU_CONTRIBUTION_ID}/stage`,
      `${MENU_CONTRIBUTION_ID}/discard`,
      `${MENU_CONTRIBUTION_ID}/copy-relative`,
      `${MENU_CONTRIBUTION_ID}/copy-path`,
    ])
  })

  test('omits the absolute-path copy without a working directory', () => {
    const actions = actionsFor(fileValue({ cwd: undefined }))
    assert.deepEqual(publishedIds(actions), [
      `${MENU_CONTRIBUTION_ID}/open`,
      `${MENU_CONTRIBUTION_ID}/stage`,
      `${MENU_CONTRIBUTION_ID}/discard`,
      `${MENU_CONTRIBUTION_ID}/copy-relative`,
    ])
  })

  test('resolves nothing for a file without a path', () => {
    assert.deepEqual(actionsFor(fileValue({ path: '' })), [])
    assert.deepEqual(actionsFor(fileValue({ path: 42 })), [])
  })
})

describe('resolveMenuActions for folders', () => {
  test('a changes folder stages and discards the whole subtree', () => {
    const value = { sessionId: SESSION, panelId: PANEL, kind: 'folder', section: 'changes', path: 'src', paths: ['src/a.js', 'src/b.js'], cwd: '/repo' }
    const actions = actionsFor(value)
    assert.deepEqual(publishedIds(actions), [
      `${MENU_CONTRIBUTION_ID}/stage-all`,
      `${MENU_CONTRIBUTION_ID}/discard-all`,
      `${MENU_CONTRIBUTION_ID}/copy-relative`,
      `${MENU_CONTRIBUTION_ID}/copy-path`,
    ])
    assert.deepEqual(labelsOf(actions), [
      t('actions.stage'),
      t('actions.discard'),
      t('menu.copyRelativePath'),
      t('menu.copyPath'),
    ])
    assert.equal(actions[0].separatorBefore, undefined)
    assert.equal(actions[0].danger, undefined)
    assert.equal(actions[1].danger, true)
    assert.equal(actions[1].separatorBefore, undefined)
    assert.equal(actions[2].separatorBefore, true)
  })

  test('a staged folder offers unstaging only, and a merge folder no discard', () => {
    const common = { sessionId: SESSION, kind: 'folder', path: 'src', paths: ['src/a.js'], cwd: '/repo' }
    assert.deepEqual(publishedIds(actionsFor({ ...common, section: 'staged' })), [
      `${MENU_CONTRIBUTION_ID}/unstage-all`,
      `${MENU_CONTRIBUTION_ID}/copy-relative`,
      `${MENU_CONTRIBUTION_ID}/copy-path`,
    ])
    assert.deepEqual(publishedIds(actionsFor({ ...common, section: 'merge' })), [
      `${MENU_CONTRIBUTION_ID}/stage-all`,
      `${MENU_CONTRIBUTION_ID}/copy-relative`,
      `${MENU_CONTRIBUTION_ID}/copy-path`,
    ])
  })

  test('resolves nothing for a folder without a path or without resolved paths', () => {
    const base = { sessionId: SESSION, kind: 'folder', section: 'changes' }
    assert.deepEqual(actionsFor({ ...base, paths: ['src/a.js'] }), [])
    assert.deepEqual(actionsFor({ ...base, path: 'src', paths: [] }), [])
    assert.deepEqual(actionsFor({ ...base, path: 'src' }), [])
    assert.deepEqual(actionsFor({ ...base, path: 'src', paths: ['', 42, null] }), [])
  })
})

describe('resolveMenuActions for group headers', () => {
  test('a changes header offers stage-all, discard-all, and refresh', () => {
    const actions = actionsFor({ sessionId: SESSION, kind: 'section', section: 'changes' })
    assert.deepEqual(publishedIds(actions), [
      `${MENU_CONTRIBUTION_ID}/stage-all`,
      `${MENU_CONTRIBUTION_ID}/discard-all`,
      `${MENU_CONTRIBUTION_ID}/refresh`,
    ])
    assert.deepEqual(labelsOf(actions), [t('actions.stageAll'), t('actions.discardAll'), t('refresh')])
    assert.equal(actions[1].danger, true)
    assert.equal(actions[2].separatorBefore, true)
  })

  test('a staged header offers unstage-all and refresh', () => {
    const actions = actionsFor({ sessionId: SESSION, kind: 'section', section: 'staged' })
    assert.deepEqual(publishedIds(actions), [
      `${MENU_CONTRIBUTION_ID}/unstage-all`,
      `${MENU_CONTRIBUTION_ID}/refresh`,
    ])
    assert.deepEqual(labelsOf(actions), [t('actions.unstageAll'), t('refresh')])
    assert.equal(actions[1].separatorBefore, true)
  })

  test('a merge header offers stage-all only', () => {
    const actions = actionsFor({ sessionId: SESSION, kind: 'section', section: 'merge' })
    assert.deepEqual(publishedIds(actions), [`${MENU_CONTRIBUTION_ID}/stage-all`])
    assert.deepEqual(labelsOf(actions), [t('actions.stageAll')])
  })

  test('the graph header refreshes history with the history label', () => {
    const actions = actionsFor({ sessionId: SESSION, kind: 'section', section: 'graph' })
    assert.deepEqual(publishedIds(actions), [`${MENU_CONTRIBUTION_ID}/refresh`])
    assert.deepEqual(labelsOf(actions), [t('menu.refreshHistory')])
  })

  test('resolves nothing for an unknown group', () => {
    assert.deepEqual(actionsFor({ sessionId: SESSION, kind: 'section', section: 'unknown' }), [])
  })
})

describe('resolveMenuActions for commit and diff targets', () => {
  test('a commit row copies the full id and the subject', () => {
    const value = { sessionId: SESSION, kind: 'commit', oid: 'a'.repeat(40), shortOid: 'aaaaaaa', subject: 'Fix it' }
    const actions = actionsFor(value)
    // The published ids are `copy-id`/`copy-message`, not `copy-commit-*`.
    assert.deepEqual(publishedIds(actions), [
      'git-graph.actions/copy-id',
      'git-graph.actions/copy-message',
    ])
    assert.deepEqual(labelsOf(actions), [t('menu.copyCommitId'), t('menu.copyCommitSubject')])
    assert.equal(actions[0].danger, undefined)
    assert.equal(actions[0].separatorBefore, undefined)
  })

  test('a commit row omits the command for a missing or empty field', () => {
    const base = { sessionId: SESSION, kind: 'commit' }
    assert.deepEqual(publishedIds(actionsFor({ ...base, oid: 'a'.repeat(40) })), [`${MENU_CONTRIBUTION_ID}/copy-id`])
    assert.deepEqual(publishedIds(actionsFor({ ...base, subject: 'Fix it' })), [`${MENU_CONTRIBUTION_ID}/copy-message`])
    assert.deepEqual(actionsFor({ ...base, oid: '', subject: '' }), [])
    assert.deepEqual(actionsFor(base), [])
  })

  test('a diff header copies the relative path and, with a cwd, the absolute path', () => {
    const actions = actionsFor({ sessionId: SESSION, kind: 'diff', path: 'src/app.js', cwd: '/repo' })
    assert.deepEqual(publishedIds(actions), [
      `${MENU_CONTRIBUTION_ID}/copy-relative`,
      `${MENU_CONTRIBUTION_ID}/copy-path`,
    ])
    assert.deepEqual(labelsOf(actions), [t('menu.copyRelativePath'), t('menu.copyPath')])
    assert.deepEqual(publishedIds(actionsFor({ sessionId: SESSION, kind: 'diff', path: 'src/app.js' })), [
      `${MENU_CONTRIBUTION_ID}/copy-relative`,
    ])
    assert.deepEqual(actionsFor({ sessionId: SESSION, kind: 'diff', path: '' }), [])
  })
})

describe('resolveMenuActions busy state', () => {
  test('disables mutating file actions but keeps the copy commands active', () => {
    const actions = actionsFor(fileValue({ busy: true }))
    assert.deepEqual(actions.filter((action) => action.disabled === true).map((action) => action.id),
      ['open', 'stage', 'discard'])
    assert.equal(actionById(actions, 'copy-relative').disabled, undefined)
    assert.equal(actionById(actions, 'copy-path').disabled, undefined)
  })

  test('disables every group-header action while the panel is busy', () => {
    const actions = actionsFor({ sessionId: SESSION, kind: 'section', section: 'changes', busy: true })
    assert.ok(actions.every((action) => action.disabled === true))
  })

  test('leaves copy-only targets enabled while the panel is busy', () => {
    const commit = actionsFor({ sessionId: SESSION, kind: 'commit', oid: 'a'.repeat(40), subject: 'Fix it', busy: true })
    assert.ok(commit.every((action) => action.disabled === undefined))
    const diff = actionsFor({ sessionId: SESSION, kind: 'diff', path: 'src/app.js', cwd: '/repo', busy: true })
    assert.ok(diff.every((action) => action.disabled === undefined))
  })

  test('adds no disabled flag when the panel is not busy', () => {
    for (const busy of [false, undefined]) {
      const actions = actionsFor(fileValue({ busy }))
      assert.ok(actions.every((action) => action.disabled === undefined), `busy ${String(busy)}`)
    }
  })
})

describe('menu command payloads', () => {
  test('file commands emit the open, stage, and discard operations', () => {
    const actions = actionsFor(fileValue())
    const emitted = captureCommands(() => {
      for (const id of ['open', 'stage', 'discard']) actionById(actions, id).run()
    })
    assert.deepEqual(emitted, [
      { sessionId: SESSION, panelId: PANEL, type: 'open', section: 'changes', path: 'src/app.js' },
      { sessionId: SESSION, panelId: PANEL, type: 'stage', paths: ['src/app.js'] },
      { sessionId: SESSION, panelId: PANEL, type: 'discard', paths: ['src/app.js'], single: true },
    ])
  })

  test('an unknown section emits the changes fallback', () => {
    const emitted = captureCommands(() => {
      actionById(actionsFor(fileValue({ section: 'renamed' })), 'open').run()
    })
    assert.deepEqual(emitted, [{ sessionId: SESSION, panelId: PANEL, type: 'open', section: 'changes', path: 'src/app.js' }])
  })

  test('a staged file emits the unstage operation', () => {
    const emitted = captureCommands(() => {
      actionById(actionsFor(fileValue({ section: 'staged' })), 'unstage').run()
    })
    assert.deepEqual(emitted, [{ sessionId: SESSION, panelId: PANEL, type: 'unstage', paths: ['src/app.js'] }])
  })

  test('folder commands emit the filtered subtree paths', () => {
    const value = { sessionId: SESSION, panelId: PANEL, kind: 'folder', section: 'changes', path: 'src', paths: ['src/a.js', '', 42, 'src/b.js'] }
    const actions = actionsFor(value)
    const emitted = captureCommands(() => {
      actionById(actions, 'stage-all').run()
      actionById(actions, 'discard-all').run()
    })
    assert.deepEqual(emitted, [
      { sessionId: SESSION, panelId: PANEL, type: 'stage', paths: ['src/a.js', 'src/b.js'] },
      { sessionId: SESSION, panelId: PANEL, type: 'discard', paths: ['src/a.js', 'src/b.js'] },
    ])
  })

  test('group-header commands emit the whole-section operations', () => {
    const changes = captureCommands(() => {
      const actions = actionsFor({ sessionId: SESSION, panelId: PANEL, kind: 'section', section: 'changes' })
      for (const id of ['stage-all', 'discard-all', 'refresh']) actionById(actions, id).run()
    })
    assert.deepEqual(changes, [
      { sessionId: SESSION, panelId: PANEL, type: 'stageSection', section: 'changes' },
      { sessionId: SESSION, panelId: PANEL, type: 'discardSection', section: 'changes' },
      { sessionId: SESSION, panelId: PANEL, type: 'refresh' },
    ])
    const staged = captureCommands(() => {
      actionById(actionsFor({ sessionId: SESSION, panelId: PANEL, kind: 'section', section: 'staged' }), 'unstage-all').run()
    })
    assert.deepEqual(staged, [{ sessionId: SESSION, panelId: PANEL, type: 'unstageSection', section: 'staged' }])
  })

  test('commands carry the captured panel id, undefined when the panel had none', () => {
    const captured = captureCommands(() => {
      actionById(actionsFor({ sessionId: SESSION, kind: 'section', section: 'graph' }), 'refresh').run()
    })
    assert.deepEqual(captured, [{ sessionId: SESSION, panelId: undefined, type: 'refresh' }])
  })

  test('copy commands do not emit commands on the bus', () => {
    const actions = actionsFor(fileValue())
    const emitted = captureCommands(() => {
      actionById(actions, 'copy-relative').run()
      actionById(actions, 'copy-path').run()
    })
    assert.deepEqual(emitted, [])
  })
})

describe('copy command execution', () => {
  test('copies the relative path and reports success through the toast', async () => {
    const copied = []
    const notes = await runCopy(async (text) => { copied.push(text) }, fileValue(), 'copy-relative')
    assert.deepEqual(copied, ['src/app.js'])
    assert.deepEqual(notes, [{ text: t('menu.copiedRelativePath'), success: true }])
  })

  test('copies the absolute path below the repository root', async () => {
    const copied = []
    const notes = await runCopy(async (text) => { copied.push(text) }, fileValue(), 'copy-path')
    assert.deepEqual(copied, ['/repo/src/app.js'])
    assert.deepEqual(notes, [{ text: t('menu.copiedPath'), success: true }])
  })

  test('keeps native separators for a Windows working directory', async () => {
    const copied = []
    await runCopy(async (text) => { copied.push(text) }, fileValue({ cwd: 'C:\\repo' }), 'copy-path')
    assert.deepEqual(copied, ['C:\\repo\\src\\app.js'])
  })

  test('reports a refusing clipboard instead of staying silent', async () => {
    const notes = await runCopy(async () => { throw new Error('denied') }, fileValue(), 'copy-relative')
    assert.deepEqual(notes, [{ text: t('menu.copyFailed'), success: false }])
  })

  test('commit copies use the full identifier and the subject', async () => {
    const value = { sessionId: SESSION, kind: 'commit', oid: 'a'.repeat(40), subject: 'Fix it' }
    const ids = []
    const idNotes = await runCopy(async (text) => { ids.push(text) }, value, 'copy-id')
    assert.deepEqual(ids, ['a'.repeat(40)])
    assert.deepEqual(idNotes, [{ text: t('menu.copiedCommitId'), success: true }])
    const subjects = []
    const subjectNotes = await runCopy(async (text) => { subjects.push(text) }, value, 'copy-message')
    assert.deepEqual(subjects, ['Fix it'])
    assert.deepEqual(subjectNotes, [{ text: t('menu.copiedCommitSubject'), success: true }])
  })
})
