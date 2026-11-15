/**
 * Stable failures shared by the Host half.
 *
 * Every route answers with a JSON envelope; errors that a caller may act on
 * carry a stable code and an HTTP status instead of a raw exception.
 */

/** A failure that crosses the wire with a stable code and a human message. */
export class GitGraphError extends Error {
  /**
   * @param {string} code - stable failure code.
   * @param {string} message - human-readable description.
   * @param {number} [status] - HTTP status to answer with.
   */
  constructor(code, message, status = 500) {
    super(message)
    this.name = 'GitGraphError'
    this.code = code
    this.status = status
  }
}

/**
 * Report Git failures with the Host's own words, keeping the stable code when it is one of ours.
 * @param {unknown} error - thrown value.
 * @returns {GitGraphError} normalized failure.
 */
export function normalizeFailure(error) {
  if (error instanceof GitGraphError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new GitGraphError('internal', message, 500)
}
