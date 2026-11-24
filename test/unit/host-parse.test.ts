/**
 * Direct unit tests for the Host half's pure parsers.
 *
 * These import the extracted modules directly — no Git process, no HTTP server,
 * no Host context. The canned text mirrors the real output shapes of
 * `git status --porcelain=v2 --branch -z` and `git diff --no-color`, with NUL
 * record separators kept explicit because `-z` parsing depends on them.
 */

import assert from 'node:assert/strict'
import { resolve, win32 } from 'node:path'
import { describe, test } from 'node:test'
import { GitGraphError } from '../../src/host/errors.ts'
import { parseUnifiedDiff } from '../../src/host/git/diff.ts'
import { parseCommitMeta, parseHistory, parseNameStatus } from '../../src/host/git/history.ts'
import {
  isOutsideRoot,
  resolveRepositoryPath,
  resolveRepositoryPaths,
} from '../../src/host/git/paths.ts'
import type { RefRecord } from '../../src/host/git/references.ts'
import {
  NO_GRAPH_REFERENCES,
  parseRefRecords,
  resolveGraphReferences,
  shortRefName,
} from '../../src/host/git/references.ts'
import { parseStatus } from '../../src/host/git/status.ts'

const NUL = '\0'
/** 40-character object ids, the shape real porcelain output carries. */
const OID_A = 'a'.repeat(40)
const OID_B = 'b'.repeat(40)
const OID_C = 'c'.repeat(40)
/** A root that is absolute on every platform without touching the filesystem. */
const ROOT = resolve('/tmp', 'git-graph-unit-repo')

/**
 * Build one NUL-terminated porcelain payload from text records.
 * @param records - records without their trailing NUL.
 * @returns output in the shape Git writes with `-z`.
 */
function porcelain(...records: string[]): string {
  return records.map((record) => record + NUL).join('')
}

/**
 * One ordinary (`1`) porcelain-v2 record.
 * @param xy - two status characters.
 * @param path - repository-relative path.
 * @returns record.
 */
