# Sticky section headers

## Why
On a long change list or commit graph, a section header scrolls out of view, so
the reader loses which group the visible rows belong to. The section titles are
the only labels for the rows beneath them, so they should stay readable while
their rows pass by.

## What Changes
Each collapsible section header stays pinned to the top edge of its scrolling
pane for as long as its own section still reaches into the pane, and paints the
host's surface so the rows scrolling beneath it are hidden. Only one header is
pinned at a time: the next section's header takes the top edge as the section
before it leaves, rather than the headers stacking up. The behavior covers both
the change-group pane and the commit-graph pane, each within its own scroll
container, and leaves the header's toggle, count and context menu usable while
pinned.

## Non-goals
- No change to section collapse state, header height, type, count chip, actions,
  or context menus, beyond their remaining usable while pinned.
- No stacked stack of several pinned headers, and no pinned headers in the
  commit-details view, whose header is not a collapsible section header.
- No new scroll position persistence, pane behavior, Host work, or locale copy.
