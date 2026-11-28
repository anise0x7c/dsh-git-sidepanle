/**
 * Host path-scope and direct-filesystem regressions.
 *
 * Each test builds a real repository: Git-backed actions must treat the
 * requested path literally, while untracked previews and deletions must stay on
 * ordinary files inside ordinary directories.
 */

import assert from 'node:assert/strict'
import { execFile as execFileCallback } from 'node:child_process'
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative } from 'node:path'
import { after, before, test } from 'node:test'
import { promisify } from 'node:util'
import type { GitGraphOperation, GitGraphRpcValues } from '../src/shared/git.ts'
import { withSessionServer } from './support/host-server.ts'
import type { RpcReply } from './support/types.ts'

const execFile = promisify(execFileCallback)
let tmpRoot = ''

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFile('git', args, { cwd })
  return stdout
}

/** Create one initialized repository with a deterministic identity. */
async function fixture(name: string): Promise<string> {
  const directory = await mkdtemp(join(tmpRoot, `${name}-`))
  await git(directory, 'init', '-q', '-b', 'main')
  await git(directory, 'config', 'user.name', 'Path Test')
  await git(directory, 'config', 'user.email', 'paths@example.test')
  return directory
}

interface CallResult<T> {
  status: number
  body: RpcReply<T>
}

