/**
 * Build the panel command caller and the failure objects it throws.
 */

import { RPC_PATH } from '../constants.js'

export function makeFailure(code, message, status) {
  const failure = new Error(message || code)
  failure.code = code
  failure.detail = message || ''
  failure.status = status
  return failure
}

export function createCaller(sessionId) {
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
