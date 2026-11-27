# git-sidebar delta

## ADDED Requirements

### Requirement: Workspace and commit graph sections

The panel SHALL present its working-tree changes and its history as exactly two
top-level collapsible sections, the Workspace section above the Commit Graph
section. The Workspace section SHALL contain every change group the repository
reports — merge conflicts, staged changes, and changes not yet staged — as its
own nested collapsible group in Code OSS's order, and SHALL show the
clean-workspace text in place of the groups when the repository has no changes.
Every nested group SHALL keep its own file count, its bulk action controls where
it has them, its context menu and its file rows, and the Workspace header SHALL
NOT show a file count. The nested group headers and the rows of every group
SHALL be indented one step inside the Workspace section, so the groups read as
children of Workspace. Collapsing the Workspace section SHALL hide all of its
nested groups and their rows; collapsing one nested group SHALL hide only that
group's rows and SHALL leave the other groups and the Workspace section
expanded. Nested group open states SHALL survive collapsing and expanding the
Workspace section while the panel remains mounted.

#### Scenario: The panel shows two sections

- **WHEN** the panel shows a repository with changes
- **THEN** the Workspace section appears above the Commit Graph section, and the
  merge-conflict, staged and unstaged groups are listed inside the Workspace
  section

#### Scenario: Groups open inside the workspace

- **WHEN** the panel opens on a repository with staged and unstaged changes
- **THEN** the Workspace section and each group it lists start expanded, and the
  group rows appear inside the Workspace section rather than beside it

#### Scenario: Nested groups are groups in their own right

- **GIVEN** the Workspace section lists changed files
- **WHEN** the user looks at a nested group header
- **THEN** it shows its own file count, its bulk stage, unstage or discard
  controls where they apply, and its own context menu, while the Workspace
  header shows no file count

#### Scenario: Nested groups are indented

- **GIVEN** the Workspace section lists a change group
- **WHEN** the group's header and rows are shown
- **THEN** both sit one indentation step inside the Workspace header, while the
  commit graph rows keep their own inset

#### Scenario: Collapse the workspace

- **WHEN** the user collapses the Workspace section
- **THEN** the nested group headers and every changed-file row disappear, and
  the Commit Graph section stays expanded and in place

#### Scenario: Collapse one nested group

- **WHEN** the user collapses the staged group inside the Workspace section
- **THEN** only the staged group's rows disappear while the merge-conflict and
  unstaged groups keep their rows and open states

#### Scenario: Nested states survive the workspace

- **GIVEN** the user collapsed the staged group and left the unstaged group open
- **WHEN** the user collapses and expands the Workspace section
- **THEN** the staged group is still collapsed and the unstaged group still
  shows its rows

#### Scenario: Clean workspace

- **WHEN** the repository has no changes
- **THEN** the Workspace section is shown with its clean-workspace text inside
  it, no nested group is rendered, and the Commit Graph section is still offered

## MODIFIED Requirements

### Requirement: Independent change and graph panes

The panel SHALL present the Workspace section above the Commit Graph section in
two vertically stacked panes that scroll independently, separated by a divider
while the split is shown. The user SHALL be able to move the divider by
dragging it while both panes show expanded content, and both panes SHALL keep a
usable minimum height. Scrolling one pane SHALL NOT move the other or change
its scroll position. The divider SHALL be reachable by keyboard and SHALL
change the split with the arrow keys. Opening a commit's details SHALL overlay
the split with a card without resizing or unmounting either pane, and returning
SHALL reveal the same split with the ratio and scroll positions the user left.

The workspace pane SHALL fold away when the Workspace section is collapsed,
keeping only that section's header. When the Workspace section stays expanded
but every nested change group it renders is collapsed, the workspace pane SHALL
keep the Workspace header followed by those nested group headers instead of its
share of the split. The graph pane SHALL fold to its header when the commit
graph section is collapsed. While a pane is folded, the other pane SHALL take
the remaining height, the folded pane's rows SHALL be clipped by the shrinking
pane instead of vanishing first, and the height change SHALL be animated over
the panel's short motion duration. The divider SHALL remain visible while a
pane is folded and SHALL be inert in that state: it SHALL show no hover
highlight, accept no pointer drag, take no keyboard focus and change no ratio.
Expanding the Workspace section, expanding any nested change group, or
expanding the commit graph SHALL animate the pane back to the split ratio in
effect before the fold and SHALL make the divider operable again. A pane that
renders no section at all SHALL be treated as expanded and keep its share of the
split. With a reduced-motion preference the pane SHALL take its new height at
once.

