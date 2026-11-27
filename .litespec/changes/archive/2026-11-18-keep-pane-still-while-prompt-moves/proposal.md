# Keep the pane still while the operation prompt moves

## Why

The rise animation starts the card below the pane's bottom edge while its
Cancel control already has focus. The browser could then scroll the pane's
scrollable ancestor to reveal that control, so opening a confirmation pushed
the whole tab upwards — branch header, lists and graph included — and the panel
stayed jumped.

## What Changes

- The prompt's motion box becomes a pane-sized, out-of-flow clip box that clips
  the card at the pane's edges itself instead of relying on the host tab body,
  so the translated card never contributes to any ancestor's scrollable area.
- Opening, dismissing, or replacing a prompt therefore keeps the pane content,
  its scroll position and the branch header exactly where they were, while the
  card still rises from and lowers to the bottom edge.

## Non-goals

- No change to the prompt's layout, geometry, shadow, translucency, focus, or
  dismissal semantics.
- No change to the commit-details slide, which moves inside its own scroll
  frame and has no focused control in it during the motion.