function ordinaryRecord(xy: string, path: string): string {
  return `1 ${xy} N... 100644 100644 100644 ${OID_A} ${OID_B} ${path}`
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

describe('parseStatus', () => {
  test('starts from an empty repository summary when Git prints nothing', () => {
    assert.deepEqual(parseStatus(''), {
      repo: {
        root: '',
        branch: null,
        detached: false,
        unborn: false,
        upstream: null,
        ahead: 0,
        behind: 0,
        headOid: null,
      },
      files: [],
    })
  })

  test('reads branch name, upstream, ahead/behind counts, and HEAD oid', () => {
    const output = porcelain(
      `# branch.oid ${OID_A}`,
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -3',
    )
    const { repo, files } = parseStatus(output)
    assert.deepEqual(files, [])
    assert.equal(repo.root, '')
    assert.equal(repo.branch, 'main')
    assert.equal(repo.detached, false)
    assert.equal(repo.unborn, false)
    assert.equal(repo.upstream, 'origin/main')
    assert.equal(repo.ahead, 2)
    assert.equal(repo.behind, 3)
    assert.equal(repo.headOid, OID_A)
  })

  test('marks an unborn branch as having no HEAD oid', () => {
    const output = porcelain('# branch.oid (initial)', '# branch.head main', '? first.txt')
    const { repo, files } = parseStatus(output)
    assert.equal(repo.unborn, true)
    assert.equal(repo.headOid, null)
    assert.equal(repo.branch, 'main')
    assert.equal(repo.detached, false)
    assert.deepEqual(files, [
      {
        kind: 'untracked',
        x: '?',
        y: '?',
        path: 'first.txt',
        conflict: false,
        untracked: true,
      },
    ])
  })

  test('marks a detached HEAD with no branch name', () => {
    const output = porcelain(`# branch.oid ${OID_A}`, '# branch.head (detached)')
    const { repo } = parseStatus(output)
    assert.equal(repo.detached, true)
    assert.equal(repo.branch, null)
    assert.equal(repo.headOid, OID_A)
  })

  test('keeps staged and unstaged status letters per row', () => {
    const output = porcelain(
      `# branch.oid ${OID_A}`,
      '# branch.head main',
      ordinaryRecord('M.', 'staged.txt'),
      ordinaryRecord('.M', 'unstaged.txt'),
      ordinaryRecord('MM', 'both.txt'),
      ordinaryRecord('A.', 'added.txt'),
    )
    const { files } = parseStatus(output)
    assert.deepEqual(files, [
      { kind: 'ordinary', x: 'M', y: '.', path: 'staged.txt', conflict: false, untracked: false },
      { kind: 'ordinary', x: '.', y: 'M', path: 'unstaged.txt', conflict: false, untracked: false },
      { kind: 'ordinary', x: 'M', y: 'M', path: 'both.txt', conflict: false, untracked: false },
      { kind: 'ordinary', x: 'A', y: '.', path: 'added.txt', conflict: false, untracked: false },
    ])
  })

  test('parses paths that contain spaces', () => {
    const output = porcelain(ordinaryRecord('.M', 'folder name/file name.txt'))
    const { files } = parseStatus(output)
    const first = files[0]
    assert.ok(first, 'the status output should parse one row')
    assert.equal(first.path, 'folder name/file name.txt')
  })

  test('consumes the second -z record of a rename as the original path', () => {
    const output = porcelain(
      `# branch.oid ${OID_A}`,
      '# branch.head main',
      `2 R. N... 100644 100644 100644 ${OID_A} ${OID_B} R100 renamed file.txt`,
      'original file.txt',
      '? after.txt',
    )
    const { files } = parseStatus(output)
    assert.deepEqual(files, [
      {
        kind: 'renamed',
        x: 'R',
        y: '.',
        path: 'renamed file.txt',
        origPath: 'original file.txt',
        conflict: false,
        untracked: false,
      },
      { kind: 'untracked', x: '?', y: '?', path: 'after.txt', conflict: false, untracked: true },
    ])
  })

  test('flags unmerged rows as conflicts and keeps their paths', () => {
    const output = porcelain(
      `# branch.oid ${OID_A}`,
      '# branch.head main',
      `u UU N... 100644 100644 100644 100644 ${OID_A} ${OID_B} ${OID_C} conflict.txt`,
      `u UU N... 100644 100644 100644 100644 ${OID_A} ${OID_B} ${OID_C} src/deep/conflict.txt`,
    )
    const { files } = parseStatus(output)
    assert.equal(files.length, 2)
    assert.deepEqual(
      files.map((file) => file.path),
      ['conflict.txt', 'src/deep/conflict.txt'],
    )
    for (const file of files) {
      assert.equal(file.kind, 'unmerged')
      assert.equal(file.x, 'U')
      assert.equal(file.y, 'U')
      assert.equal(file.conflict, true)
      assert.equal(file.untracked, false)
    }
  })

  test('ignores records it does not understand', () => {
    const output = porcelain('! unknown record', '# weird header', '? kept.txt')
    const { files } = parseStatus(output)
    assert.deepEqual(
      files.map((file) => file.path),
      ['kept.txt'],
    )
  })
})

describe('parseUnifiedDiff', () => {
  /** Two files, three hunks, context/removals/additions, and an omitted-count header. */
  const multiFile = [
    'diff --git a/src/alpha.txt b/src/alpha.txt',
    'index 1111111..2222222 100644',
    '--- a/src/alpha.txt',
    '+++ b/src/alpha.txt',
    '@@ -1,3 +1,4 @@ function name()',
    ' context one',
    '-removed line',
    '+added line',
    '+another added line',
    ' context two',
    '@@ -10,2 +11,2 @@',
    ' tail context',
    '-old tail',
    '+new tail',
    'diff --git a/beta.txt b/beta.txt',
    'index 3333333..4444444 100644',
    '--- a/beta.txt',
    '+++ b/beta.txt',
    '@@ -1 +1 @@',
    '-gone',
    '+kept',
    '',
  ].join('\n')

  test('counts additions, deletions, and context across multiple files', () => {
    const parsed = parseUnifiedDiff(multiFile)
    assert.equal(parsed.binary, false)
    assert.equal(parsed.additions, 4)
    assert.equal(parsed.deletions, 3)
    assert.equal(parsed.hunks.length, 3)
    assert.deepEqual(
      parsed.hunks.map((hunk) => hunk.header),
      ['@@ -1,3 +1,4 @@ function name()', '@@ -10,2 +11,2 @@', '@@ -1 +1 @@'],
    )
    const firstHunk = parsed.hunks[0]
    assert.ok(firstHunk, 'the first hunk should be parsed')
    assert.deepEqual(
      firstHunk.lines.map((line) => line.t),
      [' ', '-', '+', '+', ' '],
    )
    assert.deepEqual(firstHunk.lines[1], { t: '-', text: 'removed line' })
    assert.deepEqual(firstHunk.lines[2], { t: '+', text: 'added line' })
  })

  test('addresses the compared files without the a/ and b/ prefixes', () => {
    const parsed = parseUnifiedDiff(multiFile)
    // Paths describe the last file section in the payload, matching the pre-split parser.
    assert.equal(parsed.oldPath, 'beta.txt')
    assert.equal(parsed.newPath, 'beta.txt')
    const single = parseUnifiedDiff('--- a/alpha.txt\n+++ b/alpha.txt\n@@ -1 +1 @@\n-a\n+b\n')
    assert.equal(single.oldPath, 'alpha.txt')
    assert.equal(single.newPath, 'alpha.txt')
    const singleHunk = single.hunks[0]
    assert.ok(singleHunk, 'the single-file diff should parse one hunk')
    assert.equal(singleHunk.oldStart, 1)
    assert.equal(singleHunk.oldCount, 1)
    assert.equal(singleHunk.newStart, 1)
    assert.equal(singleHunk.newCount, 1)
  })

  test('defaults omitted hunk counts to one and keeps the header text', () => {
    const parsed = parseUnifiedDiff('--- a/x.txt\n+++ b/x.txt\n@@ -5 +7 @@ tail\n-old\n+new\n')
    assert.deepEqual(parsed.hunks[0], {
      header: '@@ -5 +7 @@ tail',
      oldStart: 5,
      oldCount: 1,
      newStart: 7,
      newCount: 1,
      lines: [
        { t: '-', text: 'old' },
        { t: '+', text: 'new' },
      ],
    })
  })

  test('drops the no-newline marker instead of counting it as a change', () => {
    const parsed = parseUnifiedDiff(
      [
        '--- a/a.txt',
        '+++ b/a.txt',
        '@@ -1,2 +1,2 @@',
        ' keep',
        '-gone',
        '+added',
        '\\ No newline at end of file',
        '',
      ].join('\n'),
    )
    assert.equal(parsed.additions, 1)
    assert.equal(parsed.deletions, 1)
    const hunk = parsed.hunks[0]
    assert.ok(hunk, 'the diff should parse one hunk')
    assert.deepEqual(hunk.lines, [
      { t: ' ', text: 'keep' },
      { t: '-', text: 'gone' },
      { t: '+', text: 'added' },
    ])
  })

  test('reports binary diffs without hunks', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/logo.png b/logo.png',
        'index 1111111..2222222 100644',
        'Binary files a/logo.png and b/logo.png differ',
        '',
      ].join('\n'),
    )
    assert.equal(parsed.binary, true)
    assert.equal(parsed.additions, 0)
    assert.equal(parsed.deletions, 0)
    assert.deepEqual(parsed.hunks, [])
  })

  test('recognises a binary patch payload', () => {
    assert.equal(parseUnifiedDiff('GIT binary patch\nliteral 0\n').binary, true)
  })

  test('returns an empty diff for text without hunks', () => {
    assert.deepEqual(parseUnifiedDiff(''), { binary: false, additions: 0, deletions: 0, hunks: [] })
    assert.deepEqual(parseUnifiedDiff('diff --git a/a.txt b/a.txt\n'), {
      binary: false,
      additions: 0,
      deletions: 0,
      hunks: [],
    })
  })

  test('ignores content lines that appear before the first hunk', () => {
    const parsed = parseUnifiedDiff('+not in a hunk\n@@ -1 +1 @@\n-a\n+b\n')
    assert.equal(parsed.additions, 1)
    assert.equal(parsed.deletions, 1)
    const hunk = parsed.hunks[0]
    assert.ok(hunk, 'the diff should parse one hunk')
    assert.deepEqual(
      hunk.lines.map((line) => line.t),
      ['-', '+'],
    )
  })

  test('keeps /dev/null as the compared path for created and deleted files', () => {
    const created = parseUnifiedDiff('--- /dev/null\n+++ b/created.txt\n@@ -0,0 +1,2 @@\n+x\n+y\n')
    assert.equal(created.oldPath, '/dev/null')
    assert.equal(created.newPath, 'created.txt')
    assert.equal(created.additions, 2)
    const deleted = parseUnifiedDiff('--- a/removed.txt\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-x\n')
    assert.equal(deleted.oldPath, 'removed.txt')
    assert.equal(deleted.newPath, '/dev/null')
    assert.equal(deleted.deletions, 1)
  })
})

