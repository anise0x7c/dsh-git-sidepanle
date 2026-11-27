# Design

## Native menu contract

The installed DSH `0.2.2-rc.3` package `@deepseek-ai/dsh-client-ui-context-menu` accepts recursive `children`, `separatorBefore`, `disabled` and `danger` fields. Its registry recursively namespaces callbacks and does not execute a parent that has children; its view recursively maps those children to the host primitive's `submenu` entries. The plugin's minimal structural types need to acknowledge `children` and optional callbacks. No replacement overlay, host UI primitive import or additional context-menu CSS is necessary.

Source checked in this installation:

- `node_modules/@deepseek-ai/dsh-client-ui-context-menu/src/client/types.ts`
- `node_modules/@deepseek-ai/dsh-client-ui-context-menu/src/client/registry.ts`
- `node_modules/@deepseek-ai/dsh-client-ui-context-menu/src/client/View.tsx`

## Commit target and ordering

The captured commit value includes its decoration string. Existing ref parsing supplies only local heads for checkout and deletion submenus, excluding remote defaults and detached markers. The current local head remains available in the checkout submenu but is disabled; it is omitted from deletion choices. Separator flags are attached to the first item of each subsequent group so native rendering reproduces the requested group order on both branch-head and ordinary-commit rows.

Detached checkout and other Git writes flow through the panel command bus and its existing ownership, busy, failure and refresh paths. Copy callbacks stay in the shared menu contribution and retain their current values.

## Naming and destructive actions

A panel-local dialog state models branch creation, tag creation and branch deletion. Branch input is required; tag input requires a name and accepts an optional message, matching lightweight tags for an empty message and annotated tags otherwise. Deletion requires explicit confirmation and uses Git's safe deletion rather than forced deletion. A successful dialog closes only after the Host succeeds; validation errors or Git failures retain the current text. Success invalidates the lazy toolbar branch list and refreshes status and history.

Graph-row context-menu and keyboard handlers remember their DOM row before handing the gesture to DSH's shared trigger. Creation inputs and a deletion's Cancel button own initial focus; a `useId` description association exposes the operation warning. Idle Escape and successful operations restore that row only while it is still connected, without racing panel disposal. Busy feedback has its own status text, inputs become read-only rather than disabled, and the submit control uses `aria-disabled` plus the command guard so focus can survive a failed write. Ordinary Enter inserts an annotation newline; Ctrl/Cmd+Enter submits it.

## Host validation and `.gitignore`

Repository-root resolution, full 40-character commit ids, ref-format validation and `execFile` argument vectors protect the new RPCs. Branch creation starts at the chosen commit and checks out the new branch. Tag creation points at that commit. Branch deletion validates the ref and lets Git reject current or unmerged branches.

Ignoring uses the resolved repository root, never the Session subdirectory. A rule begins with `/` and backslash-escapes Git-ignore pattern characters and spaces so it identifies the chosen path literally. An existing identical line is not duplicated. Append preserves CRLF when the file already uses it, inserts a newline before a rule if the previous final line lacked one, and ends the file with a newline. Newlines in a requested path are rejected because one ignore rule cannot represent them.

Git does not follow a linked working-tree `.gitignore`, so the helper rejects symlinks and other non-regular file targets. It opens the target with `O_NOFOLLOW`, stats and reads the resulting descriptor, and appends through that same descriptor with `O_APPEND`. This is both an explicit regular-file check and a race-resistant pair of operations: a link swapped into the path cannot redirect the append, and a path replaced after opening cannot retarget the already-open descriptor. The regression leaves an outside linked target unchanged. Tracked entries keep their status; only an untracked entry disappears from the refreshed change list.