#### Scenario: Workspace list scrolls on its own

- **WHEN** the Workspace list is taller than its pane and the user scrolls it
- **THEN** only the Workspace pane moves while the graph keeps its own scroll
  position

#### Scenario: Dragging the divider

- **GIVEN** both panes show expanded content
- **WHEN** the user drags the divider upward
- **THEN** the Workspace pane becomes shorter and the graph pane becomes taller

#### Scenario: Keyboard adjustment

- **WHEN** the divider has keyboard focus and the user presses ArrowDown
- **THEN** the Workspace pane grows and the graph pane shrinks

#### Scenario: Minimum pane heights

- **WHEN** the user drags the divider to either extreme
- **THEN** both panes remain at least a usable minimum height

#### Scenario: Details do not move the split

- **GIVEN** the Workspace and graph are visible at a user-selected ratio
- **WHEN** the user opens a commit's details
- **THEN** the card covers the split, and both panes keep their geometry and
  scroll positions underneath it

#### Scenario: Returning from commit details

- **WHEN** the user opens a commit's details and then returns to the split
- **THEN** the Workspace list and graph are revealed with the ratio and scroll
  positions they had before

#### Scenario: Collapsing the graph folds it to its header

- **GIVEN** the Workspace and the commit graph are visible at a user-selected
  ratio
- **WHEN** the user collapses the Commit Graph section
- **THEN** the graph pane folds down to its section header at the bottom edge of
  the panel instead of jumping there, its rows are clipped by the shrinking
  pane, the Workspace pane takes the rest of the height, and the divider stays
  visible between the panes without responding to input

#### Scenario: Expanding the graph restores the split

- **GIVEN** the user collapsed the Commit Graph section
- **WHEN** the user expands it again
- **THEN** the graph pane grows back to the ratio it had before the collapse,
  and the divider accepts drags and keyboard steps again

#### Scenario: Collapsing the workspace folds it to its header

- **GIVEN** the Workspace section lists change groups at a user-selected ratio
- **WHEN** the user collapses the Workspace section
- **THEN** the Workspace pane folds to the Workspace header at the top of the
  split, the graph pane takes the rest of the height, and the divider stays
  visible without responding to input

#### Scenario: Expanding the workspace restores the split and its groups

- **GIVEN** the user collapsed the Workspace section
- **WHEN** the user expands it again
- **THEN** the Workspace pane grows back to the ratio it had before the collapse,
  its nested groups keep the open states they had, and the divider accepts
  drags and keyboard steps again

#### Scenario: Collapsing every nested group folds the workspace to its headers

- **GIVEN** the Workspace section is expanded and none of its groups is collapsed
- **WHEN** the user collapses every nested group
- **THEN** the Workspace pane folds to the Workspace header followed by the
  nested group headers, the graph pane takes the rest of the height, and the
  divider stays visible without responding to input

#### Scenario: One expanded group restores the pane

- **GIVEN** every nested group in the Workspace pane is collapsed
- **WHEN** the user expands one nested group
- **THEN** the Workspace pane grows back to its share of the split at the ratio
  it had, and the divider accepts drags and keyboard steps again

#### Scenario: One group does not fold the workspace

- **GIVEN** the Workspace section lists several groups at a user-selected ratio
- **WHEN** the user collapses one nested group while another stays expanded
- **THEN** the Workspace pane keeps its ratio, its height and an operable
  divider, and only that group's rows disappear

#### Scenario: A collapsed divider ignores input

- **GIVEN** a pane is folded so the divider is inert
- **WHEN** the user hovers it, drags it or presses an arrow key while it is
  targeted
- **THEN** it shows no hover highlight, takes no focus and the split does not
  move

#### Scenario: Reduced motion skips the fold animation

- **GIVEN** the user prefers reduced motion
- **WHEN** the user collapses the Workspace section or every nested group
- **THEN** the pane takes its header height at once and the divider is inert

#### Scenario: A clean workspace keeps its pane

- **GIVEN** the working tree is clean so the Workspace section renders no group
- **WHEN** the panel shows the clean-workspace text inside the Workspace section
- **THEN** the Workspace pane keeps its share of the split and the divider still
  responds to input

### Requirement: Section headers stay pinned while scrolling

