/**
 * A real loopback Host server over a fake context for Host-half tests.
 *
 * The bundle's routes are registered exactly as the runtime would register
 * them, and the server is a real HTTP listener, so requests exercise the trust
 * fence, body reader and JSON envelope. `withSessionServer` also disposes the
 * plugin registrations, including the repository watch registry.
 */

import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type {
  HostContext,
  SessionPersistenceService,
  SessionsService,
  WebServerRoute,
  WorkingDirectoryService,
} from '../../src/host/context.ts'
import { apply } from '../../src/host-entry.ts'

/** Registered routes plus the plugin registration disposer. */
export interface TestHostServer {
  /** Routes by exact path. */
  routes: Map<string, WebServerRoute>
  /** Remove the registered routes and dispose the watch registry. */
  dispose: () => void
}

/**
 * Build a fake Host context and register the bundle's routes with it.
 * @param cwd - Session working directory the fake services report.
 * @returns the registered routes and their disposer.
 */
export function createFakeContext(cwd: string): TestHostServer {
  const routes = new Map<string, WebServerRoute>()
  function get(name: 'sessions'): SessionsService | undefined
  function get(name: 'workingDirectory'): WorkingDirectoryService | undefined
  function get(name: 'sessionPersistence'): SessionPersistenceService | undefined
  function get(name: string): unknown
  function get(
    name: string,
  ): SessionsService | WorkingDirectoryService | SessionPersistenceService | undefined {
    if (name === 'sessions')
      return { get: (id: string) => (id === 'session-1' ? { header: { cwd } } : undefined) }
    if (name === 'workingDirectory') return { get: () => cwd }
    if (name === 'sessionPersistence')
      return { stat: async (id: string) => (id === 'session-1' ? { header: { cwd } } : undefined) }
    return undefined
  }
  const ctx: HostContext = {
    effect(setup) {
      const disposer = setup()
      return () => {
        if (typeof disposer === 'function') disposer()
      }
    },
    webServer: {
      register(route) {
        if (routes.has(route.path)) throw new Error(`duplicate route ${route.path}`)
        routes.set(route.path, route)
        return () => {
          routes.delete(route.path)
        }
      },
    },
    get,
  }
  const dispose = apply(ctx)
  return { routes, dispose }
}

/**
 * Serve the registered routes through a real loopback server.
 * @param routes - routes returned by `createFakeContext`.
 * @returns the unstarted server.
 */
export function routeServer(routes: Map<string, WebServerRoute>): Server {
  return createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    const route = routes.get(path)
    if (route === undefined) {
      response.writeHead(404)
      response.end()
      return
    }
    void route.handler(request, response)
  })
}

/**
 * Read the bound port of a listening test server.
 * @param target - listening server.
 * @returns its TCP port.
 */
export function serverPort(target: Server): number {
  const address = target.address()
  assert.ok(address !== null && typeof address === 'object', 'the test server has no TCP address')
  return address.port
}

/**
 * Run an operation against one Session's real loopback server.
 * @param cwd - Session working directory.
 * @param operation - receives the server URL.
 * @returns the operation result.
 */
export async function withSessionServer<T>(
  cwd: string,
  operation: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const host = createFakeContext(cwd)
  const other = routeServer(host.routes)
  await new Promise<void>((resolve) => {
    other.listen(0, '127.0.0.1', resolve)
  })
  try {
    return await operation(`http://127.0.0.1:${serverPort(other)}`)
  } finally {
    await new Promise<void>((resolve) => {
      other.close(() => resolve())
    })
    host.dispose()
  }
}
