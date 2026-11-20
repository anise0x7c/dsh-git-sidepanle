# Commit split button with commit action menu

## Why

The commit box offers one small commit button. A user who wants to amend the
last commit, commit and push, or commit and sync has to commit and then find a
separate control in the toolbar, and the primary action is easy to miss next to
the change lists. VS Code's Source Control view instead makes the commit button
span the whole commit box and adds a trailing expand control with the other
commit actions.

## What Changes

- The commit box renders its commit action as a primary button that fills the
  row, with a separate expand control at its trailing edge and a check icon in
  the main button.
- The expand control opens a menu with **Commit**, **Commit (Amend)**, a
  separator, **Commit and Push**, and **Commit and Sync**, closed by Escape,
  outside click, or the start of an action.
- **Commit (Amend)** replaces HEAD with the typed message and the staged
  changes; it is refused when the branch has no commit yet.
- **Commit and Push** commits and then pushes; **Commit and Sync** commits,
  pulls by merging, and pushes only when the pull succeeded. When the remote
  step fails, the created commit stays and the failure is reported.
- Commit and Push and Commit and Sync are unavailable when the current branch
  has no upstream, with the reason shown on hover.
- The stage-all confirmation still guards a commit with nothing staged, for
  each of Commit, Commit and Push, and Commit and Sync.

## Non-goals

- No change to the remote toolbar menu, Fetch, Pull, Push, Sync, or Publish.
- No change to the commit message-sized input or the shortcut behavior
  (Ctrl+Enter still runs Commit).
- Staging behavior is unchanged: Amend does not stage anything by itself.
