/**
 * Build the panel command caller and the failure objects it throws.
 */

import { RPC_PATH } from '../constants.ts'
import type {
  CallerFailure,
  Failure,
  GitGraphOperation,
  GitGraphPayloads,
  GitGraphRpcValues,
  RpcCall,
} from '../types/domain.ts'

/** Minimal shape of one Host response body before validation. */
interface UnknownResponseBody {
  readonly ok?: unknown
  readonly value?: unknown
  readonly error?: {
    readonly code?: unknown
    readonly message?: unknown
  }
}

/**
 * Build one failure object.
 * @param code - stable failure code.
 * @param message - failure detail.
 * @param status - HTTP status when the Host answered.
 * @returns failure object.
 */
export function makeFailure(code: string, message: string, status?: number): CallerFailure {
  return Object.assign(new Error(message || code), {
    code,
    detail: message || '',
    status,
  })
}

/**
 * Keep the display-relevant fields of a thrown value.
 *
 * Hooks store this narrower envelope rather than the thrown value itself: the
 * panel only reads `code` and `message`, and a non-Error throw must still fall
 * back to the generic failure text.
 * @param error - value caught by a panel loader or action.
 * @returns failure envelope with the fields the panel can display.
 */
export function toFailure(error: unknown): Failure {
  if (error === null || typeof error !== 'object') return {}
  const candidate = error as { readonly code?: unknown; readonly message?: unknown }
  return {
    ...(typeof candidate.code === 'string' ? { code: candidate.code } : {}),
    ...(typeof candidate.message === 'string' ? { message: candidate.message } : {}),
  }
}

/**
 * Build the RPC caller bound to one Session.
 * @param sessionId - Session whose working directory the Host uses.
 * @returns operation caller bound to that Session.
 */
export function createCaller(sessionId: string): RpcCall {
  return async function call<Operation extends GitGraphOperation>(
    op: Operation,
    ...args: [payload?: GitGraphPayloads[Operation]]
  ): Promise<GitGraphRpcValues[Operation]> {
    const payload = args[0]
    let response: Response
    try {
      response = await fetch(RPC_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-dsh-git-graph': '1' },
        body: JSON.stringify({ sessionId, op, ...(payload ?? {}) }),
      })
    } catch (cause) {
      throw makeFailure('network', cause instanceof Error ? cause.message : String(cause))
    }
    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw makeFailure(
        'bad-response',
        `The Host answered HTTP ${response.status}.`,
        response.status,
      )
    }
    if (data === null || typeof data !== 'object')
      throw makeFailure(
        'bad-response',
        `The Host answered HTTP ${response.status}.`,
        response.status,
      )
    const body = data as UnknownResponseBody
    if (body.ok !== true) {
      const error = body.error ?? {}
      throw makeFailure(
        typeof error.code === 'string' ? error.code : 'internal',
        typeof error.message === 'string' ? error.message : '',
        response.status,
      )
    }
    return body.value as GitGraphRpcValues[Operation]
  }
}
