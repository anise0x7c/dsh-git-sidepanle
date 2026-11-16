# Replicate the VS Code commit graph

## Why
The panel promises a VS Code-style source-control surface, but its commit graph
was a custom lane layout: it kept vacant lanes open instead of compacting them,
drew its own bounded-curve channels, colored lanes with a conflict-avoiding
six-token palette, showed plain text ref chips, and listed commits in date order.
Side by side with VS Code's Source Control Graph on a complex history (several
branch tips, repeated merges from a fork, remote-tracking branches) the two
disagree on commit order, lane placement, curves, node shapes, colors and ref
labels, so a user moving between the two tools cannot recognize the same
history. The user asked for a 1:1 reproduction of VS Code's graph, accepting
breaking changes to the previous graph contract.

## What Changes
- **Order:** history is listed in topological order across local branches, tags
  and remote-tracking branches, as VS Code's "All" graph filter lists it.
- **Layout:** VS Code's swimlane model replaces the custom lane allocator. A
  commit's node takes the leftmost incoming line heading for it; its first
  parent continues that line; every further line heading for the same commit
  joins the node on its row and closes; each additional merge parent opens a
  new line at the right end; lines right of a closed line shift left on that
  row. The previous guarantees about reusing lanes "to the right of the source"
  and keeping vacated lanes open are dropped.
- **Drawing:** VS Code's geometry — 22-pixel rows, 11-pixel lane pitch, thin
  round-capped lines, an 11-pixel quarter turn for joins and merge launches, a
  5-pixel S-turn for lane shifts — and VS Code's three node shapes: filled dot,
  merge ring with a center dot, and a hollow ring for the checked-out commit,
  each separated from touching lines by a clear gap.
- **Colors:** VS Code's five-color rotation (`#FFB000`, `#DC267F`, `#994F00`,
  `#40B0A6`, `#B66DFF`) assigned in creation order, plus fixed colors for the
  checked-out branch (blue), its upstream (purple) and its base branch
  (orange). The previous conflict-avoiding coloring is dropped.
- **Rows:** the row shows the subject (bold for the checked-out commit) and the
  dimmed author on one ellipsized line, followed by VS Code's colored reference
  badges with target, branch, cloud and tag icons; the first reference shows
  its name, the rest collapse into icon badges grouped by color and kind.
  Short identifier, relative time and every reference move into the row
  tooltip. Text begins right after the row's own graph cell.
- **Host:** the history operation additionally reports the checked-out
  reference, its upstream and its base branch, and returns full reference
  names so local and remote branches can be told apart.
- **Presentation:** the graph palette and the compact graph row height are an
  explicit exception to "host tokens and row heights only"; everything else
  keeps the host's visual language.

## Non-goals
- No "Incoming Changes" / "Outgoing Changes" virtual rows, no inline expansion
  of a commit's files inside the graph, no author avatars, no rich hover card,
  no graph filter picker and no "load more" paging; the window stays at the
  most recent 60 commits.
- No change to commit details, diffs, staging, committing, menus or branch
  switching behavior.
- The base branch is never written to the repository configuration, and no
  reflog heuristics are used to guess it.
