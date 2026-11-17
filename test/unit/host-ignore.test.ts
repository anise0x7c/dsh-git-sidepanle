import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { GitGraphError } from '../../src/host/errors.ts'
import { appendGitignoreRule, gitignoreRule } from '../../src/host/git/ignore.ts'

/**
 * Run one filesystem test in its own temporary repository root.
 * @param run - test body.
 */
async function withRepository(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-git-graph-ignore-'))
  try {
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

/**
 * Run a call that must fail with a stable `GitGraphError`.
 * @param call - call expected to throw.
 * @returns the thrown failure.
 */
function captureFailure(call: () => unknown): GitGraphError {
  try {
    call()
  } catch (error) {
    assert.ok(error instanceof GitGraphError, `expected a GitGraphError, got ${String(error)}`)
    return error
  }
  assert.fail('the call should have been refused')
}

describe('gitignoreRule', () => {
  test('anchors nested paths at the repository root and preserves forward slashes', () => {
    assert.equal(gitignoreRule('logs/nested/output.txt'), '/logs/nested/output.txt')
  })

  test('backslash-escapes every literal pattern character and space', () => {
    assert.equal(
      gitignoreRule('dir\\name/#hash/!bang/*star/?query/[group]/two words.txt'),
      '/dir\\\\name/\\#hash/\\!bang/\\*star/\\?query/\\[group\\]/two\\ words.txt',
    )
  })

  test('preserves UTF-8 path text', () => {
    assert.equal(gitignoreRule('assets/你好 🌿.txt'), '/assets/你好\\ 🌿.txt')
  })

  test('rejects line breaks that cannot be represented by one rule', () => {
    for (const path of ['bad\nname.txt', 'bad\rname.txt']) {
      const failure = captureFailure(() => gitignoreRule(path))
      assert.equal(failure.code, 'bad-request')
      assert.equal(failure.status, 400)
    }
  })
})

describe('appendGitignoreRule', () => {
  test('creates a missing file with one UTF-8 rule and a final newline', async () => {
    await withRepository(async (root) => {
      assert.equal(await appendGitignoreRule(root, '目录/café 之.txt'), true)
      assert.equal(await readFile(join(root, '.gitignore'), 'utf8'), '/目录/café\\ 之.txt\n')
    })
  })

  test('fills an empty file without a leading blank line', async () => {
    await withRepository(async (root) => {
      const filename = join(root, '.gitignore')
      await writeFile(filename, '', 'utf8')
      assert.equal(await appendGitignoreRule(root, 'output.txt'), true)
      assert.equal(await readFile(filename, 'utf8'), '/output.txt\n')
    })
  })

  test('appends to an existing LF file without rewriting its contents', async () => {
    await withRepository(async (root) => {
      const filename = join(root, '.gitignore')
      await writeFile(filename, '# existing\n/old.txt\n', 'utf8')
      assert.equal(await appendGitignoreRule(root, 'logs/output file.txt'), true)
      assert.equal(
        await readFile(filename, 'utf8'),
        '# existing\n/old.txt\n/logs/output\\ file.txt\n',
      )
    })
  })

  test('uses CRLF throughout when the existing file contains CRLF', async () => {
    await withRepository(async (root) => {
      const filename = join(root, '.gitignore')
      await writeFile(filename, '# existing\r\n/old.txt\r\n', 'utf8')
      assert.equal(await appendGitignoreRule(root, 'new output.txt'), true)
      assert.equal(
        await readFile(filename, 'utf8'),
        '# existing\r\n/old.txt\r\n/new\\ output.txt\r\n',
      )
    })
  })

  test('prefixes a newline when the existing final line is unterminated', async () => {
    await withRepository(async (root) => {
      const filename = join(root, '.gitignore')
      await writeFile(filename, '# existing\n/old.txt', 'utf8')
      assert.equal(await appendGitignoreRule(root, 'new.txt'), true)
      assert.equal(await readFile(filename, 'utf8'), '# existing\n/old.txt\n/new.txt\n')
    })
  })

  test('returns false for an identical line without writing the file', async () => {
    await withRepository(async (root) => {
      const filename = join(root, '.gitignore')
      const path = 'nested/file name.txt'
      const rule = gitignoreRule(path)
      const existing = `# existing\r\n${rule}\r\n`
      await writeFile(filename, existing, 'utf8')
      const past = new Date('2000-01-01T00:00:00.000Z')
      await utimes(filename, past, past)
      const before = await stat(filename)

      assert.equal(await appendGitignoreRule(root, path), false)
      assert.equal(await readFile(filename, 'utf8'), existing)
      assert.equal((await stat(filename)).mtimeMs, before.mtimeMs)
    })
  })

  test('rejects a linked .gitignore without touching its outside target', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'dsh-git-graph-ignore-outside-'))
    try {
      const target = join(outside, 'unrelated.txt')
      await writeFile(target, 'must stay unchanged\n', 'utf8')
      await withRepository(async (root) => {
        await symlink(target, join(root, '.gitignore'), 'file')
        await assert.rejects(appendGitignoreRule(root, 'nested/file.txt'), (error: unknown) => {
          assert.ok(error instanceof GitGraphError)
          assert.equal(error.code, 'ignore-not-a-file')
          assert.equal(error.status, 409)
          return true
        })
        assert.equal(await readFile(target, 'utf8'), 'must stay unchanged\n')
      })
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  })

  test('does not turn a non-ENOENT read failure into a new file', async () => {
    await withRepository(async (root) => {
      const filename = join(root, '.gitignore')
      await mkdir(filename)
      await assert.rejects(appendGitignoreRule(root, 'file.txt'), (error: unknown) => {
        assert.notEqual((error as NodeJS.ErrnoException).code, 'ENOENT')
        return true
      })
    })
  })
})
