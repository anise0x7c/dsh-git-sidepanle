/**
 * Boundary tests for the Host half's leaves.
 *
 * These cover the trust fence, the JSON body reader, failure normalization, and
 * Session working-directory fallbacks directly, without a Host context or a Git
 * process where one is not needed. The requests are real `IncomingMessage`
 * instances so the fence sees the same header and socket shapes the web server
 * hands it.
 */

import assert from 'node:assert/strict'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import { describe, test } from 'node:test'
import type {
  HostContext,
  SessionPersistenceService,
  SessionsService,
  WorkingDirectoryService,
} from '../../src/host/context.ts'
import { GitGraphError, normalizeFailure } from '../../src/host/errors.ts'
import { readJsonBody } from '../../src/host/http/respond.ts'
import {
  isLoopbackAddress,
  isLoopbackHostname,
  isTrustedRequest,
} from '../../src/host/http/trust.ts'
import { resolveSessionDirectory } from '../../src/host/session.ts'

/** Body limit mirrored from `http/respond.ts`; the exact value is the contract. */
const MAX_BODY_BYTES = 256 * 1024
/** The authority every trusted request in this file uses. */
const AUTHORITY = '127.0.0.1:43329'

/** Options accepted by the real-request helper. */
interface RequestOptions {
  /** Complete header map, already lower-cased. */
  headers?: Record<string, string>
  /** Socket remote address; defaults to loopback. */
  remoteAddress?: string
}

/**
 * Build a real `IncomingMessage` with a controllable header map and peer address.
 * @param options - header map and socket remote address.
 * @returns a request the fence can inspect.
 */
function requestWith(options: RequestOptions = {}): IncomingMessage {
  const request = new IncomingMessage(new Socket())
  request.headers = options.headers ?? {}
  Object.defineProperty(request.socket, 'remoteAddress', {
    value: options.remoteAddress ?? '127.0.0.1',
    configurable: true,
  })
  return request
}

const TRUSTED_HEADERS: Record<string, string> = {
  host: AUTHORITY,
  'x-dsh-git-graph': '1',
  'sec-fetch-site': 'same-origin',
  origin: `http://${AUTHORITY}`,
}

/**
 * Build a request that starts from the fully trusted header set.
 * @param overrides - header values to replace, or delete when undefined.
 * @param remoteAddress - socket remote address, defaults to loopback.
 * @returns the request.
 */
function trustRequest(
  overrides: Record<string, string | undefined> = {},
  remoteAddress = '127.0.0.1',
): IncomingMessage {
  const headers: Record<string, string> = { ...TRUSTED_HEADERS }
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) delete headers[name]
    else headers[name] = value
  }
  return requestWith({ headers, remoteAddress })
}

/**
 * Build a request whose body is already buffered in the stream.
 * @param chunks - body chunks in order.
 * @returns the request.
 */
function bodyRequest(chunks: readonly (string | Buffer)[]): IncomingMessage {
  const request = requestWith()
  for (const chunk of chunks) request.push(chunk)
  request.push(null)
  return request
}

/**
 * Read one string field from a parsed JSON object.
 * @param value - parsed object.
 * @param name - field name.
 * @returns the field as a string.
 */
function stringField(value: Record<string, unknown>, name: string): string {
  const field = value[name]
  if (typeof field !== 'string') assert.fail(`expected a string field named ${name}`)
  return field
}

/**
 * Await a call that must fail with a stable `GitGraphError`.
 * @param operation - call expected to fail.
 * @returns the thrown failure.
 */
async function captureFailure(operation: Promise<unknown>): Promise<GitGraphError> {
  try {
    await operation
  } catch (error) {
    assert.ok(error instanceof GitGraphError, `expected a GitGraphError, got ${String(error)}`)
    return error
  }
  assert.fail('the call should have been refused')
}

/** Services a Session lookup may see, each optional like the real context. */
interface SessionServices {
  sessions?: SessionsService
  workingDirectory?: WorkingDirectoryService
  sessionPersistence?: SessionPersistenceService
}

