/**
 * One filesystem watcher per repository the panel uses, shared by every panel
 * that reads that repository and released with the last of them.
 *
 * The host half runs Git and watches the repository; the browser half cannot.
 * This registry turns filesystem events into two monotonic counters — working
 * tree/index and references — that the browser reads through the guarded RPC.
 * A burst of events is coalesced with a short debounce so one checkout produces
 * one update instead of one per rewritten file.
 *
 * Watchers are lazy: nothing is watched until a panel subscribes, the watchers
 * are shared, and a subscription that stops polling expires so a crashed tab
 * cannot keep the Host watching forever. A watcher that cannot start (or dies)
 * reports `watching: false`, which tells the panel to fall back to its periodic
 * status check; watcher failures are never user-visible.
 */
import { watch as fsWatch } from 'node:fs'
import { join } from 'node:path'
import type { WatchState } from '../../shared/git.ts'
import { findRepositoryRoot, readGitDirectory } from '../git/exec.ts'
import { classifyGitDirectoryEntry, classifyWorktreeEntry, type WatchChange } from './classify.ts'

/** Quiet period before a burst of filesystem events becomes one update. */
export const WATCH_DEBOUNCE_MS = 600

/** Time after the last poll at which a panel's subscription lapses. */
export const WATCH_IDLE_MS = 15_000

/** Optional timings, overridable so tests do not wait for the real values. */
export interface WatchTimings {
  /** Quiet period before a burst becomes one update. */
  readonly debounceMs?: number
  /** Time after the last poll at which a subscription lapses. */
  readonly idleMs?: number
}

/** Minimal filesystem watcher handle owned by the registry. */
export interface WatcherHandle {
  /** Close the watcher, ignoring an already-closed one. */
  close(): void
  /** Listen for watcher failures. */
  on(event: 'error', listener: () => void): unknown
}

/**
 * Optional discovery and watcher injection.
 *
 * Tests use it to hold repository discovery open and to make watcher lifetime
 * observable; the defaults run the real Git lookup and `fs.watch`.
 */
export interface WatchRegistryDeps {
  /** Resolve the repository root containing a directory. */
  readonly findRepositoryRoot?: (cwd: string) => Promise<string | null>
  /** Resolve a repository's Git metadata directory. */
  readonly readGitDirectory?: (root: string) => Promise<string | null>
  /** Start one filesystem watcher. */
  readonly watch?: (
    path: string,
    options: { recursive: boolean; persistent: boolean },
    listener: (event: string, filename: string | null) => void,
  ) => WatcherHandle
}

/** Result for a directory that is not a repository or cannot be watched. */
function idleState(): WatchState {
  return { watching: false, worktree: 0, references: 0 }
}

/** One panel's subscription to a repository. */
interface PanelSubscription {
  /** Session directory the panel polled from. */
  cwd: string
  /** Repository root that directory resolved to. */
  readonly root: string
  /** Last time the panel polled. */
  seenAt: number
}

/** One watched repository and its change counters. */
interface WatchedRepository {
  /** Absolute repository root. */
  readonly root: string
  /** Open filesystem watchers. */
  watchers: WatcherHandle[]
  /** Panel ids currently subscribed. */
  panels: Set<string>
  /** Working tree/index counter. */
  worktree: number
  /** `HEAD`/reference counter. */
  references: number
  /** Whether a working-tree change is waiting for the debounce to finish. */
  pendingWorktree: boolean
  /** Whether a reference change is waiting for the debounce to finish. */
  pendingReferences: boolean
  /** Debounce timer, or null when nothing is pending. */
  flushTimer: ReturnType<typeof setTimeout> | null
  /** Subscription-expiry timer, or null when nothing is scheduled. */
  expiryTimer: ReturnType<typeof setTimeout> | null
  /** Whether the watchers were closed. */
  closed: boolean
}

/** The watch registry the RPC dispatcher borrows. */
export interface RepositoryWatchRegistry {
  /**
   * Subscribe one panel to the repository containing a directory, or refresh
   * an existing subscription and report the current counters.
   * @param cwd - Session working directory.
   * @param panel - panel identity used for the subscription.
   * @returns the repository's counters, or an idle state when it is not watched.
   */
  watch(cwd: string, panel: string): Promise<WatchState>
  /**
   * Remove one panel's subscription, releasing the repository when it was the
   * last one.
   * @param panel - panel identity.
   */
  unwatch(panel: string): void
  /** Close every watcher and timer; the registry cannot be used afterwards. */
  dispose(): void
}

/**
 * Create the watch registry. It owns only filesystem watchers and timers; Git
 * reads happen elsewhere, on demand, when the browser sees a counter move.
 * @param timings - debounce and subscription-lifetime overrides.
 * @param deps - optional discovery and watcher injection for tests.
 * @returns the registry.
 */
