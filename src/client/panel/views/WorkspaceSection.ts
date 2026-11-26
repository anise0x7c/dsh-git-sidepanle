/**
 * The Workspace section: the top-level working-tree section whose body holds the
 * nested change groups and, when the repository is clean, the clean-workspace
 * text. It owns only the section header; the groups keep their own headers,
 * counts, actions and menus.
 */

import type React from 'react'
import { createElement } from 'react'
import { Section } from '../Section.ts'
import type { ChangeGroupsProps } from './ChangeGroups.ts'
import { ChangeGroups } from './ChangeGroups.ts'

const h = createElement

/** Props of the Workspace section. */
export interface WorkspaceSectionProps extends ChangeGroupsProps {
  /** Whether the section body is expanded. */
  readonly open: boolean
  /** Keep the body mounted while the pane folds away. */
  readonly retainBody: boolean
  /** Repository exists and has no changes. */
  readonly clean: boolean
  /** Toggle the section. */
  readonly onToggle: () => void
}

/**
 * Render the Workspace section with its nested change groups.
 * @param props - workspace props.
 * @returns the Workspace section element.
 */
export function WorkspaceSection(props: WorkspaceSectionProps): React.ReactElement {
  const t = props.t
  const clean = props.clean
    ? h(
        'div',
        { className: 'dshgg-clean' },
        h('span', { className: 'dshgg-cleanTitle' }, t('clean.title')),
        h('span', { className: 'dshgg-cleanDesc' }, t('clean.desc')),
      )
    : null
  return h(
    Section,
    {
      id: 'workspace',
      title: t('sections.workspace'),
      open: props.open,
      retainBody: props.retainBody,
      onToggle: props.onToggle,
    },
    h('div', { className: 'dshgg-workspaceGroups' }, h(ChangeGroups, props), clean),
  )
}
