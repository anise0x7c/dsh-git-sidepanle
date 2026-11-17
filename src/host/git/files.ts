/**
 * Direct filesystem access for browser-supplied untracked paths.
 *
 * Git-backed reads and writes deliberately stay in Git. Only untracked
 * previews and deletion touch the filesystem directly, so both walk the parent
 * chain without following links. Previews read through a checked descriptor;
 * deletion unlinks the final entry without following it.
 * Node has no portable `openat`, so a malicious local process that swaps an
 * ancestor directory between the check and the operation is out of scope; the
 * repository and local account are trusted, the browser path is not.
 */
import { constants, type Stats } from 'node:fs'
import { type FileHandle, lstat, open, unlink } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { GitGraphError } from '../errors.ts'
import { runGit } from './exec.ts'
import { resolveRepositoryPath } from './paths.ts'

/** Largest number of untracked bytes a preview reads. */
const MAX_UNTRACKED_BYTES = 512 * 1024

/** Open flag value, tolerating platforms without no-follow or non-blocking. */
const DIRECT_OPEN_FLAGS =
  constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)

/** One direct target: its absolute path and lstat result. */
interface DirectTarget {
  absolute: string
  info: Stats
}

/** Whether an lstat/open failure means the target is simply absent. */
function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

/**
 * Refuse a path whose parent chain contains a symbolic link.
 * @returns false when a parent is missing or not a directory, so the target
 * cannot exist through it.
 */
async function hasOrdinaryParents(root: string, absolute: string, label: string): Promise<boolean> {
  const parts = relative(root, absolute).split(sep)
  let current = root
  for (const part of parts.slice(0, -1)) {
    current = join(current, part)
    let info: Stats
    try {
      info = await lstat(current)
    } catch (error) {
      if (isMissing(error)) return false
      throw error
    }
    if (info.isSymbolicLink()) {
      throw new GitGraphError(
        'path-outside-repository',
        `"${label}" passes through a symbolic link.`,
        400,
      )
    }
    if (!info.isDirectory()) return false
  }
  return true
}

/**
 * Inspect one direct target without following its final link.
 * @returns the target, or undefined when it does not exist.
 */
async function directTarget(root: string, path: string): Promise<DirectTarget | undefined> {
  const absolute = resolveRepositoryPath(root, path)
  if (!(await hasOrdinaryParents(root, absolute, path))) return undefined
  try {
    return { absolute, info: await lstat(absolute) }
  } catch (error) {
    if (isMissing(error)) return undefined
    throw error
  }
}

/**
 * A preview failure that does not distinguish a missing file, a link or
 * another non-regular type through the wire.
 */
function unreadable(path: string): GitGraphError {
  return new GitGraphError('not-found', `"${path}" is not a readable file.`, 404)
}

/** A direct deletion failure for a target that is not an ordinary file or link. */
function notAFile(path: string): GitGraphError {
  return new GitGraphError('not-a-file', `"${path}" is not a file.`, 409)
}

/** Refuse a path that is absent from Git's non-ignored untracked candidates. */
function notUntracked(path: string): GitGraphError {
  return new GitGraphError('not-untracked', `"${path}" is not an untracked, non-ignored file.`, 409)
}

/**
 * Report whether Git's index considers a path untracked.
 *
 * The browser's `untracked` flag is only a request; these commands are the
 * authority for both preview and deletion. A path present in the index is
 * always tracked. Otherwise `ls-files --others` must list the exact path;
 * ignored paths are intentionally not candidates, matching the status list
 * that never offers them.
 * @param root - repository root.
 * @param path - repository-relative path, already validated.
 * @returns whether the path is an untracked, non-ignored working-tree file.
 */
export async function isUntrackedPath(root: string, path: string): Promise<boolean> {
  const cached = await runGit(root, ['ls-files', '--error-unmatch', '--', path])
  if (cached.ok) return false
  if (cached.code === 'ENOENT')
    throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
  if (cached.code !== 1) {
    throw new GitGraphError(
      'git-command-failed',
      cached.stderr.trim() || 'git ls-files failed',
      409,
    )
  }
  const others = await runGit(root, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
    '--',
    path,
  ])
  if (!others.ok) {
    if (others.code === 'ENOENT')
      throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
    throw new GitGraphError(
      'git-command-failed',
      others.stderr.trim() || 'git ls-files --others failed',
      409,
    )
  }
  return others.stdout.split('\0').includes(path)
}

/**
 * Read a bounded untracked preview without following a final link.
 * @param root - repository root.
 * @param path - repository-relative path.
 * @returns the read bytes and whether the file was longer than the cap.
 */
export async function readUntrackedPreview(
  root: string,
  path: string,
): Promise<{ contents: Buffer; truncated: boolean }> {
  const target = await directTarget(root, path)
  if (target === undefined || !target.info.isFile()) throw unreadable(path)
  if (!(await isUntrackedPath(root, path))) throw notUntracked(path)
  let descriptor: FileHandle | undefined
  try {
    // No-follow plus the descriptor stat closes the gap between the lstat above
    // and the read even when a final component is replaced with a link.
    descriptor = await open(target.absolute, DIRECT_OPEN_FLAGS)
    const info = await descriptor.stat()
    if (!info.isFile()) throw unreadable(path)
    const wanted = Math.min(info.size, MAX_UNTRACKED_BYTES)
    const buffer = Buffer.alloc(wanted)
    let bytesRead = 0
    while (bytesRead < wanted) {
      const read = await descriptor.read(buffer, bytesRead, wanted - bytesRead, bytesRead)
      if (read.bytesRead === 0) break
      bytesRead += read.bytesRead
    }
    return { contents: buffer.subarray(0, bytesRead), truncated: info.size > bytesRead }
  } catch (error) {
    if (error instanceof GitGraphError) throw error
    throw unreadable(path)
  } finally {
    await descriptor?.close()
  }
}

/**
 * Delete one path Git reports as untracked.
 *
 * A final symbolic link is removed by `unlink` itself, so its target is never
 * read or changed; a symbolic-link parent is refused before that.
 * @param root - repository root.
 * @param path - repository-relative path.
 * @returns whether a target existed.
 */
export async function removeUntrackedPath(root: string, path: string): Promise<boolean> {
  const target = await directTarget(root, path)
  if (target === undefined) return false
  if (!target.info.isFile() && !target.info.isSymbolicLink()) throw notAFile(path)
  if (!(await isUntrackedPath(root, path))) throw notUntracked(path)
  await unlink(target.absolute)
  return true
}
