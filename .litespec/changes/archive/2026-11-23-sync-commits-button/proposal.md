# Sync action when the workspace is clean and commits are unpushed

## Why

With a clean working tree and local commits the upstream does not have yet, the
commit box still shows Commit and stays unavailable until a message is typed,
and a commit of nothing would be refused anyway. The only sensible action at
that moment is a sync, but it hides in the graph header's overflow menu, so the
most prominent control in the panel is dead exactly when the branch needs to
reach its remote.

## What Changes

When the working tree has no changes, the checked-out branch tracks an upstream
and that upstream is behind by at least one local commit, the commit box's
primary action becomes a sync action labelled with the number of local commits
ahead. It is available without a message, it replaces the commit modes rather
than sitting beside them, and activating it runs Sync — pull by merging, then
push — after which the usual refresh shows the branch back in step. As soon as
there is a change to commit, the action returns to Commit, and a branch without
an upstream never shows the sync action.

## Non-goals

- No new remote operation is introduced: the action runs the existing Sync, so
  a failed pull still skips the push and a failed sync is reported like any
  other remote action.
- A branch that is only behind, or one that is ahead by local commits while the
  working tree still has changes, keeps the commit action.
- The commit message box, its sizing and its `Ctrl+Enter` shortcut are
  unchanged.
