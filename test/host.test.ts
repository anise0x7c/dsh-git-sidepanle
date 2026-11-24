/**
 * Host-half tests for the Git source-control bundle.
 *
 * The route is exercised over a real loopback HTTP server, so the trust fence,
 * body handling, JSON envelope, and every Git operation run exactly as the
 * browser will call them.
 */

import assert from 'node:assert/strict'
import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { promisify } from 'node:util'
import { createRepositoryWatchRegistry } from '../src/host/watch/registry.ts'
import type {
  ChangeEntry,
  GitGraphOperation,
  GitGraphRpcValues,
  RepositoryStatus,
  StatusResult,
  WatchState,
} from '../src/shared/git.ts'
import {
  createFakeContext,
  routeServer,
  serverPort,
  withSessionServer,
} from './support/host-server.ts'
import type { RpcReply } from './support/types.ts'

const execFile = promisify(execFileCallback)
let tmpRoot = ''
let repo = ''
let server: Server | undefined
let disposeHost: (() => void) | undefined
let base = ''

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFile('git', args, { cwd })
  return stdout
}

/** Create an isolated repository with one commit and a fixed identity. */
async function createRemoteRepository(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpRoot, prefix))
  await git(directory, 'init', '-q', '-b', 'main')
  await git(directory, 'config', 'user.name', 'Remote Test')
  await git(directory, 'config', 'user.email', 'remote@example.test')
  await writeFile(join(directory, 'base.txt'), 'base\n')
  await git(directory, 'add', '-A')
  await git(directory, 'commit', '-q', '-m', 'base commit')
  return directory
}

/** Create an isolated bare repository to act as a local-path remote. */
async function createBareRemote(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpRoot, prefix))
  await git(directory, 'init', '-q', '--bare', '-b', 'main')
  return directory
}

/** Clone a bare remote so a peer can advance it. */
async function createPeer(bare: string, prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpRoot, prefix))
  await git(directory, 'clone', '-q', bare, '.')
  await git(directory, 'config', 'user.name', 'Peer')
  await git(directory, 'config', 'user.email', 'peer@example.test')
  return directory
}

/** Read a ref's object id, or null when the ref does not exist. */
async function refValue(directory: string, ref: string): Promise<string | null> {
  try {
    return (await git(directory, 'rev-parse', '--verify', ref)).trim()
  } catch {
    return null
  }
}

/** Read one changed file from a status result, failing when Git did not report it. */
function fileByPath(files: readonly ChangeEntry[], path: string): ChangeEntry {
  const file = files.find((entry) => entry.path === path)
  assert.ok(file, `the status did not report ${path}`)
  return file
}

/** Read the repository summary of a status result that must have one. */
function requireRepo(status: StatusResult): RepositoryStatus {
  assert.ok(status.repo !== null, 'the directory should be inside a repository')
  return status.repo
}

/** One RPC reply plus the HTTP status the test server answered. */
interface CallResult<T> {
  status: number
  body: RpcReply<T>
}

/** One call's options. */
interface CallOptions {
  untrusted?: boolean
}

async function request<T>(
  url: string,
  payload: Record<string, unknown>,
  trusted = true,
): Promise<CallResult<T>> {
  const headers = {
    'content-type': 'application/json',
    ...(trusted ? { 'x-dsh-git-graph': '1' } : {}),
  }
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
  return { status: response.status, body: (await response.json()) as RpcReply<T> }
}

async function callAt<Operation extends GitGraphOperation>(
  baseUrl: string,
  op: Operation,
  payload: Record<string, unknown> = {},
): Promise<CallResult<GitGraphRpcValues[Operation]>> {
  return request(`${baseUrl}/api/dsh-git-graph/rpc`, { sessionId: 'session-1', op, ...payload })
}

async function call<Operation extends GitGraphOperation>(
  op: Operation,
  payload: Record<string, unknown> = {},
  options: CallOptions = {},
): Promise<CallResult<GitGraphRpcValues[Operation]>> {
  return request(
    `${base}/api/dsh-git-graph/rpc`,
    { sessionId: 'session-1', op, ...payload },
    options.untrusted !== true,
  )
}

async function callUnknown(
  op: string,
  payload: Record<string, unknown> = {},
): Promise<CallResult<unknown>> {
  return request(`${base}/api/dsh-git-graph/rpc`, { sessionId: 'session-1', op, ...payload })
}

/**
 * Wait for a real interval; the watch debounce and idle timers are real too.
 * @param ms - milliseconds to wait.
 */
async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/**
 * Poll a panel's watch counters until they satisfy a predicate.
 * @param baseUrl - test server URL.
 * @param panel - panel identity.
 * @param predicate - condition to reach.
 * @param timeoutMs - how long to keep polling.
 * @returns the state that satisfied the predicate.
 */
async function waitForWatch(
  baseUrl: string,
  panel: string,
  predicate: (state: WatchState) => boolean,
  timeoutMs = 8000,
): Promise<WatchState> {
  const deadline = Date.now() + timeoutMs
  let last: WatchState = { watching: false, worktree: 0, references: 0 }
  while (Date.now() < deadline) {
    const { body } = await callAt(baseUrl, 'watch', { panel })
    if (body.ok) {
      last = body.value
      if (predicate(last)) return last
    }
    await sleep(80)
  }
  assert.fail(`the watch counters did not reach the expected state: ${JSON.stringify(last)}`)
}

