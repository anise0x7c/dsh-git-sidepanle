// @ts-check
/**
 * Per-panel command bus: one shared subscription point for menu command dispatch.
 */

/**
 * Dispatch target for menu commands: the shared overlay emits envelopes, the
 * mounted panel subscribes to them.
 * @typedef {object} CommandBus
 * @property {(command: object) => void} emit - deliver one command envelope to every current listener.
 * @property {(listener: (command: object) => void) => () => void} subscribe - listen until the returned disposer runs.
 */

/**
 * Menu commands are emitted by the host's shared context-menu overlay,
 * outside this React tree, so actions only describe what to do. The mounted
 * panel executes them through its own confirmation, busy, failure, and
 * refresh paths, which keeps the two entry points identical.
 * @returns {CommandBus} command bus for panel menu commands.
 */
export function createCommandBus() {
  /** @type {Set<(command: object) => void>} */
  const listeners = new Set()
  return {
    /**
     * Deliver one command envelope to the current listeners.
     * @param {object} command - envelope sent by a menu action.
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
     * @param {(command: object) => void} listener - handler for emitted commands.
     * @returns {() => void} unsubscribe.
     */
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

export const panelCommands = createCommandBus()
