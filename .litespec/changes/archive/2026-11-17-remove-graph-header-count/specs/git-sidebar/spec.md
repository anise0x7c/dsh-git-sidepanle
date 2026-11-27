# git-sidebar delta

## ADDED Requirements

### Requirement: Commit graph header

The commit graph SHALL sit under a collapsible header that shows the graph
title, its toggle and its context menu, and that header SHALL NOT show a count
of the commits loaded so far. The change-group headers SHALL keep showing their
file counts.

#### Scenario: Loaded commits are not counted in the header

- **GIVEN** the graph has loaded one or more commits
- **WHEN** the graph section header is shown
- **THEN** the header shows the graph title without a count chip

#### Scenario: Change-group headers keep their counts

- **GIVEN** the staged and unstaged groups list files
- **WHEN** the panel is shown
- **THEN** each change-group header still shows the number of files in its group

## MODIFIED Requirements

### Requirement: Section headers stay pinned while scrolling

Each collapsible section header SHALL remain visible at the top edge of its
scrolling pane for as long as any part of its own section still reaches below
that edge. A pinned header SHALL paint the host's surface, so the rows scrolling
beneath it are hidden. A pinned header SHALL also cover the pane's top edge
itself, including the inset above the content, so no part of a row is visible
above the header. A header SHALL show the host's hover highlight over that
surface while the pointer is over it, and the highlight SHALL stay inside the
header's rounded corners. At most one header SHALL be pinned at a time: while a
header is pinned, the next section's header SHALL keep its normal position until
the pinned header's section has left the top edge, and SHALL then take that
place. A pinned header SHALL keep its toggle, its count where it shows one, and
its context menu usable. A pane whose content fits without scrolling SHALL show
every header in its normal position.

#### Scenario: A group header stays while its rows scroll

- **GIVEN** the changes group is taller than its pane
- **WHEN** the user scrolls the change list down
- **THEN** the changes header stays at the top edge of that pane while its rows pass beneath it

#### Scenario: Rows do not show through a pinned header

- **WHEN** rows scroll under a pinned header
- **THEN** the header's surface hides them

#### Scenario: Nothing shows above a pinned header

- **GIVEN** a group is taller than its pane
- **WHEN** the user scrolls so that a row crosses the top edge of the pane
- **THEN** the header covers the pane's top edge and no sliver of the row appears above the header

#### Scenario: Hovering a header highlights it

- **WHEN** the pointer moves over a section header, whether it is pinned or in its normal position
- **THEN** the header shows the host hover highlight over its surface and the rows beneath a pinned header stay hidden

#### Scenario: Only one header is pinned

- **GIVEN** a group header is pinned
- **WHEN** the user scrolls past that group's last row and the next group reaches the top edge
- **THEN** the previous header leaves with its group and only the next group's header is pinned

#### Scenario: The pinned header keeps its controls

- **WHEN** the user activates a pinned header's toggle or opens its context menu
- **THEN** the section collapses or expands as usual and the menu opens with that group's actions

#### Scenario: The graph pane pins its own header

- **WHEN** the user scrolls the graph pane
- **THEN** the graph header stays at that pane's top edge while the change pane keeps its own scroll position

#### Scenario: Short panes keep their headers in place

- **GIVEN** the change list fits in its pane without scrolling
- **WHEN** the panel is shown
- **THEN** every group header stays in its normal position
