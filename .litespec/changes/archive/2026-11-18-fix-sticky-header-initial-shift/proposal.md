# Remove the pinned section header's initial shift

## Why
Starting to scroll a section pane slides its header up a few pixels before it
pins, because the pane's resting inset sits above the header in the scroll
content. That small movement is visible, makes the header look like it is
changing position to cover the rows, and makes the sticky behavior feel
unstable. The header should already be in its pinned position and simply stay
there while the rows move.

## What Changes
A section header now rests in the position where it pins, so beginning to
scroll moves only the rows. The inset above a pinned header is painted by the
header's own surface instead of being empty scroll content, so no row can show
above the header and the header never shifts to cover the pane's top edge. The
single-pinned-header rule, the surface masking, the hover highlight, the
toggle, counts, actions, context menus, and the pane geometry stay as they are.

## Non-goals
- No change to the header's height, typography, hover highlight, count, actions,
  toggle, or context menu.
- No change to section collapse behavior, pane sizing, split ratio, scroll
  positions, or row spacing.
- No scroll listener, sticky-state tracking, Host work, or locale copy.
