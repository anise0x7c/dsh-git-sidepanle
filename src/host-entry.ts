/**
 * Host half of the Git graph bundle: entry and route assembly.
 *
 * The browser half is a pure renderer: it asks this half for structured
 * repository state and operations over one guarded `/api/dsh-git-sidepanel` route
 * family. Every Git command runs in the Session's working directory, with the
 * workspace filesystem's permissions, and never through a shell.
 *
 * This entry owns only the guard, the HTTP method checks, and the wire
 * envelope; the operations themselves live under `src/host/`.
 */
import type { ServerResponse } from 'node:http'
import type { HostContext } from './host/context.ts'
import { normalizeFailure } from './host/errors.ts'
import { readJsonBody, sendJson } from './host/http/respond.ts'
import { isTrustedRequest } from './host/http/trust.ts'
import { dispatch, HEALTH_PATH, RPC_PATH } from './host/rpc.ts'
import { createRepositoryWatchRegistry } from './host/watch/registry.ts'

/** Host services this bundle cannot run without. */
export const inject = ['webServer'] as const

/**
 * Answer an untrusted request with the stable refusal envelope.
 * @param response - Node response.
 */
function refuseUntrusted(response: ServerResponse): void {
  sendJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'Request refused.' } })
}

/**
 * Register the guarded route family.
 * @param ctx - Host context.
 * @returns disposer removing both routes.
 */
export function apply(ctx: HostContext): () => void {
  // One registry per plugin instance: every panel of every Session shares the
  // watchers of a repository, and unloading the plugin closes all of them.
  const registry = createRepositoryWatchRegistry()
  const disposeWatch = ctx.effect(() => () => registry.dispose(), 'git-sidepanel: repository watch')

  const disposeHealth = ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: HEALTH_PATH,
        handler: (request, response) => {
          if (!isTrustedRequest(request)) return refuseUntrusted(response)
          if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { allow: 'GET, HEAD' })
            response.end()
            return
          }
          sendJson(response, 200, { ok: true, service: 'dsh-git-sidepanel' })
        },
      }),
    'git-sidepanel: health route',
  )

  const disposeRpc = ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: RPC_PATH,
        handler: async (request, response) => {
          if (!isTrustedRequest(request)) return refuseUntrusted(response)
          if (request.method !== 'POST') {
            response.writeHead(405, { allow: 'POST' })
            response.end()
            return
          }
          const payload = await readJsonBody(request)
          if (payload === null) {
            sendJson(response, 400, {
              ok: false,
              error: { code: 'bad-request', message: 'A JSON object body is required.' },
            })
            return
          }
          try {
            const value = await dispatch(ctx, payload, registry)
            sendJson(response, 200, { ok: true, value })
          } catch (error) {
            const failure = normalizeFailure(error)
            sendJson(response, failure.status, {
              ok: false,
              error: { code: failure.code, message: failure.message },
            })
          }
        },
      }),
    'git-sidepanel: rpc route',
  )

  return () => {
    disposeRpc()
    disposeHealth()
    disposeWatch()
  }
}
