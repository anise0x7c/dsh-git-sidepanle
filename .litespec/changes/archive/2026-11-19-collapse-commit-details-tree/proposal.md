# Add indentation guides and folder collapsing to commit details

## Why

The commit-details folder tree can be long, and a commit that touches one deep
subtree buries everything else. Today every folder row is a fixed label, so a
user cannot hide a noisy subtree, and the only cue for nesting is empty
indentation space, which makes a deeply indented row hard to place in the
hierarchy.

## What Changes

- Every folder row becomes a disclosure control with a chevron: activating it
  by pointer, `Enter` or `Space` collapses or expands the folder's whole
  subtree, and its expanded state is exposed to assistive technology. Folder
  rows still open no diff and no menu.
- A collapsed folder keeps its own row and hides every nested folder and file
  row beneath it, including a collapsed unbranched chain's contents. Folders
  start expanded whenever the details view opens, and collapse state is local
  to the open card.
- Every nested row draws one vertical guide per ancestor folder through the
  indentation space, so guide lines line up with the parent folder's disclosure
  control and continue across adjacent rows. Root rows have no guides.
- File rows keep their file-type icon, name, rename arrow, status letter,
  tooltip and context menu, and align with folder rows because both reserve the
  disclosure column.
- The header's file count, empty/loading/failure/truncated states and the card's
  motion and layering behavior are unchanged.

## Non-goals

- No change to the three working-tree change groups or to the files listed
  under an expanded graph commit; those stay flat lists.
- Collapse state is not persisted across closing and reopening the details
  view, tabs, or sessions.
- No "collapse all"/"expand all" control and no Host, wire, or repository
  changes.
