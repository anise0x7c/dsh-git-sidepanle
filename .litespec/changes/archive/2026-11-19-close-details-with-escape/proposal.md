# Close commit details with Escape

## Why

The commit details view is dismissed only through its back control or by
clicking elsewhere, so a keyboard user has to move focus to that small control.
Escape is the conventional way to leave a view, and pressing it while the
details are open currently does nothing.

## What Changes

- Pressing Escape while a commit's details are open and the Git panel has
  keyboard focus leaves the details view through the same slide-out transition
  as the back control.
- The shortcut dismisses only the details card: it does not run Git, change the
  repository, or alter the split ratio, scroll positions or expanded commits
  underneath it.
- An operation prompt or the branch menu keeps priority for Escape; while one
  of them is open, Escape dismisses that surface instead of the details card.
- The shortcut is inactive when the details view is closed, the Git tab is not
  visible, or keyboard focus is in another pane.

## Non-goals

- No new visible control or key hint in the details toolbar.
- No change to the existing Escape behavior of operation prompts, reference
  dialogs, the branch menu or host context menus.
- No shortcut for opening the details view, and no change to its content.
