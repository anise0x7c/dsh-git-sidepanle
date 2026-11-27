# git-sidebar delta

## ADDED Requirements

### Requirement: Hover highlights a surface and its controls

When the pointer rests on a row of the change lists, the commit graph or the
commit-details tree, or on a collapsible section header, the panel SHALL show
the host's hover highlight over that whole surface, inside that surface's
rounded corners. While the pointer rests on a control inside such a surface —
the section toggle, a header action, a file-row action or a control in the
commit graph header — that control SHALL add its own rounded hover highlight
above the surface highlight, so the control reads both as part of the
highlighted row and as the target under the pointer. A control's highlight
SHALL stay inside its own rounded corners and inside the surface's corners. A
disabled control SHALL NOT show a control highlight, and a row that takes no
pointer input SHALL show neither layer.

#### Scenario: A control inside a hovered header

- **GIVEN** the staged group shows its unstage-all control and the unstaged
  group shows its stage-all and discard-all controls
- **WHEN** the pointer moves over one of those controls
- **THEN** the whole header shows the hover highlight and that control adds its
  own highlight above it, while the header's other controls show only the
  header highlight

#### Scenario: A control inside a hovered row

- **GIVEN** a file row reveals its stage, unstage or discard control while the
  row is hovered
- **WHEN** the pointer moves onto that control
- **THEN** the row keeps its hover highlight and the control adds its own
  highlight above it

#### Scenario: The graph header highlights like the other headers

- **WHEN** the pointer moves from a change-group header to the commit graph
  header
- **THEN** the graph header shows the same whole-header highlight, and a graph
  header control that the pointer rests on adds its own highlight above it

#### Scenario: Both layers leave with the pointer

- **WHEN** the pointer leaves the header, the row or the control
- **THEN** the control highlight and the surface highlight are gone

#### Scenario: A disabled control stays flat

- **GIVEN** an action is running so a header's action control is disabled
- **WHEN** the pointer rests on that disabled control
- **THEN** the header shows its hover highlight and the disabled control adds no
  highlight of its own

#### Scenario: A status row takes no hover

- **WHEN** the pointer rests on a note row that reports a loading, empty or
  failed list, away from any control it may contain
- **THEN** the row shows no hover highlight, while an inline retry control keeps
  its own highlight

## MODIFIED Requirements

### Requirement: Section headers stay pinned while scrolling

Each collapsible section header SHALL remain visible at the top edge of its
scrolling pane for as long as any part of its own section still reaches below
that edge. A header SHALL already rest at the pane's top edge in both its
normal and pinned positions, so beginning to scroll its pane SHALL NOT shift
the header; only the rows SHALL move beneath it. A pinned header SHALL paint
the host's opaque surface from the pane's top edge down, so the rows scrolling
beneath it are hidden and no part of a row is visible above or through the
header. A header SHALL show the host's hover highlight while the pointer is
over any part of it, and the highlight SHALL stay inside the header's rounded
corners. The commit graph header SHALL follow the same rule as every other
header, and a control inside a header SHALL add its own hover highlight above
the header's highlight. At most one header SHALL be pinned at a time: while a
header is pinned, the next section's header SHALL keep its normal position
until the pinned header's section has left the top edge, and SHALL then take
that place. A pinned header SHALL keep its toggle, its count where it shows
one, and its context menu usable. A pane whose content fits without scrolling
SHALL show every header in its normal position.

#### Scenario: A group header stays while its rows scroll

- **GIVEN** the changes group is taller than its pane
- **WHEN** the user scrolls the change list down
- **THEN** the changes header stays at the top edge of that pane while its rows pass beneath it

#### Scenario: Scrolling does not shift the header

- **GIVEN** a change group is taller than its pane and the pane is at its top
- **WHEN** the user begins to scroll the pane
- **THEN** the group header stays flush at the pane's top edge from the first scrolled pixel, and only the rows move beneath it

#### Scenario: Rows do not show through a pinned header

- **WHEN** rows scroll under a pinned header
- **THEN** the header's opaque surface hides them

#### Scenario: Nothing shows above a pinned header

- **GIVEN** a group is taller than its pane
- **WHEN** the user scrolls so that a row crosses the top edge of the pane
- **THEN** the header's surface begins at the pane's top edge and no sliver of the row appears above the header

#### Scenario: Hovering a header highlights it

- **WHEN** the pointer moves over a section header, whether it is pinned or in its normal position
- **THEN** the header shows the host hover highlight over its surface and the rows beneath a pinned header stay hidden

#### Scenario: The graph header keeps the whole-header highlight

- **WHEN** the pointer moves over the commit graph header, including the space between its controls
- **THEN** the header shows the hover highlight over its whole surface, and its controls add their own highlight only while the pointer rests on them

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
