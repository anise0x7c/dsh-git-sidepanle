/**
 * Session identity to working directory resolution.
 */
import type { HostContext } from './context.ts'
import { GitGraphError } from './errors.ts'

/**
 * Resolve a Session's working directory without activating its Agent.
 * @param ctx - Host context.
 * @param sessionId - wire identity.
 * @returns absolute directory.
 */
export async function resolveSessionDirectory(
  ctx: HostContext,
  sessionId: unknown,
): Promise<string> {
  if (typeof sessionId !== 'string' || sessionId === '') {
    throw new GitGraphError('bad-request', 'A Session identity is required.', 400)
  }
  const sessions = ctx.get('sessions')
  const session = sessions?.get?.(sessionId)
  if (session !== undefined) {
    const workingDirectory = ctx.get('workingDirectory')
    try {
      const directory = workingDirectory?.get?.(session)
      if (typeof directory === 'string' && directory !== '') return directory
    } catch {
      // Fall through to the Session header.
    }
    const headerDirectory = session.header?.cwd
    if (typeof headerDirectory === 'string' && headerDirectory !== '') return headerDirectory
  }
  const persistence = ctx.get('sessionPersistence')
  if (persistence?.stat !== undefined) {
    const snapshot = await persistence.stat(sessionId)
    const directory = snapshot?.header?.cwd
    if (typeof directory === 'string' && directory !== '') return directory
  }
  throw new GitGraphError(
    'session-not-found',
    `Session "${sessionId}" has no working directory.`,
    404,
  )
}
