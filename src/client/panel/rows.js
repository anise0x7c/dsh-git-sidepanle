/**
 * Folder and file rows plus the recursive tree renderer.
 */

import { createElement } from 'react'
import { baseName, statusKey } from '../git/format.js'
import { collectTreePaths } from '../git/tree.js'
import { ChevronRightIcon, MinusIcon, PlusIcon, UndoIcon } from '../icons.js'
import { menuTarget } from '../menu/trigger.js'
import { IconButton } from './controls.js'

const h = createElement

export function FolderRow(props) {
  const keyboard = {
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        props.onToggle()
      }
    },
  }
  const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
  const rowProps = menuTrigger === null || props.menuTarget === undefined
    ? keyboard
    : menuTrigger(props.menuTarget, { ...keyboard, 'aria-haspopup': 'menu', title: props.menuHint })
  return h('div', {
    className: 'dshgg-row dshgg-folderRow',
    style: { paddingLeft: `${6 + props.depth * 14}px` },
    role: 'button',
    tabIndex: 0,
    'aria-expanded': props.open,
    onClick: props.onToggle,
    ...rowProps,
  },
  h('span', { className: 'dshgg-chevron', 'data-open': props.open === true ? 'true' : 'false' },
    h(ChevronRightIcon, { size: 12 })),
  h('span', { className: 'dshgg-folderName' }, props.node.name))
}

export function FileRow(props) {
  const entry = props.entry
  const letter = props.letter
  const name = baseName(entry.path)
  const actionButtons = []
  if (props.mode === 'commit') {
    // Historical rows have no staging or discarding actions: the commit is
    // already recorded, so the row only opens its diff.
  } else if (props.mode === 'staged') {
    actionButtons.push(h(IconButton, {
      key: 'unstage',
      label: props.t('actions.unstage'),
      title: props.t('actions.unstage'),
      disabled: props.busy === true,
      onClick: (event) => { event.stopPropagation(); props.onUnstage(entry) },
    }, h(MinusIcon, { size: 14 })))
  } else {
    actionButtons.push(h(IconButton, {
      key: 'stage',
      label: props.t('actions.stage'),
      title: props.t('actions.stage'),
      disabled: props.busy === true,
      onClick: (event) => { event.stopPropagation(); props.onStage(entry) },
    }, h(PlusIcon, { size: 14 })))
    if (props.mode !== 'merge' && typeof props.onDiscard === 'function') {
      actionButtons.push(h(IconButton, {
        key: 'discard',
        label: props.t('actions.discard'),
        title: props.t('actions.discard'),
        disabled: props.busy === true,
        onClick: (event) => { event.stopPropagation(); props.onDiscard(entry) },
      }, h(UndoIcon, { size: 14 })))
    }
  }
  const title = entry.origPath === undefined ? entry.path : `${entry.origPath} → ${entry.path}`
  const keyboard = {
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        props.onOpen(entry)
      }
    },
  }
  const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
  const rowProps = menuTrigger === null || props.menuTarget === undefined
    ? keyboard
    : menuTrigger(props.menuTarget, { ...keyboard, 'aria-haspopup': 'menu' })
  return h('div', {
    className: 'dshgg-row dshgg-fileRow',
    style: { paddingLeft: `${6 + props.depth * 14}px` },
    role: 'button',
    tabIndex: 0,
    'aria-label': `${props.t(statusKey(letter))} ${entry.path}`,
    title,
    onClick: () => props.onOpen(entry),
    ...rowProps,
  },
  h('span', { className: 'dshgg-status', 'data-status': letter }, letter),
  h('span', { className: 'dshgg-fileName' }, name),
  entry.origPath === undefined ? null : h('span', { className: 'dshgg-fileArrow', title: entry.origPath }, `\u2190 ${baseName(entry.origPath)}`),
  h('span', { className: 'dshgg-fileActions' }, actionButtons))
}

export function renderTree(nodes, depth, context) {
  const rows = []
  // Change rows register their own target kinds; the commit-details view
  // passes past-commit kinds so its copy-only menus never offer staging.
  const fileKind = context.fileKind ?? 'file'
  const folderKind = context.folderKind ?? 'folder'
  const target = (kind, detail) => (context.menuTarget === undefined ? undefined : context.menuTarget(kind, detail))
  for (const node of nodes) {
    if (node.type === 'folder') {
      const open = context.collapsed[node.path] !== true
      rows.push(h(FolderRow, {
        key: `folder:${node.path}`,
        node,
        depth,
        open,
        onToggle: () => context.onToggleFolder(node.path),
        menuTrigger: context.menuTrigger,
        menuHint: context.menuHint,
        menuTarget: target(folderKind, { section: context.mode, path: node.path, paths: collectTreePaths(node) }),
      }))
      if (open) rows.push(...renderTree(node.children, depth + 1, context))
      continue
    }
    rows.push(h(FileRow, {
      key: `file:${node.entry.kind}:${node.entry.path}:${node.entry.x}:${node.entry.y}:${node.entry.letter ?? ''}`,
      entry: node.entry,
      letter: node.entry.letter ?? '',
      depth,
      t: context.t,
      busy: context.busy,
      mode: context.mode,
      onOpen: context.onOpen,
      onStage: context.onStage,
      onUnstage: context.onUnstage,
      onDiscard: context.onDiscard,
      menuTrigger: context.menuTrigger,
      menuTarget: target(fileKind, { section: context.mode, path: node.entry.path }),
    }))
  }
  return rows
}
