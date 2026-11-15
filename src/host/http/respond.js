/**
 * JSON response and request-body helpers for the plugin's route family.
 *
 * This module is a leaf: it must not import anything from the project so the
 * routes stay testable without a Host context or a Git repository.
 */

const MAX_BODY_BYTES = 256 * 1024

/**
 * Answer one JSON body with a stable envelope.
 * @param {import('node:http').ServerResponse} response - Node response.
 * @param {number} status - HTTP status.
 * @param {unknown} value - JSON-serializable value.
 */
export function sendJson(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  response.end(body)
}

/**
 * Read a bounded JSON object body.
 * @param {import('node:http').IncomingMessage} request - Node request.
 * @returns {Promise<Record<string, unknown> | null>} the parsed object, or null when malformed or oversized.
 */
export function readJsonBody(request) {
  return new Promise((resolveBody) => {
    const chunks = []
    let bytes = 0
    let refused = false
    request.on('data', (chunk) => {
      if (refused) return
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += buffer.length
      if (bytes > MAX_BODY_BYTES) {
        refused = true
        chunks.length = 0
        return
      }
      chunks.push(buffer)
    })
    request.on('end', () => {
      if (refused) return resolveBody(null)
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        resolveBody(parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null)
      } catch {
        resolveBody(null)
      }
    })
    request.on('error', () => resolveBody(null))
  })
}
