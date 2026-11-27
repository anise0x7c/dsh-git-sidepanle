# Polish the Git panel UI and render a real commit graph

## Why

The panel uses ad-hoc font sizes, spacing, and control styling that drift from
the host sidebar, and its commit history draws the graph as ASCII text, so the
surface looks foreign inside DSH and branch topology is hard to read.

The right Sidebar is the densest surface in the Web GUI: users see the Git tab
next to DSH's own panels, tabs, and menus. A panel that invents its own 12.5px
body text, 23px rows, pill-shaped labels, and outline buttons reads as a
bolted-on widget instead of part of the application. The commit history is the
worst offender: `git log --graph` columns rendered as monospace text cannot use
theme colors, cannot draw nodes, and collapse to unreadable symbols in a
narrow column.

## What Changes

- The panel adopts the host's visual language: theme tokens for every color,
  border, surface, and focus ring; the host's type scale for section headers,
  rows, metadata, and controls; the host's row heights, spacing, corner radii,
  and menu surface treatment.
- The commit history becomes a real tree graph. The Host sends each commit's
  parents, and the panel lays commits out in colored branch lanes and draws
  nodes, vertical lines, and fork/merge curves with inline SVG. Linear history
  stays one lane; divergent branches and merges read as separate colored lines
  that join and part. Ref labels, subject, hash, author, and relative time stay
  on the row, with the graph column aligned across rows.
- The three change groups, the commit box, the branch picker, banners, empty
  states, the commit-details view, and the diff tab keep their behavior and are
  restyled onto the same foundations.
- Motion stays limited to what communicates state: the refresh spinner and the
  chevron rotation. Nothing animates for decoration.

## Non-goals

- No new Git operations, no changes to the Host trust fence, RPC shape beyond
  the added `parents` field on history rows, or command behavior.
- No changes to the shared context-menu presentation, which the host owns; the
  panel keeps only its branch picker, styled to match the host's menus.
- No horizontal scrolling graph: the sidebar is narrow by design, so lanes
  stay compact instead of offering a scrollable graph canvas.
- No new runtime dependencies, and no direct imports of host UI packages.
