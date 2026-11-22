# git-sidebar delta

## MODIFIED Requirements

### Requirement: Independent change and graph panes

The panel SHALL present the change groups above the commit graph in two
vertically stacked panes that scroll independently, separated by a divider
while both panes show expanded content. The user SHALL be able to move the
divider by dragging it, and both panes SHALL keep a usable minimum height.
Scrolling one pane SHALL NOT move the other or change its scroll position. The
divider SHALL be reachable by keyboard and SHALL change the split with the
arrow keys. Opening a commit's details SHALL overlay the split with a card
without resizing or unmounting either pane, and returning SHALL reveal the same
split with the ratio and scroll positions the user left.

A pane whose sections are all collapsed SHALL take only the height of their
headers instead of its share of the split. The change pane SHALL keep its
collapsed headers at the top of the split and the graph pane SHALL keep its
collapsed header at the bottom edge of the panel; the other pane SHALL take the
remaining height, and no divider SHALL be offered while a pane is collapsed.
Expanding one section SHALL restore the split with the ratio and scroll
positions in effect before the collapse. A pane that renders no section at all
SHALL be treated as expanded and keep its share of the split.

#### Scenario: Change list scrolls on its own

- **WHEN** the change list is taller than its pane and the user scrolls it
- **THEN** only the change list moves while the graph keeps its own scroll position

#### Scenario: Dragging the divider

- **WHEN** the user drags the divider upward
- **THEN** the change pane becomes shorter and the graph pane becomes taller

#### Scenario: Keyboard adjustment

- **WHEN** the divider has keyboard focus and the user presses ArrowDown
- **THEN** the change pane grows and the graph pane shrinks

#### Scenario: Minimum pane heights

- **WHEN** the user drags the divider to either extreme
- **THEN** both panes remain at least a usable minimum height

#### Scenario: Details do not move the split

- **GIVEN** the change list and graph are visible at a user-selected ratio
- **WHEN** the user opens a commit's details
- **THEN** the card covers the split, and both panes keep their geometry and
  scroll positions underneath it

#### Scenario: Returning from commit details

- **WHEN** the user opens a commit's details and then returns to the split
- **THEN** the change list and graph are revealed with the ratio and scroll
  positions they had before

#### Scenario: Collapsing the graph shrinks it to its header

- **GIVEN** the change list and the commit graph are visible at a user-selected
  ratio
- **WHEN** the user collapses the commit graph section
- **THEN** the graph pane keeps only its section header at the bottom edge of the
  panel, the change pane takes the rest of the height, and no divider is shown

#### Scenario: Expanding the graph restores the split

- **GIVEN** the user collapsed the commit graph section
- **WHEN** the user expands it again
- **THEN** the graph has the ratio and scroll position it had before the
  collapse, and the divider is shown again

#### Scenario: Collapsing every change group gives the room to the graph

- **GIVEN** the change pane renders change groups and none of them is collapsed
- **WHEN** the user collapses every change group
- **THEN** the change pane keeps only their headers at the top of the split, the
  graph pane takes the rest of the height, and no divider is shown

#### Scenario: One expanded change group restores the pane

- **GIVEN** every change group in the change pane is collapsed
- **WHEN** the user expands one change group
- **THEN** the change pane takes its share of the split at the ratio it had, and
  the divider is shown again

#### Scenario: A clean workspace keeps its pane

- **GIVEN** the working tree is clean so the change pane renders no change group
- **WHEN** the panel shows the clean-workspace text
- **THEN** the change pane keeps its share of the split
