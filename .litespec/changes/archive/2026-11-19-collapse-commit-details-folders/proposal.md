# Collapse folder rows in commit details

## Why

The commit-details folder tree can be long, and a commit that touches one deep
subtree buries everything else. Today every folder row is a fixed label with a
folder glyph, so a user cannot hide a noisy subtree and the glyph says only that
the row is a folder, not whether its contents are shown.

## What Changes

- Every folder row becomes a disclosure control. It shows an expansion arrow in
  place of the folder glyph — pointing right while the folder is collapsed and
  down while it is expanded — and exposes its expanded state to assistive
  technology.
- Activating a folder row by pointer, `Enter` or `Space` collapses or expands
  everything nested beneath it. A collapsed folder keeps its own row and hides
  every nested folder and file row, including the contents of a collapsed
  unbranched folder chain. Folder rows still open no diff and no menu.
- Every folder starts expanded whenever the details view opens, and collapsing
  one folder leaves other folders' states alone. Defaulting to expanded keeps
  the whole commit readable at a glance.
- Collapse state belongs to the open details card and starts fresh for another
  commit; nothing is persisted.
- File rows keep their file-type icon, name, rename arrow, status letter,
  tooltip and context menu. The header still counts the changed files, and the
  empty, loading, failure/retry and truncated states and the card's motion and
  layering behavior are unchanged.

## Non-goals

- No change to the three working-tree change groups or to the files listed
  under an expanded graph commit; those stay flat, path-sorted lists.
- No "collapse all"/"expand all" control, no keyboard tree navigation beyond
  activating the focused folder row, and no indentation guides.
- No Host, wire, diff, locale, or repository behavior changes.
