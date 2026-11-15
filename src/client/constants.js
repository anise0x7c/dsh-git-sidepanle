/**
 * Identifiers and limits shared by the plugin, the panels and the Host route.
 */

export const PACKAGE_ID = '@local/dsh-git-graph'
export const NS = 'gitGraph'
export const GIT_ID = '@local/dsh-git-graph/git'
export const GIT_KIND = 'git'
export const GIT_SHORTCUT = 'workspace.git'
export const DIFF_ID = '@local/dsh-git-graph/diff'
export const DIFF_KIND = 'git-diff'
export const RPC_PATH = 'api/dsh-git-graph/rpc'
export const POLL_INTERVAL_MS = 5000
export const MAX_RENDERED_DIFF_LINES = 4000
export const MENU_TARGET = 'gitGraphItem'
export const MENU_CONTRIBUTION_ID = 'git-graph.actions'

let panelSequence = 0

/**
 * Identify one mounted panel. The menu commands rely on this id to keep
 * commands addressed to another pane of the same Session out of this one.
 * @returns {string} the per-panel id used in menu command addressing
 */
export function nextPanelId() {
  panelSequence += 1
  return `git-panel-${panelSequence}`
}
