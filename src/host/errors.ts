/**
 * Stable failures shared by the Host half.
 *
 * Every route answers with a JSON envelope; errors that a caller may act on
 * carry a stable code and an HTTP status instead of a raw exception.
 */

/** A failure that crosses the wire with a stable code and a human message. */
export class GitGraphError extends Error {
  /** Stable failure code. */
  declare readonly code: string
  /** HTTP status the route answers with. */
  declare readonly status: number

  /**
   * @param code - stable failure code.
   * @param message - human-readable description.
   * @param status - HTTP status to answer with.
   */
  constructor(code: string, message: string, status = 500) {
    super(message)
    this.name = 'GitGraphError'
    this.code = code
    this.status = status
  }
}

/**
 * Report Git failures with the Host's own words, keeping the stable code when it is one of ours.
 * @param error - thrown value.
 * @returns normalized failure.
 */
export function normalizeFailure(error: unknown): GitGraphError {
  if (error instanceof GitGraphError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new GitGraphError('internal', message, 500)
}
