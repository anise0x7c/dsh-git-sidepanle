# Design: surface ownership and the hover layer

## Painting order is the whole bug

A stacking context paints its own background and borders first, then its
negative-z-index descendants, then its in-flow content. The 0.8.0 header owned a
transparent background and painted the opaque pane surface in a `::before` with
`z-index: -1`; that surface therefore covered the header's own hover background
whenever the pointer hovered it. The highlight was still computed and painted —
just underneath the opaque layer.

## Fix: the header owns the surface, the highlight is a layer above it

The header's own `background` now carries the pane surface (base fill for a
docked tab, layer-2 for a floating one), which is the layer that stays below
the hover paint. The hover highlight moves to the `::before`, using the host's
`--dsw-alias-interactive-bg-hover` with `opacity` toggled by `:hover` in the
`(hover: hover)` media query, so it paints above the surface and below the
header's contents without tinting the title, count, or actions.

The header box drops its corner radius and the highlight layer keeps
`--dsw-radius-md`: the opaque surface must be square so rows cannot show through
at the corners while the header is pinned, while the highlight keeps the host's
rounded header shape. The surface tokens are unchanged from 0.8.0.
