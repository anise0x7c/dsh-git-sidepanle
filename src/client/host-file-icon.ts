/**
 * The Web application's own file-type icon for one file row.
 *
 * The shell seeds its frozen client module table with
 * `@deepseek-ai/dsh-client-ui-primitives`, whose `FileTypeIcon` classifies a
 * path and draws the glyph that the application's workspace explorer uses, so a
 * row here matches the explorer beside it instead of growing a second, thinner
 * classifier. This module is the bundle's only runtime request outside `react`;
 * `scripts/build.ts` marks the specifier external and the artifact validation
 * allows exactly that entry.
 *
 * Resolution is deliberately soft. DSH's plugin guide warns that Harness Client
 * packages change without notice and that a throwing component blanks the slot,
 * so a host without the entry (or with a non-function export) falls back to the
 * plugin's own document icon: the file list keeps working, only the artwork
 * degrades.
 */

import type React from 'react'
import { createElement } from 'react'
import { FileIcon } from './icons.ts'

/** Props of {@link HostFileIcon}. */
export interface HostFileIconProps {
  /** Repository-relative path of the file the row names. */
  readonly path: string
  /** Square edge length in pixels; defaults to 16. */
  readonly size?: number
}

/** Props the application's `FileTypeIcon` accepts from this plugin. */
interface BorrowedIconProps {
  readonly path: string
  readonly size: number
}

/** One borrowed file-type icon component. */
type BorrowedIcon = (props: BorrowedIconProps) => React.ReactElement

/**
 * Read the application's file-type icon from the module table.
 * @returns the component, or undefined when the table has no usable entry.
 */
function resolveHostIcon(): BorrowedIcon | undefined {
  try {
    const hostModule:
      | { FileTypeIcon?: unknown }
      | undefined = require('@deepseek-ai/dsh-client-ui-primitives')
    const icon = hostModule?.FileTypeIcon
    return typeof icon === 'function' ? (icon as BorrowedIcon) : undefined
  } catch {
    // A host that does not provide the entry keeps the plain document icon.
    return undefined
  }
}

const hostIcon = resolveHostIcon()

/**
 * Render one file row's icon: the application's per-type glyph for `path`, or
 * the plugin's plain document icon when the application provides none.
 * @param props - file path and edge length.
 * @returns the icon element.
 */
export function HostFileIcon(props: HostFileIconProps): React.ReactElement {
  const size = props.size ?? 16
  return hostIcon === undefined
    ? createElement(FileIcon, { size })
    : createElement(hostIcon, { path: props.path, size })
}
