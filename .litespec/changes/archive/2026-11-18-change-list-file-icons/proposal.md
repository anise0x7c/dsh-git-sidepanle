# Show file-type icons in the change lists

## Why

The graph's expanded rows and the details view identify every changed file by
the Web application's per-type icon, but the merge-conflicts, staged and changes
lists — the first surface a user sees — still show a bare status letter and
path. The three surfaces list the same files and disagree about how a file is
introduced: one looks like the rest of the application, the other two look like
plain text.

The detail view already proved the artwork and its fallback on the same shared
row; extending them to the working-tree lists is a presentation change on one
renderer, not new behavior.

## What Changes

- Every row in the merge-conflicts, staged and changes lists shows the Web
  application's own file-type icon for that file's path before the file name,
  with the per-type color its workspace explorer uses.
- The icon occupies one fixed 16-pixel slot between the status letter and the
  file name; row height, status letter, file name, dimmed directory, rename
  arrow, hover actions, context menus and keyboard behavior are unchanged.
- The same fallback applies as everywhere else: when the application provides no
  file-type icon set, the row shows the plugin's plain document icon and keeps
  working.
- The row option that previously kept the icon off the change lists is removed,
  because every flat file-row list now shows it; the graph's own change rows and
  the details view keep the icon they already had.

## Non-goals

- Changing grouping, ordering, deduplication or the status letters of the three
  lists.
- Moving or resizing the stage, unstage and discard controls, or the rename
  arrow.
- Changing the graph's expanded rows or the details view beyond sharing the same
  renderer.
- Version bumps or commits.
