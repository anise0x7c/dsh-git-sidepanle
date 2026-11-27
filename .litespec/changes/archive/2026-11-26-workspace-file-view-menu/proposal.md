# Switch Workspace change lists between list and tree

## Why
The three change groups only render flat, path-sorted lists. A working tree
spread over several folders therefore reads as one long list, even though the
commit-details card already draws the same kind of files as a folder tree the
user can collapse. The Workspace header has no menu of its own, while the
commit graph header keeps its remote actions in a dropdown under an ellipsis,
so there is no place to choose how the section shows its files.

The specification already described such a switch as a toolbar view control,
but the shipped panel never had one: the recorded behavior and the panel
disagree. This change implements the switch where users can reach it and
corrects the record.

## What Changes
The Workspace section header gains its own view menu, a dropdown opened from an
ellipsis button in the header's action area, drawn like the commit graph header's
remote overflow menu. The menu offers two file views for every change group at
once: the flat list the panel shows today, and the folder tree the commit
details card draws. The view in effect is checked and the other view is offered;
choosing a view changes no Git state, no grouping, no counts and no section open
state.

The panel opens with the flat list. While it stays open, the chosen view
survives status refreshes, section collapsing and a commit's details opening and
closing, and closing the tab returns to the flat list. In the tree, every folder
starts expanded, a folder row toggles only its own group's subtree, and the
expansion state also survives refreshes and a round trip through the flat list.

## Non-goals
- No second entry point for the view: the header's view menu is the only way to
  switch, and the section header keeps no context menu of its own.
- No change to the commit-details tree, the commit graph, the diff tabs or the
  commit box.
- No per-group view: one view applies to every group at once.
- No change to how changes are grouped, staged, discarded or committed.
