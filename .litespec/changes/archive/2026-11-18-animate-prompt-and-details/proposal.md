# Animate the operation prompt and the commit details view

## Why

Both surfaces appear and disappear instantly. A confirmation pops into the pane
with no cue about where it belongs or where it went, and opening a commit's
details replaces the change list and graph with no hint that the view arrived
from the right edge, which makes returning feel like a jump rather than a step
back.

## What Changes

- The floating operation surface — discard confirmations, the stage-all-and-
  commit offer, and the branch/tag forms — rises into place from the bottom
  edge of the Git pane when it opens, and lowers out of the pane before it is
  removed when it is dismissed. While it leaves it accepts no input.
- The commit details view slides in from the right edge of the pane when it
  opens, and slides back out to that edge before the change list and graph
  return.
- A system request for reduced motion keeps both surfaces still: they appear
  and disappear at their final position without moving.

## Non-goals

- No animation for ordinary panel content: rows, sections, the graph, the
  commit box, banners and Toast notices keep their current behavior.
- No change to prompt semantics: focus, Escape, busy locking, the replacement
  of an idle prompt and the single-prompt rule stay exactly as they are. A
  leaving prompt runs nothing and cannot be clicked.
- No change to the details view's content, file list, diff entry point or the
  change-list state restored on return.
