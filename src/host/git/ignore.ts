import { constants } from 'node:fs'
import { type FileHandle, lstat, open } from 'node:fs/promises'
import { join } from 'node:path'
import { GitGraphError } from '../errors.ts'

/**
 * Reject an ignore target Git itself would not read as a normal working-tree file.
 * @returns a failure without revealing a symbolic link's destination.
 */
function notAFile(): GitGraphError {
  return new GitGraphError(
    'ignore-not-a-file',
    'The .gitignore path must be a regular file, not a symbolic link or another file type.',
    409,
  )
}

/**
 * Turn a repository-relative path into a root-anchored literal Git ignore rule.
 * @param path - repository-relative path, already validated by the caller.
 * @returns the escaped ignore rule.
 */
export function gitignoreRule(path: string): string {
  if (/[\r\n]/.test(path)) {
    throw new GitGraphError(
      'bad-request',
      'Paths containing newlines cannot be added to .gitignore.',
      400,
    )
  }
  return `/${path.replace(/[\\#!*?[\] ]/g, (character) => `\\${character}`)}`
}

/**
 * Append a literal path rule to the repository's `.gitignore` unless it already exists.
 *
 * The link check and open handle are deliberately both present: the link makes
 * Git's no-follow rule explicit, and the no-follow open plus descriptor stat
 * prevents a replacement race from turning this into a write outside the root.
 * Reading and appending on the same descriptor then keeps the checked file and
 * the written file identical. `O_APPEND` prevents rewriting existing content.
 *
 * @param root - resolved repository root.
 * @param path - repository-relative path, already validated by the caller.
 * @returns whether a rule was appended.
 */
export async function appendGitignoreRule(root: string, path: string): Promise<boolean> {
  const rule = gitignoreRule(path)
  const filename = join(root, '.gitignore')
  try {
    if (!(await lstat(filename)).isFile()) throw notAFile()
  } catch (error) {
    if (error instanceof GitGraphError) throw error
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  // On a missing file, an attacker cannot race in a link that gets followed:
  // O_NOFOLLOW rejects it even though O_CREAT is also present.
  let descriptor: FileHandle | undefined
  try {
    descriptor = await open(
      filename,
      constants.O_RDWR | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW,
    )
    if (!(await descriptor.stat()).isFile()) throw notAFile()
    const existing = await descriptor.readFile('utf8')
    if (existing.split(/\r\n|[\r\n]/).includes(rule)) return false

    const newline = existing.includes('\r\n') ? '\r\n' : '\n'
    const separator = existing !== '' && !/[\r\n]$/.test(existing) ? newline : ''
    await descriptor.writeFile(`${separator}${rule}${newline}`, { encoding: 'utf8' })
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ELOOP') throw notAFile()
    throw error
  } finally {
    await descriptor?.close()
  }
}
