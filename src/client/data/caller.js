// @ts-check
/**
 * Build the panel command caller and the failure objects it throws.
 */

import { RPC_PATH } from '../constants.js'

/**
 * Error carrying the Host failure envelope; thrown by the panel caller.
 * @typedef {Error & { code: string, detail: string, status: number | undefined }} CallerFailure
 */

/**
 * Call one Host RPC operation for the panel's Session.
 * @typedef {(operation: string, payload?: Record<string, unknown>) => Promise<unknown>} RpcCall
 */

/**
 * Build one failure object.
 * @param {string} code - stable failure code.
 * @param {string} message - failure detail.
 * @param {number} [status] - HTTP status when the Host answered.
 * @returns {CallerFailure} failure object.
 */
export function makeFailure(code, message, status) {
  const failure = /** @type {CallerFailure} */ (new Error(message || code))
  failure.code = code
  failure.detail = message || ''
  failure.status = status
  return failure
}

/**
 * Build the RPC caller bound to one Session.
 * @param {string} sessionId - Session whose working directory the Host uses.
 * @returns {RpcCall} operation caller bound to that Session.
 */
export function createCaller(sessionId) {
  /**
   * @param {string} op - Host operation name.
   * @param {Record<string, unknown>} [payload] - operation arguments.
   * @returns {Promise<unknown>} operation value.
   */
  return async function call(op, payload = {}) {
    let response
    try {
      response = await fetch(RPC_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-dsh-git-graph': '1' },
        body: JSON.stringify({ sessionId, op, ...payload }),
      })
    } catch (cause) {
      throw makeFailure('network', cause instanceof Error ? cause.message : String(cause))
    }
    let data
    try {
      data = await response.json()
    } catch {
      throw makeFailure('bad-response', `The Host answered HTTP ${response.status}.`, response.status)
    }
    if (data === null || typeof data !== 'object') throw makeFailure('bad-response', `The Host answered HTTP ${response.status}.`, response.status)
    if (data.ok !== true) {
      const error = data.error ?? {}
      throw makeFailure(typeof error.code === 'string' ? error.code : 'internal', typeof error.message === 'string' ? error.message : '', response.status)
    }
    return data.value
  }
}
