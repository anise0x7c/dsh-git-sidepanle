/**
 * File-level diffs: reading from Git or the filesystem, and unified-diff parsing.
 */
import type {
  CommitDiff,
  DiffHunk,
  DiffLine,
  ParsedDiff,
  WorkingTreeDiff,
} from '../../shared/git.ts'
import { GitGraphError } from '../errors.ts'
import { runGit } from './exec.ts'
import { readUntrackedPreview } from './files.ts'
import { resolveRepositoryPath } from './paths.ts'

const MAX_DIFF_BYTES = 2 * 1024 * 1024
const FULL_OID = /^[0-9a-f]{40}$/

/** Parsed diff fields plus the Host's truncation flag. */
export interface ReadDiff extends ParsedDiff {
  /** Whether the Host capped the diff size. */
  truncated: boolean
}

/**
 * Run one Git diff command and parse its output.
 * @param root - repository root.
 * @param args - Git arguments after the subcommand.
 * @returns parsed diff fields plus truncation.
 */
async function runDiff(root: string, args: string[]): Promise<ReadDiff> {
  const result = await runGit(root, args)
  if (!result.ok) {
    if (result.code === 'ENOENT')
      throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    throw new GitGraphError('git-command-failed', result.stderr.trim() || 'git diff failed', 409)
  }
  const truncated = result.stdout.length > MAX_DIFF_BYTES
  const text = truncated ? result.stdout.slice(0, MAX_DIFF_BYTES) : result.stdout
  return { truncated, ...parseUnifiedDiff(text) }
}

/**
 * Read one file comparison as a unified diff.
 * @param root - repository root.
 * @param path - repository-relative path.
 * @param staged - compare the index instead of the working tree.
 * @param untracked - render the file's content as additions.
 * @returns diff payload.
 */
export async function readDiff(
  root: string,
  path: string,
  staged: boolean,
  untracked: boolean,
): Promise<WorkingTreeDiff> {
  resolveRepositoryPath(root, path)
  // The browser's flag is a request. A path Git still reports as untracked is
  // read directly; a tracked path is refused with `not-untracked` rather than
  // silently rendered as another diff, so the mismatch is never hidden.
  if (untracked) {
    const { contents, truncated } = await readUntrackedPreview(root, path)
    if (contents.includes(0)) {
      return {
        path,
        staged: false,
        untracked: true,
        binary: true,
        truncated,
        additions: 0,
        deletions: 0,
        hunks: [],
      }
    }
    const text = contents.toString('utf8')
    const lines = text.split('\n')
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    return {
      path,
      staged: false,
      untracked: true,
      binary: false,
      truncated,
      additions: lines.length,
      deletions: 0,
      hunks: [
        {
          header: `@@ -0,0 +1,${lines.length} @@`,
          oldStart: 0,
          oldCount: 0,
          newStart: 1,
          newCount: lines.length,
          lines: lines.map(
            (lineText, index): DiffLine => ({ t: '+', text: lineText, newLine: index + 1 }),
          ),
        },
      ],
    }
  }
  const diff = await runDiff(root, [
    'diff',
    '--no-color',
    '--no-ext-diff',
    '--no-textconv',
    '--unified=3',
    ...(staged ? ['--cached'] : []),
    '--',
    path,
  ])
  return { path, staged, untracked: false, ...diff }
}

/**
 * Read the diff one commit introduced into one file.
 *
 * The comparison is against the commit's first parent, or against the empty
 * tree for a root commit, so a merge commit shows what it brought into the
 * checked-out line of history. A rename's original path is included as a
 * pathspec so Git can detect the pair instead of reading the new path alone as
 * an addition.
 * @param root - repository root.
 * @param path - repository-relative path in the commit.
 * @param oid - full commit identifier.
 * @param origPath - repository-relative original path of a rename.
 * @returns diff payload scoped to the commit.
 */