export function createRepositoryWatchRegistry(
  timings: WatchTimings = {},
  deps: WatchRegistryDeps = {},
): RepositoryWatchRegistry {
  const debounceMs = timings.debounceMs ?? WATCH_DEBOUNCE_MS
  const idleMs = timings.idleMs ?? WATCH_IDLE_MS
  const discover = deps.findRepositoryRoot ?? findRepositoryRoot
  const readGitDir = deps.readGitDirectory ?? readGitDirectory
  const startWatch: NonNullable<WatchRegistryDeps['watch']> =
    deps.watch ??
    ((path, options, listener) => {
      const watcher = fsWatch(path, options, (event, filename) =>
        listener(event, typeof filename === 'string' ? filename : null),
      )
      return {
        close: () => watcher.close(),
        on: (event, onError) => watcher.on(event, onError),
      }
    })
  const repositories = new Map<string, WatchedRepository>()
  const subscriptions = new Map<string, PanelSubscription>()
  /** Latest watch/unwatch generation per panel; stale async work checks it. */
  const panelTokens = new Map<string, object>()
  let disposed = false
  const now = (): number => Date.now()

  /**
   * Open the three watchers of one repository.
   * @param repo - repository record.
   * @param gitDirectory - absolute Git metadata directory.
   * @returns true when the working-tree and metadata watchers started.
   */
  function open(repo: WatchedRepository, gitDirectory: string): boolean {
    const fail = (): void => {
      closeRepository(repo)
    }
    const rootWatcher = openWatcher(
      repo.root,
      true,
      (filename) => {
        onEntry(repo, classifyWorktreeEntry(filename))
      },
      fail,
    )
    if (rootWatcher === null) return false
    const metadataWatcher = openWatcher(
      gitDirectory,
      false,
      (filename) => {
        onEntry(repo, classifyGitDirectoryEntry(filename))
      },
      fail,
    )
    if (metadataWatcher === null) {
      closeWatchers([rootWatcher])
      return false
    }
    // The refs tree is separate from the metadata directory: branch updates
    // live below it and would otherwise not reach the non-recursive watcher.
    // It is optional, because a repository without a loose-ref directory still
    // writes `packed-refs`, which the metadata watcher covers.
    const refsRoot = join(gitDirectory, 'refs')
    const refsWatcher = openWatcher(
      refsRoot,
      true,
      () => {
        onEntry(repo, 'references')
      },
      fail,
    )
    repo.watchers = [rootWatcher, metadataWatcher, ...(refsWatcher === null ? [] : [refsWatcher])]
    return true
  }

  /**
   * Start one watcher, treating "cannot watch" as an unavailable watcher.
   * @param path - directory to watch.
   * @param recursive - whether to watch the tree below it.
   * @param onEvent - classification callback.
   * @param onFailure - watcher error callback.
   * @returns the watcher, or null when it could not start.
   */
  function openWatcher(
    path: string,
    recursive: boolean,
    onEvent: (filename: string | null) => void,
    onFailure: () => void,
  ): WatcherHandle | null {
    try {
      const watcher = startWatch(path, { recursive, persistent: false }, (_event, filename) => {
        onEvent(filename)
      })
      watcher.on('error', onFailure)
      return watcher
    } catch {
      return null
    }
  }

  /**
   * Close a list of watchers, ignoring watchers that are already gone.
   * @param watchers - watchers to close.
   */
  function closeWatchers(watchers: readonly WatcherHandle[]): void {
    for (const watcher of watchers) {
      try {
        watcher.close()
      } catch {
        // Closing an already-closed watcher is not a failure.
      }
    }
  }

  /**
   * Record one event and restart the debounce window.
   * @param repo - repository that changed.
   * @param change - classification of the event.
   */
  function onEntry(repo: WatchedRepository, change: WatchChange): void {
    if (repo.closed || change === 'ignore') return
    if (change === 'worktree') repo.pendingWorktree = true
    else repo.pendingReferences = true
    if (repo.flushTimer !== null) clearTimeout(repo.flushTimer)
    repo.flushTimer = setTimeout(() => {
      repo.flushTimer = null
      if (repo.closed) return
      if (repo.pendingWorktree) repo.worktree += 1
      if (repo.pendingReferences) repo.references += 1
      repo.pendingWorktree = false
      repo.pendingReferences = false
    }, debounceMs)
    repo.flushTimer.unref?.()
  }

  /**
   * Read one repository's counters.
   * @param repo - repository record.
   * @returns wire value.
   */
  function stateOf(repo: WatchedRepository): WatchState {
    return {
      watching: !repo.closed,
      worktree: repo.worktree,
      references: repo.references,
    }
  }

  /**
   * Release every subscription of one repository and close its watchers.
   * @param repo - repository record.
   */
  function closeRepository(repo: WatchedRepository): void {
    if (repo.closed) return
    repo.closed = true
    if (repo.flushTimer !== null) clearTimeout(repo.flushTimer)
    if (repo.expiryTimer !== null) clearTimeout(repo.expiryTimer)
    repo.flushTimer = null
    repo.expiryTimer = null
    closeWatchers(repo.watchers)
    repo.watchers = []
    for (const panel of repo.panels) subscriptions.delete(panel)
    repo.panels.clear()
    if (repositories.get(repo.root) === repo) repositories.delete(repo.root)
  }

  /**
   * Schedule the next subscription expiration of one repository.
   * @param repo - repository record.
   */
  function scheduleExpiry(repo: WatchedRepository): void {
    if (repo.closed) return
    if (repo.expiryTimer !== null) clearTimeout(repo.expiryTimer)
    repo.expiryTimer = null
    if (repo.panels.size === 0) {
      closeRepository(repo)
      return
    }
    let earliest = Number.POSITIVE_INFINITY
    for (const panel of repo.panels) {
      const subscription = subscriptions.get(panel)
      if (subscription !== undefined) {
        earliest = Math.min(earliest, subscription.seenAt + idleMs)
      }
    }
    if (!Number.isFinite(earliest)) {
      closeRepository(repo)
      return
    }
    repo.expiryTimer = setTimeout(
      () => {
        repo.expiryTimer = null
        expire(repo)
      },
      Math.max(0, earliest - now()),
    )
    repo.expiryTimer.unref?.()
  }

  /**
   * Drop the subscriptions that stopped polling since the last deadline.
   * @param repo - repository record.
   */
  function expire(repo: WatchedRepository): void {
    if (repo.closed) return
    const deadline = now() - idleMs
    for (const panel of [...repo.panels]) {
      const subscription = subscriptions.get(panel)
      if (subscription === undefined || subscription.seenAt <= deadline) {
        subscriptions.delete(panel)
        repo.panels.delete(panel)
      }
    }
    if (repo.panels.size === 0) closeRepository(repo)
    else scheduleExpiry(repo)
  }

  /**
   * Remove one panel's subscription and release the repository if it was last.
   * @param panel - panel identity.
   */
  function detach(panel: string): void {
    const subscription = subscriptions.get(panel)
    if (subscription === undefined) return
    subscriptions.delete(panel)
    const repo = repositories.get(subscription.root)
    if (repo === undefined) return
    repo.panels.delete(panel)
    if (repo.panels.size === 0) closeRepository(repo)
    else scheduleExpiry(repo)
  }

  /**
   * Find or open the watched repository for one root.
   * @param root - repository root.
   * @param gitDirectory - absolute Git metadata directory.
   * @returns repository record, or null when watching is unavailable.
   */
  function obtain(root: string, gitDirectory: string | null): WatchedRepository | null {
    const existing = repositories.get(root)
    if (existing !== undefined && !existing.closed) return existing
    if (gitDirectory === null) return null
    const repo: WatchedRepository = {
      root,
      watchers: [],
      panels: new Set(),
      worktree: 0,
      references: 0,
      pendingWorktree: false,
      pendingReferences: false,
      flushTimer: null,
      expiryTimer: null,
      closed: false,
    }
    if (!open(repo, gitDirectory)) {
      repo.closed = true
      closeWatchers(repo.watchers)
      return null
    }
    repositories.set(root, repo)
    return repo
  }

  return {
    async watch(cwd: string, panel: string): Promise<WatchState> {
      if (disposed) return idleState()
      const token: object = {}
      panelTokens.set(panel, token)
      try {
        // A normal poll refreshes the existing subscription without touching
        // repository discovery or watcher life. It also supersedes any older
        // in-flight request for the same panel.
        const known = subscriptions.get(panel)
        if (known !== undefined && known.cwd === cwd) {
          const repo = repositories.get(known.root)
          if (repo !== undefined && !repo.closed) {
            known.seenAt = now()
            repo.panels.add(panel)
            scheduleExpiry(repo)
            return stateOf(repo)
          }
        }
        const root = await discover(cwd)
        // Disposal and newer watch/unwatch calls win over every pending step.
        if (disposed || panelTokens.get(panel) !== token) return idleState()
        if (root === null) {
          detach(panel)
          return idleState()
        }
        const gitDirectory = await readGitDir(root)
        if (disposed || panelTokens.get(panel) !== token) return idleState()
        // Moving inside the same repository keeps its watchers alive.
        const existing = subscriptions.get(panel)
        if (existing !== undefined && existing.root === root) {
          const repo = repositories.get(root)
          if (repo !== undefined && !repo.closed) {
            existing.cwd = cwd
            existing.seenAt = now()
            repo.panels.add(panel)
            scheduleExpiry(repo)
            return stateOf(repo)
          }
        }
        // Only a current request may replace the old subscription; an obsolete
        // one returning idle must never detach the newer subscription.
        detach(panel)
        const repo = obtain(root, gitDirectory)
        if (repo === null) return idleState()
        repo.panels.add(panel)
        subscriptions.set(panel, { cwd, root, seenAt: now() })
        scheduleExpiry(repo)
        return stateOf(repo)
      } finally {
        if (panelTokens.get(panel) === token) panelTokens.delete(panel)
      }
    },
    unwatch(panel: string): void {
      if (disposed) return
      // Invalidate a watch that is still discovering, then drop what exists.
      panelTokens.delete(panel)
      detach(panel)
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      panelTokens.clear()
      for (const repo of [...repositories.values()]) closeRepository(repo)
      subscriptions.clear()
    },
  }
}
