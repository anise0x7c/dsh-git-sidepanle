/**
 * Per-panel menu wiring: the Host command caller, the shared context-menu
 * trigger binding, the per-panel id, the captured-target builders and the refs
 * the panel hooks share. Pure factories and small hooks only; no Host calls
 * happen here.
 */

import type { MutableRefObject } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { nextPanelId } from '../constants.ts'
import { createCaller } from '../data/caller.ts'
import { parseRefs } from '../git/format.ts'
import type {
  MenuTarget,
  MenuTargetDetail,
  MenuTargetKind,
  MenuTriggerFactory,
} from '../menu/trigger.ts'
import { bindMenuTrigger, menuTarget } from '../menu/trigger.ts'
import type { CommitSummary, RpcCall } from '../types/domain.ts'
import type { UseContextMenu } from '../types/dsh.ts'
import type { ConfirmState } from './confirm.ts'

/** Wiring one panel derives from its Session and slot hook. */
export interface PanelMenu {
  /** RPC caller bound to the panel's Session. */
  readonly call: RpcCall
  /** Host context-menu trigger binding, or null when menus are unavailable. */
  readonly menuTrigger: MenuTriggerFactory | null
  /** Per-panel id used to keep menu commands scoped to this panel. */
  readonly panelId: string
}

/** RPC caller plus context-menu binding shared by the panel and diff tabs. */
export interface PanelWiring {
  /** RPC caller bound to the Session. */
  readonly call: RpcCall
  /** Host context-menu trigger binding, or null when menus are unavailable. */
  readonly menuTrigger: MenuTriggerFactory | null
}

/**
 * Build the Session-scoped caller and context-menu binding without allocating a
 * panel id. A tab without a usable Session id gets no menu trigger.
 * @param options - wiring inputs.
 * @returns caller and trigger binding.
 */
export function usePanelWiring(options: {
  readonly sessionId: string
  readonly useContextMenu?: UseContextMenu | undefined
}): PanelWiring {
  const { sessionId, useContextMenu } = options
  const call = useMemo(() => createCaller(sessionId), [sessionId])
  const menuTrigger = useMemo(
    () =>
      typeof sessionId === 'string' && sessionId !== '' ? bindMenuTrigger(useContextMenu) : null,
    [useContextMenu, sessionId],
  )
  return { call, menuTrigger }
}

/**
 * Build the panel's RPC caller, its context-menu binding and its panel id.
 * @param options - wiring inputs.
 * @returns wiring used by the panel and handed to the hooks that need it.
 */
export function usePanelMenu(options: {
  readonly sessionId: string
  readonly useContextMenu?: UseContextMenu | undefined
}): PanelMenu {
  const wiring = usePanelWiring(options)
  const panelId = useMemo(() => nextPanelId(), [])
  return { ...wiring, panelId }
}

/** Refs shared by the panel hooks. */
export interface PanelRefs {
  /** Status load in progress. */
  readonly inFlight: MutableRefObject<boolean>
  /** Active action name, or null. */
  readonly busy: MutableRefObject<string | null>
  /** Open confirmation, or null. */
  readonly confirm: MutableRefObject<ConfirmState | null>
  /** Whether the panel is still mounted. */
  readonly mounted: MutableRefObject<boolean>
  /** Whether the Host is watching the repository for live updates. */
  readonly watching: MutableRefObject<boolean>
  /** Branch chip wrapper used for menu dismissal. */
  readonly wrap: MutableRefObject<HTMLDivElement | null>
}

/**
 * Refs shared by the panel hooks. They let the async loaders, the 5 s poll and
 * the menu commands read the newest state without re-subscribing effects.
 * @returns refs handed to the hooks.
 */
export function usePanelRefs(): PanelRefs {
  const inFlight = useRef(false)
  const busy = useRef<string | null>(null)
  const confirm = useRef<ConfirmState | null>(null)
  const mounted = useRef(true)
  const watching = useRef(false)
  const wrap = useRef<HTMLDivElement | null>(null)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )
  return useMemo(
    () => ({ inFlight, busy, confirm, mounted, watching, wrap }),
    [inFlight, busy, confirm, mounted, watching, wrap],
  )
}

/** Builders for the captured menu targets of one panel render. */
export interface MenuTargetFactories {
  /** Build a group-header target. */
  readonly sectionTarget: (section: string) => MenuTarget
  /** Build a commit-row target. */
  readonly commitTarget: (commit: Pick<CommitSummary, 'oid' | 'subject' | 'refs'>) => MenuTarget
  /** Build a row target for one row family. */
  readonly rowTarget: (kind: MenuTargetKind, detail: MenuTargetDetail) => MenuTarget
}

/**
 * Build the menu target factories for the current panel state. Each factory
 * returns the `{ kind, value }` wrapper the host trigger captures; the shared
 * registry later resolves the contribution with the captured value only.
 * @param options - target inputs.
 * @returns factories for the panel's rows and sections.
 */
export function createMenuTargets(options: {
  readonly sessionId: string
  readonly panelId: string
  readonly busy: string | null
  readonly cwd?: string
}): MenuTargetFactories {
  const { sessionId, panelId, busy, cwd } = options
  return {
    sectionTarget: (section) =>
      menuTarget(sessionId, 'section', { section, busy: busy !== null, panelId }),
    commitTarget: (commit) =>
      menuTarget(sessionId, 'commit', {
        oid: commit.oid,
        subject: commit.subject,
        branchHeads: parseRefs(commit.refs)
          .filter((ref) => ref.kind === 'head' || ref.kind === 'branch')
          .map((ref) => ({ name: ref.name, current: ref.kind === 'head' }))
          .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0)),
        panelId,
        busy: busy !== null,
      }),
    rowTarget: (kind, detail) => {
      // The builder replaces any `cwd` carried by the detail, even with none:
      // the panel's repository root is the copy-path base for every row.
      const fields = { ...detail }
      delete fields.cwd
      return menuTarget(sessionId, kind, {
        ...fields,
        ...(cwd === undefined ? {} : { cwd }),
        busy: busy !== null,
        panelId,
      })
    },
  }
}
