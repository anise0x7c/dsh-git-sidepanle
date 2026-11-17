/**
 * Watch-registry lifecycle: disposal, pending discovery, and per-panel races.
 *
 * These tests replace repository discovery and the watcher factory with
 * deterministic deferred handles, so no test waits for a real timer or Git.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createRepositoryWatchRegistry,
  type WatcherHandle,
  type WatchRegistryDeps,
} from '../src/host/watch/registry.ts'

const IDLE = { watching: false, worktree: 0, references: 0 }

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

/**
 * Build a promise that the test settles explicitly.
 * @returns the promise and its resolver.
 */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

/**
 * Build a watcher factory that records openings and closings.
 * @param opened - paths passed to the factory.
 * @param closed - paths whose watcher was closed.
 * @returns a structural fake for the real watcher factory.
 */
function fakeWatchFactory(
  opened: string[],
  closed: string[] = [],
): NonNullable<WatchRegistryDeps['watch']> {
  return (path) => {
    opened.push(path)
    const handle: WatcherHandle = {
      close: () => {
        closed.push(path)
      },
      on: () => undefined,
    }
    return handle
  }
}

test('dispose during repository discovery is permanent', async (t) => {
  const root = deferred<string | null>()
  const opened: string[] = []
  const registry = createRepositoryWatchRegistry(
    { idleMs: 60_000 },
    {
      findRepositoryRoot: () => root.promise,
      readGitDirectory: async () => '/repo/.git',
      watch: fakeWatchFactory(opened),
    },
  )
  t.after(() => registry.dispose())

  const pending = registry.watch('/workspace', 'panel')
  registry.dispose()
  root.resolve('/repo')

  assert.deepEqual(await pending, IDLE)
  assert.deepEqual(opened, [])
  assert.deepEqual(await registry.watch('/workspace', 'panel'), IDLE)
  assert.deepEqual(opened, [])
})

test('dispose during Git-directory discovery opens no watcher', async (t) => {
  const gitDirectory = deferred<string | null>()
  let startedReading!: () => void
  const reading = new Promise<void>((resolve) => {
    startedReading = resolve
  })
  const opened: string[] = []
  const registry = createRepositoryWatchRegistry(
    { idleMs: 60_000 },
    {
      findRepositoryRoot: async () => '/repo',
      readGitDirectory: () => {
        startedReading()
        return gitDirectory.promise
      },
      watch: fakeWatchFactory(opened),
    },
  )
  t.after(() => registry.dispose())

  const pending = registry.watch('/workspace', 'panel')
  await reading
  registry.dispose()
  gitDirectory.resolve('/repo/.git')

  assert.deepEqual(await pending, IDLE)
  assert.deepEqual(opened, [])
})

test('unwatch before a pending watch settles cancels it', async (t) => {
  const root = deferred<string | null>()
  const opened: string[] = []
  const registry = createRepositoryWatchRegistry(
    { idleMs: 60_000 },
    {
      findRepositoryRoot: () => root.promise,
      readGitDirectory: async (path) => `${path}/.git`,
      watch: fakeWatchFactory(opened),
    },
  )
  t.after(() => registry.dispose())

  const pending = registry.watch('/workspace', 'panel')
  registry.unwatch('panel')
  root.resolve('/repo')

  assert.deepEqual(await pending, IDLE)
  assert.deepEqual(opened, [])

  // A later watch is a new intent and may subscribe normally.
  assert.equal((await registry.watch('/workspace', 'panel')).watching, true)
  assert.equal(opened.length, 3)
})

test('an obsolete pending watch never detaches a newer subscription', async (t) => {
  const roots = new Map<string, Deferred<string | null>>([
    ['/a', deferred()],
    ['/b', deferred()],
  ])
  let discoveries = 0
  const opened: string[] = []
  const closed: string[] = []
  const registry = createRepositoryWatchRegistry(
    { idleMs: 60_000 },
    {
      findRepositoryRoot: (cwd) => {
        discoveries += 1
        return roots.get(cwd)?.promise ?? Promise.resolve(null)
      },
      readGitDirectory: async (root) => `${root}/.git`,
      watch: fakeWatchFactory(opened, closed),
    },
  )
  t.after(() => registry.dispose())

  const older = registry.watch('/a', 'panel')
  const newer = registry.watch('/b', 'panel')

  roots.get('/b')?.resolve('/b')
  assert.equal((await newer).watching, true)
  const openedForNewer = opened.length

  roots.get('/a')?.resolve('/a')
  assert.deepEqual(await older, IDLE)
  assert.equal(opened.length, openedForNewer)

  const beforePoll = discoveries
  assert.equal((await registry.watch('/b', 'panel')).watching, true)
  assert.equal(discoveries, beforePoll)
  assert.equal(opened.length, openedForNewer)
  assert.deepEqual(closed, [])
})

test('a same-cwd poll supersedes a pending move without reopening', async (t) => {
  const rootB = deferred<string | null>()
  let discoveries = 0
  const opened: string[] = []
  const closed: string[] = []
  const registry = createRepositoryWatchRegistry(
    { idleMs: 60_000 },
    {
      findRepositoryRoot: (cwd) => {
        discoveries += 1
        return cwd === '/b' ? rootB.promise : Promise.resolve('/a')
      },
      readGitDirectory: async (root) => `${root}/.git`,
      watch: fakeWatchFactory(opened, closed),
    },
  )
  t.after(() => registry.dispose())

  assert.equal((await registry.watch('/a', 'panel')).watching, true)
  const openedForA = opened.length

  const moving = registry.watch('/b', 'panel')
  assert.equal((await registry.watch('/a', 'panel')).watching, true)
  assert.equal(opened.length, openedForA)

  rootB.resolve('/b')
  assert.deepEqual(await moving, IDLE)
  assert.equal(opened.length, openedForA)
  assert.deepEqual(closed, [])
  assert.equal(discoveries, 2)
})

test('dispose is idempotent and watch stays idle', async (t) => {
  const opened: string[] = []
  const closed: string[] = []
  const registry = createRepositoryWatchRegistry(
    { idleMs: 60_000 },
    {
      findRepositoryRoot: async () => '/repo',
      readGitDirectory: async (root) => `${root}/.git`,
      watch: fakeWatchFactory(opened, closed),
    },
  )
  t.after(() => registry.dispose())

  assert.equal((await registry.watch('/workspace', 'panel')).watching, true)
  const openedCount = opened.length

  registry.dispose()
  registry.dispose()
  registry.unwatch('panel')

  assert.deepEqual(await registry.watch('/workspace', 'panel'), IDLE)
  assert.equal(opened.length, openedCount)
  assert.equal(closed.length, openedCount)
})
