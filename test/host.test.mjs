/**
 * Host-half tests for the Git source-control bundle.
 *
 * The route is exercised over a real loopback HTTP server, so the trust fence,
 * body handling, JSON envelope, and every Git operation run exactly as the
 * browser will call them.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFile as execFileCallback } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { promisify } from 'node:util'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apply } from '../index.js'

const execFile = promisify(execFileCallback)
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const tmpRoot = join(packageRoot, '.tmp-test')

/** @type {string} */
let repo
/** @type {import('node:http').Server} */
let server
/** @type {string} */
let base

async function git(cwd, ...args) {
  const { stdout } = await execFile('git', args, { cwd })
  return stdout
}

function createFakeContext(cwd) {
  const routes = new Map()
  const ctx = {
    effect(callback) {
      const disposer = callback()
      return () => { if (typeof disposer === 'function') disposer() }
    },
    webServer: {
      register(route) {
        if (routes.has(route.path)) throw new Error(`duplicate route ${route.path}`)
        routes.set(route.path, route)
        return () => { routes.delete(route.path) }
      },
    },
    get(name) {
      if (name === 'sessions') return { get: (id) => (id === 'session-1' ? { header: { cwd } } : undefined) }
      if (name === 'workingDirectory') return { get: () => cwd }
      if (name === 'sessionPersistence') return { stat: async (id) => (id === 'session-1' ? { header: { cwd } } : undefined) }
      return undefined
    },
  }
  apply(ctx)
  return routes
}

async function call(op, payload = {}, options = {}) {
  const headers = { 'content-type': 'application/json', ...(options.untrusted === true ? {} : { 'x-dsh-git-graph': '1' }) }
  const response = await fetch(`${base}/api/dsh-git-graph/rpc`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId: 'session-1', op, ...payload }),
  })
  const body = await response.json()
  return { status: response.status, body }
}

before(async () => {
  await rm(tmpRoot, { recursive: true, force: true })
  await mkdir(tmpRoot, { recursive: true })
  repo = await mkdtemp(join(tmpRoot, 'repo-'))
  await git(repo, 'init', '-b', 'main')
  await git(repo, 'config', 'user.name', 'Git Graph Test')
  await git(repo, 'config', 'user.email', 'git-graph@example.test')
  await writeFile(join(repo, 'alpha.txt'), 'one\ntwo\n')
  await git(repo, 'add', '-A')
  await git(repo, 'commit', '-m', 'initial commit')

  const routes = createFakeContext(repo)
  server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    const route = routes.get(path)
    if (route === undefined) {
      response.writeHead(404)
      response.end()
      return
    }
    void route.handler(request, response)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  base = `http://127.0.0.1:${address.port}`
})

after(async () => {
  if (server !== undefined) await new Promise((resolve) => server.close(resolve))
  await rm(tmpRoot, { recursive: true, force: true })
})

test('health route answers only trusted loopback requests', async () => {
  const trusted = await fetch(`${base}/api/dsh-git-graph/health`, { headers: { 'x-dsh-git-graph': '1' } })
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
  assert.equal(body.value.repo.root, repo)
  assert.equal(body.value.repo.branch, 'main')
  assert.equal(body.value.repo.unborn, false)
  assert.deepEqual(body.value.files, [])

  await writeFile(join(repo, 'alpha.txt'), 'one\nTWO\n')
  await writeFile(join(repo, 'beta.txt'), 'new file\n')
  const next = await call('status')
  const files = next.body.value.files
  const alpha = files.find((file) => file.path === 'alpha.txt')
  const beta = files.find((file) => file.path === 'beta.txt')
  assert.equal(alpha.kind, 'ordinary')
  assert.equal(alpha.x, '.')
  assert.equal(alpha.y, 'M')
  assert.equal(beta.kind, 'untracked')
  assert.equal(beta.untracked, true)
})

