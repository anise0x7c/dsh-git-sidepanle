/**
 * Wire contract between the Host RPC half and the browser half.
 *
 * These declarations are the single source of truth for the JSON values that
 * cross `/api/dsh-git-graph/rpc`. They are type-only: importing this module
 * emits no JavaScript, so the Host bundle and the browser bundle both stay
 * unchanged.
 */

/** Porcelain family of one changed-file row. */
export type ChangeKind = 'ordinary' | 'renamed' | 'unmerged' | 'untracked'

/**
 * One changed-file row as the `status` operation reports it.
 *
 * `conflict` and `untracked` are always present so the browser can branch on
 * them without a second lookup.
 */
export interface ChangeEntry {
  /** Porcelain family. */
  kind: ChangeKind
  /** Index status character, or `.` when unchanged. */
  x: string
  /** Worktree status character, or `.` when unchanged. */
  y: string
  /** Repository-relative path. */
  path: string
  /** Rename/copy source path, omitted when the row is not a rename/copy. */
  origPath?: string
  /** Whether the row is an unmerged conflict. */
  conflict: boolean
  /** Whether the row is untracked. */
  untracked: boolean
}

/**
 * Repository summary from porcelain-v2 `# branch.*` headers.
 *
 * `parseStatus` starts with `root: ''`; `readStatus` fills the absolute root
 * when it can resolve one.
 */
export interface RepositoryInfo {
  /** Absolute repository root. */
  root: string
  /** Current local branch, or null for a detached HEAD. */
  branch: string | null
  /** Whether HEAD is detached. */
  detached: boolean
  /** Whether the branch has no commits yet. */
  unborn: boolean
  /** Upstream ref, or null when the branch has none. */
  upstream: string | null
  /** Commits ahead of the upstream. */
  ahead: number
  /** Commits behind the upstream. */
  behind: number
  /** Full HEAD commit id, or null on an unborn branch. */
  headOid: string | null
}

/** Repository summary joined with the Session working directory it was read in. */
export interface RepositoryStatus extends RepositoryInfo {
  /** Absolute Session working directory, which may be a repository subdirectory. */
  cwd: string
}

/**
 * Value of the `status` operation.
 *
 * Outside a repository the read cannot fill `repo`, so the working directory
 * travels in the top-level `cwd` instead. Inside one, `repo.cwd` carries it and
 * the top-level field is omitted.
 */
export type StatusResult =
  | {
      /** Repository summary. */
      repo: RepositoryStatus
      /** Absolute Session working directory; omitted because `repo.cwd` carries it. */
      cwd?: string
      /** Changed files, path-unordered as Git reports them. */
      files: ChangeEntry[]
    }
  | {
      /** No repository contains the working directory. */
      repo: null
      /** Absolute Session working directory. */
      cwd: string
      /** Always empty outside a repository. */
      files: ChangeEntry[]
    }

/** One commit row of the commit graph. */
export interface CommitSummary {
  /** Full commit id. */
  oid: string
  /** Abbreviated commit id. */
  shortOid: string
  /** Author name. */
  author: string
  /** Author timestamp in Unix seconds. */
  authoredAt: number
  /**
   * Full decoration string, for example
   * `HEAD -> refs/heads/main, refs/remotes/origin/main, tag: refs/tags/v1`.
   */
  refs: string
  /** Parent ids, first parent first; empty for a root commit. */
  parents: string[]
  /** Subject line. */
  subject: string
}

/** Commit metadata returned by `commit-details`. */
export interface CommitDetailsCommit extends CommitSummary {
  /** Commit body without the trailing newlines Git appends. */
  body: string
}

/** One file a commit changed. */
export interface ChangedFile {
  /** Repository-relative path in the commit. */
  path: string
  /** Git name-status letter (`A`, `M`, `D`, `R`, `C`, `T`). */
  letter: string
  /** Original path of a rename/copy, omitted otherwise. */
  origPath?: string
}

/** Value of the `commit-details` operation. */
export interface CommitDetails {
  /** Commit metadata. */
  commit: CommitDetailsCommit
  /** Changed files in Git's order, capped at the Host limit. */
  files: ChangedFile[]
  /** Whether the file list was capped. */
  truncated: boolean
}

/** One reference the commit graph gives a fixed color. */
export interface GraphReference {
  /** Full ref name such as `refs/heads/main`, or the commit id of a detached HEAD. */
  id: string
  /** Display name such as `main` or `origin/main`. */
  name: string
  /** Full id of the commit the reference points at. */
  revision: string
}

/**
 * The references VS Code's Source Control Graph colors specially: the
 * checked-out branch (blue), its upstream (purple) and its base branch
 * (orange). Each is null when the repository has none.
 */
