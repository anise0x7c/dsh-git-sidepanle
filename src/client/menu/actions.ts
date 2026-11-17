/**
 * Describe the commands available for one menu target; the overlay renders them
 * and the panel runs them.
 */

import type { LocaleBinder, MenuActionView } from '../types/dsh.ts'
import type { PanelCommand } from './bus.ts'
import { panelCommands } from './bus.ts'
import { absolutePath, copyAndReport } from './clipboard.ts'
import type { MenuTargetValue } from './trigger.ts'

/**
 * Payload one action emits on the panel command bus: the command without the
 * addressing the resolver adds from the captured target.
 */
export type MenuCommandPayload = Omit<PanelCommand, 'sessionId' | 'panelId'>

/** Presentation flags one action may carry. */
export interface MenuActionFlags {
  /** Destructive styling. */
  readonly danger?: boolean
  /** Draw a divider above the action. */
  readonly separatorBefore?: boolean
  /** Shown but not selectable. */
  readonly disabled?: boolean
}

/**
 * One resolved menu action as the shared overlay renders it.
 *
 * Executable leaves supply a callback; submenu parents have children instead.
 * The shared view strips callbacks when it publishes presentation rows.
 */
export interface MenuAction extends Omit<MenuActionView, 'children'> {
  /** Nested native submenu actions. */
  readonly children?: readonly MenuAction[]
  /** Executes the panel command or clipboard copy; submenu parents have none. */
  readonly run?: () => void | Promise<void>
}

/**
 * Build one resolved menu action.
 * @param id - stable action id.
 * @param label - localized label.
 * @param run - action callback.
 * @param extra - presentation flags.
 * @returns resolved action.
 */
export function menuAction(
  id: string,
  label: string,
  run: () => void | Promise<void>,
  extra: MenuActionFlags = {},
): MenuAction {
  return { id, label, run, ...extra }
}

/**
 * Resolve the actions for one captured context-menu target.
 * @param value - the captured target value: the row data the trigger was bound
 *   with, as the shared registry hands it to a contribution.
 * @param t - locale binder.
 * @param notify - host toast for clipboard feedback.
 * @returns ordered actions for the shared overlay.
 */
