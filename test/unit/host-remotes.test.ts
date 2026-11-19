/**
 * Direct unit tests for remote-list parsing and remote-name validation.
 *
 * These import the Host modules directly — no Git process, no HTTP server.
 * The canned `git remote -v` text mirrors Git's tab-separated records.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { GitGraphError } from '../../src/host/errors.ts'
import { parseRemoteBranches } from '../../src/host/git/branches.ts'
import { parseRemoteVerbose } from '../../src/host/git/remotes.ts'
import { optionalRemoteNameOf, remoteNameOf, remoteUrlOf } from '../../src/host/validation.ts'

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

/**
 * Build one `git remote -v` line.
 * @param name - remote name.
 * @param url - remote URL.
 * @param kind - URL kind.
 * @returns one tab-separated record.
 */
function remoteLine(name: string, url: string, kind: 'fetch' | 'push'): string {
  return `${name}\t${url} (${kind})`
}

/**
 * Build one `for-each-ref` record.
 * @param refname - full ref name.
 * @param symref - symbolic target, empty for ordinary refs.
 * @returns one tab-separated record.
 */
function refLine(refname: string, symref = ''): string {
  return `${refname}\t${symref}`
}

describe('parseRemoteVerbose', () => {
  test('reads fetch and push URLs in configured order', () => {
    const output = [
      remoteLine('origin', 'https://example.test/origin.git', 'fetch'),
      remoteLine('origin', 'ssh://example.test/origin.git', 'push'),
      remoteLine('upstream', 'https://example.test/upstream.git', 'fetch'),
      remoteLine('upstream', 'https://example.test/upstream.git', 'push'),
      '',
    ].join('\n')
    assert.deepEqual(parseRemoteVerbose(output), [
      {
        name: 'origin',
        fetchUrl: 'https://example.test/origin.git',
        pushUrl: 'ssh://example.test/origin.git',
      },
      {
        name: 'upstream',
        fetchUrl: 'https://example.test/upstream.git',
        pushUrl: 'https://example.test/upstream.git',
      },
    ])
  })

  test('falls back to the fetch URL when Git prints no push URL', () => {
    const output = remoteLine('origin', '/tmp/remote.git', 'fetch')
    assert.deepEqual(parseRemoteVerbose(output), [
      { name: 'origin', fetchUrl: '/tmp/remote.git', pushUrl: '/tmp/remote.git' },
    ])
  })

  test('keeps the first occurrence of each URL kind', () => {
    const output = [
      remoteLine('origin', 'first-fetch', 'fetch'),
      remoteLine('origin', 'first-push', 'push'),
      remoteLine('origin', 'second-fetch', 'fetch'),
      remoteLine('origin', 'second-push', 'push'),
    ].join('\n')
    assert.deepEqual(parseRemoteVerbose(output), [
      { name: 'origin', fetchUrl: 'first-fetch', pushUrl: 'first-push' },
    ])
  })

  test('skips malformed and empty records instead of failing the read', () => {
    const output = [
      '',
      'garbage',
      'origin\thttps://example.test/origin.git (bogus)',
      'origin\t (fetch)',
      'origin\t( fetch )',
      '\t/path/without-name.git (fetch)',
      remoteLine('origin', 'https://example.test/origin.git', 'fetch'),
    ].join('\n')
    assert.deepEqual(parseRemoteVerbose(output), [
      {
        name: 'origin',
        fetchUrl: 'https://example.test/origin.git',
        pushUrl: 'https://example.test/origin.git',
      },
    ])
  })

  test('tolerates CRLF line endings and surroundings whitespace', () => {
    const output = `${remoteLine(' origin ', ' /tmp/remote.git ', 'fetch')}\r\n`
    assert.deepEqual(parseRemoteVerbose(output), [
      { name: 'origin', fetchUrl: '/tmp/remote.git', pushUrl: '/tmp/remote.git' },
    ])
  })

  test('returns no remotes for empty output', () => {
    assert.deepEqual(parseRemoteVerbose(''), [])
    assert.deepEqual(parseRemoteVerbose('\n'), [])
  })
})

describe('remoteNameOf', () => {
  test('accepts ordinary remote names', () => {
    for (const name of ['origin', 'upstream', 'team/fork', 'a', 'x'.repeat(200)]) {
      assert.equal(remoteNameOf(name), name)
    }
  })

  test('rejects option-like and structurally invalid names', () => {
    for (const value of [
      '',
      '-force',
      '--upload-pack=evil',
      'has space',
      'has\ttab',
      'has\nnewline',
      'has\u0001control',
      'has..dots',
      'has:colon',
      'has?question',
      'has*star',
      'has[glob',
      'has\\slash',
      'has~tilde',
      'has^caret',
      'has@{brace',
      '..',
      'trailing/',
      'trailing.',
      'name.lock',
      'x'.repeat(201),
    ]) {
      const failure = captureFailure(() => remoteNameOf(value))
      assert.equal(failure.code, 'bad-request', `value ${JSON.stringify(value)}`)
      assert.equal(failure.status, 400)
    }
  })

  test('rejects non-string values', () => {
    for (const value of [undefined, null, 42, true, {}, ['origin']]) {
      const failure = captureFailure(() => remoteNameOf(value))
      assert.equal(failure.code, 'bad-request')
      assert.equal(failure.status, 400)
    }
  })
})