export interface GraphReferences {
  /** Checked-out branch, or the detached HEAD commit. */
  current: GraphReference | null
  /** Upstream of the checked-out branch. */
  remote: GraphReference | null
  /** Base branch of the checked-out branch, when it differs from the upstream. */
  base: GraphReference | null
}

/** Value of the `history` operation. */
export interface HistoryResult {
  /** Graph rows in topological display order. */
  commits: CommitSummary[]
  /** References with fixed graph colors. */
  references: GraphReferences
}

/** One local branch. */
export interface BranchInfo {
  /** Branch name without `refs/heads/`. */
  name: string
  /** Whether the branch is checked out. */
  current: boolean
}

/** Value of the `branches` operation. */
export interface BranchesResult {
  /** Local branches in Git's ref order. */
  branches: BranchInfo[]
}

/** One line of a unified-diff hunk. */
export interface DiffLine {
  /** `' '` context, `'-'` deletion, `'+'` addition. */
  t: ' ' | '-' | '+'
  /** Line content without the marker. */
  text: string
  /** One-based line number for an untracked file's rendered additions. */
  newLine?: number
}

/** One unified-diff hunk. */
export interface DiffHunk {
  /** Full `@@` header line. */
  header: string
  /** First old line number. */
  oldStart: number
  /** Old line count. */
  oldCount: number
  /** First new line number. */
  newStart: number
  /** New line count. */
  newCount: number
  /** Hunk body lines. */
  lines: DiffLine[]
}

/** Fields parsed from unified-diff text. */
export interface ParsedDiff {
  /** Whether Git reported a binary diff. */
  binary: boolean
  /** Number of added lines. */
  additions: number
  /** Number of deleted lines. */
  deletions: number
  /** Compared old path, without its `a/` prefix, when Git named one. */
  oldPath?: string
  /** Compared new path, without its `b/` prefix, when Git named one. */
  newPath?: string
  /** Rename source, when Git reported one. */
  renameFrom?: string
  /** Rename destination, when Git reported one. */
  renameTo?: string
  /** Parsed hunks. */
  hunks: DiffHunk[]
}

/** Value of a `diff` operation for a working-tree file. */
export interface WorkingTreeDiff extends ParsedDiff {
  /** Repository-relative path that was compared. */
  path: string
  /** Whether the index was compared instead of the working tree. */
  staged: boolean
  /** Whether the file was rendered as untracked additions. */
  untracked: boolean
  /** Whether the Host capped the diff size. */
  truncated: boolean
}

/** Value of a `diff` operation for a file in one commit. */
export interface CommitDiff extends ParsedDiff {
  /** Repository-relative path in the commit. */
  path: string
  /** Full commit id whose change was compared. */
  commit: string
  /** Whether the Host capped the diff size. */
  truncated: boolean
}

/** Value of the `diff` operation. */
export type DiffResult = WorkingTreeDiff | CommitDiff

/** Value of an operation that only reports success. */
export interface OkResult {
  ok: true
}

/** Value of the `commit` operation. */
export interface CommitResult {
  ok: true
  /** Short HEAD id, or null when it could not be read. */
  commit: string | null
}

/** Value of the `checkout` operation. */
export interface CheckoutResult {
  ok: true
  /** Branch that is now checked out. */
  branch: string
}

/** Result type of every RPC operation, keyed by operation name. */
export interface GitGraphRpcValues {
  status: StatusResult
  history: HistoryResult
  'commit-details': CommitDetails
  branches: BranchesResult
  stage: OkResult
  unstage: OkResult
  discard: OkResult
  commit: CommitResult
  checkout: CheckoutResult
  diff: DiffResult
}

/** Every operation the Host dispatcher accepts. */
export type GitGraphOperation = keyof GitGraphRpcValues

/** Union of every operation value. */
export type GitGraphRpcValue = GitGraphRpcValues[GitGraphOperation]

/** Operation arguments, excluding the Session identity both halves add. */
export interface GitGraphPayloads {
  status: Record<never, never>
  history: Record<never, never>
  'commit-details': { oid: string }
  branches: Record<never, never>
  stage: { paths: string[] }
  unstage: { paths: string[] }
  discard: { path: string; untracked?: boolean }
  commit: { message: string; stageAll?: boolean }
  checkout: { branch: string }
  diff: { path: string; staged?: boolean; untracked?: boolean; commit?: string; origPath?: string }
}

/** One complete RPC request body. */
export type GitGraphRequest = {
  [Operation in GitGraphOperation]: {
    sessionId: string
    op: Operation
  } & GitGraphPayloads[Operation]
}[GitGraphOperation]

/** Failure envelope. */
export interface RpcErrorBody {
  ok: false
  error: { code: string; message: string }
}

/** Success envelope. */
export interface RpcSuccessBody {
  ok: true
  value: GitGraphRpcValue
}

/** Any RPC response body. */
export type RpcResponseBody = RpcSuccessBody | RpcErrorBody
