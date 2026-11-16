# Restore the section header hover highlight

## Why
0.8.0 gave the pinned section header a square opaque layer behind it to hide the
rows it covers. That layer is a negative-z-index child of the header, and a
stacking context paints its own background below such children: the opaque layer
covered the header's hover background, so section headers stopped highlighting
when the pointer moved over them. The hover highlight is part of the host's
header language, and the fix must keep the rows masked without losing it.

## What Changes
- The header element itself carries the opaque pane surface (the docked tab fill
  or, in a floating tab, the layer-2 fill), so no separate layer sits above its
  background.
- The host hover highlight becomes a rounded layer above that surface and below
  the header's contents, so hovering any section header shows the same
  translucent highlight as before, inside the header's corner radius.
- Pinning, the single-pinned-header rule, the masking of rows, and the header's
  toggle, count and context menu are unchanged.

## Non-goals
- No change to which surface a docked or floating pane uses, or to the sticky
  clamp rules, section markup, or header dimensions.
- No new hover styling for rows, actions, or menus.