describe('resolveRepositoryPath', () => {
  test('resolves a normal repository-relative path', () => {
    assert.equal(resolveRepositoryPath(ROOT, 'alpha.txt'), resolve(ROOT, 'alpha.txt'))
  })

  test('resolves nested paths unchanged', () => {
    const nested = 'apps/web/src/app.js'
    assert.equal(resolveRepositoryPath(ROOT, nested), resolve(ROOT, nested))
    assert.equal(resolveRepositoryPath(ROOT, 'a//b/c.txt'), resolve(ROOT, 'a/b/c.txt'))
  })

  test('allows a path that walks into and back out of a subdirectory', () => {
    assert.equal(resolveRepositoryPath(ROOT, 'deep/../inside.txt'), resolve(ROOT, 'inside.txt'))
  })

  test('accepts a double-dot-prefixed filename as an ordinary path', () => {
    assert.equal(resolveRepositoryPath(ROOT, '..notes'), resolve(ROOT, '..notes'))
    assert.equal(resolveRepositoryPath(ROOT, 'deep/..notes'), resolve(ROOT, 'deep/..notes'))
  })

  test('rejects a resolved path that is absolute on another Windows drive', () => {
    assert.equal(
      isOutsideRoot('C:\\repo', 'C:\\repo\\..notes', win32),
      false,
      'a dot-prefixed child name stays inside',
    )
    assert.equal(isOutsideRoot('C:\\repo', 'C:\\repo', win32), true)
    assert.equal(isOutsideRoot('C:\\repo', 'C:\\repo\\..\\outside.txt', win32), true)
    assert.equal(
      isOutsideRoot('C:\\repo', 'D:\\outside.txt', win32),
      true,
      'relative() returns another absolute path across drives',
    )
  })

  test('rejects an absolute path', () => {
    const absolute = resolve('/', 'etc', 'passwd')
    const failure = captureFailure(() => resolveRepositoryPath(ROOT, absolute))
    assert.equal(failure.code, 'bad-request')
    assert.equal(failure.status, 400)
  })

  test('rejects parent-directory traversal', () => {
    const failure = captureFailure(() => resolveRepositoryPath(ROOT, '../outside.txt'))
    assert.equal(failure.code, 'path-outside-repository')
    assert.equal(failure.status, 400)
    const nested = captureFailure(() => resolveRepositoryPath(ROOT, 'a/../../outside.txt'))
    assert.equal(nested.code, 'path-outside-repository')
    assert.equal(nested.status, 400)
  })

  test('rejects a path that resolves to the repository root itself', () => {
    for (const input of ['.', 'subdir/..', '..']) {
      const failure = captureFailure(() => resolveRepositoryPath(ROOT, input))
      assert.equal(failure.code, 'path-outside-repository', `input ${JSON.stringify(input)}`)
      assert.equal(failure.status, 400)
    }
  })

  test('rejects missing, non-string, and NUL-bearing paths as bad requests', () => {
    for (const input of ['', 'a\0b', 42, null, undefined, {}, ['a.txt']]) {
      const failure = captureFailure(() => resolveRepositoryPath(ROOT, input))
      assert.equal(failure.code, 'bad-request', `input ${String(input)}`)
      assert.equal(failure.status, 400)
    }
  })
})