before(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'dsh-git-graph-test-'))
  repo = await mkdtemp(join(tmpRoot, 'repo-'))
  await git(repo, 'init', '-b', 'main')
  await git(repo, 'config', 'user.name', 'Git Graph Test')
  await git(repo, 'config', 'user.email', 'git-graph@example.test')
  await writeFile(join(repo, 'alpha.txt'), 'one\ntwo\n')
  await git(repo, 'add', '-A')
  await git(repo, 'commit', '-m', 'initial commit')

  const host = createFakeContext(repo)
  disposeHost = host.dispose
  server = routeServer(host.routes)
  await new Promise<void>((resolve) => {
    server?.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${serverPort(server)}`
})

after(async () => {
  if (server !== undefined)
    await new Promise<void>((resolve) => {
      server?.close(() => resolve())
    })
  disposeHost?.()
  await rm(tmpRoot, { recursive: true, force: true })
})

test('health route answers only trusted loopback requests', async () => {
  const trusted = await fetch(`${base}/api/dsh-git-graph/health`, {
    headers: { 'x-dsh-git-graph': '1' },
  })
  assert.equal(trusted.status, 200)
  assert.deepEqual(await trusted.json(), { ok: true, service: '@local/dsh-git-graph' })
  const untrusted = await fetch(`${base}/api/dsh-git-graph/health`)
  assert.equal(untrusted.status, 403)
  const rpc = await call('status', {}, { untrusted: true })
  assert.equal(rpc.status, 403)
})

test('status reports the branch and change groups', async () => {
  const { status, body } = await call('status')
  assert.equal(status, 200)
  assert.equal(body.ok, true)
  const repository = requireRepo(body.value)
  assert.equal(repository.root, repo)
  assert.equal(repository.branch, 'main')
  assert.equal(repository.unborn, false)
  assert.deepEqual(body.value.files, [])

  await writeFile(join(repo, 'alpha.txt'), 'one\nTWO\n')
  await writeFile(join(repo, 'beta.txt'), 'new file\n')
  const next = await call('status')
  const files = next.body.value.files
  const alpha = fileByPath(files, 'alpha.txt')
  const beta = fileByPath(files, 'beta.txt')
  assert.equal(alpha.kind, 'ordinary')
  assert.equal(alpha.x, '.')
  assert.equal(alpha.y, 'M')
  assert.equal(beta.kind, 'untracked')
  assert.equal(beta.untracked, true)
})

test('status reports conflicted files with their paths', async () => {
  const conflictRepo = await mkdtemp(join(tmpRoot, 'conflict-'))
  await git(conflictRepo, 'init', '-b', 'main')
  await git(conflictRepo, 'config', 'user.name', 'Git Graph Test')
  await git(conflictRepo, 'config', 'user.email', 'git-graph@example.test')
  await mkdir(join(conflictRepo, 'src'), { recursive: true })
  await writeFile(join(conflictRepo, 'src', 'conflicted.txt'), 'base\n')
  await git(conflictRepo, 'add', '-A')
  await git(conflictRepo, 'commit', '-m', 'base version')
  await git(conflictRepo, 'checkout', '-b', 'feature')
  await writeFile(join(conflictRepo, 'src', 'conflicted.txt'), 'feature version\n')
  await git(conflictRepo, 'commit', '-am', 'feature version')
  await git(conflictRepo, 'checkout', 'main')
  await writeFile(join(conflictRepo, 'src', 'conflicted.txt'), 'main version\n')
  await git(conflictRepo, 'commit', '-am', 'main version')
  await assert.rejects(git(conflictRepo, 'merge', 'feature'))

  const { status, body } = await withSessionServer(conflictRepo, (url) => callAt(url, 'status'))
  assert.equal(status, 200)
  assert.equal(body.ok, true)
  const conflicted = body.value.files.find((file) => file.kind === 'unmerged')
  assert.ok(conflicted, 'the conflicted file is reported as an unmerged entry')
  assert.equal(conflicted.path, 'src/conflicted.txt')
  assert.equal(conflicted.conflict, true)
  assert.equal(conflicted.untracked, false)
  assert.equal(conflicted.x, 'U')
  assert.equal(conflicted.y, 'U')
})

test('stage, unstage, diff, commit, and history work end to end', async () => {
  const staged = await call('stage', { paths: ['alpha.txt'] })
  assert.equal(staged.body.ok, true)
  let status = (await call('status')).body.value
  assert.equal(fileByPath(status.files, 'alpha.txt').x, 'M')

  const stagedDiff = await call('diff', { path: 'alpha.txt', staged: true })
  assert.equal(stagedDiff.body.ok, true)
  assert.equal(stagedDiff.body.value.additions, 1)
  assert.equal(stagedDiff.body.value.deletions, 1)
  assert.ok(stagedDiff.body.value.hunks.length > 0)

  const unstagedDiff = await call('diff', { path: 'alpha.txt', staged: false })
  assert.equal(unstagedDiff.body.value.additions, 0)
  assert.equal(unstagedDiff.body.value.deletions, 0)
  assert.equal(unstagedDiff.body.value.hunks.length, 0)

  const untrackedDiff = await call('diff', { path: 'beta.txt', untracked: true })
  assert.equal(untrackedDiff.body.value.additions, 1)
  const untrackedHunk = untrackedDiff.body.value.hunks[0]
  assert.ok(untrackedHunk, 'the untracked diff has no hunk')
  const untrackedLine = untrackedHunk.lines[0]
  assert.ok(untrackedLine, 'the untracked diff has no rendered line')
  assert.equal(untrackedLine.t, '+')

  await call('unstage', { paths: ['alpha.txt'] })
  status = (await call('status')).body.value
  assert.equal(fileByPath(status.files, 'alpha.txt').x, '.')

  const emptyCommit = await call('commit', { message: '   ' })
  assert.equal(emptyCommit.body.ok, false)
  assert.equal(emptyCommit.body.error.code, 'empty-message')

  const refusedCommit = await call('commit', { message: 'nothing staged yet' })
  assert.equal(refusedCommit.body.ok, false)
  assert.equal(refusedCommit.body.error.code, 'nothing-staged')

  const commit = await call('commit', { message: 'change alpha and add beta', stageAll: true })
  assert.equal(commit.body.ok, true)
  const commitOid = commit.body.value.commit
  assert.ok(typeof commitOid === 'string', 'the commit operation reports the new HEAD')
  assert.match(commitOid, /^[0-9a-f]{7,}$/)

  status = (await call('status')).body.value
  assert.deepEqual(status.files, [])

  const history = await call('history')
  assert.equal(history.body.ok, true)
  assert.equal(history.body.value.commits.length, 2)
  assert.equal(history.body.value.hasMore, false)
  const newestCommit = history.body.value.commits[0]
  const rootCommit = history.body.value.commits[1]
  assert.ok(newestCommit, 'the history has no newest commit')
  assert.ok(rootCommit, 'the history has no root commit')
  assert.equal(newestCommit.subject, 'change alpha and add beta')
  assert.equal(newestCommit.refs.includes('main'), true)
  assert.deepEqual(newestCommit.parents, [rootCommit.oid])
  assert.deepEqual(rootCommit.parents, [])
  assert.equal('graph' in newestCommit, false)
  assert.equal(
    newestCommit.refs,
    'HEAD -> refs/heads/main',
    'decorations carry full reference names',
  )
  assert.deepEqual(history.body.value.references, {
    current: { id: 'refs/heads/main', name: 'main', revision: newestCommit.oid },
    remote: null,
    base: null,
  })

  const badOp = await callUnknown('nonsense')
  assert.equal(badOp.body.ok, false)
  assert.equal(badOp.body.error.code, 'unknown-operation')
})

test('commit amend replaces the tip commit and is refused without HEAD', async () => {
  const amendable = await mkdtemp(join(tmpRoot, 'amend-'))
  await git(amendable, 'init', '-q', '-b', 'main')
  await git(amendable, 'config', 'user.name', 'Git Graph Test')
  await git(amendable, 'config', 'user.email', 'git-graph@example.test')
  await writeFile(join(amendable, 'base.txt'), 'base\n')
  await git(amendable, 'add', '-A')
  await git(amendable, 'commit', '-q', '-m', 'base commit')
  await writeFile(join(amendable, 'base.txt'), 'base amended\n')
  await git(amendable, 'add', '-A')
  const countBefore = (await git(amendable, 'rev-list', '--count', 'HEAD')).trim()

  const amended = await withSessionServer(amendable, (baseUrl) =>
    callAt(baseUrl, 'commit', { message: 'amended message', amend: true }),
  )
  assert.equal(amended.status, 200)
  assert.equal(amended.body.ok, true)
  assert.match(amended.body.value.commit ?? '', /^[0-9a-f]{7,}$/)
  assert.equal((await git(amendable, 'rev-list', '--count', 'HEAD')).trim(), countBefore)
  assert.equal((await git(amendable, 'log', '-1', '--format=%s')).trim(), 'amended message')
  assert.match(await git(amendable, 'show', '--name-only', '--format=', 'HEAD'), /base\.txt/)

  const unborn = await mkdtemp(join(tmpRoot, 'amend-unborn-'))
  await git(unborn, 'init', '-q', '-b', 'main')
  await git(unborn, 'config', 'user.name', 'Git Graph Test')
  await git(unborn, 'config', 'user.email', 'git-graph@example.test')
  const refused = await withSessionServer(unborn, (baseUrl) =>
    callAt(baseUrl, 'commit', { message: 'nope', amend: true }),
  )
  assert.equal(refused.status, 409)
  assert.equal(refused.body.ok, false)
  assert.equal(refused.body.error.code, 'nothing-to-amend')
})

test('history pages backwards by offset and reports when older commits remain', async () => {
  const pagedRepo = await mkdtemp(join(tmpRoot, 'paged-'))
  await git(pagedRepo, 'init', '-b', 'main')
  await git(pagedRepo, 'config', 'user.name', 'Git Graph Test')
  await git(pagedRepo, 'config', 'user.email', 'git-graph@example.test')
  for (let index = 0; index < 61; index += 1) {
    await git(pagedRepo, 'commit', '--allow-empty', '-m', `commit ${index}`)
  }

  await withSessionServer(pagedRepo, async (baseUrl) => {
    const first = await callAt(baseUrl, 'history')
    assert.equal(first.status, 200)
    assert.equal(first.body.ok, true)
    assert.equal(first.body.value.commits.length, 60)
    assert.equal(first.body.value.hasMore, true)
    const firstPageHead = first.body.value.commits[0]
    const firstPageTail = first.body.value.commits[59]
    assert.ok(firstPageHead, 'the first history page has no head')
    assert.ok(firstPageTail, 'the first history page has no tail')
    assert.equal(firstPageHead.subject, 'commit 60')
    assert.equal(firstPageTail.subject, 'commit 1')

    const second = await callAt(baseUrl, 'history', { offset: 60 })
    assert.equal(second.body.ok, true)
    assert.equal(second.body.value.commits.length, 1)
    assert.equal(second.body.value.hasMore, false)
    const secondPageHead = second.body.value.commits[0]
    assert.ok(secondPageHead, 'the second history page has no head')
    assert.equal(secondPageHead.subject, 'commit 0')
    assert.deepEqual(secondPageHead.parents, [])
    const continuedParent = firstPageTail.parents[0]
    assert.ok(continuedParent, 'the first page tail has no parent')
    assert.deepEqual(
      secondPageHead.oid,
      continuedParent,
      'the page continues below the previous one',
    )

    const beyond = await callAt(baseUrl, 'history', { offset: 61 })
    assert.equal(beyond.body.ok, true)
    assert.equal(beyond.body.value.commits.length, 0)
    assert.equal(beyond.body.value.hasMore, false)

    for (const offset of [-1, 1.5, '10']) {
      const refused = await callAt(baseUrl, 'history', { offset })
      assert.equal(refused.status, 400, `offset ${String(offset)}`)
      assert.equal(refused.body.ok, false)
      assert.equal(refused.body.error.code, 'bad-request')
    }
  })
})

test('a commit reports its metadata and changed files, and its files diff against the first parent', async () => {
  const history = (await call('history')).body.value
  const head = history.commits.find((commit) => commit.subject === 'change alpha and add beta')
  assert.ok(head, 'the second commit is in the history')

  const details = await call('commit-details', { oid: head.oid })
  assert.equal(details.body.ok, true)
  assert.equal(details.body.value.commit.oid, head.oid)
  assert.equal(details.body.value.commit.shortOid, head.shortOid)
  assert.equal(details.body.value.commit.subject, 'change alpha and add beta')
  assert.equal(details.body.value.commit.author, 'Git Graph Test')
  assert.equal(details.body.value.commit.parents.length, 1)
  assert.equal(details.body.value.truncated, false)
  const changed = details.body.value.files
  assert.deepEqual(changed.map((file) => [file.letter, file.path]).sort(), [
    ['A', 'beta.txt'],
    ['M', 'alpha.txt'],
  ])

  const commitDiff = await call('diff', { path: 'alpha.txt', commit: head.oid })
  assert.equal(commitDiff.body.ok, true)
  assert.ok('commit' in commitDiff.body.value)
  assert.equal(commitDiff.body.value.commit, head.oid)
  assert.equal(commitDiff.body.value.additions, 1)
  assert.equal(commitDiff.body.value.deletions, 1)
  assert.ok(commitDiff.body.value.hunks.length > 0)

  const root = history.commits.find((commit) => commit.subject === 'initial commit')
  assert.ok(root, 'the root commit is in the history')
  const rootDetails = await call('commit-details', { oid: root.oid })
  assert.deepEqual(rootDetails.body.value.commit.parents, [])
  assert.deepEqual(rootDetails.body.value.files, [{ path: 'alpha.txt', letter: 'A' }])
  const rootDiff = await call('diff', { path: 'alpha.txt', commit: root.oid })
  assert.equal(rootDiff.body.ok, true)
  assert.equal(rootDiff.body.value.additions, 2)
  assert.equal(rootDiff.body.value.deletions, 0)

  const missing = await call('commit-details', { oid: 'f'.repeat(40) })
  assert.equal(missing.body.ok, false)
  assert.equal(missing.body.error.code, 'unknown-commit')
  assert.equal(missing.status, 404)

  for (const oid of ['HEAD', head.shortOid, head.oid.toUpperCase()]) {
    const refused = await call('commit-details', { oid })
    assert.equal(refused.body.ok, false, `commit-details accepted ${oid}`)
    assert.equal(refused.body.error.code, 'bad-request')
    const refusedDiff = await call('diff', { path: 'alpha.txt', commit: oid })
    assert.equal(refusedDiff.body.error.code, 'bad-request')
  }
})

test('commit details follow the first parent for renames, deletions, and merges', async () => {
  const timeline = await mkdtemp(join(tmpRoot, 'timeline-'))
  await git(timeline, 'init', '-q', '-b', 'main')
  await git(timeline, 'config', 'user.name', 'Git Graph Test')
  await git(timeline, 'config', 'user.email', 'git-graph@example.test')
  await mkdir(join(timeline, 'src'), { recursive: true })
  await writeFile(join(timeline, 'src', 'alpha.txt'), 'one\n')
  await writeFile(join(timeline, 'keep.txt'), 'kept\n')
  await writeFile(join(timeline, 'doomed.txt'), 'bye\n')
  await git(timeline, 'add', '-A')
  await git(timeline, 'commit', '-qm', 'first commit')

  await git(timeline, 'mv', 'keep.txt', 'renamed.txt')
  await git(timeline, 'rm', '-q', 'doomed.txt')
  await writeFile(join(timeline, 'src', 'alpha.txt'), 'one\ntwo\n')
  await writeFile(join(timeline, 'src', 'new.txt'), 'new\n')
  await git(timeline, 'add', '-A')
  await git(timeline, 'commit', '-qm', 'rename, delete, and add')
  const second = (await git(timeline, 'rev-parse', 'HEAD')).trim()

  await git(timeline, 'checkout', '-q', '-b', 'feature')
  await writeFile(join(timeline, 'feature.txt'), 'feature\n')
  await git(timeline, 'add', '-A')
  await git(timeline, 'commit', '-qm', 'feature work')
  await git(timeline, 'checkout', '-q', 'main')
  await writeFile(join(timeline, 'main.txt'), 'main\n')
  await git(timeline, 'add', '-A')
  await git(timeline, 'commit', '-qm', 'main work')
  await git(timeline, 'merge', '-q', '--no-ff', 'feature', '-m', 'merge feature')
  const merge = (await git(timeline, 'rev-parse', 'HEAD')).trim()

  await withSessionServer(timeline, async (baseUrl) => {
    const details = await callAt(baseUrl, 'commit-details', { oid: second })
    assert.equal(details.body.ok, true)
    const files = details.body.value.files
    assert.deepEqual(files.map((file) => [file.letter, file.path]).sort(), [
      ['A', 'src/new.txt'],
      ['D', 'doomed.txt'],
      ['M', 'src/alpha.txt'],
      ['R', 'renamed.txt'],
    ])
    const renamed = files.find((file) => file.letter === 'R')
    assert.ok(renamed, 'the rename is listed')
    assert.equal(renamed.origPath, 'keep.txt')
    assert.equal(details.body.value.commit.parents.length, 1)

    const renameDiff = await callAt(baseUrl, 'diff', {
      path: 'renamed.txt',
      commit: second,
      origPath: 'keep.txt',
    })
    assert.equal(renameDiff.body.ok, true)
    assert.equal(renameDiff.body.value.renameFrom, 'keep.txt')
    assert.equal(renameDiff.body.value.renameTo, 'renamed.txt')
    assert.equal(renameDiff.body.value.additions, 0)

    const deleteDiff = await callAt(baseUrl, 'diff', { path: 'doomed.txt', commit: second })
    assert.equal(deleteDiff.body.ok, true)
    assert.equal(deleteDiff.body.value.deletions, 1)

    const mergeDetails = await callAt(baseUrl, 'commit-details', { oid: merge })
    assert.equal(mergeDetails.body.ok, true)
    assert.equal(mergeDetails.body.value.commit.parents.length, 2)
    assert.deepEqual(mergeDetails.body.value.files, [{ path: 'feature.txt', letter: 'A' }])

    // History carries the parent list the browser lays the graph out from, in
    // an order where every listed parent comes after its children.
    const history = await callAt(baseUrl, 'history')
    assert.equal(history.body.ok, true)
    const entries = history.body.value.commits
    const mergeRow = entries.find((entry) => entry.oid === merge)
    assert.ok(mergeRow, 'the merge commit is listed')
    assert.equal(mergeRow.parents.length, 2)
    const featureTip = (await git(timeline, 'rev-parse', 'feature')).trim()
    const featureRow = entries.find((entry) => entry.oid === featureTip)
    assert.ok(featureRow, 'the side branch tip is listed')
    assert.deepEqual(featureRow.parents, [second])
    const position = new Map(entries.map((entry, index) => [entry.oid, index]))
    for (const entry of entries) {
      for (const parent of entry.parents) {
        if (position.has(parent)) {
          const childPosition = position.get(entry.oid)
          const parentPosition = position.get(parent)
          assert.ok(
            childPosition !== undefined && parentPosition !== undefined,
            'both positions are listed',
          )
          assert.ok(
            parentPosition > childPosition,
            `${entry.oid} is listed after its parent ${parent}`,
          )
        }
      }
    }
  })
})

test('history lists branches topologically and reports the graph references', async () => {
  const graphRepo = await mkdtemp(join(tmpRoot, 'graph-refs-'))
  /**
   * Commit an empty change at a fixed date.
   * @param date - Unix seconds for both author and committer.
   * @param subject - commit subject.
   * @returns the new commit id.
   */
  const commitAt = async (date: number, subject: string): Promise<string> => {
    await execFile('git', ['commit', '-q', '--allow-empty', '-m', subject], {
      cwd: graphRepo,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: `@${date} +0000`,
        GIT_COMMITTER_DATE: `@${date} +0000`,
      },
    })
    return (await git(graphRepo, 'rev-parse', 'HEAD')).trim()
  }
  await git(graphRepo, 'init', '-q', '-b', 'main')
  await git(graphRepo, 'config', 'user.name', 'Git Graph Test')
  await git(graphRepo, 'config', 'user.email', 'git-graph@example.test')
  const root = await commitAt(1_700_000_000, 'root')
  const mainOne = await commitAt(1_700_000_200, 'main one')
  await git(graphRepo, 'checkout', '-q', '-b', 'fix/side', root)
  const sideOne = await commitAt(1_700_000_300, 'side one')
  await git(graphRepo, 'checkout', '-q', 'main')
  const mainTwo = await commitAt(1_700_000_400, 'main two')
  await git(graphRepo, 'checkout', '-q', 'fix/side')
  const sideTwo = await commitAt(1_700_000_500, 'side two')
  await git(graphRepo, 'checkout', '-q', 'main')

  // A remote without a network: its tracking refs, upstream and default branch.
  await git(graphRepo, 'remote', 'add', 'origin', join(tmpRoot, 'no-such-remote'))
  await git(graphRepo, 'update-ref', 'refs/remotes/origin/main', mainOne)
  await git(graphRepo, 'update-ref', 'refs/remotes/origin/master', root)
  await git(graphRepo, 'update-ref', 'refs/remotes/origin/release', sideOne)
  await git(graphRepo, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/master')
  await git(graphRepo, 'config', 'branch.main.remote', 'origin')
  await git(graphRepo, 'config', 'branch.main.merge', 'refs/heads/main')

  await withSessionServer(graphRepo, async (baseUrl) => {
    let history = (await callAt(baseUrl, 'history')).body.value
    const order = history.commits.map((entry) => entry.oid)
    assert.deepEqual(
      order,
      [sideTwo, sideOne, mainTwo, mainOne, root],
      'topological order keeps each line of history together instead of interleaving dates',
    )
    const sideRow = history.commits[0]
    assert.ok(sideRow)
    assert.equal(sideRow.refs, 'refs/heads/fix/side')
    assert.deepEqual(history.references, {
      current: { id: 'refs/heads/main', name: 'main', revision: mainTwo },
      remote: { id: 'refs/remotes/origin/main', name: 'origin/main', revision: mainOne },
      base: { id: 'refs/remotes/origin/master', name: 'origin/master', revision: root },
    })

    // A configured Code OSS merge base wins over the default branch.
    await git(graphRepo, 'config', 'branch.main.vscode-merge-base', 'origin/release')
    history = (await callAt(baseUrl, 'history')).body.value
    assert.deepEqual(history.references.base, {
      id: 'refs/remotes/origin/release',
      name: 'origin/release',
      revision: sideOne,
    })
    assert.equal(
      (await git(graphRepo, 'config', '--get', 'branch.main.vscode-merge-base')).trim(),
      'origin/release',
      'the history read never rewrites the configuration',
    )

    // A base that is the upstream is not a base.
    await git(graphRepo, 'config', 'branch.main.vscode-merge-base', 'origin/main')
    await git(graphRepo, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')
    history = (await callAt(baseUrl, 'history')).body.value
    assert.equal(history.references.base, null)

    // A detached HEAD is the current reference by commit id.
    await git(graphRepo, 'checkout', '-q', '--detach', mainOne)
    history = (await callAt(baseUrl, 'history')).body.value
    assert.deepEqual(history.references, {
      current: { id: mainOne, name: mainOne, revision: mainOne },
      remote: null,
      base: null,
    })
  })
})

test('discard restores tracked files and deletes untracked files', async () => {
  await writeFile(join(repo, 'alpha.txt'), 'one\nchanged again\n')
  await writeFile(join(repo, 'gamma.txt'), 'temporary\n')
  let status = (await call('status')).body.value
  assert.equal(status.files.length, 2)

  const discarded = await call('discard', { path: 'alpha.txt', untracked: false })
  assert.equal(discarded.body.ok, true)
  assert.equal(await readFile(join(repo, 'alpha.txt'), 'utf8'), 'one\nTWO\n')

  const removed = await call('discard', { path: 'gamma.txt', untracked: true })
  assert.equal(removed.body.ok, true)
  await assert.rejects(readFile(join(repo, 'gamma.txt'), 'utf8'))

  status = (await call('status')).body.value
  assert.deepEqual(status.files, [])

  const escapeAttempt = await call('discard', { path: '../outside.txt', untracked: true })
  assert.equal(escapeAttempt.body.ok, false)
  assert.equal(escapeAttempt.body.error.code, 'path-outside-repository')
})

test('branches list and checkout switch the worktree', async () => {
  const branches = await call('branches')
  assert.equal(branches.body.ok, true)
  assert.deepEqual(branches.body.value.branches, [{ name: 'main', current: true }])

  await git(repo, 'branch', 'feature/sidebar')
  const listed = await call('branches')
  assert.deepEqual(
    listed.body.value.branches.map((branch) => branch.name),
    ['feature/sidebar', 'main'],
  )

  const switched = await call('checkout', { branch: 'feature/sidebar' })
  assert.equal(switched.body.ok, true)
  const status = (await call('status')).body.value
  assert.equal(requireRepo(status).branch, 'feature/sidebar')

  const missing = await call('checkout', { branch: 'no-such-branch' })
  assert.equal(missing.body.ok, false)
  assert.equal(missing.body.error.code, 'unknown-branch')

  const optionShaped = await call('checkout', { branch: '--force' })
  assert.equal(optionShaped.body.ok, false)
  assert.equal(optionShaped.body.error.code, 'bad-request')
})

test('graph menus check out, create and safely delete references', async () => {
  const fixture = await mkdtemp(join(tmpRoot, 'graph-actions-'))
  await git(fixture, 'init', '-q', '-b', 'main')
  await git(fixture, 'config', 'user.name', 'Graph Actions Test')
  await git(fixture, 'config', 'user.email', 'graph-actions@example.test')
  await writeFile(join(fixture, 'base.txt'), 'base\n')
  await git(fixture, 'add', '-A')
  await git(fixture, 'commit', '-q', '-m', 'base')
  const baseCommit = (await git(fixture, 'rev-parse', 'HEAD')).trim()
  await writeFile(join(fixture, 'main.txt'), 'main\n')
  await git(fixture, 'add', '-A')
  await git(fixture, 'commit', '-q', '-m', 'main work')
  const mainCommit = (await git(fixture, 'rev-parse', 'HEAD')).trim()

  await withSessionServer(fixture, async (baseUrl) => {
    const detached = await callAt(baseUrl, 'checkout-detached', { oid: baseCommit })
    assert.equal(detached.body.ok, true)
    let status = (await callAt(baseUrl, 'status')).body.value
    assert.equal(requireRepo(status).detached, true)
    assert.equal(requireRepo(status).headOid, baseCommit)
    await assert.rejects(readFile(join(fixture, 'main.txt'), 'utf8'))
    assert.equal(await readFile(join(fixture, 'base.txt'), 'utf8'), 'base\n')

    const created = await callAt(baseUrl, 'create-branch', {
      oid: baseCommit,
      name: 'feature/from-graph',
    })
    assert.equal(created.body.ok, true)
    assert.equal(created.body.value.branch, 'feature/from-graph')
    status = (await callAt(baseUrl, 'status')).body.value
    assert.equal(requireRepo(status).branch, 'feature/from-graph')
    assert.equal(requireRepo(status).headOid, baseCommit)

    await writeFile(join(fixture, 'feature.txt'), 'not on main\n')
    await git(fixture, 'add', '-A')
    await git(fixture, 'commit', '-q', '-m', 'unmerged work')
    const switched = await callAt(baseUrl, 'checkout', { branch: 'main' })
    assert.equal(switched.body.ok, true)
    assert.equal(requireRepo((await callAt(baseUrl, 'status')).body.value).branch, 'main')

    const lightweight = await callAt(baseUrl, 'create-tag', {
      oid: baseCommit,
      name: 'v-light',
      message: '',
    })
    assert.equal(lightweight.body.ok, true)
    assert.equal((await git(fixture, 'cat-file', '-t', 'refs/tags/v-light')).trim(), 'commit')
    assert.equal((await git(fixture, 'rev-parse', 'refs/tags/v-light')).trim(), baseCommit)
    const annotated = await callAt(baseUrl, 'create-tag', {
      oid: mainCommit,
      name: 'v-annotated',
      message: 'release notes\n\nwith details\n',
    })
    assert.equal(annotated.body.ok, true)
    assert.equal((await git(fixture, 'cat-file', '-t', 'refs/tags/v-annotated')).trim(), 'tag')
    assert.equal(
      (await git(fixture, 'rev-parse', 'refs/tags/v-annotated^{commit}')).trim(),
      mainCommit,
    )
    assert.match(
      await git(fixture, 'for-each-ref', '--format=%(contents)', 'refs/tags/v-annotated'),
      /release notes\n\nwith details/,
    )

    const duplicate = await callAt(baseUrl, 'create-branch', {
      oid: mainCommit,
      name: 'feature/from-graph',
    })
    assert.equal(duplicate.body.ok, false)
    assert.equal(duplicate.body.error.code, 'git-command-failed')
    assert.equal(requireRepo((await callAt(baseUrl, 'status')).body.value).branch, 'main')

    const unmerged = await callAt(baseUrl, 'delete-branch', { branch: 'feature/from-graph' })
    assert.equal(unmerged.body.ok, false)
    assert.equal(unmerged.body.error.code, 'git-command-failed')
    assert.equal(
      await git(fixture, 'show-ref', '--verify', '--quiet', 'refs/heads/feature/from-graph').then(
        () => true,
        () => false,
      ),
      true,
    )

    await git(fixture, 'merge', '-q', '--no-edit', 'feature/from-graph')
    const removed = await callAt(baseUrl, 'delete-branch', { branch: 'feature/from-graph' })
    assert.equal(removed.body.ok, true)
    assert.equal(
      await git(fixture, 'show-ref', '--verify', '--quiet', 'refs/heads/feature/from-graph').then(
        () => true,
        () => false,
      ),
      false,
    )
    const current = await callAt(baseUrl, 'delete-branch', { branch: 'main' })
    assert.equal(current.body.ok, false)
    assert.equal(requireRepo((await callAt(baseUrl, 'status')).body.value).branch, 'main')
    await writeFile(join(fixture, 'main.txt'), 'uncommitted local edit\n')
    const refused = await callAt(baseUrl, 'checkout-detached', { oid: baseCommit })
    assert.equal(refused.body.ok, false)
    assert.equal(refused.body.error.code, 'git-command-failed')
    assert.equal(requireRepo((await callAt(baseUrl, 'status')).body.value).branch, 'main')
    assert.equal(await readFile(join(fixture, 'main.txt'), 'utf8'), 'uncommitted local edit\n')
    const shortCommit = await callAt(baseUrl, 'checkout-detached', { oid: 'abc123' })
    assert.equal(shortCommit.body.error.code, 'bad-request')
  })
})

test('ignore writes a literal root rule from a Session subdirectory', async () => {
  const fixture = await mkdtemp(join(tmpRoot, 'ignore-root-'))
  await git(fixture, 'init', '-q', '-b', 'main')
  await git(fixture, 'config', 'user.name', 'Ignore Test')
  await git(fixture, 'config', 'user.email', 'ignore@example.test')
  await mkdir(join(fixture, 'logs'), { recursive: true })
  await writeFile(join(fixture, '.gitignore'), '# local rules')
  await writeFile(join(fixture, 'base.txt'), 'base\n')
  await git(fixture, 'add', '-A')
  await git(fixture, 'commit', '-q', '-m', 'base')
  await writeFile(join(fixture, 'logs', 'local output.txt'), 'do not delete\n')

  await withSessionServer(join(fixture, 'logs'), async (baseUrl) => {
    const ignored = await callAt(baseUrl, 'ignore', { path: 'logs/local output.txt' })
    assert.equal(ignored.body.ok, true)
    assert.equal(
      await readFile(join(fixture, '.gitignore'), 'utf8'),
      '# local rules\n/logs/local\\ output.txt\n',
    )
    assert.equal(
      await readFile(join(fixture, 'logs', 'local output.txt'), 'utf8'),
      'do not delete\n',
    )
    const status = (await callAt(baseUrl, 'status')).body.value
    assert.deepEqual(
      status.files.map((entry) => entry.path),
      ['.gitignore'],
    )
    assert.equal((await callAt(baseUrl, 'ignore', { path: 'logs/local output.txt' })).body.ok, true)
    assert.equal(
      await readFile(join(fixture, '.gitignore'), 'utf8'),
      '# local rules\n/logs/local\\ output.txt\n',
    )
    const escaped = await callAt(baseUrl, 'ignore', { path: '../outside.txt' })
    assert.equal(escaped.body.error.code, 'path-outside-repository')
  })
})

test('an unborn repository stages, unstages, and takes its first commit', async () => {
  const unborn = await mkdtemp(join(tmpRoot, 'unborn-'))
  await git(unborn, 'init', '-q', '-b', 'main')
  await git(unborn, 'config', 'user.name', 'Unborn Test')
  await git(unborn, 'config', 'user.email', 'unborn@example.test')
  await writeFile(join(unborn, 'first.txt'), 'first file\n')

  await withSessionServer(unborn, async (baseUrl) => {
    let status = await callAt(baseUrl, 'status')
    assert.equal(requireRepo(status.body.value).unborn, true)
    assert.equal(requireRepo(status.body.value).branch, 'main')
    const firstUntracked = status.body.value.files[0]
    assert.ok(firstUntracked, 'the unborn repository reports no untracked file')
    assert.equal(firstUntracked.kind, 'untracked')

    const history = await callAt(baseUrl, 'history')
    assert.deepEqual(history.body.value.commits, [])

    await callAt(baseUrl, 'stage', { paths: ['first.txt'] })
    status = await callAt(baseUrl, 'status')
    const stagedFirst = status.body.value.files[0]
    assert.ok(stagedFirst, 'staging the first file reports no change')
    assert.equal(stagedFirst.x, 'A')

    await callAt(baseUrl, 'unstage', { paths: ['first.txt'] })
    status = await callAt(baseUrl, 'status')
    const unstagedFirst = status.body.value.files[0]
    assert.ok(unstagedFirst, 'unstaging the first file reports no change')
    assert.equal(unstagedFirst.kind, 'untracked')

    const refused = await callAt(baseUrl, 'commit', { message: 'first commit' })
    assert.equal(refused.body.error.code, 'nothing-staged')

    const commit = await callAt(baseUrl, 'commit', { message: 'first commit', stageAll: true })
    assert.equal(commit.body.ok, true)
    status = await callAt(baseUrl, 'status')
    assert.deepEqual(status.body.value.files, [])
    assert.equal(requireRepo(status.body.value).unborn, false)

    const after = await callAt(baseUrl, 'history')
    assert.equal(after.body.value.commits.length, 1)
    const firstCommit = after.body.value.commits[0]
    assert.ok(firstCommit, 'the first commit is missing from history')
    assert.equal(firstCommit.subject, 'first commit')

    const branches = await callAt(baseUrl, 'branches')
    assert.deepEqual(branches.body.value.branches, [{ name: 'main', current: true }])
  })
})

test('a directory outside a repository reports no repository', async () => {
  const outside = join(tmpRoot, 'plain')
  await mkdir(outside, { recursive: true })
  await writeFile(join(outside, 'file.txt'), 'x')
  const host = createFakeContext(outside)
  const other = routeServer(host.routes)
  await new Promise<void>((resolve) => {
    other.listen(0, '127.0.0.1', resolve)
  })
  const endpoint = `http://127.0.0.1:${serverPort(other)}/api/dsh-git-graph/rpc`
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dsh-git-graph': '1' },
      body: JSON.stringify({ sessionId: 'session-1', op: 'status' }),
    })
    const body = (await response.json()) as RpcReply<StatusResult>
    assert.equal(body.ok, true)
    assert.equal(body.value.repo, null)
    const refused = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dsh-git-graph': '1' },
      body: JSON.stringify({ sessionId: 'session-1', op: 'history' }),
    })
    const refusedBody = (await refused.json()) as RpcReply<unknown>
    assert.equal(refusedBody.ok, false)
    assert.equal(refusedBody.error.code, 'not-a-repository')
  } finally {
    await new Promise<void>((resolve) => {
      other.close(() => resolve())
    })
    host.dispose()
  }
})

