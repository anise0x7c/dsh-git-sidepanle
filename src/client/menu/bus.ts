/**
 * Per-panel command bus: one shared subscription point for menu command dispatch.
 */

/** One command envelope emitted by a context-menu action. */
export interface PanelCommand {
  /** Panel operation (`open`, `stage`, `discard`, `refresh`, ...). */
  readonly type: string
  /** Session the captured target belongs to. */
  readonly sessionId?: string
  /** Panel instance that captured the target. */
  readonly panelId?: string
  /** Change group the operation applies to. */
  readonly section?: string
  /** One repository-relative path. */
  readonly path?: string
  /** Repository-relative paths. */
  readonly paths?: readonly string[]
  /** A single-entry discard needs one confirmation. */
  readonly single?: boolean
  /** Full commit id for checkout or reference creation. */
  readonly oid?: string
  /** Local branch for a checkout or deletion. */
  readonly branch?: string
  /** New branch or tag name. */
  readonly name?: string
  /** Optional annotated tag message. */
  readonly message?: string
}

/** Dispatch target for menu commands. */
export interface CommandBus {
  /**
   * Deliver one command envelope to every current listener.
   * @param command - envelope sent by a menu action.
   */
  emit(command: PanelCommand): void

  /**
   * Listen until the returned disposer runs.
   * @param listener - handler for emitted commands.
   * @returns unsubscribe.
   */
  subscribe(listener: (command: PanelCommand) => void): () => void
}

/**
 * Menu commands are emitted by the host's shared context-menu overlay,
 * outside this React tree, so actions only describe what to do. The mounted
 * panel executes them through its own confirmation, busy, failure, and
 * refresh paths, which keeps the two entry points identical.
 * @returns command bus for panel menu commands.
 */
export function createCommandBus(): CommandBus {
  const listeners = new Set<(command: PanelCommand) => void>()
  return {
    /**
     * Deliver one command envelope to the current listeners.
     * @param command - envelope sent by a menu action.
     */
    emit(command) {
      for (const listener of [...listeners]) {
        try {
          listener(command)
        } catch (error) {
          console.warn('[git-graph] context menu command failed', error)
        }
      }
    },
    /**
     * Subscribe one panel command handler.
     * @param listener - handler for emitted commands.
     * @returns unsubscribe.
     */
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const panelCommands: CommandBus = createCommandBus()
