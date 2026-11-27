# Design: one line layer

## Root cause

A lane that crosses a commit row's edge used to be two strokes: the row above
ends its `V 22` at its bottom edge, the row below starts its `V 0` at its top
edge, and each row's `<svg>` clips at that edge. At a whole device pixel the two
ends abut exactly, so the lane looks continuous. At a fractional one — a page
zoom of 125%, for example — each stroke resolves itself into the shared pixel
with partial coverage, and antialiased strokes composite one after the other:
`1 - (1 - 0.5)(1 - 0.5) = 0.75` of the line color instead of 1. The reported
screenshot shows the break every second row, 55 device pixels apart, with the
affected pixel at 132/180 of the line's brightness.

## What does not work

Two separately rasterized spots cannot fill one pixel exactly. Covering the
shared pixel completely with a second stroke (the first attempt: a one-pixel
overhang above each row) removes the notch but doubles the coverage of the
stroke's *edge* columns, where the antialiasing lives: the lane's dim side
pixels go from 12.5% to 23% of the line color for a row, which reads as a
slightly thicker spot instead of a lighter one. Abutting instead of overlapping
brings the notch back. Every per-row split trades one artifact for the other,
because the two halves are drawn separately.

## Fix

The graph's lines are one layer, and every segment of one color in the whole
list goes into a single `<path>` element. A path is rasterized once and its
coverage is clamped to one, so overlapping or abutting subpaths inside it merge
into one continuous outline: the row edges are no longer boundaries at all. The
same layer holds the node gaps as circles in its mask.

- `graphRowGeometry(row, offset)` keeps Code OSS's per-row path commands and adds
  the row's offset, so the layer can place a row's pieces in the graph's
  coordinates. With the offset at zero the commands are byte-identical to Code OSS's, which the equivalence test against
  `test/support/code-oss-scm-history.ts` still checks.
- `graphLayer(rows)` collects `paths` and `bridge` per color, the node gaps in
  layer coordinates, and the layer's size.
- The row keeps a cell that holds its node and is as wide as its graph width,
  which is what keeps the text starting after the graph.
- `ROW_OVERHANG` survives for the one case the single element cannot cover: a
  lane that changes color at a row boundary puts the two colors in different
  elements, and the lower color's one-pixel reach above its row keeps the shared
  pixel fully covered.
- The node gap that closes on hover now belongs to the layer's mask, where a
  stylesheet rule on the row cannot reach it. The section tracks the hovered row
  (`onMouseEnter`/`onMouseLeave` on the rows) and hands its index to the layer,
  which picks the smaller radius; the node's own hover size stays a CSS rule in
  the row.

## Consequences

- A lane is exactly as thick between two rows as anywhere else, at every zoom
  and device pixel ratio, with no notch and no bulge.
- The lines are drawn in a layer positioned against the rows' inset. A row's
  hover surface is painted first, so the lines stay visible over it, and the
  layer takes no pointer events.
- Colors are painted in the order they first appear in the graph rather than row
  by row, so at a crossing of two lanes the pixel where they meet can take the
  other lane's color. It is a single pixel and no line shape changes.
- Hovering a row re-renders the section; the rows are simple and the layer's
  paths are memoized, so it stays cheap.
