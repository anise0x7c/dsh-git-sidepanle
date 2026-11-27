# Start the expanded commit's wide lane at its node

## Why
Commit 93421d1 drew the whole row's node lane three pixels wide, so the line
visibly thickened halfway between the commit above and this node, before the
wide line into the listed files began. Code OSS keeps every commit row's lane one
pixel wide and only widens the lane in the positions that run through the listed
changes, so the row between the two should not look thicker than the thin line
it joins.

## What Changes
In an expanded commit row only the lane below the node is drawn three pixels
wide; the lane arriving from the commit above stays one pixel, matching the
listed changes' wide line instead of thickening the segment above the node. The
listed rows' lanes, the graph area widths and every other row's geometry stay as
they are.

## Non-goals
- Changing how the listed file rows draw their lanes, the node shapes, the
  graph area width or the geometry of any other commit row.