/**
 * Build the minimal context `resolveSessionDirectory` reads.
 * @param services - service overrides.
 * @returns a Host context for the lookup.
 */
function contextWith(services: SessionServices): HostContext {
  function get(name: 'sessions'): SessionsService | undefined
  function get(name: 'workingDirectory'): WorkingDirectoryService | undefined
  function get(name: 'sessionPersistence'): SessionPersistenceService | undefined
  function get(name: string): unknown
  function get(name: string): unknown {
    if (name === 'sessions') return services.sessions
    if (name === 'workingDirectory') return services.workingDirectory
    if (name === 'sessionPersistence') return services.sessionPersistence
    return undefined
  }
  return {
    effect(setup) {
      const dispose = setup()
      return () => {
        if (typeof dispose === 'function') dispose()
      }
    },
    webServer: { register: () => () => {} },
    get,
  }
}

describe('isLoopbackAddress', () => {
  test('accepts IPv4 and IPv6 loopback literals', () => {
    for (const address of [
      '127.0.0.1',
      '127.1.2.3',
      '127.255.255.255',
      '::1',
      '::ffff:127.0.0.1',
    ]) {
      assert.equal(isLoopbackAddress(address), true, address)
    }
  })

  test('refuses other addresses, malformed literals, and missing values', () => {
    for (const address of [
      '128.0.0.1',
      '10.0.0.1',
      '127.0.0.256',
      '127.0.0',
      '::ffff:10.0.0.1',
      'localhost',
      '',
      undefined,
    ]) {
      assert.equal(isLoopbackAddress(address), false, String(address))
    }
  })
})

describe('isLoopbackHostname', () => {
  test('accepts localhost and loopback literals', () => {
    for (const hostname of ['localhost', '[::1]', '127.0.0.1', '127.9.9.9']) {
      assert.equal(isLoopbackHostname(hostname), true, hostname)
    }
  })

  test('refuses other names, different case, and empty values', () => {
    for (const hostname of ['LOCALHOST', 'example.test', '0.0.0.0', '']) {
      assert.equal(isLoopbackHostname(hostname), false, hostname)
    }
  })
})

describe('isTrustedRequest', () => {
  test('accepts the fully trusted same-origin loopback request', () => {
    assert.equal(isTrustedRequest(trustRequest()), true)
  })

  test('requires the bundle request header', () => {
    assert.equal(isTrustedRequest(trustRequest({ 'x-dsh-git-graph': undefined })), false)
    assert.equal(isTrustedRequest(trustRequest({ 'x-dsh-git-graph': '0' })), false)
  })

  test('refuses either proxy header', () => {
    assert.equal(isTrustedRequest(trustRequest({ 'x-forwarded-for': '203.0.113.5' })), false)
    assert.equal(isTrustedRequest(trustRequest({ 'cf-connecting-ip': '203.0.113.5' })), false)
  })

  test('requires a loopback socket address', () => {
    assert.equal(isTrustedRequest(trustRequest({}, '10.1.2.3')), false)
    assert.equal(isTrustedRequest(trustRequest({}, '')), false)
    assert.equal(isTrustedRequest(trustRequest({}, '::1')), true)
  })

  test('requires a loopback Host header', () => {
    assert.equal(isTrustedRequest(trustRequest({ host: 'example.test:43329' })), false)
    assert.equal(isTrustedRequest(trustRequest({ host: undefined })), false)
    assert.equal(isTrustedRequest(trustRequest({ host: '' })), false)
    assert.equal(
      isTrustedRequest(trustRequest({ host: 'localhost:43329', origin: 'http://localhost:43329' })),
      true,
    )
    assert.equal(
      isTrustedRequest(trustRequest({ host: '[::1]:43329', origin: 'http://[::1]:43329' })),
      true,
    )
  })

  test('refuses a Host header that is not a valid URL authority', () => {
    assert.equal(isTrustedRequest(trustRequest({ host: '[::1' })), false)
  })

  test('requires same-origin browser markers when present', () => {
    assert.equal(isTrustedRequest(trustRequest({ 'sec-fetch-site': undefined })), true)
    assert.equal(isTrustedRequest(trustRequest({ 'sec-fetch-site': 'same-site' })), false)
    assert.equal(isTrustedRequest(trustRequest({ 'sec-fetch-site': 'cross-site' })), false)
    assert.equal(isTrustedRequest(trustRequest({ 'sec-fetch-site': '' })), false)
  })

  test('matches a present Origin authority against the Host header', () => {
    assert.equal(isTrustedRequest(trustRequest({ origin: 'http://127.0.0.1:43329' })), true)
    assert.equal(isTrustedRequest(trustRequest({ origin: 'http://127.0.0.1:9999' })), false)
    assert.equal(isTrustedRequest(trustRequest({ origin: 'https://example.test' })), false)
    assert.equal(isTrustedRequest(trustRequest({ origin: 'not a URL' })), false)
  })

  test('accepts an absent or empty Origin, as before', () => {
    assert.equal(isTrustedRequest(trustRequest({ origin: undefined })), true)
    assert.equal(isTrustedRequest(trustRequest({ origin: '' })), true)
  })
})

