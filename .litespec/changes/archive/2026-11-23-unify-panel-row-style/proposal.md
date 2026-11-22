# Unify changed-file and commit row styles

## Why

The Changes section renders 28-pixel file rows while the commit graph renders
22-pixel commit rows, so one panel shows two row rhythms and two hover/focus
treatments. The commit-details tree adds a third height. A single compact
22-pixel row style across the change lists and the commit graph makes the
sidebar read as one surface.

## What Changes

Changed-file rows, commit-details folder rows, commit rows and the files listed
under an expanded commit all use one shared compact row style: 22-pixel height,
the same horizontal padding, gap, corner radius, hover surface and focus ring.
The commit graph keeps its graph cell, subject, reference badges and drawing
geometry inside that shared row. Rows therefore line up with each other across
the Changes and Commit Graph sections.

## Non-goals

- The commit graph's drawing geometry (22-pixel row height, 11-pixel lane pitch,
  curves, nodes) and its restyled palette stay as they are; the shared row
  happens to keep the graph's existing height.
- Section headers, the commit box, toolbars, diff rows and floating panels keep
  their current sizes.
- Row content and actions are unchanged: file icon, name, dimmed directory,
  status letter, rename arrow, inline stage/unstage/discard controls, commit
  subject, author, reference badges and context menus.
