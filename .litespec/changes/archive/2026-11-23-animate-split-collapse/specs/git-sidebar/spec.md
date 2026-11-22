# git-sidebar delta

## MODIFIED Requirements

### Requirement: Independent change and graph panes

The panel SHALL present the change groups above the commit graph in two
vertically stacked panes that scroll independently, separated by a divider
while the split is shown. The user SHALL be able to move the divider by
dragging it while both panes show expanded content, and both panes SHALL keep a
usable minimum height. Scrolling one pane SHALL NOT move the other or change
its scroll position. The divider SHALL be reachable by keyboard and SHALL
change the split with the arrow keys. Opening a commit's details SHALL overlay
the split with a card without resizing or unmounting either pane, and returning
SHALL reveal the same split with the ratio and scroll positions the user left.

A pane whose sections are all collapsed SHALL take only the height of their
headers instead of its share of the split. The change pane SHALL keep its
collapsed headers at the top of the split and the graph pane SHALL keep its
collapsed header at the bottom edge of the panel, while the other pane takes
the remaining height. The height change SHALL be animated over the panel's
short motion duration instead of jumping, and the section body SHALL stay
mounted while the pane folds so its rows are clipped by the shrinking pane
rather than vanishing first. The divider SHALL remain visible while a pane is
collapsed and SHALL be inert in that state: it SHALL show no hover highlight,
accept no pointer drag, take no keyboard focus and change no ratio. Expanding
one section SHALL animate the pane back to the split ratio in effect before the
collapse and SHALL make the divider operable again. A pane that renders no
section at all SHALL be treated as expanded and keep its share of the split.
With a reduced-motion preference the pane SHALL take its new height at once.

#### Scenario: Change list scrolls on its own

- **WHEN** the change list is taller than its pane and the user scrolls it
- **THEN** only the change list moves while the graph keeps its own scroll position

#### Scenario: Dragging the divider

- **GIVEN** both panes show expanded content
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

#### Scenario: Collapsing the graph folds it to its header

- **GIVEN** the change list and the commit graph are visible at a user-selected
  ratio
- **WHEN** the user collapses the commit graph section
- **THEN** the graph pane folds down to its section header at the bottom edge of
  the panel instead of jumping there, its rows are clipped by the shrinking
  pane, the change pane takes the rest of the height, and the divider stays
  visible between the panes without responding to input

#### Scenario: Expanding the graph restores the split

- **GIVEN** the user collapsed the commit graph section
- **WHEN** the user expands it again
- **THEN** the graph pane grows back to the ratio it had before the collapse,
  and the divider accepts drags and keyboard steps again

#### Scenario: Collapsing every change group gives the room to the graph

- **GIVEN** the change pane renders change groups and none of them is collapsed
- **WHEN** the user collapses every change group
- **THEN** the change pane folds to only their headers at the top of the split,
  the graph pane takes the rest of the height, and the divider stays visible
  without responding to input

#### Scenario: One expanded change group restores the pane

- **GIVEN** every change group in the change pane is collapsed
- **WHEN** the user expands one change group
- **THEN** the change pane grows back to its share of the split at the ratio it
  had, and the divider accepts drags and keyboard steps again

#### Scenario: A collapsed divider ignores input

- **GIVEN** a pane is collapsed so the divider is inert
- **WHEN** the user hovers it, drags it or presses an arrow key while it is
  targeted
- **THEN** it shows no hover highlight, takes no focus and the split does not
  move

#### Scenario: Reduced motion skips the fold animation

- **GIVEN** the user prefers reduced motion
- **WHEN** the user collapses a section whose pane folds away
- **THEN** the pane takes its header height at once and the divider is inert

#### Scenario: A clean workspace keeps its pane

- **GIVEN** the working tree is clean so the change pane renders no change group
- **WHEN** the panel shows the clean-workspace text
- **THEN** the change pane keeps its share of the split and the divider still
  responds to input
