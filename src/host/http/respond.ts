/**
 * JSON response and request-body helpers for the plugin's route family.
 *
 * This module is a leaf: it must not import anything from the project so the
 * routes stay testable without a Host context or a Git repository.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

const MAX_BODY_BYTES = 256 * 1024

/**
 * Whether a parsed JSON value is a plain object.
 * @param value - parsed value.
 * @returns true for a non-null, non-array object.
 */
function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Answer one JSON body with a stable envelope.
 * @param response - Node response.
 * @param status - HTTP status.
 * @param value - JSON-serializable value.
 */
export function sendJson(response: ServerResponse, status: number, value: unknown): void {
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
 * @param request - Node request.
 * @returns the parsed object, or null when malformed or oversized.
 */
export function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolveBody) => {
    const chunks: Buffer[] = []
    let bytes = 0
    let refused = false
    request.on('data', (chunk: Buffer | string) => {
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
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        resolveBody(isJsonObject(parsed) ? parsed : null)
      } catch {
        resolveBody(null)
      }
    })
    request.on('error', () => resolveBody(null))
  })
}