test('watching reports external edits, staging, commits, fetches, switches and detached checkouts', async () => {
  const watched = await mkdtemp(join(tmpRoot, 'watch-repo-'))
  const remote = await mkdtemp(join(tmpRoot, 'watch-remote-'))
  await git(watched, 'init', '-b', 'main')
  await git(watched, 'config', 'user.name', 'Watch Test')
  await git(watched, 'config', 'user.email', 'watch@example.test')
  await writeFile(join(watched, 'file.txt'), 'one\n')
  await git(watched, 'add', '-A')
  await git(watched, 'commit', '-m', 'initial commit')
  await git(remote, 'init', '--bare', '-b', 'main')
  await git(watched, 'remote', 'add', 'origin', remote)
  await git(watched, 'push', '-q', '-u', 'origin', 'main')
  // Advance the remote from another clone so a later fetch moves origin/main.
  const peer = await mkdtemp(join(tmpRoot, 'watch-peer-'))
  await git(peer, 'clone', '-q', remote, '.')
  await git(peer, 'config', 'user.name', 'Peer')
  await git(peer, 'config', 'user.email', 'peer@example.test')
  await writeFile(join(peer, 'remote.txt'), 'remote\n')
  await git(peer, 'add', '-A')
  await git(peer, 'commit', '-m', 'remote commit')
  await git(peer, 'push', '-q', 'origin', 'main')

  await withSessionServer(watched, async (baseUrl) => {
    const panel = 'watch-panel'
    const initial = await callAt(baseUrl, 'watch', { panel })
    assert.equal(initial.body.ok, true)
    assert.deepEqual(initial.body.value, { watching: true, worktree: 0, references: 0 })

    await writeFile(join(watched, 'file.txt'), 'two\n')
    const edited = await waitForWatch(
      baseUrl,
      panel,
      (state) => state.worktree > initial.body.value.worktree,
    )

    await git(watched, 'add', 'file.txt')
    const staged = await waitForWatch(baseUrl, panel, (state) => state.worktree > edited.worktree)

    await git(watched, 'commit', '-m', 'second commit')
    const committed = await waitForWatch(
      baseUrl,
      panel,
      (state) => state.references > staged.references,
    )

    await git(watched, 'fetch', '-q', 'origin')
    const fetched = await waitForWatch(
      baseUrl,
      panel,
      (state) => state.references > committed.references,
    )

    await git(watched, 'switch', '-q', '-c', 'side')
    const switched = await waitForWatch(
      baseUrl,
      panel,
      (state) => state.references > fetched.references,
    )
    const side = await callAt(baseUrl, 'references')
    assert.equal(side.body.value.current?.id, 'refs/heads/side')

    const head = (await git(watched, 'rev-parse', 'HEAD')).trim()
    await git(watched, 'checkout', '-q', '--detach', head)
    await waitForWatch(baseUrl, panel, (state) => state.references > switched.references)
    const detached = await callAt(baseUrl, 'references')
    assert.equal(detached.body.value.current?.id, head)
    assert.equal(detached.body.value.current?.name, head)
  })
})