describe('resolveRepositoryPaths', () => {
  test('returns a validated list of repository-relative paths', () => {
    assert.deepEqual(resolveRepositoryPaths(ROOT, ['a.txt', 'src/b.txt']), ['a.txt', 'src/b.txt'])
  })

  test('rejects empty and non-list input', () => {
    for (const input of [[], 'a.txt', undefined]) {
      const failure = captureFailure(() => resolveRepositoryPaths(ROOT, input))
      assert.equal(failure.code, 'bad-request')
      assert.equal(failure.status, 400)
    }
  })

  test('rejects option-shaped paths before they reach Git', () => {
    const failure = captureFailure(() => resolveRepositoryPaths(ROOT, ['--upload-pack=evil']))
    assert.equal(failure.code, 'bad-request')
    assert.equal(failure.status, 400)
  })

  test('rejects one bad entry anywhere in the list', () => {
    const failure = captureFailure(() => resolveRepositoryPaths(ROOT, ['ok.txt', '../bad.txt']))
    assert.equal(failure.code, 'path-outside-repository')
    assert.equal(failure.status, 400)
  })

  test('rejects more than 2000 paths in one request', () => {
    const many = Array.from({ length: 2001 }, (_, index) => `file-${index}.txt`)
    const failure = captureFailure(() => resolveRepositoryPaths(ROOT, many))
    assert.equal(failure.code, 'bad-request')
    assert.equal(failure.status, 400)
  })
})

