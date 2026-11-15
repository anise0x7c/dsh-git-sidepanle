/**
 * Git execution, repository discovery, and repository-relative path validation.
 *
 * Every command runs through `execFile` with an explicit argument vector —
 * never through a shell — in a pinned, non-interactive environment. Paths that
 * come from the browser are validated to stay inside the repository before
 * they reach Git; the browser never sends a repository path of its own.
 */
import { execFile } from 'node:child_process'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { GitGraphError } from '../errors.js'

const DEFAULT_TIMEOUT_MS = 20_000
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024

/**
 * Run Git without a shell.
 * @param {string} cwd - working directory.
 * @param {readonly string[]} args - Git arguments.
 * @param {{ timeout?: number }} [options] - timeout override.
 * @returns {Promise<{ ok: boolean; stdout: string; stderr: string; code: number | string | undefined }>} result.
 */
export function runGit(cwd, args, options = {}) {
  return new Promise((resolveRun) => {
    execFile(
      'git',
      [...args],
      {
        cwd,
        timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_OPTIONAL_LOCKS: '0',
          GIT_PAGER: 'cat',
          LC_ALL: 'C',
          LANG: 'C',
        },
      },
      (error, stdout, stderr) => {
        resolveRun({
          ok: error === null,
          stdout: typeof stdout === 'string' ? stdout : '',
          stderr: typeof stderr === 'string' ? stderr : '',
          code: error === null ? undefined : error.code,
        })
      },
    )
  })
}

/**
 * Run Git and reject with a stable failure when it exits non-zero.
 * @param {string} cwd - working directory.
 * @param {readonly string[]} args - Git arguments.
 * @param {{ timeout?: number }} [options] - timeout override.
 * @returns {Promise<string>} standard output.
 */
export async function gitOrThrow(cwd, args, options = {}) {
  const result = await runGit(cwd, args, options)
  if (result.ok) return result.stdout
  if (result.code === 'ENOENT') throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
  const detail = (result.stderr.trim() || result.stdout.trim() || `git ${args[0] ?? ''} failed`)
  throw new GitGraphError('git-command-failed', detail, 409)
}

/**
 * The repository root that contains one directory.
 * @param {string} cwd - directory to inspect.
 * @returns {Promise<string | null>} absolute root, or null outside a repository.
 */
export async function findRepositoryRoot(cwd) {
  const result = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  if (result.ok) {
    const root = result.stdout.trim().split('\n')[0]?.trim()
    return root === undefined || root === '' ? null : root
  }
  if (result.code === 'ENOENT') throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
  return null
}

/**
 * Resolve one repository-relative path, refusing escapes and option-shaped paths.
 * @param {string} root - repository root.
 * @param {unknown} input - wire path.
 * @returns {string} absolute path inside the repository.
 */
export function resolveRepositoryPath(root, input) {
  if (typeof input !== 'string' || input === '' || input.includes('\0')) {
    throw new GitGraphError('bad-request', 'A file path is required.', 400)
  }
  if (isAbsolute(input)) throw new GitGraphError('bad-request', 'A repository-relative path is required.', 400)
  const absolute = resolve(root, input)
  const rel = relative(root, absolute)
  if (rel === '' || rel.startsWith('..') || rel.includes('\0')) {
    throw new GitGraphError('path-outside-repository', `"${input}" is outside the repository.`, 400)
  }
  if (rel.split(sep).some((part) => part === '..')) {
    throw new GitGraphError('path-outside-repository', `"${input}" is outside the repository.`, 400)
  }
  return absolute
}

/**
 * Validate a list of repository-relative paths.
 * @param {string} root - repository root.
 * @param {unknown} input - wire paths.
 * @returns {string[]} validated paths, relative as given.
 */
export function resolveRepositoryPaths(root, input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new GitGraphError('bad-request', 'At least one path is required.', 400)
  }
  if (input.length > 2000) throw new GitGraphError('bad-request', 'Too many paths in one request.', 400)
  const paths = []
  for (const item of input) {
    resolveRepositoryPath(root, item)
    if (typeof item !== 'string' || item.startsWith('-')) {
      throw new GitGraphError('bad-request', `Invalid path "${String(item)}".`, 400)
    }
    paths.push(item)
  }
  return paths
}

/**
 * One parsed porcelain-v2 record.
 * @param {'ordinary' | 'renamed' | 'unmerged' | 'untracked'} kind - record kind.
 * @param {string} x - index status character.
 * @param {string} y - worktree status character.
 * @param {string} path - path.
 * @param {string | undefined} origPath - rename source.
 * @returns {{ kind: string, x: string, y: string, path: string, origPath?: string }} wire entry.
 */
export function changeEntry(kind, x, y, path, origPath) {
  return {
    kind,
    x,
    y,
    path,
    ...origPath === undefined ? {} : { origPath },
    conflict: kind === 'unmerged',
    untracked: kind === 'untracked',
  }
}
