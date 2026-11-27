# Route the commit graph on a row and column grid

## Why

The previous connector runs an S-curve from a commit all the way to the following row. Its lateral displacement therefore grows with the lane span, and forks and joins do not read as matching turns. A second text line and a text column aligned to the edge of the widest graph also waste space and separate a commit's subject from its node. Coloring by lane number can give two branches the same color where they meet, even when no palette shortage exists.

## What Changes

- Draw all lane changes in a row-and-column grid: start at the source commit, turn into a fixed horizontal channel on its row, round into the destination column, and continue vertically. Use the corresponding mirrored turn for a join.
- Keep simultaneous lanes distinct while the available palette permits, and do not let joining branches inherit the destination color early.
- Slightly enlarge commit nodes, place metadata beside the subject in one line, and start each commit's text beside its own node rather than after the widest graph column.
- Preserve commit ordering, parent topology, ref labels, details activation, and context-menu behavior.

## Non-goals

- No changes to Git commands, Host transport, commit selection, diff rendering, or commit-details content.
- No infinite color palette: when more than six mutually conflicting branches require colors, reuse is unavoidable and resolution minimizes collisions without moving the topology.
- No continuous horizontal scrolling, graph zoom controls, or custom Git ordering.
