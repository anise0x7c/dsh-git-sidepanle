/**
 * Git process execution and repository discovery.
 *
 * Every command runs through `execFile` with an explicit argument vector —
 * never through a shell — in a pinned, non-interactive environment. Every
 * invocation also carries `--literal-pathspecs`, so a browser-supplied filename
 * is never reinterpreted as a Git pattern or pathspec magic.
 */
import { execFile } from 'node:child_process'
import { GitGraphError } from '../errors.ts'

const DEFAULT_TIMEOUT_MS = 20_000
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024
/**
 * Global Git option making every pathspec literal.
 *
 * It is passed as an argument rather than exported through the parent
 * environment, so only this bundle's invocations change behavior.
 */
const LITERAL_PATHSPECS = '--literal-pathspecs'

/** Exit code Git reported, a spawn error code, or undefined on success. */
export type GitExitCode = number | string | undefined

/** One finished Git invocation. */
export interface GitResult {
  /** Whether the command exited zero. */
  ok: boolean
  /** Standard output. */
  stdout: string
  /** Standard error. */
  stderr: string
  /** Exit code or spawn error code; undefined on success. */
  code: GitExitCode
  /** Whether the invocation was killed after its timeout. */
  timedOut: boolean
}

/** Optional overrides for one Git invocation. */
export interface GitRunOptions {
  /** Kill the command after this many milliseconds. */
  timeout?: number
}

/**
 * Run Git without a shell.
 * @param cwd - working directory.
 * @param args - Git arguments.
 * @param options - timeout override.
 * @returns the finished invocation.
 */
export function runGit(
  cwd: string,
  args: readonly string[],
  options: GitRunOptions = {},
): Promise<GitResult> {
  return new Promise((resolveRun) => {
    execFile(
      'git',
      [LITERAL_PATHSPECS, ...args],
      {
        cwd,
        timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_MERGE_AUTOEDIT: 'no',
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
          code: error === null ? undefined : (error.code ?? undefined),
          timedOut: error !== null && error.killed === true,
        })
      },
    )
  })
}

/**
 * Run Git and reject with a stable failure when it exits non-zero.
 * @param cwd - working directory.
 * @param args - Git arguments.
 * @param options - timeout override.
 * @returns standard output.
 */
export async function gitOrThrow(
  cwd: string,
  args: readonly string[],
  options: GitRunOptions = {},
): Promise<string> {
  const result = await runGit(cwd, args, options)
  if (result.ok) return result.stdout
  if (result.code === 'ENOENT')
    throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
  const detail = result.stderr.trim() || result.stdout.trim() || `git ${args[0] ?? ''} failed`
  throw new GitGraphError('git-command-failed', detail, 409)
}

/**
 * The repository root that contains one directory.
 * @param cwd - directory to inspect.
 * @returns absolute root, or null outside a repository.
 */
export async function findRepositoryRoot(cwd: string): Promise<string | null> {
  const result = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  if (result.ok) {
    const root = result.stdout.trim().split('\n')[0]?.trim()
    return root === undefined || root === '' ? null : root
  }
  if (result.code === 'ENOENT')
    throw new GitGraphError('git-unavailable', 'Git could not be run on the Host.', 503)
  return null
}

/**
 * The absolute Git metadata directory of a repository.
 * @param root - repository root.
 * @returns absolute git directory, or null when Git cannot report one.
 */
export async function readGitDirectory(root: string): Promise<string | null> {
  const result = await runGit(root, ['rev-parse', '--absolute-git-dir'])
  if (!result.ok) return null
  const directory = result.stdout.trim()
  return directory === '' ? null : directory
}