export async function readCommitDiff(
  root: string,
  path: string,
  oid: string,
  origPath?: string,
): Promise<CommitDiff> {
  if (typeof oid !== 'string' || !FULL_OID.test(oid)) {
    throw new GitGraphError('bad-request', 'A full commit identifier is required.', 400)
  }
  resolveRepositoryPath(root, path)
  if (origPath !== undefined) resolveRepositoryPath(root, origPath)
  const verified = await runGit(root, ['rev-parse', '--verify', '--quiet', `${oid}^{commit}`])
  if (!verified.ok) {
    if (verified.code === 'ENOENT')
      throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    throw new GitGraphError('unknown-commit', `No commit "${oid}" exists in this repository.`, 404)
  }
  const lineage = await runGit(root, ['rev-list', '--parents', '-n', '1', oid])
  if (!lineage.ok) {
    if (lineage.code === 'ENOENT')
      throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    throw new GitGraphError(
      'git-command-failed',
      lineage.stderr.trim() || 'git rev-list failed',
      409,
    )
  }
  const parent = lineage.stdout.trim().split(' ')[1]
  const paths = origPath === undefined || origPath === path ? [path] : [origPath, path]
  const common = ['-M', '--no-color', '--no-ext-diff', '--no-textconv', '--unified=3']
  const diff =
    parent === undefined
      ? await runDiff(root, [
          'diff-tree',
          '-p',
          '--root',
          '--no-commit-id',
          ...common,
          oid,
          '--',
          ...paths,
        ])
      : await runDiff(root, ['diff', ...common, parent, oid, '--', ...paths])
  return { path, commit: oid, ...diff }
}

/**
 * Parse unified diff text into hunks.
 *
 * Only hunk lines are interpreted: `---`/`+++` name the compared files, a
 * `\ No newline at end of file` marker is not a change line, and content
 * outside a hunk (such as `index` or `diff --git` lines) is skipped.
 *
 * @param text - `git diff` output.
 * @returns parsed diff.
 */
export function parseUnifiedDiff(text: string): ParsedDiff {
  const lines = text.split('\n')
  const hunks: DiffHunk[] = []
  let current: DiffHunk | null = null
  let additions = 0
  let deletions = 0
  let oldPath: string | undefined
  let newPath: string | undefined
  let renameFrom: string | undefined
  let renameTo: string | undefined
  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      current = null
      continue
    }
    if (line.startsWith('rename from ')) {
      renameFrom = line.slice('rename from '.length)
      continue
    }
    if (line.startsWith('rename to ')) {
      renameTo = line.slice('rename to '.length)
      continue
    }
    if (line.startsWith('--- ')) {
      oldPath = line.slice(4).replace(/^a\//, '')
      continue
    }
    if (line.startsWith('+++ ')) {
      newPath = line.slice(4).replace(/^b\//, '')
      continue
    }
    if (line.startsWith('@@ ')) {
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(line)
      if (match === null) continue
      current = {
        header: line,
        oldStart: Number(match[1]),
        oldCount: match[2] === undefined ? 1 : Number(match[2]),
        newStart: Number(match[3]),
        newCount: match[4] === undefined ? 1 : Number(match[4]),
        lines: [],
      }
      hunks.push(current)
      continue
    }
    if (current === null) continue
    const marker = line.charAt(0)
    if (marker === ' ') {
      current.lines.push({ t: ' ', text: line.slice(1) })
    } else if (marker === '-') {
      current.lines.push({ t: '-', text: line.slice(1) })
      deletions += 1
    } else if (marker === '+') {
      current.lines.push({ t: '+', text: line.slice(1) })
      additions += 1
    }
  }
  return {
    binary: /Binary files .* differ/.test(text) || text.startsWith('GIT binary patch'),
    additions,
    deletions,
    ...(oldPath === undefined ? {} : { oldPath }),
    ...(newPath === undefined ? {} : { newPath }),
    ...(renameFrom === undefined ? {} : { renameFrom }),
    ...(renameTo === undefined ? {} : { renameTo }),
    hunks,
  }
}
