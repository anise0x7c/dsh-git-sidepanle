# Technical design

## Row and column geometry

Keep `computeGraph(commits)` returning `{rows, laneCount}` and each row's public
edge shape `{kind, from, to, color}`. All lanes share a global pixel pitch and
all rows have an equal height. A lane centre is a column coordinate; a commit
centre, connection channel, row top, and row bottom are row coordinates.
`graphRowGeometry(row, laneCount)` constructs coordinates from that grid.

A lane-changing `out` edge starts at the commit centre. Two quadratic turns,
joined by a horizontal segment, cross a channel six pixels below it. The turn
radius is bounded by half a nominal lane width, half the actual span, and the
space beneath the channel. The path then continues vertically to the row boundary. An `in` edge
runs vertically from its row boundary to its commit centre; the same turn shape
therefore works in both horizontal directions without reversing the chronological
direction or changing lane allocation.

The SVG continues to cover the full active graph width, so through lines and
cross-lane segments need no view-specific routing. A geometry `textOffset`
returns the right edge of the current node plus a gap, or the rightmost active
line on this row plus a gap if one lies farther right. The body receives a
negative margin equal to the unused tail of the SVG, without giving quiet rows
a fixed indent from the widest row. Row height is 28 pixels, node centre is 14,
and normal node radius is 4 (2 remains the minimum under extreme lane squeezing).
The trailing safety clearance and SVG clipping remain, but are no longer an
excuse for pushing every row's text to the right.

Each commit's text body is an inline-size container. At 360, 280, and 200 pixels
of available text width, successive rules hide relative time, author, then the
remaining metadata and ref chips. The subject keeps at least eight character
widths when that much space exists, capped by its actual container width, and
retains ellipsis. The host's normal row activation and complete tooltip remain
available without JavaScript measuring, horizontal scrolling, or new services.

## Branch identity and color

During topology traversal, each lane expectation holds a commit id and a
numeric continuous-branch identity. An ordinary first parent inherits its
source identity; each secondary parent receives a fresh identity. An edge that
meets an existing expectation uses the joining source's identity, not the
target's identity. Incoming and through segments use the expectation identity.
This keeps the joining source color all the way into a shared node.

Collect conflicts between branch identities sharing visible-space or sharing an
arrival: all identities drawn in a row, and all identities arriving at a listed
parent oid. This includes joining sources that otherwise fall on a lane whose
index has the same modulo-six color as the target.

Resolve the undirected conflict graph by saturation degree (DSATUR), breaking
ties by branch creation order. Each branch first tries its stable modulo-six
color, then the nearest unused color. This avoids unnecessary palette changes
in simple graphs while resolving conflicts in dense histories. If every slot is
already occupied by neighboring branches, score reuse so a collision at a shared
parent is strictly costlier than an ordinary simultaneous-line collision. This
keeps every shared-parent group of at most six distinct branches different, even
when unrelated conflicts exhaust the palette elsewhere. No finite palette can
fully color a seven-way mutual conflict with six colors; the resolver moves that
unavoidable reuse away from convergences when possible. It does not add non-theme
colors or widen the column to avoid that limit.

All topology first-parent and right-only secondary-parent invariants remain the
same. No Host history API, view activation, menu target or RPC contract changes.
