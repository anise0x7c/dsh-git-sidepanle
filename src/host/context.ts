/**
 * Minimal structural view of the Host context this bundle uses.
 *
 * The Host half is loaded by DSH's Cordis loader, but it needs only three
 * capabilities: `ctx.effect` for scoped cleanup, `ctx.webServer.register` for
 * the guarded route family, and `ctx.get` for Session working-directory
 * lookup. Declaring just those keeps the source independent of the runtime's
 * full Context and service class generics, while still matching the live
 * services structurally.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

/** One route handler as the web server invokes it. */
export type RequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void | Promise<void>

/** One route registration accepted by the Host web server. */
export interface WebServerRoute {
  /** Match the path exactly or as a path prefix. */
  kind: 'exact' | 'prefix'
  /** Absolute route path. */
  path: string
  /** Handler owned by the registering plugin. */
  handler: RequestHandler
}

/** The subset of the Host web server service the bundle registers with. */
export interface WebServerService {
  /** Register one route; returns the disposer that removes it. */
  register(route: WebServerRoute): () => void
}

/** The Session header fields used for working-directory fallback. */
export interface SessionHeader {
  /** Absolute Session working directory, when the header records one. */
  cwd?: string
}

/** One live Session object as `sessions.get` returns it. */
export interface SessionLike {
  /** Session header. */
  header?: SessionHeader
}

/** The subset of the Session registry the bundle reads. */
export interface SessionsService {
  /** Look up one live Session by id. */
  get?: (sessionId: string) => SessionLike | undefined
}

/** The subset of the working-directory service the bundle reads. */
export interface WorkingDirectoryService {
  /** Resolve one Session's working directory. */
  get?: (session: SessionLike) => string | undefined
}

/** One persisted Session snapshot header. */
export interface SessionSnapshot {
  /** Persisted header. */
  header?: SessionHeader
}

/** The subset of the Session persistence service the bundle reads. */
export interface SessionPersistenceService {
  /** Read one persisted Session snapshot. */
  stat?: (sessionId: string) => Promise<SessionSnapshot | undefined>
}

/** Cordis effect setup may return nothing or a lifetime-owned disposer. */
// biome-ignore lint/suspicious/noConfusingVoidType: void models setup callbacks with no return value.
export type EffectCleanup = void | (() => void)

/** The Host context methods the bundle depends on. */
export interface HostContext {
  /** Run one scoped registration and return its disposer. */
  effect(setup: () => EffectCleanup, label?: string): () => void
  /** Host web server service. */
  readonly webServer: WebServerService
  /** Live Session registry. */
  get(name: 'sessions'): SessionsService | undefined
  /** Session working-directory service. */
  get(name: 'workingDirectory'): WorkingDirectoryService | undefined
  /** Session persistence service. */
  get(name: 'sessionPersistence'): SessionPersistenceService | undefined
  /** Any other service; the bundle does not use one. */
  get(name: string): unknown
}
