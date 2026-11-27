# Unify nested hover margins and radii

## Why

The second hover layer had no shared geometry: a row control's highlight filled
the row's full 22px height and touched its top and bottom edges, while a header
control's highlight already sat 2px inside the 30px header. Both used the 8px
small radius inside a 12px surface, so the inner shape neither kept the same
inset as the outer one nor nested inside its corners. The same control read
differently depending on which surface it sat in.

## What Changes

- Every icon control that adds a hover layer inside a hovered row or section
  header fills its surface's height: a file-row control keeps its 22px pointer
  box, and a header control becomes 30px tall (a 16px glyph with 5px padding).
- The layer is drawn 2px inside that control with a transparent 2px border and
  `background-clip: padding-box`. The row's 22px box therefore paints an 18px
  layer and the header's 30px box a 26px layer, so both keep 2px from the
  surface's top and bottom edges.
- The layer's corners use the surface's 12px radius; clipping to the 2px inset
  reduces them to 10px, which is concentric with the surface's own corners (and
  clamps to a fully rounded end on the 18px row layer).
- A header's trailing 4px padding becomes 0 so its last control's layer keeps
  the same 2px trailing inset; adjacent controls use a 0 gap, so their layers
  keep 4px between them in both contexts.
- Standalone controls outside a row or header (the toolbar, the commit details
  toolbar, the diff header and the split control) keep their full-size hover.

## Non-goals

- No change to which controls take a second layer: the section toggle still
  keeps only the surface highlight.
- No change to the row or header surfaces themselves, to the hover color, or to
  any pointer target's size.