async function callAt<Operation extends GitGraphOperation>(
  baseUrl: string,
  op: Operation,
  payload: Record<string, unknown> = {},
): Promise<CallResult<GitGraphRpcValues[Operation]>> {
  const response = await fetch(`${baseUrl}/api/dsh-git-sidepanel/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dsh-git-sidepanel': '1' },
    body: JSON.stringify({ sessionId: 'session-1', op, ...payload }),
  })
  return { status: response.status, body: (await response.json()) as RpcReply<never> }
}

/** Read one changed file from a status result, failing when Git did not report it. */
function entry(
  files: readonly { path: string; x: string; y: string }[],
  path: string,
): { path: string; x: string; y: string } {
  const file = files.find((candidate) => candidate.path === path)
  assert.ok(file, `the status did not report ${path}`)
  return file
}

before(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'dsh-git-sidepanel-paths-'))
})

after(async () => {
  assert.equal(dirname(tmpRoot), tmpdir())
  assert.ok(basename(tmpRoot).startsWith('dsh-git-sidepanel-paths-'))
  await rm(tmpRoot, { recursive: true, force: true })
})

test('stage treats wildcard and magic-shaped names literally', async () => {
  const repo = await fixture('stage-literal')
  for (const name of ['star*.txt', 'starONE.txt', ':(glob)starONE.txt']) {
    await writeFile(join(repo, name), `${name}\n`)
  }
  await git(repo, 'add', '-A')
  await git(repo, 'commit', '-q', '-m', 'base')
  for (const name of ['star*.txt', 'starONE.txt', ':(glob)starONE.txt']) {
    await writeFile(join(repo, name), `changed ${name}\n`)
  }

  await withSessionServer(repo, async (baseUrl) => {
    const wildcard = await callAt(baseUrl, 'stage', { paths: ['star*.txt'] })
    assert.equal(wildcard.body.ok, true)
    let files = (await callAt(baseUrl, 'status')).body.value.files
    assert.equal(entry(files, 'star*.txt').x, 'M')
    assert.equal(entry(files, 'starONE.txt').x, '.', 'the wildcard must not stage the neighbour')

    const magic = await callAt(baseUrl, 'stage', { paths: [':(glob)starONE.txt'] })
    assert.equal(magic.body.ok, true)
    files = (await callAt(baseUrl, 'status')).body.value.files
    assert.equal(entry(files, ':(glob)starONE.txt').x, 'M')
    assert.equal(entry(files, 'starONE.txt').x, '.', 'the magic-shaped name must stay literal')
  })
})

test('unstage treats a wildcard name literally', async () => {
  const repo = await fixture('unstage-literal')
  for (const name of ['star*.txt', 'starONE.txt']) {
    await writeFile(join(repo, name), 'base\n')
  }
  await git(repo, 'add', '-A')
  await git(repo, 'commit', '-q', '-m', 'base')
  for (const name of ['star*.txt', 'starONE.txt']) {
    await writeFile(join(repo, name), 'changed\n')
  }

  await withSessionServer(repo, async (baseUrl) => {
    await callAt(baseUrl, 'stage', { paths: ['star*.txt', 'starONE.txt'] })
    const unstaged = await callAt(baseUrl, 'unstage', { paths: ['star*.txt'] })
    assert.equal(unstaged.body.ok, true)
    const files = (await callAt(baseUrl, 'status')).body.value.files
    assert.equal(entry(files, 'star*.txt').x, '.')
    assert.equal(entry(files, 'starONE.txt').x, 'M', 'the neighbour must stay staged')
  })
})

test('discard restores only the literal tracked wildcard path', async () => {
  const repo = await fixture('discard-literal')
  for (const name of ['star*.txt', 'starONE.txt']) {
    await writeFile(join(repo, name), 'base\n')
  }
  await git(repo, 'add', '-A')
  await git(repo, 'commit', '-q', '-m', 'base')
  for (const name of ['star*.txt', 'starONE.txt']) {
    await writeFile(join(repo, name), 'changed\n')
  }

  await withSessionServer(repo, async (baseUrl) => {
    const discarded = await callAt(baseUrl, 'discard', { path: 'star*.txt', untracked: false })
    assert.equal(discarded.body.ok, true)
    assert.equal(await readFile(join(repo, 'star*.txt'), 'utf8'), 'base\n')
    assert.equal(await readFile(join(repo, 'starONE.txt'), 'utf8'), 'changed\n')
  })
})

test('working and commit diffs include only the literal pattern-shaped path', async () => {
  const repo = await fixture('diff-literal')
  for (const name of ['star*.txt', 'starONE.txt', ':(glob)starONE.txt']) {
    await writeFile(join(repo, name), 'base\n')
  }
  await git(repo, 'add', '-A')
  await git(repo, 'commit', '-q', '-m', 'base')
  for (const name of ['star*.txt', 'starONE.txt', ':(glob)starONE.txt']) {
    await writeFile(join(repo, name), `working ${name}\n`)
  }
  const previous = (await git(repo, 'rev-parse', 'HEAD')).trim()

  await withSessionServer(repo, async (baseUrl) => {
    const wildcard = await callAt(baseUrl, 'diff', { path: 'star*.txt', staged: false })
    assert.equal(wildcard.body.ok, true)
    assert.equal(wildcard.body.value.additions, 1)
    const wildcardHunk = wildcard.body.value.hunks[0]
    assert.ok(wildcardHunk, 'the working diff has no hunk')
    assert.deepEqual(
      wildcardHunk.lines.filter((line) => line.t === '+').map((line) => line.text),
      ['working star*.txt'],
    )

    const magic = await callAt(baseUrl, 'diff', { path: ':(glob)starONE.txt', staged: false })
    assert.equal(magic.body.ok, true)
    const magicHunk = magic.body.value.hunks[0]
    assert.ok(magicHunk, 'the magic-path diff has no hunk')
    assert.deepEqual(
      magicHunk.lines.filter((line) => line.t === '+').map((line) => line.text),
      ['working :(glob)starONE.txt'],
    )

    await callAt(baseUrl, 'stage', { paths: ['star*.txt', 'starONE.txt', ':(glob)starONE.txt'] })
    const staged = await callAt(baseUrl, 'diff', { path: 'star*.txt', staged: true })
    assert.equal(staged.body.value.additions, 1)
    const stagedHunk = staged.body.value.hunks[0]
    assert.ok(stagedHunk, 'the staged diff has no hunk')
    assert.deepEqual(
      stagedHunk.lines.filter((line) => line.t === '+').map((line) => line.text),
      ['working star*.txt'],
    )

    await git(repo, 'add', '-A')
    await git(repo, 'commit', '-q', '-m', 'working changes')
    const oid = (await git(repo, 'rev-parse', 'HEAD')).trim()
    const commitWildcard = await callAt(baseUrl, 'diff', { path: 'star*.txt', commit: oid })
    assert.equal(commitWildcard.body.ok, true)
    assert.equal(commitWildcard.body.value.additions, 1)
    const commitWildcardHunk = commitWildcard.body.value.hunks[0]
    assert.ok(commitWildcardHunk, 'the commit diff has no hunk')
    assert.deepEqual(
      commitWildcardHunk.lines.filter((line) => line.t === '+').map((line) => line.text),
      ['working star*.txt'],
    )
    const commitMagic = await callAt(baseUrl, 'diff', {
      path: ':(glob)starONE.txt',
      commit: oid,
    })
    const commitMagicHunk = commitMagic.body.value.hunks[0]
    assert.ok(commitMagicHunk, 'the magic-path commit diff has no hunk')
    assert.deepEqual(
      commitMagicHunk.lines.filter((line) => line.t === '+').map((line) => line.text),
      ['working :(glob)starONE.txt'],
    )
    assert.notEqual(previous, oid)
  })
})

test('double-dot-prefixed files stay inside the repository', async () => {
  const repo = await fixture('dotdot')
  await writeFile(join(repo, '..notes'), 'base\n')
  await git(repo, 'add', '-A')
  await git(repo, 'commit', '-q', '-m', 'base')

  await withSessionServer(repo, async (baseUrl) => {
    await writeFile(join(repo, '..notes'), 'changed\n')
    const diff = await callAt(baseUrl, 'diff', { path: '..notes', staged: false })
    assert.equal(diff.body.ok, true)
    assert.equal(diff.body.value.additions, 1)

    const staged = await callAt(baseUrl, 'stage', { paths: ['..notes'] })
    assert.equal(staged.body.ok, true)
    const files = (await callAt(baseUrl, 'status')).body.value.files
    assert.equal(entry(files, '..notes').x, 'M')

    const unstaged = await callAt(baseUrl, 'unstage', { paths: ['..notes'] })
    assert.equal(unstaged.body.ok, true)
    const discarded = await callAt(baseUrl, 'discard', { path: '..notes', untracked: false })
    assert.equal(discarded.body.ok, true)
    assert.equal(await readFile(join(repo, '..notes'), 'utf8'), 'base\n')
  })
})

test('untracked previews refuse a final symbolic link without reading its target', async () => {
  const repo = await fixture('link-final')
  const outside = await mkdtemp(join(tmpRoot, 'outside-final-'))
  await writeFile(join(outside, 'secret.txt'), 'secret\n')
  const target = relative(repo, join(outside, 'secret.txt'))
  await symlink(target, join(repo, 'leak.txt'))

  await withSessionServer(repo, async (baseUrl) => {
    const preview = await callAt(baseUrl, 'diff', { path: 'leak.txt', untracked: true })
    assert.equal(preview.body.ok, false)
    assert.equal(preview.body.error.code, 'not-found')
    assert.equal(await readFile(join(outside, 'secret.txt'), 'utf8'), 'secret\n')

    const removed = await callAt(baseUrl, 'discard', { path: 'leak.txt', untracked: true })
    assert.equal(removed.body.ok, true)
    await assert.rejects(lstat(join(repo, 'leak.txt')))
    assert.equal(await readFile(join(outside, 'secret.txt'), 'utf8'), 'secret\n')
  })
})

test('previews and untracked deletion refuse a symbolic-link parent directory', async () => {
  const repo = await fixture('link-parent')
  const outside = await mkdtemp(join(tmpRoot, 'outside-parent-'))
  await writeFile(join(outside, 'inside.txt'), 'outside file\n')
  await symlink(relative(repo, outside), join(repo, 'linked-dir'))
  const escaped = join(outside, 'inside.txt')

  await withSessionServer(repo, async (baseUrl) => {
    const preview = await callAt(baseUrl, 'diff', {
      path: 'linked-dir/inside.txt',
      untracked: true,
    })
    assert.equal(preview.body.ok, false)
    assert.equal(preview.body.error.code, 'path-outside-repository')

    const removed = await callAt(baseUrl, 'discard', {
      path: 'linked-dir/inside.txt',
      untracked: true,
    })
    assert.equal(removed.body.ok, false)
    assert.equal(removed.body.error.code, 'path-outside-repository')
    assert.equal(await readFile(escaped, 'utf8'), 'outside file\n')
  })
})

test('an untracked request cannot delete or preview a tracked file', async () => {
  const repo = await fixture('flag-trust')
  await writeFile(join(repo, 'tracked.txt'), 'base\n')
  await git(repo, 'add', '-A')
  await git(repo, 'commit', '-q', '-m', 'base')
  await writeFile(join(repo, 'tracked.txt'), 'changed\n')
  await writeFile(join(repo, 'former-untracked.txt'), 'added later\n')
  await git(repo, 'add', 'former-untracked.txt')

  await withSessionServer(repo, async (baseUrl) => {
    const refused = await callAt(baseUrl, 'discard', { path: 'tracked.txt', untracked: true })
    assert.equal(refused.body.ok, false)
    assert.equal(refused.body.error.code, 'not-untracked')
    assert.equal(await readFile(join(repo, 'tracked.txt'), 'utf8'), 'changed\n')

    const becameTracked = await callAt(baseUrl, 'discard', {
      path: 'former-untracked.txt',
      untracked: true,
    })
    assert.equal(becameTracked.body.ok, false)
    assert.equal(becameTracked.body.error.code, 'not-untracked')
    assert.equal(await readFile(join(repo, 'former-untracked.txt'), 'utf8'), 'added later\n')

    const preview = await callAt(baseUrl, 'diff', { path: 'tracked.txt', untracked: true })
    assert.equal(preview.body.ok, false)
    assert.equal(preview.body.error.code, 'not-untracked')
  })
})

test('ignored paths are not untracked candidates for preview or deletion', async () => {
  const repo = await fixture('ignored')
  await writeFile(join(repo, '.gitignore'), 'ignored.txt\n')
  await writeFile(join(repo, 'ignored.txt'), 'ignored\n')

  await withSessionServer(repo, async (baseUrl) => {
    const preview = await callAt(baseUrl, 'diff', { path: 'ignored.txt', untracked: true })
    assert.equal(preview.body.ok, false)
    assert.equal(preview.body.error.code, 'not-untracked')

    const removed = await callAt(baseUrl, 'discard', {
      path: 'ignored.txt',
      untracked: true,
    })
    assert.equal(removed.body.ok, false)
    assert.equal(removed.body.error.code, 'not-untracked')
    assert.equal(await readFile(join(repo, 'ignored.txt'), 'utf8'), 'ignored\n')
  })
})

test('discard keeps rejecting malformed and option-shaped paths in both modes', async () => {
  const repo = await fixture('discard-validation')
  await writeFile(join(repo, '--keep.txt'), 'keep\n')
  await withSessionServer(repo, async (baseUrl) => {
    for (const untracked of [true, false]) {
      for (const path of ['--keep.txt', 42, null, '']) {
        const refused = await callAt(baseUrl, 'discard', { path, untracked })
        assert.equal(refused.body.ok, false)
        assert.equal(refused.body.error.code, 'bad-request')
      }
    }
    assert.equal(await readFile(join(repo, '--keep.txt'), 'utf8'), 'keep\n')
  })
})

test('an untracked preview refuses a directory and identifies binary content', async () => {
  const repo = await fixture('preview-types')
  await mkdir(join(repo, 'directory'))
  await writeFile(join(repo, 'binary.dat'), Buffer.from([1, 0, 2]))
  await withSessionServer(repo, async (baseUrl) => {
    const directory = await callAt(baseUrl, 'diff', { path: 'directory', untracked: true })
    assert.equal(directory.body.ok, false)
    assert.equal(directory.body.error.code, 'not-found')
    const binary = await callAt(baseUrl, 'diff', { path: 'binary.dat', untracked: true })
    assert.equal(binary.body.ok, true)
    assert.equal(binary.body.value.binary, true)
    assert.deepEqual(binary.body.value.hunks, [])
  })
})

test('ordinary untracked previews stay bounded and ordinary deletion works', async () => {
  const repo = await fixture('ordinary')
  const content = 'a'.repeat(600 * 1024)
  await writeFile(join(repo, 'big.txt'), content)
  await writeFile(join(repo, 'temp.txt'), 'temporary\n')

  await withSessionServer(repo, async (baseUrl) => {
    const preview = await callAt(baseUrl, 'diff', { path: 'big.txt', untracked: true })
    assert.equal(preview.body.ok, true)
    assert.equal(preview.body.value.truncated, true)
    const previewHunk = preview.body.value.hunks[0]
    assert.ok(previewHunk, 'the bounded preview has no hunk')
    const previewLine = previewHunk.lines[0]
    assert.ok(previewLine, 'the bounded preview has no rendered line')
    assert.equal(previewLine.text.length, 512 * 1024)

    const removed = await callAt(baseUrl, 'discard', { path: 'temp.txt', untracked: true })
    assert.equal(removed.body.ok, true)
    await assert.rejects(lstat(join(repo, 'temp.txt')))
    const again = await callAt(baseUrl, 'discard', { path: 'temp.txt', untracked: true })
    assert.equal(again.body.ok, true)
  })
})
