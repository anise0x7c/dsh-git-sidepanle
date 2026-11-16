# Keep pinned headers flush with the pane top

## Why

A pinned section header leaves the scroll frame's top inset uncovered, so a
sliver of the scrolling rows stays visible above it. The rest of the header is
opaque, but that strip breaks the surface at the top edge of the pane.

## What Changes

- The resting inset lives above the first section's content rather than on the
  scroll frame, so a pinned header reaches the very top edge of the pane and no
  row can appear above it.
- Short panes keep the same resting inset and their headers in the normal
  position.
- Hover, header controls and the single-pinned-header rule are unchanged.

## Non-goals

- The frame's horizontal insets, the gap between sections, and the splitter.
