/**
 * Adapter between the panel rows and the host shared context-menu trigger props.
 */

import { MENU_TARGET } from '../constants.js'

/** Wrap the slot-provided hook into a plain factory, or null without host menus. */
export function bindMenuTrigger(useContextMenu) {
  if (typeof useContextMenu !== 'function') return null
  let bindings
  try {
    bindings = useContextMenu()
  } catch (error) {
    console.warn('[git-graph] context menus are unavailable', error)
    return null
  }
  if (bindings === null || bindings === undefined || typeof bindings.getTriggerProps !== 'function') return null
  return (target, handlers) => bindings.getTriggerProps(target, handlers)
}

export function menuTarget(sessionId, kind, detail) {
  return { kind: MENU_TARGET, value: { sessionId, kind, ...detail } }
}
