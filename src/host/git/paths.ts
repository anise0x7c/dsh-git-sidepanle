/**
 * Repository-relative path validation.
 *
 * Browser-supplied paths are resolved against the repository root and rejected
 * when they leave it. The comparison uses the path module of the running
 * platform, with an injectable flavor so the Windows another-drive case stays
 * unit-testable on every platform.
 */
import { isAbsolute, relative, resolve, sep, type win32 } from 'node:path'
import { GitGraphError } from '../errors.ts'

/** The path operations the escape check needs. */
export type PathFlavor = Pick<typeof win32, 'isAbsolute' | 'relative' | 'sep'>

const NATIVE_PATH: PathFlavor = { isAbsolute, relative, sep }

/**
 * Whether a resolved path leaves the repository root.
 *
 * A `relative` result that is itself absolute means the two paths sit on
 * different Windows drives; treating it as a normal relative name would accept
 * an outside target. A name starting with two dots is only a parent reference
 * when the dots form a whole path segment, so `..notes` stays inside.
 * @param root - repository root.
 * @param absolute - resolved candidate.
 * @param flavor - path operations; the running platform by default.
 * @returns whether the candidate is empty or outside the root.
 */
export function isOutsideRoot(
  root: string,
  absolute: string,
  flavor: PathFlavor = NATIVE_PATH,
): boolean {
  const rel = flavor.relative(root, absolute)
  if (rel === '' || flavor.isAbsolute(rel) || rel.includes('\0')) return true
  // The escape decision is per segment, never a string prefix: `..notes` is an
  // ordinary name while `..` and `a/../../b` have a parent segment.
  return rel.split(flavor.sep).includes('..')
}

/**
 * Resolve one repository-relative path, refusing escapes and option-shaped paths.
 * @param root - repository root.
 * @param input - wire path.
 * @returns absolute path inside the repository.
 */
export function resolveRepositoryPath(root: string, input: unknown): string {
  if (typeof input !== 'string' || input === '' || input.includes('\0')) {
    throw new GitGraphError('bad-request', 'A file path is required.', 400)
  }
  if (isAbsolute(input))
    throw new GitGraphError('bad-request', 'A repository-relative path is required.', 400)
  const absolute = resolve(root, input)
  if (isOutsideRoot(root, absolute)) {
    throw new GitGraphError('path-outside-repository', `"${input}" is outside the repository.`, 400)
  }
  return absolute
}

/**
 * Validate a list of repository-relative paths.
 * @param root - repository root.
 * @param input - wire paths.
 * @returns validated paths, relative as given.
 */
export function resolveRepositoryPaths(root: string, input: unknown): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new GitGraphError('bad-request', 'At least one path is required.', 400)
  }
  if (input.length > 2000)
    throw new GitGraphError('bad-request', 'Too many paths in one request.', 400)
  const items: unknown[] = input
  const paths: string[] = []
  for (const item of items) {
    resolveRepositoryPath(root, item)
    if (typeof item !== 'string' || item.startsWith('-')) {
      throw new GitGraphError('bad-request', `Invalid path "${String(item)}".`, 400)
    }
    paths.push(item)
  }
  return paths
}