test('stage, unstage, diff, commit, and history work end to end', async () => {
  const staged = await call('stage', { paths: ['alpha.txt'] })
  assert.equal(staged.body.ok, true)
  let status = (await call('status')).body.value
  assert.equal(status.files.find((file) => file.path === 'alpha.txt').x, 'M')

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
  assert.equal(untrackedDiff.body.value.hunks[0].lines[0].t, '+')

  await call('unstage', { paths: ['alpha.txt'] })
  status = (await call('status')).body.value
  assert.equal(status.files.find((file) => file.path === 'alpha.txt').x, '.')

  const emptyCommit = await call('commit', { message: '   ' })
  assert.equal(emptyCommit.body.ok, false)
  assert.equal(emptyCommit.body.error.code, 'empty-message')

  const refusedCommit = await call('commit', { message: 'nothing staged yet' })
  assert.equal(refusedCommit.body.ok, false)
  assert.equal(refusedCommit.body.error.code, 'nothing-staged')

  const commit = await call('commit', { message: 'change alpha and add beta', stageAll: true })
  assert.equal(commit.body.ok, true)
  assert.match(commit.body.value.commit, /^[0-9a-f]{7,}$/)

  status = (await call('status')).body.value
  assert.deepEqual(status.files, [])

  const history = await call('history')
  assert.equal(history.body.ok, true)
  assert.equal(history.body.value.commits.length, 2)
  assert.equal(history.body.value.commits[0].subject, 'change alpha and add beta')
  assert.equal(history.body.value.commits[0].refs.includes('main'), true)
  assert.match(history.body.value.commits[0].graph, /^\*/)

  const badOp = await call('nonsense')
  assert.equal(badOp.body.ok, false)
  assert.equal(badOp.body.error.code, 'unknown-operation')
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

  const escape = await call('discard', { path: '../outside.txt', untracked: true })
  assert.equal(escape.body.ok, false)
  assert.equal(escape.body.error.code, 'path-outside-repository')
})

test('branches list and checkout switch the worktree', async () => {
  const branches = await call('branches')
  assert.equal(branches.body.ok, true)
  assert.deepEqual(branches.body.value.branches, [{ name: 'main', current: true }])

  await git(repo, 'branch', 'feature/sidebar')
  const listed = await call('branches')
  assert.deepEqual(listed.body.value.branches.map((branch) => branch.name), ['feature/sidebar', 'main'])

  const switched = await call('checkout', { branch: 'feature/sidebar' })
  assert.equal(switched.body.ok, true)
  const status = (await call('status')).body.value
  assert.equal(status.repo.branch, 'feature/sidebar')

  const missing = await call('checkout', { branch: 'no-such-branch' })
  assert.equal(missing.body.ok, false)
  assert.equal(missing.body.error.code, 'unknown-branch')

  const optionShaped = await call('checkout', { branch: '--force' })
  assert.equal(optionShaped.body.ok, false)
  assert.equal(optionShaped.body.error.code, 'bad-request')
})

test('a directory outside a repository reports no repository', async () => {
  const outside = join(tmpRoot, 'plain')
  await mkdir(outside, { recursive: true })
  await writeFile(join(outside, 'file.txt'), 'x')
  const routes = createFakeContext(outside)
  const other = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    const route = routes.get(path)
    if (route === undefined) {
      response.writeHead(404)
      response.end()
      return
    }
    void route.handler(request, response)
  })
  await new Promise((resolve) => other.listen(0, '127.0.0.1', resolve))
  const address = other.address()
  const response = await fetch(`http://127.0.0.1:${address.port}/api/dsh-git-graph/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dsh-git-graph': '1' },
    body: JSON.stringify({ sessionId: 'session-1', op: 'status' }),
  })
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.equal(body.value.repo, null)
  const refused = await fetch(`http://127.0.0.1:${address.port}/api/dsh-git-graph/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dsh-git-graph': '1' },
    body: JSON.stringify({ sessionId: 'session-1', op: 'history' }),
  })
  const refusedBody = await refused.json()
  assert.equal(refusedBody.ok, false)
  assert.equal(refusedBody.error.code, 'not-a-repository')
  await new Promise((resolve) => other.close(resolve))
})
