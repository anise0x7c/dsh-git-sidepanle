# Technical design

## Every parent line owns a lane

The lane table already stores one expectation per open lane: the commit it is
heading toward, its continuous branch identity, and now a creation order. A row
first selects its node from the expectation that has existed longest, not from
the leftmost matching lane. That matters once a connector can reserve a free
lane to the left of an older expectation: the commit must keep the branch
identity and color it has been travelling on, while the newer line joins it.

While traversing a commit's parents, the first parent always reserves the
commit's own lane. A secondary parent always reserves the nearest free lane to
the right of the node, carrying the source branch's identity. If no line
expects the parent yet, that identity is a fresh continuous branch; if a line
already expects it, the connector reuses the source identity so the incoming
line keeps its source color until the join. No secondary parent joins an
existing lane on the child row.

When the parent's row arrives, one expectation carries the node and every other
expectation for the same commit becomes an incoming `in` edge into that lane.
The public row/edge shape is unchanged: only the row where the turn happens and
the number of lanes that stay active until that row differ.

## Window boundary

A secondary parent below the visible window has no row where two lines could
join a node. When such an unlisted parent is already expected, the connector
folds into that expectation at the child row as before, so truncated histories
do not open extra lanes that trail off the bottom. First parents keep their own
lane there as everywhere else. This secondary-parent fold is the only early
join and it is never visible as a listed commit's fork point.

## Lane count, colors and geometry

Deferring the joins can keep more lanes active at once, because each shared
parent may receive several parallel lines. The existing global lane pitch
squeezes up to the 96-pixel graph budget and the four-pixel minimum pitch
absorbs the extra columns; text clearance already reserves the rightmost active
line on each row. Branch identities and conflict groups stay the same model:
arrivals at one listed parent compete for different colors, so shared-parent
meetings remain distinguishable within the six-color palette. Adding another
incoming lane to a node therefore does not change color-assignment rules.

## Verification

Add a regression where a merge's secondary parent is already expected by
another lane: the merge row must open a new lane, the intermediate row must keep
it vertical, and only the shared parent row may turn it into the node. Keep the
first-parent regression, the lane-ownership ordering case where a connector
opens to the left of an older expectation, and the unlisted-parent boundary
case. Preserve all geometry, activation, menu, Host and theme tests.