test('unwatch releases the repository and a stale subscription expires', async () => {
  const released = await mkdtemp(join(tmpRoot, 'watch-release-'))
  await git(released, 'init', '-b', 'main')
  await git(released, 'config', 'user.name', 'Release Test')
  await git(released, 'config', 'user.email', 'release@example.test')
  await writeFile(join(released, 'file.txt'), 'one\n')
  await git(released, 'add', '-A')
  await git(released, 'commit', '-m', 'initial commit')

  await withSessionServer(released, async (baseUrl) => {
    const initial = await callAt(baseUrl, 'watch', { panel: 'release-panel' })
    assert.equal(initial.body.value.watching, true)
    const removed = await callAt(baseUrl, 'unwatch', { panel: 'release-panel' })
    assert.deepEqual(removed.body.value, { ok: true })
    await writeFile(join(released, 'file.txt'), 'changed\n')
    await sleep(900)
    const fresh = await callAt(baseUrl, 'watch', { panel: 'release-panel-2' })
    assert.deepEqual(fresh.body.value, { watching: true, worktree: 0, references: 0 })
    await callAt(baseUrl, 'unwatch', { panel: 'release-panel-2' })
  })

  // A panel that stops polling (a closed tab) must not keep the Host watching.
  const registry = createRepositoryWatchRegistry({ debounceMs: 40, idleMs: 300 })
  try {
    const started = await registry.watch(released, 'idle-panel')
    assert.equal(started.watching, true)
    await writeFile(join(released, 'other.txt'), 'x')
    await sleep(150)
    // No poll: the subscription lapses and the repository is released.
    await sleep(400)
    await writeFile(join(released, 'late.txt'), 'y')
    await sleep(200)
    const reconnected = await registry.watch(released, 'idle-panel')
    assert.deepEqual(reconnected, { watching: true, worktree: 0, references: 0 })
  } finally {
    registry.dispose()
  }
})

