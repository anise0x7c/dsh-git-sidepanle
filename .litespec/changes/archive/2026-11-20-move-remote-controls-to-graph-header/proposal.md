# Move remote controls to the commit graph header

## Why

Fetch, Pull and Push are the panel's most frequent network actions yet they hide
behind the toolbar's overflow ellipsis, needing two clicks and staying hard to
discover. VS Code's Source Control Graph puts them directly in the graph's title
bar, which the panel already reproduces.

## What Changes

- The commit graph section header shows Fetch, Pull and Push as icon controls
  modeled on VS Code's `repo-fetch`, `repo-pull` and `repo-push` actions,
  followed by the overflow menu.
- The toolbar's overflow menu (ellipsis and its dropdown) moves from the branch
  toolbar into the commit graph section header. The toolbar keeps the branch
  chip, refresh control and remote status (cloud) control.
- The overflow menu no longer repeats Fetch, Pull and Push. It keeps Pull
  (Rebase), Sync, Publish Branch when the branch has no upstream, and the Remote
  configuration group.
- Fetch, Pull and Push follow the existing availability rules: Fetch works with
  a detached or unborn HEAD, Pull and Push require an upstream, and every action
  is unavailable while another Git operation runs. Push is unavailable without
  an upstream; Publish Branch stays reachable from the overflow menu and the
  toolbar's remote status control.

## Non-goals

- No change to the Host, RPC or Git execution; the same operations run with the
  same validation, timeout and feedback.
- No new auto-refresh toggle and no "Go to current history item" control from
  the reference screenshot, and no relocation of the branch chip, refresh or
  remote status control out of the toolbar.
- No keyboard-shortcut changes.
