# Refine commit graph layout

## Why
The graph currently searches circularly for an unused lane, so a secondary parent can open to the left of the commit that forks it and cross otherwise stable lines. On convergence, the connector adopts the destination lane's color too early, making the source branch look as though it jumps to another line. The connecting curves also use asymmetric control points, making forks and joins look lopsided even when their endpoints are correct. Together these defects make branch histories harder to trace than the VS Code-style graph the panel intends to provide.

## What Changes
- Continue the first-parent lineage in its current lane and open newly discovered secondary-parent lines only to the right of their source node.
- Keep a joining connector in the source branch's color until it reaches the target lane, and give each new fork its own visible connecting curve.
- Use symmetric, vertically tangent curves with enough outer clearance that their strokes stay inside the graph column.
- Add regression coverage for left-side vacancies, occupied lanes, converging colors, curve geometry, and edge clipping.

## Non-goals
- No changes to history retrieval, commit ordering, repository operations, commit details, or row interactions.
- No new graph controls, filtering modes, virtual scrolling, or branching features beyond the existing topology display.
