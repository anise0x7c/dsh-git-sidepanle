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

    // A configured VS Code merge base wins over the default branch.
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
