# Restructure the panel into Workspace and Commit Graph sections

## Why
The change groups and the commit graph currently look like peers: the three
change groups sit as top-level sections beside the graph, so the sidebar does
not show that all three describe the working tree. The flat hierarchy also makes
the panel read as four unrelated lists instead of the two areas a source-control
surface has.

## What Changes
Present the panel body as exactly two top-level collapsible sections: Workspace
above Commit Graph. The merge-conflict, staged and unstaged groups become
nested collapsible groups inside Workspace, keeping their counts, bulk actions,
menus and rows. Workspace collapsing hides its groups; collapsing every nested
group folds the workspace pane to the Workspace header plus the group headers.
Nested headers pin directly below the Workspace header while the pane scrolls.
The clean-workspace text moves inside the Workspace section. The split divider,
commit graph header, change rows, menus and git operations keep their behavior.

## Non-goals
- No change to how changes are grouped, staged, discarded, committed or read.
- No new panel-level or workspace-level actions; the group headers keep their
  existing bulk actions and context menus.
- No change to the commit graph geometry, badges or paging.
- No change to the toolbar, view control or commit box.
