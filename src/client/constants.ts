/**
 * Identifiers and limits shared by the plugin, the panels and the Host route.
 */

export const PACKAGE_ID = 'dsh-git-sidepanel'
export const NS = 'gitSidepanel'
export const GIT_ID = 'dsh-git-sidepanel/git'
export const GIT_KIND = 'git'
export const GIT_SHORTCUT = 'workspace.git'
export const DIFF_ID = 'dsh-git-sidepanel/diff'
export const DIFF_KIND = 'git-diff'
export const RPC_PATH = 'api/dsh-git-sidepanel/rpc'
export const POLL_INTERVAL_MS = 5000
/**
 * How often a panel asks the Host whether a watched repository changed. The
 * Host answers from memory, so this only moves two counters over the loopback
 * route; it does not run Git.
 */
export const LIVE_POLL_INTERVAL_MS = 700
export const MAX_RENDERED_DIFF_LINES = 4000
/**
 * How long the bottom operation prompt takes to rise into place or to leave,
 * in milliseconds. The stylesheet's motion rules use the same duration, so the
 * leaving card is removed exactly when its animation ends.
 */
export const PROMPT_MOTION_MS = 180
/**
 * How long the commit details view takes to slide in or out, in milliseconds.
 * The stylesheet's motion rules use the same duration, so the leaving view is
 * removed exactly when its animation ends.
 */
export const DETAILS_MOTION_MS = 200
/**
 * How long a split pane takes to fold to or from its collapsed height, in
 * milliseconds. The split stylesheet's transition uses the same duration, and
 * a section keeps its body mounted for it while the pane folds.
 */
export const SPLIT_MOTION_MS = 200
/**
 * How long the toolbar's loading bar stays once it appears, in milliseconds.
 * Work that finishes sooner holds the bar for this minimum, so a quick read
 * does not flash it for a single frame.
 */
export const PROGRESS_MIN_VISIBLE_MS = 500
export const MENU_TARGET = 'gitSidepanelItem'
export const MENU_CONTRIBUTION_ID = 'git-sidepanel.actions'

let panelSequence = 0

/**
 * Identify one mounted panel. The menu commands rely on this id to keep
 * commands addressed to another pane of the same Session out of this one.
 * @returns the per-panel id used in menu command addressing
 */
export function nextPanelId(): string {
  panelSequence += 1
  return `git-panel-${panelSequence}`
}