describe('parseCommitMeta', () => {
  /**
   * Build one `git log --format` record the way the Host commands it.
   * @param {object} fields - record fields.
   * @returns {string} NUL-separated record with Git's trailing newline.
   */
  function record({
    oid = OID_A,
    shortOid = 'aaaaaaa',
    author = 'Ann',
    authoredAt = 1700000000,
    refs = '',
    parents = '',
    subject = 'Fix the sidebar',
    body = '',
  } = {}) {
    return `${[oid, shortOid, author, String(authoredAt), refs, parents, subject, body].join(NUL)}\n`
  }

  test('reads every field and keeps multi-line bodies', () => {
    const parsed = parseCommitMeta(
      record({
        refs: 'HEAD -> main, tag: v1',
        parents: `${OID_B} ${OID_C}`,
        body: 'Body line one\nBody line two',
      }),
    )
    assert.deepEqual(parsed, {
      oid: OID_A,
      shortOid: 'aaaaaaa',
      author: 'Ann',
      authoredAt: 1700000000,
      refs: 'HEAD -> main, tag: v1',
      parents: [OID_B, OID_C],
      subject: 'Fix the sidebar',
      body: 'Body line one\nBody line two',
    })
  })

  test('reports a root commit with no parents and an empty body', () => {
    const parsed = parseCommitMeta(record({ parents: '', body: '' }))
    assert.ok(parsed)
    assert.deepEqual(parsed.parents, [])
    assert.equal(parsed.body, '')
  })

  test('refuses malformed or non-commit records', () => {
    assert.equal(parseCommitMeta(''), null)
    assert.equal(parseCommitMeta('not a record'), null)
    assert.equal(parseCommitMeta(record({ oid: 'HEAD' })), null)
  })
})

