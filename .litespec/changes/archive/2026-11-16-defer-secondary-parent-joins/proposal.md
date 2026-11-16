# Defer secondary-parent joins to the shared node

## Why
When a merge's secondary parent is already the target of another active lane,
the graph folds the new connector into that lane on the merge commit's own row.
The shared parent then looks like it is forked from the merge commit, so the
branch line starts at the wrong place. The reported extreme case has several
merges pointing at the same parent in this way; each one should stay a separate
line until the parent's node can receive it.

## What Changes
Every secondary parent opens the nearest free lane to the right of its source
commit, even when another lane already expects that parent. That line keeps its
source branch's color and stays active until the parent's row, where it joins
the node together with every other lane expecting the same commit. A commit row
can therefore receive several incoming lanes, and a merge commit can launch
distinct lanes for each of its parents.

First-parent behavior is unchanged: a first parent still continues vertically
in its commit's own lane. The total number of lanes may grow when merges share
a parent, so the existing lane squeezing and text-clearance rules continue to
keep the graph column bounded and the commit text readable.

## Non-goals
- Do not change commit order, the Host history query, or any RPC contract.
- Do not change the public graph result shape, edge kinds, or geometry rules.
- Do not redesign the commit row, ref labels, menus, keyboard activation, or
  theme behavior.
- Do not change colors, palette conflict handling, or the six-color limit.