test('watch reports that a directory outside a repository is not watched', async () => {
  const outside = join(tmpRoot, 'plain-watch')
  await mkdir(outside, { recursive: true })
  await withSessionServer(outside, async (baseUrl) => {
    const state = await callAt(baseUrl, 'watch', { panel: 'plain-panel' })
    assert.equal(state.body.ok, true)
    assert.deepEqual(state.body.value, { watching: false, worktree: 0, references: 0 })
    const removed = await callAt(baseUrl, 'unwatch', { panel: 'plain-panel' })
    assert.deepEqual(removed.body.value, { ok: true })
  })
})

test('a burst of working-tree changes becomes one watch update', async () => {
  const burst = await mkdtemp(join(tmpRoot, 'watch-burst-'))
  await git(burst, 'init', '-b', 'main')
  await git(burst, 'config', 'user.name', 'Burst Test')
  await git(burst, 'config', 'user.email', 'burst@example.test')
  await writeFile(join(burst, 'first.txt'), 'one\n')
  await git(burst, 'add', '-A')
  await git(burst, 'commit', '-m', 'initial commit')

  const registry = createRepositoryWatchRegistry({ debounceMs: 80, idleMs: 5000 })
  try {
    const initial = await registry.watch(burst, 'burst-panel')
    assert.equal(initial.watching, true)
    for (let index = 0; index < 8; index += 1) {
      await writeFile(join(burst, `burst-${index}.txt`), `${index}\n`)
    }
    await sleep(300)
    const settled = await registry.watch(burst, 'burst-panel')
    assert.equal(settled.worktree, 1, 'the burst coalesces into one update')
    assert.equal(settled.references, 0, 'a working-tree burst does not move references')
  } finally {
    registry.dispose()
  }
})

