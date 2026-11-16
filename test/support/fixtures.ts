/**
 * Shared Host response fixtures for the browser-half tests.
 *
 * These mirror the `status`, `history`, and `branches` RPC values the Host
 * returns. Tests that need a variation build it from the shared repository
 * record (`createRepo`) and the shared file list, so every default record stays
 * identical across the suite.
 */
import type {
  BranchesResult,
  CommitDetails,
  HistoryResult,
  RepositoryStatus,
  StatusResult,
} from '../../src/shared/git.ts'

/** Seconds captured once per test process, so relative commit times stay stable. */
const now = Math.floor(Date.now() / 1000)

/** Repository record of a successful status call (`cwd` may sit below `root`). */
export const REPO: RepositoryStatus = {
  root: '/repo',
  cwd: '/repo',
  branch: 'main',
  detached: false,
  unborn: false,
  upstream: 'origin/main',
  ahead: 2,
  behind: 1,
  headOid: '0123456789abcdef',
}

/** Default `status` response: an ordinary change, an untracked file, and a conflict. */
export const STATUS: StatusResult = {
  repo: REPO,
  files: [
    { kind: 'ordinary', x: 'M', y: 'M', path: 'src/app.js', conflict: false, untracked: false },
    { kind: 'untracked', x: '?', y: '?', path: 'README.md', conflict: false, untracked: true },
    { kind: 'unmerged', x: 'U', y: 'U', path: 'merge.txt', conflict: true, untracked: false },
  ],
}

/**
 * Default `history` response: the checked-out commit carrying its branch and
 * upstream, and one tagged root commit.
 */
export const HISTORY: HistoryResult = {
  commits: [
    {
      oid: 'a'.repeat(40),
      shortOid: 'aaaaaaa',
      author: 'Ann',
      authoredAt: now - 120,
      refs: 'HEAD -> refs/heads/main, refs/remotes/origin/main',
      subject: 'Fix the sidebar',
      parents: ['b'.repeat(40)],
    },
    {
      oid: 'b'.repeat(40),
      shortOid: 'bbbbbbb',
      author: 'Bob',
      authoredAt: now - 7200,
      refs: 'tag: refs/tags/v1.0',
      subject: 'Initial commit',
      parents: [],
    },
  ],
  references: {
    current: { id: 'refs/heads/main', name: 'main', revision: 'a'.repeat(40) },
    remote: { id: 'refs/remotes/origin/main', name: 'origin/main', revision: 'a'.repeat(40) },
    base: null,
  },
}

/**
 * Build a branch-list response.
 * @param names - branch names in display order.
 * @param current - name rendered as current; defaults to the first.
 * @returns `branches` RPC value.
 */
export function createBranches(names: string[], current: string = names[0] ?? ''): BranchesResult {
  return { branches: names.map((name) => ({ name, current: name === current })) }
}

/** Default `branches` response: the checked-out branch plus one other local branch. */
export const BRANCHES: BranchesResult = createBranches(['main', 'feature/sidebar'])

/** Default `commit-details` response for the head commit of `HISTORY`. */
export const COMMIT_DETAILS: CommitDetails = {
  commit: {
    oid: 'a'.repeat(40),
    shortOid: 'aaaaaaa',
    author: 'Ann',
    authoredAt: now - 120,
    refs: 'HEAD -> refs/heads/main, refs/remotes/origin/main',
    parents: ['b'.repeat(40)],
    subject: 'Fix the sidebar',
    body: 'A longer explanation of the fix.',
  },
  files: [
    { path: 'src/app.js', letter: 'M' },
    { path: 'src/added.js', letter: 'A' },
    { path: 'src/renamed.js', origPath: 'src/old.js', letter: 'R' },
    { path: 'docs/gone.md', letter: 'D' },
  ],
  truncated: false,
}

/**
 * Build a repository record from the shared one.
 * @param overrides - fields to replace (`cwd`, `upstream`, ...).
 * @returns repository record.
 */
export function createRepo(overrides: Partial<RepositoryStatus> = {}): RepositoryStatus {
  return { ...REPO, ...overrides }
}

/**
 * Build a `status` response.
 *
 * The wire omits top-level `cwd` when the repository resolved, so the two
 * variants stay distinct instead of always carrying both fields.
 * @param options - overrides.
 * @param options.repo - repository record; null means "not a repository".
 * @param options.files - changed-file records.
 * @param options.cwd - top-level Session directory the Host reports.
 * @returns `status` RPC value.
 */
export function createStatus({
  repo = REPO,
  files = [],
  cwd,
}: {
  repo?: RepositoryStatus | null
  files?: StatusResult['files']
  cwd?: string
} = {}): StatusResult {
  if (repo === null) return { repo: null, cwd: cwd ?? '/tmp/plain', files }
  return cwd === undefined ? { repo, files } : { repo, files, cwd }
}
