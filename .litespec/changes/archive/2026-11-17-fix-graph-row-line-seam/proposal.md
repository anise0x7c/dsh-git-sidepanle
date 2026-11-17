# Keep commit graph lines continuous across row boundaries

## Why

Each commit row draws its own swimlane cell, and the cell stops exactly at the
row's edge. When the row boxes do not land on whole device pixels — a page zoom
of 125%, for example — the browser renders the bottom end of one row's stroke
and the top end of the next row's stroke into the same device pixel, each with
partial coverage. The pixel is then painted with three quarters of the line
color, so a lane that crosses the boundary shows a lighter one-pixel break
between the two rows. Lanes stay unbroken inside a row, so the graph reads as a
row of dashes as soon as the zoom is not a whole number. The break is visible in
the reported screenshot at every second row boundary (a 125% zoom puts half the
row edges on half pixels).

## What Changes

- A lane that continues from one row into the next is drawn without a break:
  the row below paints its lines far enough above its own top edge that the two
  rows cover a whole device pixel, so the boundary pixel shows the full line
  color at any zoom and device pixel ratio.
- Nothing else about the drawing changes: lane positions, row height, curve
  geometry, node shapes, node gaps, colors and the per-row cell width stay VS
  Code's.
- A hovered row still shows one unbroken lane, and its own hover surface does
  not cut the lane where it meets the row above.
- The first row's cell keeps the graph's top edge: the sticky section header
  covers the extra pixel above it, as it already covers the rows pinned beneath
  it.

## Non-goals

- Adding an overhang below the rows, drawn from a row into the next row's
  hover surface, or otherwise drawing the graph as one cell for the whole list.
- Changing the lane layout, the row height, the paging behavior, or how many
  commits are listed.
