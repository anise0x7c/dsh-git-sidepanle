/**
 * Adapter between the panel rows and the host shared context-menu trigger props.
 */

import { MENU_TARGET } from '../constants.ts'
import type {
  ContextMenuBindings,
  ContextMenuTriggerTarget,
  MenuTriggerHandlers,
  MenuTriggerProps,
} from '../types/dsh.ts'

/** Row family carried by one captured target. */
export type MenuTargetKind = 'file' | 'section' | 'commit' | 'diff' | 'commitFile'

/**
 * Captured row data handed to a menu contribution; each row family adds its own
 * fields (`section`, `path`, `cwd`, `panelId`, `busy`, ...).
 */
export interface MenuTargetValue {
  /** Session that owns the row. */
  readonly sessionId: string
  /** Row family. */
  readonly kind: MenuTargetKind
  /** Change group the row belongs to. */
  readonly section?: string
  /** Repository-relative file path. */
  readonly path?: string
  /** Repository root used for absolute-path copies. */
  readonly cwd?: string
  /** Panel instance that owns the command. */
  readonly panelId?: string
  /** A Git operation is running. */
  readonly busy?: boolean
  /** Full commit id. */
  readonly oid?: string
  /** Short commit id. */
  readonly shortOid?: string
  /** Commit subject. */
  readonly subject?: string
  /** Local branch heads at this commit, used by checkout and deletion submenus. */
  readonly branchHeads?: readonly MenuBranchHead[]
}

/** One local branch head captured on a commit row. */
export interface MenuBranchHead {
  /** Local branch name, without `refs/heads/`. */
  readonly name: string
  /** Whether this is the current local branch. */
  readonly current: boolean
}

/** Fields one row family merges into its captured value. */
export type MenuTargetDetail = Partial<MenuTargetValue>

/**
 * One captured context-menu target: the registered family plus the row data the
 * trigger captured.
 */
export interface MenuTarget extends ContextMenuTriggerTarget {
  /** Registered target family. */
  readonly kind: typeof MENU_TARGET
  /** Captured row data. */
  readonly value: MenuTargetValue
}

/** Factory that binds one row to the host trigger props. */
export type MenuTriggerFactory = (
  target: MenuTarget,
  handlers?: MenuTriggerHandlers,
) => MenuTriggerProps

/**
 * Whether a dynamic host binding exposes the trigger factory.
 * @param value - candidate returned by the injected hook.
 * @returns true when the value can bind a trigger.
 */
function isContextMenuBindings(value: unknown): value is ContextMenuBindings {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { getTriggerProps?: unknown }).getTriggerProps === 'function'
  )
}

/**
 * Wrap the slot-provided hook into a plain factory, or null without host menus.
 * @param useContextMenu - injected hook.
 * @returns trigger factory; null when menus are unavailable.
 */
export function bindMenuTrigger(useContextMenu: unknown): MenuTriggerFactory | null {
  if (typeof useContextMenu !== 'function') return null
  let bindings: unknown
  try {
    bindings = (useContextMenu as () => unknown)()
  } catch (error) {
    console.warn('[git-graph] context menus are unavailable', error)
    return null
  }
  if (!isContextMenuBindings(bindings)) return null
  return (target, handlers) => bindings.getTriggerProps(target, handlers)
}

/**
 * Build one captured context-menu target for a row.
 * @param sessionId - Session that owns the row.
 * @param kind - row family.
 * @param detail - row data merged into the captured value.
 * @returns captured target wrapper.
 */
export function menuTarget(
  sessionId: string,
  kind: MenuTargetKind,
  detail: MenuTargetDetail = {},
): MenuTarget {
  return { kind: MENU_TARGET, value: { sessionId, kind, ...detail } }
}
