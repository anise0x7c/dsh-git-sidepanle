# Show the file-type icon in commit details

## Why

The details view is the detailed counterpart of the graph's expanded file rows,
yet it lists each changed file as a bare status letter and path. The expanded
rows already show the Web application's per-type icon, so the same file looks
different depending on which surface opened it, and a list of paths without
glyphs is slower to scan — especially when a commit touches one Markdown file,
one stylesheet and one image.

The icon decision is already made in one place for the graph; the details view
should reuse the same artwork and the same fallback rather than grow a second
look for the same data.

## What Changes

- Each changed file row in a commit's details view shows the Web application's
  own file-type icon for its path before the file name, with the per-type color
  its workspace explorer uses.
- The icon occupies one fixed slot between the status letter and the file name;
  row height, the status letter, the file name, the dimmed directory, the
  rename arrow, the copy-only context menu and keyboard behavior are unchanged.
- The same fallback applies as in the graph: when the application provides no
  file-type icon set, the row shows the plugin's plain document icon and keeps
  working.
- The working-tree change lists (merge, staged and changes) keep their current
  presentation for now: this change covers the details view only.

## Non-goals

- Adding the icon to the merge, staged and changes list rows.
- Changing the details view's header, metadata block, back control, ordering or
  menu actions.
- Changing the graph's expanded rows, whose icon behavior stays as it is.
- Version bumps or commits.