test('remotes lists configured remotes in order with their push URLs', async () => {
  const local = await createRemoteRepository('remotes-local-')
  const fetchRemote = await createBareRemote('remotes-fetch-')
  const pushRemote = await createBareRemote('remotes-push-')
  await git(local, 'remote', 'add', 'origin', fetchRemote)
  await git(local, 'remote', 'set-url', '--push', 'origin', pushRemote)
  await git(local, 'remote', 'add', 'upstream', fetchRemote)

  await withSessionServer(local, async (baseUrl) => {
    const listed = await callAt(baseUrl, 'remotes')
    assert.equal(listed.status, 200)
    assert.equal(listed.body.ok, true)
    assert.deepEqual(listed.body.value.remotes, [
      { name: 'origin', fetchUrl: fetchRemote, pushUrl: pushRemote },
      { name: 'upstream', fetchUrl: fetchRemote, pushUrl: fetchRemote },
    ])
  })
})

test('fetch updates every remote and prunes a deleted remote branch', async () => {
  const local = await createRemoteRepository('fetch-local-')
  const bare = await createBareRemote('fetch-bare-')
  await git(local, 'remote', 'add', 'origin', bare)
  await git(local, 'push', '-q', '-u', 'origin', 'main')
  const peer = await createPeer(bare, 'fetch-peer-')
  await writeFile(join(peer, 'remote.txt'), 'remote\n')
  await git(peer, 'add', '-A')
  await git(peer, 'commit', '-q', '-m', 'remote commit')
  await git(peer, 'push', '-q', 'origin', 'main')
  await git(peer, 'push', '-q', 'origin', 'main:refs/heads/topic')
  const remoteMain = (await git(bare, 'rev-parse', 'refs/heads/main')).trim()

  await withSessionServer(local, async (baseUrl) => {
    const fetched = await callAt(baseUrl, 'fetch')
    assert.equal(fetched.status, 200)
    assert.equal(fetched.body.ok, true)
    assert.equal((await git(local, 'rev-parse', 'refs/remotes/origin/main')).trim(), remoteMain)
    assert.equal(await refValue(local, 'refs/remotes/origin/topic'), remoteMain)

    await git(bare, 'branch', '-D', 'topic')
    const pruned = await callAt(baseUrl, 'fetch')
    assert.equal(pruned.body.ok, true)
    assert.equal(
      await refValue(local, 'refs/remotes/origin/topic'),
      null,
      'the fetched prune removed the deleted remote branch',
    )
    assert.equal((await git(local, 'rev-parse', 'refs/remotes/origin/main')).trim(), remoteMain)
  })
})

test('pull merges the upstream into the current branch', async () => {
  const local = await createRemoteRepository('pull-local-')
  const bare = await createBareRemote('pull-bare-')
  await git(local, 'remote', 'add', 'origin', bare)
  await git(local, 'push', '-q', '-u', 'origin', 'main')
  const peer = await createPeer(bare, 'pull-peer-')
  await writeFile(join(peer, 'remote.txt'), 'remote\n')
  await git(peer, 'add', '-A')
  await git(peer, 'commit', '-q', '-m', 'remote commit')
  await git(peer, 'push', '-q', 'origin', 'main')
  await writeFile(join(local, 'local.txt'), 'local\n')
  await git(local, 'add', '-A')
  await git(local, 'commit', '-q', '-m', 'local commit')

  await withSessionServer(local, async (baseUrl) => {
    const pulled = await callAt(baseUrl, 'pull')
    assert.equal(pulled.status, 200)
    assert.equal(pulled.body.ok, true)
    const merged = (await git(local, 'rev-list', '--parents', '-n', '1', 'HEAD')).trim().split(' ')
    assert.equal(merged.length, 3, 'the pull created a merge commit')
    assert.equal(await readFile(join(local, 'remote.txt'), 'utf8'), 'remote\n')
  })
})

test('pull with rebase replays local commits onto the upstream', async () => {
  const local = await createRemoteRepository('rebase-local-')
  const bare = await createBareRemote('rebase-bare-')
  await git(local, 'remote', 'add', 'origin', bare)
  await git(local, 'push', '-q', '-u', 'origin', 'main')
  const peer = await createPeer(bare, 'rebase-peer-')
  await writeFile(join(peer, 'remote.txt'), 'remote\n')
  await git(peer, 'add', '-A')
  await git(peer, 'commit', '-q', '-m', 'remote commit')
  await git(peer, 'push', '-q', 'origin', 'main')
  await writeFile(join(local, 'local.txt'), 'local\n')
  await git(local, 'add', '-A')
  await git(local, 'commit', '-q', '-m', 'local commit')

  await withSessionServer(local, async (baseUrl) => {
    const pulled = await callAt(baseUrl, 'pull', { rebase: true })
    assert.equal(pulled.status, 200)
    assert.equal(pulled.body.ok, true)
    assert.equal((await git(local, 'rev-list', '--count', 'HEAD')).trim(), '3')
    assert.equal(
      (await git(local, 'rev-list', '--merges', '--count', 'HEAD')).trim(),
      '0',
      'the rebase produced no merge commit',
    )
    const subjects = (await git(local, 'log', '--format=%s')).trim().split('\n')
    assert.ok(subjects.includes('local commit'))
    assert.ok(subjects.includes('remote commit'))
  })
})

test('push sends the current branch commits to its upstream', async () => {
  const local = await createRemoteRepository('push-local-')
  const bare = await createBareRemote('push-bare-')
  await git(local, 'remote', 'add', 'origin', bare)
  await git(local, 'push', '-q', '-u', 'origin', 'main')
  await writeFile(join(local, 'local.txt'), 'local\n')
  await git(local, 'add', '-A')
  await git(local, 'commit', '-q', '-m', 'local commit')
  const head = (await git(local, 'rev-parse', 'HEAD')).trim()

  await withSessionServer(local, async (baseUrl) => {
    const pushed = await callAt(baseUrl, 'push')
    assert.equal(pushed.status, 200)
    assert.equal(pushed.body.ok, true)
    assert.equal(await refValue(bare, 'refs/heads/main'), head)
    const status = requireRepo((await callAt(baseUrl, 'status')).body.value)
    assert.equal(status.ahead, 0)
    assert.equal(status.upstream, 'origin/main')
  })
})

test('publish pushes a branch without an upstream and sets it', async () => {
  const local = await createRemoteRepository('publish-local-')
  const bare = await createBareRemote('publish-bare-')
  await git(local, 'remote', 'add', 'upstream', bare)
  const head = (await git(local, 'rev-parse', 'HEAD')).trim()

  await withSessionServer(local, async (baseUrl) => {
    const published = await callAt(baseUrl, 'publish')
    assert.equal(published.status, 200)
    assert.equal(published.body.ok, true)
    assert.equal(await refValue(bare, 'refs/heads/main'), head)
    const status = requireRepo((await callAt(baseUrl, 'status')).body.value)
    assert.equal(status.upstream, 'upstream/main')
    assert.equal(status.ahead, 0)
  })
})

test('publish prefers origin and accepts a chosen remote', async () => {
  const local = await createRemoteRepository('publish-many-')
  const originBare = await createBareRemote('publish-origin-')
  const backupBare = await createBareRemote('publish-backup-')
  await git(local, 'remote', 'add', 'origin', originBare)
  await git(local, 'remote', 'add', 'backup', backupBare)
  const mainHead = (await git(local, 'rev-parse', 'HEAD')).trim()

  await withSessionServer(local, async (baseUrl) => {
    const published = await callAt(baseUrl, 'publish')
    assert.equal(published.body.ok, true)
    assert.equal(await refValue(originBare, 'refs/heads/main'), mainHead)
    assert.equal(await refValue(backupBare, 'refs/heads/main'), null)

    await git(local, 'switch', '-q', '-c', 'topic')
    const topicHead = (await git(local, 'rev-parse', 'HEAD')).trim()
    const chosen = await callAt(baseUrl, 'publish', { remote: 'backup' })
    assert.equal(chosen.body.ok, true)
    assert.equal(await refValue(backupBare, 'refs/heads/topic'), topicHead)
    assert.equal(await refValue(originBare, 'refs/heads/topic'), null)
    assert.equal((await git(local, 'config', '--get', 'branch.topic.remote')).trim(), 'backup')
  })
})