describe('parseHistory', () => {
  /**
   * Build one `git log` history line in the shape the Host requests.
   * @param fields - record fields.
   * @param fields.oid - full commit id.
   * @param fields.shortOid - abbreviated id.
   * @param fields.author - author name.
   * @param fields.authoredAt - author timestamp.
   * @param fields.refs - decoration string.
   * @param fields.parents - space-separated parents.
   * @param fields.subject - subject line.
   * @returns one log line.
   */
  function logLine({
    oid,
    shortOid = 'abc1234',
    author = 'Ann',
    authoredAt = '1700000000',
    refs = '',
    parents = '',
    subject = 'Fix it',
  }: {
    oid: string
    shortOid?: string
    author?: string
    authoredAt?: string
    refs?: string
    parents?: string
    subject?: string
  }): string {
    return [oid, shortOid, author, authoredAt, refs, parents, subject].join('\t')
  }

  test('reads commits, their decorations, parents, and timestamps', () => {
    const payload = [
      logLine({
        oid: OID_A,
        shortOid: 'aaaaaaa',
        author: 'Ann',
        authoredAt: '1700000123',
        refs: 'HEAD -> main, origin/main',
        parents: `${OID_B} ${OID_C}`,
        subject: 'Merge the sidebar work',
      }),
      logLine({ oid: OID_B, refs: 'tag: v1.0', parents: OID_C, subject: 'Sidebar work' }),
      logLine({ oid: OID_C, parents: '', subject: 'Initial commit' }),
    ].join('\n')
    assert.deepEqual(parseHistory(payload), [
      {
        oid: OID_A,
        shortOid: 'aaaaaaa',
        author: 'Ann',
        authoredAt: 1700000123,
        refs: 'HEAD -> main, origin/main',
        parents: [OID_B, OID_C],
        subject: 'Merge the sidebar work',
      },
      {
        oid: OID_B,
        shortOid: 'abc1234',
        author: 'Ann',
        authoredAt: 1700000000,
        refs: 'tag: v1.0',
        parents: [OID_C],
        subject: 'Sidebar work',
      },
      {
        oid: OID_C,
        shortOid: 'abc1234',
        author: 'Ann',
        authoredAt: 1700000000,
        refs: '',
        parents: [],
        subject: 'Initial commit',
      },
    ])
  })

  test('returns no commits for empty output', () => {
    assert.deepEqual(parseHistory(''), [])
    assert.deepEqual(parseHistory('\n'), [])
  })

  test('skips malformed lines instead of failing the read', () => {
    const payload = [
      'not a commit record',
      logLine({ oid: 'short' }),
      [OID_A, 'abc1234', 'Ann'].join('\t'),
      logLine({ oid: OID_B, subject: 'kept' }),
    ].join('\n')
    assert.deepEqual(
      parseHistory(payload).map((commit) => commit.oid),
      [OID_B],
    )
  })

  test('keeps a tab inside the subject in the subject field', () => {
    const payload = logLine({ oid: OID_A, parents: OID_B, subject: 'before\tafter' })
    const [commit] = parseHistory(payload)
    assert.ok(commit, 'the history output should parse one commit')
    assert.equal(commit.subject, 'before\tafter')
    assert.deepEqual(commit.parents, [OID_B])
  })
})

describe('parseNameStatus', () => {
  test('reads modified, added, deleted, renamed, and copied entries', () => {
    const payload = [
      'M',
      'src/a.txt',
      'A',
      'src/new.txt',
      'D',
      'gone.txt',
      'R100',
      'old.txt',
      'renamed.txt',
      'C075',
      'src/from.js',
      'src/to.js',
      'T',
      'script.sh',
      '',
    ].join(NUL)
    assert.deepEqual(parseNameStatus(payload), [
      { path: 'src/a.txt', letter: 'M' },
      { path: 'src/new.txt', letter: 'A' },
      { path: 'gone.txt', letter: 'D' },
      { path: 'renamed.txt', origPath: 'old.txt', letter: 'R' },
      { path: 'src/to.js', origPath: 'src/from.js', letter: 'C' },
      { path: 'script.sh', letter: 'T' },
    ])
  })

  test('returns no files for empty output', () => {
    assert.deepEqual(parseNameStatus(''), [])
    assert.deepEqual(parseNameStatus(NUL), [])
  })

  test('stops cleanly when a rename record is cut short', () => {
    assert.deepEqual(parseNameStatus(['R100', 'old.txt', ''].join(NUL)), [])
  })
})

