/**
 * Wire-input validation shared by the RPC dispatcher.
 *
 * Every helper turns an untrusted payload field into a typed value or a stable
 * `bad-request`/domain failure. Repository-relative paths are validated in
 * `git/paths.ts` because Git needs their raw spelling.
 */
import { GitGraphError } from './errors.ts'
import { runGit } from './git/exec.ts'

const FULL_OID = /^[0-9a-f]{40}$/
const PANEL_ID = /^[A-Za-z0-9._:-]{1,80}$/

/**
 * Read a full commit identity from a mutation request.
 * @param value - untrusted wire value.
 * @returns full commit identifier.
 */
export function commitOf(value: unknown): string {
  if (typeof value !== 'string' || !FULL_OID.test(value)) {
    throw new GitGraphError('bad-request', 'A full commit identifier is required.', 400)
  }
  return value
}

/**
 * Read the non-negative history page offset.
 * @param value - untrusted wire value.
 * @returns the offset, defaulting to zero.
 */
export function historyOffsetOf(value: unknown): number {
  if (value === undefined) return 0
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new GitGraphError(
      'bad-request',
      'The history offset must be a non-negative integer.',
      400,
    )
  }
  return value
}

/**
 * Validate a commit message.
 * @param value - untrusted wire value.
 * @returns the trimmed, non-empty message.
 */
export function commitMessageOf(value: unknown): string {
  const message = typeof value === 'string' ? value.trim() : ''
  if (message === '') throw new GitGraphError('empty-message', 'A commit message is required.', 400)
  if (message.length > 20_000)
    throw new GitGraphError('message-too-long', 'The commit message is too long.', 400)
  return message
}

/**
 * Validate an optional tag message.
 * @param value - untrusted wire value.
 * @returns the trimmed message, empty for a lightweight tag.
 */
export function tagMessageOf(value: unknown): string {
  if (value !== undefined && (typeof value !== 'string' || value.length > 20_000)) {
    throw new GitGraphError('bad-request', 'A tag message is too long or not text.', 400)
  }
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Read the panel identity of a `watch` request.
 * @param payload - request.
 * @returns the validated panel identity.
 */
export function panelOf(payload: Record<string, unknown>): string {
  const panel = payload.panel
  if (typeof panel !== 'string' || !PANEL_ID.test(panel)) {
    throw new GitGraphError('bad-request', 'A panel identity is required.', 400)
  }
  return panel
}

/**
 * Validate a branch name for creation or deletion.
 * @param root - resolved repository root.
 * @param value - untrusted name.
 * @returns the validated name.
 */
export async function branchNameOf(root: string, value: unknown): Promise<string> {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 200 ||
    value.startsWith('-')
  )
    throw new GitGraphError('bad-request', 'A local branch name is required.', 400)
  const formatted = await runGit(root, ['check-ref-format', '--branch', value])
  if (!formatted.ok)
    throw new GitGraphError('bad-request', `"${value}" is not a valid branch name.`, 400)
  return value
}

/**
 * Validate a branch name for checkout, which reports an unknown branch for an
 * unformattable name as it always has.
 * @param root - resolved repository root.
 * @param value - untrusted name.
 * @returns the validated name.
 */
export async function checkoutBranchNameOf(root: string, value: unknown): Promise<string> {
  if (typeof value !== 'string' || value === '' || value.startsWith('-')) {
    throw new GitGraphError('bad-request', 'A local branch name is required.', 400)
  }
  const formatted = await runGit(root, ['check-ref-format', '--branch', value])
  if (!formatted.ok) {
    throw new GitGraphError('unknown-branch', `No local branch named "${value}" exists.`, 404)
  }
  return value
}

/**
 * Validate a tag name and keep it distinguishable from option arguments.
 * @param root - resolved repository root.
 * @param value - untrusted name.
 * @returns the valid tag name.
 */
export async function tagNameOf(root: string, value: unknown): Promise<string> {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 200 ||
    value.startsWith('-')
  )
    throw new GitGraphError('bad-request', 'A tag name is required.', 400)
  const formatted = await runGit(root, ['check-ref-format', `refs/tags/${value}`])
  if (!formatted.ok)
    throw new GitGraphError('bad-request', `"${value}" is not a valid tag name.`, 400)
  return value
}

/**
 * Read a required file path string.
 * @param value - untrusted wire value.
 * @returns the raw path string.
 */
export function filePathOf(value: unknown): string {
  if (typeof value !== 'string') {
    throw new GitGraphError('bad-request', 'A file path is required.', 400)
  }
  return value
}

/**
 * Read an optional rename-source path string.
 * @param value - untrusted wire value.
 * @returns the raw path string, or undefined when absent or empty.
 */
export function optionalFilePathOf(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}