test('publish falls back to the first configured remote without origin', async () => {
  const local = await createRemoteRepository('publish-first-')
  const firstBare = await createBareRemote('publish-first-remote-')
  const secondBare = await createBareRemote('publish-second-remote-')
  await git(local, 'remote', 'add', 'alpha', firstBare)
  await git(local, 'remote', 'add', 'beta', secondBare)
  const head = (await git(local, 'rev-parse', 'HEAD')).trim()

  await withSessionServer(local, async (baseUrl) => {
    const published = await callAt(baseUrl, 'publish')
    assert.equal(published.body.ok, true)
    assert.equal(await refValue(firstBare, 'refs/heads/main'), head)
    assert.equal(await refValue(secondBare, 'refs/heads/main'), null)
  })
})

test('sync pulls the upstream before it pushes', async () => {
  const local = await createRemoteRepository('sync-local-')
  const bare = await createBareRemote('sync-bare-')
  await git(local, 'remote', 'add', 'origin', bare)
  await git(local, 'push', '-q', '-u', 'origin', 'main')
  const peer = await createPeer(bare, 'sync-peer-')
  await writeFile(join(peer, 'remote.txt'), 'remote\n')
  await git(peer, 'add', '-A')
  await git(peer, 'commit', '-q', '-m', 'remote commit')
  await git(peer, 'push', '-q', 'origin', 'main')
  await writeFile(join(local, 'local.txt'), 'local\n')
  await git(local, 'add', '-A')
  await git(local, 'commit', '-q', '-m', 'local commit')

  await withSessionServer(local, async (baseUrl) => {
    const synced = await callAt(baseUrl, 'sync')
    assert.equal(synced.status, 200)
    assert.equal(synced.body.ok, true)
    const head = (await git(local, 'rev-parse', 'HEAD')).trim()
    assert.equal(await refValue(bare, 'refs/heads/main'), head)
    assert.equal(await readFile(join(local, 'remote.txt'), 'utf8'), 'remote\n')
    const merged = (await git(local, 'rev-list', '--parents', '-n', '1', 'HEAD')).trim().split(' ')
    assert.equal(merged.length, 3, 'the sync merged the upstream before pushing')
  })
})

test('a failed pull stops sync before it pushes', async () => {
  const local = await createRemoteRepository('sync-fail-local-')
  const bare = await createBareRemote('sync-fail-bare-')
  await git(local, 'remote', 'add', 'origin', bare)
  await git(local, 'push', '-q', '-u', 'origin', 'main')
  const remoteBefore = await refValue(bare, 'refs/heads/main')
  await writeFile(join(local, 'local.txt'), 'local\n')
  await git(local, 'add', '-A')
  await git(local, 'commit', '-q', '-m', 'local commit')
  // Fetch fails while pushing would still reach the bare remote, so an
  // unchanged remote proves sync never attempted the push.
  await git(local, 'remote', 'set-url', 'origin', join(tmpRoot, 'missing-remote'))
  await git(local, 'remote', 'set-url', '--push', 'origin', bare)

  await withSessionServer(local, async (baseUrl) => {
    const synced = await callAt(baseUrl, 'sync')
    assert.equal(synced.body.ok, false)
    assert.equal(synced.body.error.code, 'git-command-failed')
    assert.equal(
      await refValue(bare, 'refs/heads/main'),
      remoteBefore,
      'the failed pull did not push',
    )
  })
})

test('an upstream whose tracking ref was not fetched still allows push', async () => {
  const local = await createRemoteRepository('upstream-config-local-')
  const bare = await createBareRemote('upstream-config-bare-')
  await git(local, 'remote', 'add', 'origin', bare)
  await git(local, 'push', '-q', '-u', 'origin', 'main')
  await git(local, 'update-ref', '-d', 'refs/remotes/origin/main')

  await withSessionServer(local, async (baseUrl) => {
    const pushed = await callAt(baseUrl, 'push')
    assert.equal(pushed.status, 200)
    assert.equal(pushed.body.ok, true)
    const status = requireRepo((await callAt(baseUrl, 'status')).body.value)
    assert.equal(status.upstream, 'origin/main')
  })
})

test('pull, push, and sync refuse a branch without an upstream', async () => {
  const local = await createRemoteRepository('no-upstream-')
  const bare = await createBareRemote('no-upstream-bare-')
  await git(local, 'remote', 'add', 'origin', bare)

  await withSessionServer(local, async (baseUrl) => {
    for (const op of ['pull', 'push', 'sync'] as const) {
      const refused = await callAt(baseUrl, op)
      assert.equal(refused.status, 409, `operation ${op}`)
      assert.equal(refused.body.ok, false)
      assert.equal(refused.body.error.code, 'no-upstream')
    }
    const fetched = await callAt(baseUrl, 'fetch')
    assert.equal(fetched.body.ok, true, 'fetch does not need an upstream')
  })
})

test('publish refuses a detached HEAD and an unborn branch', async () => {
  const detached = await createRemoteRepository('publish-detached-')
  const detachedBare = await createBareRemote('publish-detached-bare-')
  await git(detached, 'remote', 'add', 'origin', detachedBare)
  await git(detached, 'checkout', '-q', '--detach', 'HEAD')

  const unborn = await mkdtemp(join(tmpRoot, 'publish-unborn-'))
  await git(unborn, 'init', '-q', '-b', 'main')
  const unbornBare = await createBareRemote('publish-unborn-bare-')
  await git(unborn, 'remote', 'add', 'origin', unbornBare)

  await withSessionServer(detached, async (baseUrl) => {
    const refused = await callAt(baseUrl, 'publish')
    assert.equal(refused.status, 409)
    assert.equal(refused.body.error.code, 'no-current-branch')
    assert.equal(await refValue(detachedBare, 'refs/heads/main'), null)
  })
  await withSessionServer(unborn, async (baseUrl) => {
    const refused = await callAt(baseUrl, 'publish')
    assert.equal(refused.status, 409)
    assert.equal(refused.body.error.code, 'unborn-branch')
    assert.equal(await refValue(unbornBare, 'refs/heads/main'), null)
  })
})

test('publish reports an unknown remote and a repository without remotes', async () => {
  const local = await createRemoteRepository('publish-unknown-')
  const bare = await createBareRemote('publish-unknown-bare-')
  await git(local, 'remote', 'add', 'origin', bare)

  const noRemotes = await createRemoteRepository('publish-no-remotes-')

  await withSessionServer(local, async (baseUrl) => {
    const unknown = await callAt(baseUrl, 'publish', { remote: 'missing' })
    assert.equal(unknown.status, 404)
    assert.equal(unknown.body.error.code, 'unknown-remote')
    assert.equal(await refValue(bare, 'refs/heads/main'), null)
  })
  await withSessionServer(noRemotes, async (baseUrl) => {
    const refused = await callAt(baseUrl, 'publish')
    assert.equal(refused.status, 409)
    assert.equal(refused.body.error.code, 'no-remotes')
  })
})

test('publish rejects option-like and malformed remote names before Git runs', async () => {
  const local = await createRemoteRepository('publish-invalid-')
  const bare = await createBareRemote('publish-invalid-bare-')
  await git(local, 'remote', 'add', 'origin', bare)

  const invalidNames: unknown[] = [
    '--force',
    '-o',
    'bad name',
    'bad\tname',
    'bad..name',
    'trailing/',
    'trailing.',
    'name.lock',
    'x'.repeat(201),
    42,
    null,
  ]
  await withSessionServer(local, async (baseUrl) => {
    for (const remote of invalidNames) {
      const refused = await callAt(baseUrl, 'publish', { remote })
      assert.equal(refused.status, 400, `remote ${JSON.stringify(remote)}`)
      assert.equal(refused.body.ok, false)
      assert.equal(refused.body.error.code, 'bad-request')
    }
    assert.equal(await refValue(bare, 'refs/heads/main'), null, 'nothing was pushed')
    const unchanged = await callAt(baseUrl, 'remotes')
    assert.equal(unchanged.body.ok, true)
  })
})

test('add-remote configures a remote and refuses duplicates and invalid input', async () => {
  const local = await createRemoteRepository('add-remote-local-')
  const bare = await createBareRemote('add-remote-bare-')
  const backup = await createBareRemote('add-remote-backup-')

  await withSessionServer(local, async (baseUrl) => {
    const added = await callAt(baseUrl, 'add-remote', { name: 'origin', url: bare })
    assert.equal(added.status, 200)
    assert.deepEqual(added.body.value, { ok: true })
    assert.equal((await git(local, 'remote', 'get-url', 'origin')).trim(), bare)

    const duplicate = await callAt(baseUrl, 'add-remote', { name: 'origin', url: backup })
    assert.equal(duplicate.status, 409)
    assert.equal(duplicate.body.error.code, 'remote-exists')
    assert.equal((await git(local, 'remote', 'get-url', 'origin')).trim(), bare)

    for (const name of ['--force', '-o', 'bad name', 'bad..name', 42, null]) {
      const refused = await callAt(baseUrl, 'add-remote', { name, url: bare })
      assert.equal(refused.status, 400, `name ${JSON.stringify(name)}`)
      assert.equal(refused.body.error.code, 'bad-request')
    }
    for (const url of ['', '-u', '--upload-pack=evil', 'has\nnewline', 'has\tcontrol', 42, null]) {
      const refused = await callAt(baseUrl, 'add-remote', { name: 'backup', url })
      assert.equal(refused.status, 400, `url ${JSON.stringify(url)}`)
      assert.equal(refused.body.error.code, 'bad-request')
    }
    assert.equal((await git(local, 'remote')).trim(), 'origin', 'the repository changed only once')
  })
})

