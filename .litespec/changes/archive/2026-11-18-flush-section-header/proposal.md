# Flush section headers at the pane top edge

## Why
The 2px resting inset put the header just below the pane's top edge; the header
then depended on an upward shadow to paint that strip, and any seam or missed
paint let a row sliver show above it. A header that starts at the pane's top
edge covers that edge itself, so no overlay is needed.

## What Changes
Remove the first section's top inset, the shared inset variable, and the
header's sticky offset and shadow. Every header rests flush at its pane's top
edge and pins there, so scrolling starts with only the rows moving.

## Non-goals
- No change to the 2px gap between sections, the 30px header height, row
  metrics, split behavior, or the opaque docked/floating header surface.
- No host-side or route changes.
