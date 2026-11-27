# Add right-click menus to the Source control sidebar

## Why

The Source control panel exposes its operations only through hover buttons and
inline controls. The hover buttons are invisible until the pointer reaches a
row, so the available operations are hard to discover, and users who prefer a
context menu have no way to reach them. Keyboard users can focus a changed file
but cannot ask what can be done with it. Two useful pieces of information also
have no path out of the panel: the location of a changed file (to paste into a
terminal or another tool) and the identity of a commit in the graph (to paste
into a message or a command).

A context menu is the standard answer in source-control surfaces: it lists the
operations that apply to exactly the object under the pointer, without
occupying permanent space in an already narrow sidebar.

## What Changes

- Right-clicking a changed file offers opening its diff, staging or unstaging
  it, discarding it, and copying its path. The entries follow the file's
  group: a staged file can be unstaged, a conflicted or unstaged file can be
  staged, and only rows that can be discarded offer discarding.
- Right-clicking a folder row offers the same staging, unstaging, and
  discarding operations applied to every changed file below that folder, plus
  copying the folder's path.
- Right-clicking a change group header offers staging or unstaging the whole
  group and discarding all of the group's changes.
- Right-clicking a commit in the graph offers copying its full identifier and
  its message subject. Right-clicking a diff header offers copying the file's
  path.
- Menu commands behave like the equivalent inline control: the same
  confirmation before discarding, the same busy indication, the same failure
  report, and the same refresh afterwards. Nothing is executed twice and
  opening a menu executes nothing at all.
- Copying confirms success, and an unavailable clipboard is reported as a
  failure rather than silently doing nothing.
- The same menus open from the keyboard context-menu gesture on a focused
  row. They use the host's shared context-menu presentation, so position,
  dismissal, focus return, theme, and language match the rest of the
  application.
- If the host provides no context-menu facility, the panel and its inline
  controls keep working exactly as before; only the menus are absent.

## Non-goals

- No new repository operations. The menus expose the existing stage, unstage,
  discard, open-diff, and refresh operations plus clipboard copies; fetch,
  pull, push, stash, tags, per-line staging, and commit-level checkouts remain
  out of scope.
- No custom menu component, styling, or keyboard-navigation model: the host's
  shared menu renders these actions.
- Menus are transient and contribute nothing to session data.
