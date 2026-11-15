// @ts-check
/**
 * Adapter between the panel rows and the host shared context-menu trigger props.
 */

import { MENU_TARGET } from '../constants.js'

/**
 * Captured row data handed to a menu contribution; each row family adds its own
 * fields (`section`, `path`, `paths`, `cwd`, `panelId`, `busy`, ...).
 * @typedef {object} MenuTargetValue
 * @property {string} sessionId - Session that owns the row.
 * @property {string} kind - row family (`file`, `folder`, `section`, `commit`, `diff`, `commitFile`, `commitFolder`).
 * @property {string} [section] - change group the row belongs to.
 * @property {string} [path] - repository-relative file or folder path.
 * @property {string[]} [paths] - folder subtree files.
 * @property {string} [cwd] - repository root used for absolute-path copies.
 * @property {string} [panelId] - panel instance that owns the command.
 * @property {boolean} [busy] - a Git operation is running.
 * @property {string} [oid] - full commit id.
 * @property {string} [shortOid] - short commit id.
 * @property {string} [subject] - commit subject.
 */

/**
 * One captured context-menu target: the registered family plus the row data the
 * trigger captured.
 * @typedef {object} MenuTarget
 * @property {string} kind - registered target family (`gitGraphItem`).
 * @property {MenuTargetValue} value - captured row data.
 */

/**
 * Host bindings injected into every Slot scope as `props.useContextMenu`.
 * @typedef {object} ContextMenuBindings
 * @property {(target: MenuTarget, handlers?: object) => object} getTriggerProps - bind one trigger element.
 */

/**
 * Factory that binds one row to the host trigger props.
 * @typedef {(target: MenuTarget, handlers?: object) => object} MenuTriggerFactory
 */

/**
 * Wrap the slot-provided hook into a plain factory, or null without host menus.
 * @param {(() => ContextMenuBindings) | null | undefined} useContextMenu - injected hook.
 * @returns {MenuTriggerFactory | null} trigger factory; null when menus are unavailable.
 */
export function bindMenuTrigger(useContextMenu) {
  if (typeof useContextMenu !== 'function') return null
  /** @type {ContextMenuBindings | undefined} */
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

/**
 * Build one captured context-menu target for a row.
 * @param {string} sessionId - Session that owns the row.
 * @param {string} kind - row family (`file`, `folder`, `section`, `commit`, `diff`, `commitFile`, `commitFolder`).
 * @param {object} detail - row data merged into the captured value.
 * @returns {MenuTarget} captured target wrapper.
 */
export function menuTarget(sessionId, kind, detail) {
  return { kind: MENU_TARGET, value: { sessionId, kind, ...detail } }
}