describe('readJsonBody', () => {
  test('parses a JSON object body', async () => {
    assert.deepEqual(await readJsonBody(bodyRequest(['{"a":1,"b":"two"}'])), { a: 1, b: 'two' })
  })

  test('parses a body split across chunks', async () => {
    assert.deepEqual(await readJsonBody(bodyRequest(['{"a":', '1}'])), { a: 1 })
  })

  test('refuses malformed JSON, non-objects, and an empty body', async () => {
    for (const body of ['', '{', '{"a":1', '{"a":1}x', '[1,2]', 'null', 'true', '42', '"text"']) {
      assert.equal(await readJsonBody(bodyRequest([body])), null, body)
    }
  })

  test('accepts a body of exactly the size limit', async () => {
    const prefix = '{"data":"'
    const suffix = '"}'
    const filler = 'a'.repeat(MAX_BODY_BYTES - prefix.length - suffix.length)
    const body = `${prefix}${filler}${suffix}`
    assert.equal(Buffer.byteLength(body), MAX_BODY_BYTES)
    const parsed = await readJsonBody(bodyRequest([body]))
    assert.notEqual(parsed, null)
    assert.equal(
      stringField(parsed ?? {}, 'data').length,
      MAX_BODY_BYTES - prefix.length - suffix.length,
    )
  })

  test('refuses a valid JSON body one byte over the limit, across chunks', async () => {
    const prefix = '{"data":"'
    const suffix = '"}'
    const filler = 'a'.repeat(MAX_BODY_BYTES + 1 - prefix.length - suffix.length)
    const body = `${prefix}${filler}${suffix}`
    assert.equal(Buffer.byteLength(body), MAX_BODY_BYTES + 1)
    const split = Math.floor(body.length / 2)
    assert.equal(await readJsonBody(bodyRequest([body.slice(0, split), body.slice(split)])), null)
  })

  test('resolves null when the request stream errors', async () => {
    const request = requestWith()
    const pending = readJsonBody(request)
    request.destroy(new Error('stream failed'))
    assert.equal(await pending, null)
  })
})

describe('normalizeFailure', () => {
  test('keeps a GitGraphError unchanged', () => {
    const failure = new GitGraphError('not-a-repository', 'No repository here.', 409)
    assert.equal(normalizeFailure(failure), failure)
  })

  test('wraps an Error as an internal 500', () => {
    const failure = normalizeFailure(new Error('boom'))
    assert.ok(failure instanceof GitGraphError)
    assert.equal(failure.code, 'internal')
    assert.equal(failure.status, 500)
    assert.equal(failure.message, 'boom')
    assert.equal(failure.name, 'GitGraphError')
  })

  test('stringifies non-Error values', () => {
    assert.equal(normalizeFailure('plain failure').message, 'plain failure')
    assert.equal(normalizeFailure({ reason: 'x' }).message, '[object Object]')
    assert.equal(normalizeFailure(undefined).message, 'undefined')
  })
})