describe('graph references', () => {
  /**
   * Build one `for-each-ref` record.
   * @param name - full ref name.
   * @param oid - target.
   * @param fields - HEAD marker, upstream and symref target.
   * @returns record.
   */
  function record(name: string, oid: string, fields: Partial<RefRecord> = {}): RefRecord {
    return { head: false, upstream: '', symref: '', ...fields, name, oid }
  }

  const records: RefRecord[] = [
    record('refs/heads/main', OID_A, { head: true, upstream: 'refs/remotes/origin/main' }),
    record('refs/heads/fix/side', OID_B),
    record('refs/remotes/origin/HEAD', OID_C, { symref: 'refs/remotes/origin/master' }),
    record('refs/remotes/origin/main', OID_B),
    record('refs/remotes/origin/master', OID_C),
    record('refs/remotes/upstream/release', OID_A),
  ]

  test('parses NUL-separated for-each-ref records and skips malformed lines', () => {
    const stdout = [
      ['*', 'refs/heads/main', OID_A, 'refs/remotes/origin/main', ''].join(NUL),
      [' ', 'refs/remotes/origin/HEAD', OID_C, '', 'refs/remotes/origin/master'].join(NUL),
      [' ', 'refs/heads/broken', 'not-an-oid', '', ''].join(NUL),
      'garbage',
      '',
    ].join('\n')
    assert.deepEqual(parseRefRecords(stdout), [
      record('refs/heads/main', OID_A, { head: true, upstream: 'refs/remotes/origin/main' }),
      record('refs/remotes/origin/HEAD', OID_C, { symref: 'refs/remotes/origin/master' }),
    ])
  })

  test('shortens branch and remote names only', () => {
    assert.equal(shortRefName('refs/heads/fix/side'), 'fix/side')
    assert.equal(shortRefName('refs/remotes/origin/main'), 'origin/main')
    assert.equal(shortRefName('refs/tags/v1'), 'refs/tags/v1')
  })

  test('resolves the checked-out branch, its upstream and the default branch as base', () => {
    assert.deepEqual(
      resolveGraphReferences({
        records,
        remotes: ['upstream', 'origin'],
        mergeBase: '',
        detachedHead: null,
      }),
      {
        current: { id: 'refs/heads/main', name: 'main', revision: OID_A },
        remote: { id: 'refs/remotes/origin/main', name: 'origin/main', revision: OID_B },
        base: { id: 'refs/remotes/origin/master', name: 'origin/master', revision: OID_C },
      },
    )
  })

  test('prefers a configured Code OSS merge base that names a remote branch', () => {
    const resolved = resolveGraphReferences({
      records,
      remotes: ['origin'],
      mergeBase: 'upstream/release',
      detachedHead: null,
    })
    assert.deepEqual(resolved.base, {
      id: 'refs/remotes/upstream/release',
      name: 'upstream/release',
      revision: OID_A,
    })
    const local = resolveGraphReferences({
      records,
      remotes: ['origin'],
      mergeBase: 'fix/side',
      detachedHead: null,
    })
    assert.equal(local.base?.id, 'refs/remotes/origin/master', 'a local branch is not a base')
  })

  test('uses the first remote when there is no origin and drops a base equal to the upstream', () => {
    const noOrigin = resolveGraphReferences({
      records,
      remotes: ['upstream'],
      mergeBase: '',
      detachedHead: null,
    })
    assert.equal(noOrigin.base, null, 'upstream has no HEAD pointer')
    const same = resolveGraphReferences({
      records,
      remotes: ['origin'],
      mergeBase: 'origin/main',
      detachedHead: null,
    })
    assert.equal(same.base, null)
  })

  test('reports a detached HEAD by commit id and nothing for an unborn branch', () => {
    const detached = records.map((entry) => ({ ...entry, head: false }))
    assert.deepEqual(
      resolveGraphReferences({
        records: detached,
        remotes: ['origin'],
        mergeBase: '',
        detachedHead: OID_B,
      }),
      { current: { id: OID_B, name: OID_B, revision: OID_B }, remote: null, base: null },
    )
    assert.deepEqual(
      resolveGraphReferences({ records: [], remotes: [], mergeBase: '', detachedHead: null }),
      NO_GRAPH_REFERENCES,
    )
  })

  test('drops an upstream that is not present locally', () => {
    const resolved = resolveGraphReferences({
      records: [
        record('refs/heads/main', OID_A, { head: true, upstream: 'refs/remotes/origin/gone' }),
      ],
      remotes: [],
      mergeBase: '',
      detachedHead: null,
    })
    assert.equal(resolved.remote, null)
    assert.equal(resolved.base, null)
  })
})
