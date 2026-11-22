/**
 * The three change groups — merge conflicts, staged files, unstaged changes —
 * as flat, path-sorted file lists with their section actions, plus the
 * clean-workspace text.
 */

import type React from 'react'
import { createElement, Fragment } from 'react'
import { MinusIcon, PlusIcon, UndoIcon } from '../../icons.ts'
import type {
  MenuTarget,
  MenuTargetDetail,
  MenuTargetKind,
  MenuTriggerFactory,
} from '../../menu/trigger.ts'
import type { ChangeEntry, ChangeRow } from '../../types/domain.ts'
import type { LocaleBinder } from '../../types/dsh.ts'
import type { ChangeGroupMode } from '../change-groups.ts'
import { visibleChangeGroups } from '../change-groups.ts'
import { IconButton } from '../controls.ts'
import { renderFileRows } from '../rows.ts'
import { Section } from '../Section.ts'

const h = createElement

/** Props of the three change groups. */
export interface ChangeGroupsProps {
  /** Locale binder. */
  readonly t: LocaleBinder
  /** Repository exists and has no changes. */
  readonly clean: boolean
  /** Sorted conflicted files with display letters. */
  readonly mergeRows: readonly ChangeRow[]
  /** Sorted staged files with display letters. */
  readonly stagedRows: readonly ChangeRow[]
  /** Sorted unstaged files with display letters. */
  readonly changedRows: readonly ChangeRow[]
  /** Open state per section id. */
  readonly openSections: Readonly<Record<string, boolean>>
  /** Whether the change pane folds away when its last open group closes. */
  readonly foldBodies: boolean
  /** An action is running. */
  readonly busy: boolean
  /** The repository exists and no action is running. */
  readonly canAct: boolean
  /** Toggle a section. */
  readonly onToggleSection: (id: string) => void
  /** Stage file entries. */
  readonly onStage: (entries: readonly ChangeEntry[]) => unknown
  /** Unstage file entries. */
  readonly onUnstage: (entries: readonly ChangeEntry[]) => unknown
  /** Open the diff tab for an entry and mode. */
  readonly onOpenDiff: (entry: ChangeEntry, mode: 'staged' | 'changes') => void
  /** Ask to discard one entry. */
  readonly onDiscard: (entry: ChangeEntry) => void
  /** Ask to discard the changed group. */
  readonly onDiscardAll: () => void
  /** Host trigger binding. */
  readonly menuTrigger: MenuTriggerFactory | null
  /** Build a group-header menu target. */
  readonly sectionTarget: (section: string) => MenuTarget
  /** Build a file-row menu target. */
  readonly rowTarget: (kind: MenuTargetKind, detail: MenuTargetDetail) => MenuTarget
}

/**
 * Render the three groups plus the clean-workspace text.
 * @param props - change-group props.
 * @returns the groups as one fragment.
 */
export function ChangeGroups(props: ChangeGroupsProps): React.ReactElement {
  const t = props.t
  const sectionActions: Record<'merge' | 'staged' | 'changes', React.ReactNode> = {
    merge: null,
    staged:
      props.stagedRows.length === 0
        ? null
        : h(
            IconButton,
            {
              label: t('actions.unstageAll'),
              title: t('actions.unstageAll'),
              disabled: !props.canAct,
              onClick: () => {
                void props.onUnstage(props.stagedRows)
              },
            },
            h(MinusIcon, { size: 14 }),
          ),
    changes:
      props.changedRows.length === 0
        ? null
        : [
            h(
              IconButton,
              {
                key: 'stage-all',
                label: t('actions.stageAll'),
                title: t('actions.stageAll'),
                disabled: !props.canAct,
                onClick: () => {
                  void props.onStage(props.changedRows)
                },
              },
              h(PlusIcon, { size: 14 }),
            ),
            h(
              IconButton,
              {
                key: 'discard-all',
                label: t('actions.discardAll'),
                title: t('actions.discardAll'),
                disabled: !props.canAct,
                onClick: () => props.onDiscardAll(),
              },
              h(UndoIcon, { size: 14 }),
            ),
          ],
  }
  /**
   * Render one group's flat file list with its per-row actions and menu target.
   * @param mode - group id.
   * @param rows - the group's sorted rows.
   * @returns file-row elements.
   */
  const rowsFor = (
    mode: 'merge' | 'staged' | 'changes',
    rows: readonly ChangeRow[],
  ): React.ReactElement[] =>
    renderFileRows(rows, {
      t,
      busy: props.busy,
      mode,
      onOpen: (entry) => props.onOpenDiff(entry, mode === 'staged' ? 'staged' : 'changes'),
      onStage: (entry) => {
        void props.onStage([entry])
      },
      onUnstage: (entry) => {
        void props.onUnstage([entry])
      },
      onDiscard: (entry) => props.onDiscard(entry),
      menuTrigger: props.menuTrigger,
      menuTarget: (entry) => props.rowTarget('file', { section: mode, path: entry.path }),
    })
  const visible = visibleChangeGroups(props)
  const shows = (mode: ChangeGroupMode): boolean => visible.includes(mode)
  return h(
    Fragment,
    null,
    shows('merge')
      ? h(
          Section,
          {
            id: 'merge',
            title: t('sections.merge'),
            count: props.mergeRows.length,
            open: props.openSections.merge === true,
            retainBody: props.foldBodies,
            onToggle: () => props.onToggleSection('merge'),
            actions: sectionActions.merge,
            menuTrigger: props.menuTrigger,
            menuHint: t('menu.hint'),
            menuTarget: props.sectionTarget('merge'),
          },
          rowsFor('merge', props.mergeRows),
        )
      : null,
    shows('staged')
      ? h(
          Section,
          {
            id: 'staged',
            title: t('sections.staged'),
            count: props.stagedRows.length,
            open: props.openSections.staged === true,
            retainBody: props.foldBodies,
            onToggle: () => props.onToggleSection('staged'),
            actions: sectionActions.staged,
            menuTrigger: props.menuTrigger,
            menuHint: t('menu.hint'),
            menuTarget: props.sectionTarget('staged'),
          },
          rowsFor('staged', props.stagedRows),
        )
      : null,
    shows('changes')
      ? h(
          Section,
          {
            id: 'changes',
            title: t('sections.changes'),
            count: props.changedRows.length,
            open: props.openSections.changes === true,
            retainBody: props.foldBodies,
            onToggle: () => props.onToggleSection('changes'),
            actions: sectionActions.changes,
            menuTrigger: props.menuTrigger,
            menuHint: t('menu.hint'),
            menuTarget: props.sectionTarget('changes'),
          },
          rowsFor('changes', props.changedRows),
        )
      : null,
    props.clean
      ? h(
          'div',
          { className: 'dshgg-clean' },
          h('span', { className: 'dshgg-cleanTitle' }, t('clean.title')),
          h('span', { className: 'dshgg-cleanDesc' }, t('clean.desc')),
        )
      : null,
  )
}
