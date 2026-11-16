/**
 * Per-panel menu wiring: the Host command caller, the shared context-menu
 * trigger binding, the per-panel id, the captured-target builders and the refs
 * the panel hooks share. Pure factories and small hooks only; no Host calls
 * happen here.
 */

import { useEffect, useMemo, useRef } from 'react'
import { nextPanelId } from '../constants.js'
import { createCaller } from '../data/caller.js'
import { bindMenuTrigger, menuTarget } from '../menu/trigger.js'

/**
 * Build the panel's RPC caller and its context-menu binding. A panel without a
 * usable Session id gets no caller target and no menu trigger.
 * @param {object} options - wiring inputs.
 * @param {string} options.sessionId - Session the panel is bound to.
 * @param {Function} [options.useContextMenu] - host trigger hook from slot props.
 * @returns {{call: Function, menuTrigger: Function|null, panelId: string}} wiring
 *   used by the panel and handed to the hooks that need it.
 */
export function usePanelMenu({ sessionId, useContextMenu }) {
  const call = useMemo(() => createCaller(sessionId), [sessionId])
  const menuTrigger = useMemo(
    () => (typeof sessionId === 'string' && sessionId !== '' ? bindMenuTrigger(useContextMenu) : null),
    [useContextMenu, sessionId],
  )
  const panelId = useMemo(() => nextPanelId(), [])
  return { call, menuTrigger, panelId }
}

/**
 * Refs shared by the panel hooks. They let the async loaders, the 5 s poll and
 * the menu commands read the newest state without re-subscribing effects.
 * @returns {object} refs handed to the hooks:
 *   `inFlight` (status load in progress), `busy` (active action name or null),
 *   `confirm` (open confirmation or null), `mounted` (panel still mounted),
 *   `wrap` (branch chip wrapper for menu dismissal).
 */
export function usePanelRefs() {
  const inFlight = useRef(false)
  const busy = useRef(null)
  const confirm = useRef(null)
  const mounted = useRef(true)
  const wrap = useRef(null)
  useEffect(() => () => { mounted.current = false }, [])
  return useMemo(
    () => ({ inFlight, busy, confirm, mounted, wrap }),
    [inFlight, busy, confirm, mounted, wrap],
  )
}

/**
 * Build the menu target factories for the current panel state. Each factory
 * returns the `{ kind, value }` wrapper the host trigger captures; the shared
 * registry later resolves the contribution with the captured value only.
 * @param {object} options - target inputs.
 * @param {string} options.sessionId - Session the panel belongs to.
 * @param {string} options.panelId - per-panel id for command ownership checks.
 * @param {string|null} options.busy - current busy operation name or null.
 * @param {string} [options.cwd] - repository root used to make copied paths absolute.
 * @returns {{sectionTarget: Function, commitTarget: Function, rowTarget: Function}} factories.
 */
export function createMenuTargets({ sessionId, panelId, busy, cwd }) {
  return {
    sectionTarget: (section) => menuTarget(sessionId, 'section', { section, busy: busy !== null, panelId }),
    commitTarget: (commit) => menuTarget(sessionId, 'commit', {
      oid: commit.oid,
      shortOid: commit.shortOid,
      subject: commit.subject,
    }),
    rowTarget: (kind, detail) => menuTarget(sessionId, kind, { ...detail, cwd, busy: busy !== null, panelId }),
  }
}
