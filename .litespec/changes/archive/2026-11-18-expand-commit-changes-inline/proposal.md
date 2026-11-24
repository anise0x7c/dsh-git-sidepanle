# Expand commit changes inline in the graph

## Why

Code OSS's Source Control Graph lets a commit row expand in place to list the
files that commit changed, with the graph lanes running on through the expanded
rows, so a quick look never leaves the graph. This panel instead replaces the
change list and the graph with a separate details view on every click, which is
heavy for a glance and loses the user's place in the history.

## What Changes

- Activating a commit row (click, Enter or Space) toggles an inline list of the
  commit's changed files directly under the row, reproducing Code OSS's
  expanded history item: 22-pixel rows, every line that leaves the commit
  continuing vertically through them with the commit's own line drawn
  three pixels wide, a file icon, the file name with its dimmed directory, and
  the status letter at the row's end. Several commits may be expanded at once;
  activating an expanded row collapses it.
- An expanded file opens that file's diff for the commit, keeps the copy-only
  context menu of past-commit files, and shows a loading row, a failure row
  with retry, an explicit no-changes row, or a capped-list note when they apply.
- The existing commit-details view (metadata, message body, back control) is no
  longer opened by activating a row. It opens from a new first commit-row
  context-menu action, "View Details" (查看详情), followed by a separator
  before the existing groups.
- Badge-row tooltip wording and the commit-row menu structure are updated to
  match.

## Non-goals

- A tree view mode, folder rows or per-file inline action buttons in the
  expanded list, and Code OSS's file-icon themes (a single generic file icon
  stands in).
- A multi-file diff editor or an inline "view changes" button on the commit row.
- Host, RPC or wire changes: the expanded list reuses the existing commit
  details read.
- Version bumps or commits.