export function resolveMenuActions(
  value: unknown,
  t: LocaleBinder,
  notify: ((text: string, success: boolean) => void) | undefined,
): MenuAction[] {
  if (value === null || value === undefined || typeof value !== 'object') return []
  // The shared registry hands over JSON-shaped row data captured by a trigger;
  // the row families below narrow it field by field instead of trusting it.
  const target = value as Partial<MenuTargetValue>
  const sessionId = target.sessionId
  if (typeof sessionId !== 'string' || sessionId === '') return []
  /**
   * Emit one panel command for this captured target.
   * @param payload - panel operation and its arguments.
   * @returns action callback.
   */
  const command =
    (payload: MenuCommandPayload): (() => void) =>
    () =>
      panelCommands.emit({ sessionId, panelId: target.panelId, ...payload })
  /**
   * Copy one value and report through the host toast.
   * @param text - text to copy.
   * @param successKey - dictionary key reported on success.
   * @returns action callback.
   */
  const copy =
    (text: string, successKey: string): (() => Promise<void>) =>
    () =>
      copyAndReport(t, notify, text, successKey)
  /**
   * Build the path-copy actions shared by file, commit-file and diff rows.
   * @param path - repository-relative path.
   * @param cwd - repository root used for the absolute copy, when known.
   * @param separatorBefore - draw a divider above the first copy action.
   * @returns the copy-relative action and, with a root, copy-path.
   */
  const copyPathActions = (
    path: string,
    cwd: string | undefined,
    separatorBefore = false,
  ): MenuAction[] => {
    const actions = [
      menuAction(
        'copy-relative',
        t('menu.copyRelativePath'),
        copy(path, 'menu.copiedRelativePath'),
        separatorBefore ? { separatorBefore: true } : {},
      ),
    ]
    if (typeof cwd === 'string' && cwd !== '') {
      actions.push(
        menuAction(
          'copy-path',
          t('menu.copyPath'),
          copy(absolutePath(cwd, path), 'menu.copiedPath'),
        ),
      )
    }
    return actions
  }
  const blocked: MenuActionFlags = target.busy === true ? { disabled: true } : {}

  if (target.kind === 'file') {
    const path = target.path
    if (typeof path !== 'string' || path === '') return []
    const section =
      target.section === 'staged' || target.section === 'merge' ? target.section : 'changes'
    const actions = [
      menuAction('open', t('menu.openDiff'), command({ type: 'open', section, path }), blocked),
    ]
    if (section === 'staged') {
      actions.push(
        menuAction('unstage', t('actions.unstage'), command({ type: 'unstage', paths: [path] }), {
          separatorBefore: true,
          ...blocked,
        }),
      )
    } else {
      actions.push(
        menuAction('stage', t('actions.stage'), command({ type: 'stage', paths: [path] }), {
          separatorBefore: true,
          ...blocked,
        }),
      )
      if (section !== 'merge')
        actions.push(
          menuAction(
            'discard',
            t('actions.discard'),
            command({ type: 'discard', paths: [path], single: true }),
            { danger: true, ...blocked },
          ),
        )
    }
    actions.push(
      menuAction('ignore', t('menu.addToGitignore'), command({ type: 'ignore', path }), blocked),
    )
    actions.push(...copyPathActions(path, target.cwd, true))
    return actions
  }

  if (target.kind === 'section') {
    const section = target.section
    if (section === 'changes') {
      return [
        menuAction(
          'stage-all',
          t('actions.stageAll'),
          command({ type: 'stageSection', section }),
          blocked,
        ),
        menuAction(
          'discard-all',
          t('actions.discardAll'),
          command({ type: 'discardSection', section }),
          { danger: true, ...blocked },
        ),
        menuAction('refresh', t('refresh'), command({ type: 'refresh' }), {
          separatorBefore: true,
          ...blocked,
        }),
      ]
    }
    if (section === 'staged') {
      return [
        menuAction(
          'unstage-all',
          t('actions.unstageAll'),
          command({ type: 'unstageSection', section }),
          blocked,
        ),
        menuAction('refresh', t('refresh'), command({ type: 'refresh' }), {
          separatorBefore: true,
          ...blocked,
        }),
      ]
    }
    if (section === 'merge') {
      return [
        menuAction(
          'stage-all',
          t('actions.stageAll'),
          command({ type: 'stageSection', section }),
          blocked,
        ),
      ]
    }
    if (section === 'graph') {
      return [
        menuAction('refresh', t('menu.refreshHistory'), command({ type: 'refresh' }), blocked),
      ]
    }
    return []
  }

  if (target.kind === 'commit') {
    const actions: MenuAction[] = []
    const oid = target.oid
    const canMutate = typeof oid === 'string' && /^[0-9a-f]{40}$/.test(oid)
    const branchHeads = Array.isArray(target.branchHeads)
      ? target.branchHeads.filter(
          (branch) =>
            typeof branch === 'object' &&
            branch !== null &&
            typeof branch.name === 'string' &&
            branch.name !== '',
        )
      : []
    if (canMutate) {
      if (branchHeads.length > 0) {
        actions.push({
          id: 'checkout',
          label: t('menu.checkout'),
          children: branchHeads.map((branch) =>
            menuAction(
              branch.name,
              branch.name,
              command({ type: 'checkout', branch: branch.name }),
              { ...blocked, ...(branch.current === true ? { disabled: true } : {}) },
            ),
          ),
          ...blocked,
        })
      }
      actions.push(
        menuAction(
          'checkout-detached',
          t('menu.checkoutDetached'),
          command({ type: 'checkoutDetached', oid }),
          blocked,
        ),
        menuAction(
          'create-branch',
          t('menu.createBranch'),
          command({ type: 'createBranch', oid }),
          { separatorBefore: true, ...blocked },
        ),
      )
      const deletable = branchHeads.filter((branch) => branch.current !== true)
      if (deletable.length > 0) {
        actions.push({
          id: 'delete-branch',
          label: t('menu.deleteBranch'),
          danger: true,
          children: deletable.map((branch) =>
            menuAction(
              branch.name,
              branch.name,
              command({ type: 'deleteBranch', branch: branch.name }),
              { danger: true, ...blocked },
            ),
          ),
          ...blocked,
        })
      }
      actions.push(
        menuAction('create-tag', t('menu.createTag'), command({ type: 'createTag', oid }), {
          separatorBefore: true,
          ...blocked,
        }),
      )
    }
    if (typeof oid === 'string' && oid !== '') {
      actions.push(
        menuAction(
          'copy-id',
          t('menu.copyCommitId'),
          copy(oid, 'menu.copiedCommitId'),
          canMutate ? { separatorBefore: true } : {},
        ),
      )
    }
    if (typeof target.subject === 'string' && target.subject !== '') {
      actions.push(
        menuAction(
          'copy-message',
          t('menu.copyCommitSubject'),
          copy(target.subject, 'menu.copiedCommitSubject'),
        ),
      )
    }
    return actions
  }

  if (target.kind === 'commitFile' || target.kind === 'diff') {
    const path = target.path
    if (typeof path !== 'string' || path === '') return []
    return copyPathActions(path, target.cwd)
  }

  return []
}
