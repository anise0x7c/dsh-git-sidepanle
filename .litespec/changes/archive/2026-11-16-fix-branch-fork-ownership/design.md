# Technical design

## Keep first parents in their source lane

The existing lane table stores the next expected commit and continuous branch
identity for each open line. The current implementation looks up an existing
parent expectation for every parent. If a first parent is already expected, it
turns immediately into that lane, which is the reported early-fork defect.

An ordinary first parent instead always reserves the source commit's own lane.
A duplicate expectation is intentional: two branches can occupy distinct lanes
while heading for the same listed parent. Secondary-parent allocation remains
unchanged, including the nearest-free-right rule and source branch colors.

## Consume duplicate expectations at the shared parent

At the start of each commit row, select its first matching expectation as the
node position. Other lanes expecting exactly that commit are incoming lines,
not through lines: draw an `in` connector from that lane to the selected node
lane and retire the duplicate expectation. The extra line may turn on the
parent's row using the same grid `edgePath`, without adding connector kinds or
changing the public row shape.

For an additional right-hand incoming lane with a one-row input, the path is
from `(right, 0)` to `(node, 14)`, with horizontal displacement around `y=6`.
This mirrors a rightward child-to-parent fork from `(node, 14)` to `(right, 28)`.
`graphRowGeometry` already supports `from !== to` in both directions. Its
per-row text clearance automatically includes the arriving line.

## Verification

Add a regression with two multi-commit first-parent chains reaching one common
parent. Assert the intermediate rows have vertical incoming and outgoing
segments; assert the shared-parent row alone contains the right-to-left `in`
turn, with its source branch color and unchanged node lane. Adjust existing
diamond expectations to the corrected joining row without weakening topology,
color, geometry, activation, or responsive assertions. Keep all Host code and
Git history ordering unchanged.