describe('parseRemoteBranches', () => {
  test('keeps Git order and exposes the remote and branch parts', () => {
    const output = [
      refLine('refs/remotes/origin/feature/x'),
      refLine('refs/remotes/origin/alpha'),
      refLine('refs/remotes/origin/zeta'),
      '',
    ].join('\n')
    assert.deepEqual(parseRemoteBranches(output, ['origin']), [
      { name: 'origin/feature/x', remote: 'origin', branch: 'feature/x' },
      { name: 'origin/alpha', remote: 'origin', branch: 'alpha' },
      { name: 'origin/zeta', remote: 'origin', branch: 'zeta' },
    ])
  })

  test('skips symbolic and literal HEAD pointers', () => {
    const output = [
      refLine('refs/remotes/origin/HEAD', 'refs/remotes/origin/main'),
      refLine('refs/remotes/origin/HEAD'),
      refLine('refs/remotes/origin/main'),
    ].join('\n')
    assert.deepEqual(parseRemoteBranches(output, ['origin']), [
      { name: 'origin/main', remote: 'origin', branch: 'main' },
    ])
  })

  test('attributes a ref to the longest configured remote prefix', () => {
    const output = [
      refLine('refs/remotes/team/fork/dev'),
      refLine('refs/remotes/team/main'),
      refLine('refs/remotes/origin/main'),
    ].join('\n')
    assert.deepEqual(parseRemoteBranches(output, ['team/fork', 'origin', 'team']), [
      { name: 'team/fork/dev', remote: 'team/fork', branch: 'dev' },
      { name: 'team/main', remote: 'team', branch: 'main' },
      { name: 'origin/main', remote: 'origin', branch: 'main' },
    ])
    assert.deepEqual(parseRemoteBranches(output, ['team']), [
      { name: 'team/fork/dev', remote: 'team', branch: 'fork/dev' },
      { name: 'team/main', remote: 'team', branch: 'main' },
    ])
  })

  test('skips malformed records and refs of unconfigured remotes', () => {
    const output = [
      '',
      'garbage',
      'refs/heads/main',
      refLine('refs/remotes/'),
      refLine('refs/remotes/unconfigured/topic'),
      refLine('refs/remotes/origin/'),
      refLine('refs/remotes/origin/main'),
    ].join('\n')
    assert.deepEqual(parseRemoteBranches(output, ['origin']), [
      { name: 'origin/main', remote: 'origin', branch: 'main' },
    ])
  })

  test('tolerates CRLF line endings and empty output', () => {
    assert.deepEqual(
      parseRemoteBranches(`${refLine('refs/remotes/origin/main')}\r\n`, ['origin']),
      [{ name: 'origin/main', remote: 'origin', branch: 'main' }],
    )
    assert.deepEqual(parseRemoteBranches('', ['origin']), [])
    assert.deepEqual(parseRemoteBranches('\n', ['origin']), [])
  })
})

describe('remoteUrlOf', () => {
  test('accepts every scheme and ordinary URL text', () => {
    for (const url of [
      'https://example.test/repo.git',
      'ssh://git@example.test/repo.git',
      'git@example.test:team/repo.git',
      'file:///tmp/repo.git',
      '/tmp/plain/path.git',
      ' C:/repos/example.git ',
    ]) {
      assert.equal(remoteUrlOf(url), url)
    }
  })

  test('rejects option-shaped, control-bearing and oversized URLs', () => {
    for (const value of [
      '',
      '-u',
      '--upload-pack=evil',
      'has\nnewline',
      'has\rcarriage',
      'has\ttab',
      'has\u0000nul',
      'has\u0001control',
      'x'.repeat(4097),
    ]) {
      const failure = captureFailure(() => remoteUrlOf(value))
      assert.equal(failure.code, 'bad-request', `value ${JSON.stringify(value)}`)
      assert.equal(failure.status, 400)
    }
  })

  test('rejects non-string values', () => {
    for (const value of [undefined, null, 42, true, {}, ['/tmp/repo.git']]) {
      assert.throws(() => remoteUrlOf(value), GitGraphError)
    }
  })
})

describe('optionalRemoteNameOf', () => {
  test('returns undefined when the field is absent', () => {
    assert.equal(optionalRemoteNameOf(undefined), undefined)
  })

  test('validates a present name like a required field', () => {
    assert.equal(optionalRemoteNameOf('origin'), 'origin')
    assert.throws(() => optionalRemoteNameOf(''), GitGraphError)
    assert.throws(() => optionalRemoteNameOf(null), GitGraphError)
  })
})
