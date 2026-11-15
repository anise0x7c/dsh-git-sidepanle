/**
 * Per-panel command bus: one shared subscription point for menu command dispatch.
 */

/**
 * Menu commands are emitted by the host's shared context-menu overlay,
 * outside this React tree, so actions only describe what to do. The mounted
 * panel executes them through its own confirmation, busy, failure, and
 * refresh paths, which keeps the two entry points identical.
 */
export function createCommandBus() {
  const listeners = new Set()
  return {
    emit(command) {
      for (const listener of [...listeners]) {
        try {
          listener(command)
        } catch (error) {
          console.warn('[git-graph] context menu command failed', error)
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

export const panelCommands = createCommandBus()
