# Widen the expanded commit row's own lane

## Why

Code OSS's wide change-row lane starts at the expanded commit's bottom edge: the
commit row's own line stays one pixel, the lines listed under it are three, and
at the row boundary the lane visibly changes width. The row that owns the files
therefore looks disconnected from them, which reads as a drawing defect rather
than as the emphasis the wide line is meant to carry.

## What Changes

- An expanded commit's own row draws the lane in its node's position three
  pixels wide, above and below the node, so the wide line runs from the row's
  top edge through the node position and the row's bottom edge into the listed
  rows without a change of width.
- A collapsed commit row keeps one-pixel lines, and every other line of the
  row, including the curves of lanes joining the node, keeps one pixel.
- The change is presentational only: layout, colors, node shapes, hover and the
  listed rows' own drawing are unchanged, and a lane the commit is not on is
  never widened.

## Non-goals

- Widening the whole checked-out branch lane, or any lane of a collapsed commit
  row: only the row whose files are listed is emphasised.
- Changing Code OSS's three-pixel highlight or one-pixel lines elsewhere,
  including the change rows' own graph area.
- Version bumps or commits.
