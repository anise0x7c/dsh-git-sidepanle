# Inspect a commit's changed files from the graph

## Why

The commit graph is read-only today: a user can read commit subjects, see refs,
and copy identifiers, but cannot inspect what a commit actually changed.
Reviewing history — "what did this commit touch?" — is the main reason a
source-control panel shows a graph at all, and today the only way to answer it
is to leave DSH and run Git in a terminal. The change list and its diff tabs
cover uncommitted work; history has no equivalent path.

## What Changes

- Activating a commit row in the graph — with a pointer click, or Enter/Space
  on a focused row — opens a commit-details view inside the Git panel instead
  of the change list. The view shows the commit's short identifier, subject,
  author, relative time and message body, followed by the files that commit
  changed.
- The changed files carry their status letters (added, modified, deleted,
  renamed, copied, type changed) and their repository-relative paths in the
  same foldable folder tree the change groups use; a rename shows its original
  path.
- Clicking a changed file opens it in the existing unified-diff tab, scoped to
  that commit: the diff is taken against the commit's first parent, or against
  the empty tree for a root commit. The diff header states which commit the
  diff belongs to, and a rename shows the original path.
- A commit that changed nothing relative to its first parent (an empty commit,
  or a clean merge) says so instead of showing an empty list. A failed load is
  reported in the details view with a retry path.
- A back control returns to the change list and graph without touching the
  repository. Right-clicking a file or folder inside the details view offers
  the path-copy commands that make sense for a past commit; staging and
  discarding are not offered there.
- The commit list itself is unchanged apart from being activatable: branch
  switching, copy menus, refresh, and the change list continue to work as
  before.

## Non-goals

- No new repository operation beyond reading a commit and its file diff. No
  checkout, cherry-pick, revert, reset, tag, or amend from the details view.
- No comparison against a second parent or between two arbitrary commits, no
  side-by-side diff editor, and no per-file staging or discarding of past
  commits.
- No new tab type: the details view lives in the Git panel, and the existing
  diff tab keeps being reused.
- Very large commits are bounded on the Host; the details view reports that
  the file list was truncated instead of returning an unbounded payload.