describe('resolveSessionDirectory', () => {
  test('refuses missing, empty, and non-string Session identities before lookup', async () => {
    for (const sessionId of [undefined, null, '', 42, {}]) {
      const failure = await captureFailure(resolveSessionDirectory(contextWith({}), sessionId))
      assert.equal(failure.code, 'bad-request', String(sessionId))
      assert.equal(failure.status, 400)
    }
  })

  test('prefers the live working-directory service over the Session header', async () => {
    const context = contextWith({
      sessions: { get: (id) => (id === 'session-1' ? { header: { cwd: '/header' } } : undefined) },
      workingDirectory: { get: () => '/live' },
      sessionPersistence: {
        stat: async () => {
          throw new Error('persistence must not be read')
        },
      },
    })
    assert.equal(await resolveSessionDirectory(context, 'session-1'), '/live')
  })

  test('falls back to the Session header when the working directory throws', async () => {
    const context = contextWith({
      sessions: { get: () => ({ header: { cwd: '/header' } }) },
      workingDirectory: {
        get: () => {
          throw new Error('no live directory')
        },
      },
    })
    assert.equal(await resolveSessionDirectory(context, 'session-1'), '/header')
  })

  test('falls back to the Session header when the working directory is empty', async () => {
    const context = contextWith({
      sessions: { get: () => ({ header: { cwd: '/header' } }) },
      workingDirectory: { get: () => '' },
    })
    assert.equal(await resolveSessionDirectory(context, 'session-1'), '/header')
  })

  test('falls back to the Session header when the working directory service is absent', async () => {
    const context = contextWith({
      sessions: { get: () => ({ header: { cwd: '/header' } }) },
    })
    assert.equal(await resolveSessionDirectory(context, 'session-1'), '/header')
  })

  test('falls back to persisting the Session when no live Session exists', async () => {
    const context = contextWith({
      sessions: { get: () => undefined },
      sessionPersistence: {
        stat: async (id) => (id === 'session-1' ? { header: { cwd: '/persisted' } } : undefined),
      },
    })
    assert.equal(await resolveSessionDirectory(context, 'session-1'), '/persisted')
  })

  test('falls back to persistence when the Session registry or its get method is absent', async () => {
    for (const sessions of [undefined, {}]) {
      const context = contextWith({
        sessions,
        sessionPersistence: { stat: async () => ({ header: { cwd: '/persisted' } }) },
      })
      assert.equal(await resolveSessionDirectory(context, 'session-1'), '/persisted')
    }
  })

  test('falls back to persistence when the Session header has no directory', async () => {
    // A Session exists, so the live working-directory service is consulted
    // first; it is absent here, the header is empty, and persistence answers.
    const context = contextWith({
      sessions: { get: () => ({ header: {} }) },
      sessionPersistence: { stat: async () => ({ header: { cwd: '/persisted' } }) },
    })
    assert.equal(await resolveSessionDirectory(context, 'session-1'), '/persisted')
  })

  test('refuses a Session with no directory anywhere', async () => {
    const missingSession = await captureFailure(
      resolveSessionDirectory(contextWith({}), 'session-9'),
    )
    assert.equal(missingSession.code, 'session-not-found')
    assert.equal(missingSession.status, 404)
    assert.match(missingSession.message, /session-9/)

    const missingPersistence = await captureFailure(
      resolveSessionDirectory(
        contextWith({
          sessions: { get: () => ({ header: {} }) },
          sessionPersistence: {},
        }),
        'session-1',
      ),
    )
    assert.equal(missingPersistence.code, 'session-not-found')
    assert.equal(missingPersistence.status, 404)
  })

  test('ignores a persisted snapshot for another Session', async () => {
    const context = contextWith({
      sessionPersistence: {
        stat: async (id) => (id === 'session-1' ? { header: { cwd: '/other' } } : undefined),
      },
    })
    const failure = await captureFailure(resolveSessionDirectory(context, 'session-2'))
    assert.equal(failure.code, 'session-not-found')
    assert.equal(failure.status, 404)
  })
})
