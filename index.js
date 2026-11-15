/**
 * Host half of the Git graph bundle: entry and route assembly.
 *
 * The browser half is a pure renderer: it asks this half for structured
 * repository state and operations over one guarded `/api/dsh-git-graph` route
 * family. Every Git command runs in the Session's working directory, with the
 * workspace filesystem's permissions, and never through a shell.
 *
 * This entry owns only the guard, the HTTP method checks, and the wire
 * envelope; the operations themselves live under `src/host/`.
 */
import { normalizeFailure } from './src/host/errors.js'
import { readJsonBody, sendJson } from './src/host/http/respond.js'
import { isTrustedRequest } from './src/host/http/trust.js'
import { dispatch, HEALTH_PATH, RPC_PATH } from './src/host/rpc.js'

/** Host services this bundle cannot run without. */
export const inject = ['webServer']

/**
 * Answer an untrusted request with the stable refusal envelope.
 * @param {import('node:http').ServerResponse} response - Node response.
 */
function refuseUntrusted(response) {
  sendJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'Request refused.' } })
}

/**
 * Register the guarded route family.
 * @param {import('@deepseek-ai/cordis').Context} ctx - Host context.
 * @returns {() => void} disposer removing both routes.
 */
export function apply(ctx) {
  const disposeHealth = ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: HEALTH_PATH,
    handler: (request, response) => {
      if (!isTrustedRequest(request)) return refuseUntrusted(response)
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { allow: 'GET, HEAD' })
        response.end()
        return
      }
      sendJson(response, 200, { ok: true, service: '@local/dsh-git-graph' })
    },
  }), 'git-graph: health route')

  const disposeRpc = ctx.effect(() => ctx.webServer.register({
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
        sendJson(response, 400, { ok: false, error: { code: 'bad-request', message: 'A JSON object body is required.' } })
        return
      }
      try {
        const value = await dispatch(ctx, payload)
        sendJson(response, 200, { ok: true, value })
      } catch (error) {
        const failure = normalizeFailure(error)
        sendJson(response, failure.status, { ok: false, error: { code: failure.code, message: failure.message } })
      }
    },
  }), 'git-graph: rpc route')

  return () => {
    disposeRpc()
    disposeHealth()
  }
}