Each collapsible section header SHALL remain visible at its resting offset for
as long as any part of its own section still reaches below that offset. The
Workspace header SHALL rest and pin at the top edge of its scrolling pane, and a
nested change-group header SHALL rest and pin directly below the Workspace
header. A header SHALL already rest in that position before its pane is
scrolled, so beginning to scroll the pane SHALL NOT shift either the Workspace
header or a nested group header; only the rows SHALL move beneath them. A pinned
header SHALL paint the host's opaque surface from its resting position down, so
the rows scrolling beneath it are hidden and no part of a row is visible above
or through it. A header SHALL show the host's hover highlight while the pointer
is over any part of it, and the highlight SHALL stay inside the header's
rounded corners. The commit graph header SHALL follow the same rule as every
other top-level header, and a header's action control SHALL add its own hover
highlight above the header's highlight while its toggle keeps only the header
highlight. At most one nested change-group header SHALL be pinned while the
Workspace header stays pinned above it: while a group header is pinned, the
next group's header SHALL keep its normal position until the pinned group's
section has left, and SHALL then take that place. A pinned header SHALL keep
its toggle, its count where it shows one, and its context menu usable. A pane
whose content fits without scrolling SHALL show every header in its normal
position.

#### Scenario: A group header stays while its rows scroll

- **GIVEN** the unstaged group is taller than the Workspace pane
- **WHEN** the user scrolls the Workspace list down
- **THEN** the Workspace header stays at the top edge of the pane and the
  unstaged group header stays directly below it while the group's rows pass
  beneath them

#### Scenario: Scrolling does not shift the headers

- **GIVEN** a change group is taller than its pane and the pane is at its top
- **WHEN** the user begins to scroll the pane
- **THEN** the Workspace header stays flush at the pane's top edge, the group
  header stays directly below it, and only the rows move beneath them

#### Scenario: Rows do not show through a pinned header

- **WHEN** rows scroll under a pinned group header
- **THEN** the header's opaque surface hides them

#### Scenario: Nothing shows above a pinned header

- **GIVEN** a group is taller than its pane
- **WHEN** the user scrolls so that a row crosses the top edge of the pane
- **THEN** the Workspace header's surface begins at the pane's top edge, the
  pinned group header's surface begins directly below it, and no sliver of a row
  appears above either header or between them

#### Scenario: Hovering a header highlights it

- **WHEN** the pointer moves over the Workspace header, a nested group header
  or the commit graph header, whether it is pinned or in its normal position
- **THEN** that header shows the host hover highlight over its surface and the
  rows beneath a pinned header stay hidden

#### Scenario: The graph header keeps the whole-header highlight

- **WHEN** the pointer moves over the commit graph header, including the space
  between its controls
- **THEN** the header shows the hover highlight over its whole surface, and its
  controls add their own highlight only while the pointer rests on them

#### Scenario: Only one nested header is pinned

- **GIVEN** a nested group header is pinned below the Workspace header
- **WHEN** the user scrolls past that group's last row and the next group
  reaches the pinned position
- **THEN** the previous header leaves with its group and only the next group's
  header is pinned below the Workspace header

#### Scenario: The Workspace header stays while its groups scroll

- **GIVEN** the Workspace section contains several groups taller than the pane
- **WHEN** the user scrolls through every group
- **THEN** the Workspace header stays at the pane's top edge and each group
  header pins beneath it only while its own group is in view

#### Scenario: The pinned header keeps its controls

- **WHEN** the user activates a pinned group header's toggle or opens its
  context menu
- **THEN** the section collapses or expands as usual and the menu opens with
  that group's actions

#### Scenario: The graph pane pins its own header

- **WHEN** the user scrolls the graph pane
- **THEN** the graph header stays at that pane's top edge while the Workspace
  pane keeps its own scroll position

#### Scenario: Short panes keep their headers in place

- **GIVEN** the Workspace list fits in its pane without scrolling
- **WHEN** the panel is shown
- **THEN** the Workspace header and every group header stay in their normal
  positions

### Requirement: Clean workspace state

When the repository exists and has no changes, the panel SHALL state that the
working tree is clean using localized text only, without an icon and without
empty change groups, inside the expanded Workspace section.

#### Scenario: Clean repository

- **WHEN** the repository has no merge, staged, or unstaged changes
- **THEN** the Workspace section shows the clean-workspace title and description
  inside its body and no check icon, and no nested change group is rendered