test('remove-remote deletes the remote and refreshes the upstream summary', async () => {
  const local = await createRemoteRepository('remove-remote-local-')
  const bare = await createBareRemote('remove-remote-bare-')
  await git(local, 'remote', 'add', 'origin', bare)
  await git(local, 'push', '-q', '-u', 'origin', 'main')
  const remoteMain = await refValue(local, 'refs/remotes/origin/main')
  assert.ok(remoteMain !== null, 'the push created the remote-tracking branch')

  await withSessionServer(local, async (baseUrl) => {
    const before = requireRepo((await callAt(baseUrl, 'status')).body.value)
    assert.equal(before.upstream, 'origin/main')

    const unknown = await callAt(baseUrl, 'remove-remote', { name: 'missing' })
    assert.equal(unknown.status, 404)
    assert.equal(unknown.body.error.code, 'unknown-remote')
    assert.equal(await refValue(local, 'refs/remotes/origin/main'), remoteMain)

    const removed = await callAt(baseUrl, 'remove-remote', { name: 'origin' })
    assert.equal(removed.status, 200)
    assert.deepEqual(removed.body.value, { ok: true })
    assert.equal((await git(local, 'remote')).trim(), '')
    assert.equal(await refValue(local, 'refs/remotes/origin/main'), null)
    assert.deepEqual((await callAt(baseUrl, 'remotes')).body.value.remotes, [])
    const after = requireRepo((await callAt(baseUrl, 'status')).body.value)
    assert.equal(after.branch, 'main')
    assert.equal(after.upstream, null, 'the removed remote no longer supplies the upstream')

    const again = await callAt(baseUrl, 'remove-remote', { name: 'origin' })
    assert.equal(again.status, 404)
    assert.equal(again.body.error.code, 'unknown-remote')
  })
})

test('branches lists remote-tracking branches without symbolic HEAD and with slashed remotes', async () => {
  const local = await createRemoteRepository('branches-remote-local-')
  const originBare = await createBareRemote('branches-remote-origin-')
  const forkBare = await createBareRemote('branches-remote-fork-')
  const head = (await git(local, 'rev-parse', 'HEAD')).trim()
  await git(local, 'remote', 'add', 'origin', originBare)
  await git(local, 'remote', 'add', 'team/fork', forkBare)
  await git(local, 'update-ref', 'refs/remotes/origin/alpha', head)
  await git(local, 'update-ref', 'refs/remotes/origin/main', head)
  await git(local, 'update-ref', 'refs/remotes/origin/zeta', head)
  await git(local, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')
  await git(local, 'update-ref', 'refs/remotes/team/fork/dev', head)

  await withSessionServer(local, async (baseUrl) => {
    const listed = await callAt(baseUrl, 'branches')
    assert.equal(listed.status, 200)
    assert.deepEqual(listed.body.value.branches, [{ name: 'main', current: true }])
    assert.deepEqual(listed.body.value.remoteBranches, [
      { name: 'origin/alpha', remote: 'origin', branch: 'alpha' },
      { name: 'origin/main', remote: 'origin', branch: 'main' },
      { name: 'origin/zeta', remote: 'origin', branch: 'zeta' },
      { name: 'team/fork/dev', remote: 'team/fork', branch: 'dev' },
    ])
  })
})

test('checkout-remote creates a tracking branch and reuses an existing local branch', async () => {
  const local = await createRemoteRepository('checkout-remote-local-')
  const bare = await createBareRemote('checkout-remote-bare-')
  await git(local, 'remote', 'add', 'origin', bare)
  await git(local, 'push', '-q', '-u', 'origin', 'main')
  const peer = await createPeer(bare, 'checkout-remote-peer-')
  await writeFile(join(peer, 'feature.txt'), 'feature\n')
  await git(peer, 'switch', '-q', '-c', 'feature/a')
  await git(peer, 'add', '-A')
  await git(peer, 'commit', '-q', '-m', 'feature work')
  await git(peer, 'push', '-q', 'origin', 'feature/a')
  await git(peer, 'switch', '-q', 'main')
  await writeFile(join(peer, 'existing.txt'), 'existing\n')
  await git(peer, 'switch', '-q', '-c', 'existing')
  await git(peer, 'add', '-A')
  await git(peer, 'commit', '-q', '-m', 'existing work')
  await git(peer, 'push', '-q', 'origin', 'existing')
  await git(local, 'fetch', '-q', 'origin')
  await git(local, 'branch', 'existing')
  await git(local, 'branch', '--set-upstream-to=origin/main', 'existing')

  await withSessionServer(local, async (baseUrl) => {
    const created = await callAt(baseUrl, 'checkout-remote', {
      remote: 'origin',
      branch: 'feature/a',
    })
    assert.equal(created.status, 200)
    assert.deepEqual(created.body.value, { ok: true, branch: 'feature/a' })
    let status = requireRepo((await callAt(baseUrl, 'status')).body.value)
    assert.equal(status.branch, 'feature/a')
    assert.equal(status.upstream, 'origin/feature/a')
    assert.equal(
      (await git(local, 'rev-parse', 'feature/a')).trim(),
      (await git(local, 'rev-parse', 'origin/feature/a')).trim(),
    )

    await callAt(baseUrl, 'checkout', { branch: 'main' })
    const reused = await callAt(baseUrl, 'checkout-remote', {
      remote: 'origin',
      branch: 'existing',
    })
    assert.equal(reused.status, 200)
    assert.equal(reused.body.value.branch, 'existing')
    status = requireRepo((await callAt(baseUrl, 'status')).body.value)
    assert.equal(status.branch, 'existing')
    assert.equal(status.upstream, 'origin/main', 'the existing upstream stayed unchanged')
    assert.equal((await git(local, 'config', '--get', 'branch.existing.remote')).trim(), 'origin')
    assert.equal(
      (await git(local, 'config', '--get', 'branch.existing.merge')).trim(),
      'refs/heads/main',
    )

    const unknownRemote = await callAt(baseUrl, 'checkout-remote', {
      remote: 'missing',
      branch: 'feature/a',
    })
    assert.equal(unknownRemote.status, 404)
    assert.equal(unknownRemote.body.error.code, 'unknown-remote')
    const unknownBranch = await callAt(baseUrl, 'checkout-remote', {
      remote: 'origin',
      branch: 'no-such-branch',
    })
    assert.equal(unknownBranch.status, 404)
    assert.equal(unknownBranch.body.error.code, 'unknown-remote-branch')
    const headPointer = await callAt(baseUrl, 'checkout-remote', {
      remote: 'origin',
      branch: 'HEAD',
    })
    assert.equal(headPointer.status, 400)
    assert.equal(headPointer.body.error.code, 'bad-request')
    const optionShaped = await callAt(baseUrl, 'checkout-remote', {
      remote: 'origin',
      branch: '--force',
    })
    assert.equal(optionShaped.status, 400)
    assert.equal(optionShaped.body.error.code, 'bad-request')
    const unknownBeforeBranch = await callAt(baseUrl, 'checkout-remote', {
      remote: 'missing',
      branch: '--force',
    })
    assert.equal(unknownBeforeBranch.status, 404)
    assert.equal(unknownBeforeBranch.body.error.code, 'unknown-remote')
  })
})

test('checkout-remote leaves the previous branch when Git refuses the switch', async () => {
  const local = await createRemoteRepository('checkout-remote-fail-local-')
  const bare = await createBareRemote('checkout-remote-fail-bare-')
  await git(local, 'remote', 'add', 'origin', bare)
  await git(local, 'push', '-q', '-u', 'origin', 'main')
  const peer = await createPeer(bare, 'checkout-remote-fail-peer-')
  await git(peer, 'switch', '-q', '-c', 'feature/conflict')
  await writeFile(join(peer, 'shared.txt'), 'remote version\n')
  await git(peer, 'add', '-A')
  await git(peer, 'commit', '-q', '-m', 'conflicting feature')
  await git(peer, 'push', '-q', 'origin', 'feature/conflict')
  await git(local, 'fetch', '-q', 'origin')
  // The local main has no shared.txt, so an untracked file blocks the switch.
  await writeFile(join(local, 'shared.txt'), 'local untracked\n')

  await withSessionServer(local, async (baseUrl) => {
    const refused = await callAt(baseUrl, 'checkout-remote', {
      remote: 'origin',
      branch: 'feature/conflict',
    })
    assert.equal(refused.status, 409)
    assert.equal(refused.body.error.code, 'git-command-failed')
    const status = requireRepo((await callAt(baseUrl, 'status')).body.value)
    assert.equal(status.branch, 'main')
    assert.equal(await readFile(join(local, 'shared.txt'), 'utf8'), 'local untracked\n')
    assert.equal(await refValue(local, 'refs/heads/feature/conflict'), null)
  })
})
