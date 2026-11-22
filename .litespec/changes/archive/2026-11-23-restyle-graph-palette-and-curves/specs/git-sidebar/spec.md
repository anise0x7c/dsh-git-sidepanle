# git-sidebar delta

## MODIFIED Requirements

### Requirement: Commit graph drawing

The graph SHALL follow VS Code's Source Control Graph geometry: rows 22 pixels
high, line positions 11 pixels apart with the first position 11 pixels from the
graph's left edge, nodes centered vertically in their row, and lines drawn one
pixel wide with round caps. A continuing line SHALL be vertical. A line that
moves left on a row SHALL descend briefly, turn with a 3-pixel radius into a
horizontal run at the row's middle, and turn with the same radius down into its
new position; this tighter radius, rather than VS Code's 5 pixels, is deliberate.
A line joining a node from the right SHALL turn with an 11-pixel quarter curve
from its position into the row's middle and run horizontally into the node. A
merge's additional parent line SHALL leave the node horizontally and turn with
an 11-pixel quarter curve down into its own position at the row's bottom edge.
Each row's graph cell SHALL be one position wider than the larger of its
incoming and outgoing line counts, and the row's text SHALL begin right after
that cell. A line that enters a row from above SHALL join the line the row above
leaves at its bottom edge without a break, including when the rows' edges fall
between device pixels.

#### Scenario: A join turns into the node

- **WHEN** a second line heading for a commit arrives at the commit's row from
  a position to the right of the node
- **THEN** the line curves from that position at the row's top edge into the
  row's middle and runs horizontally into the node

#### Scenario: A merge launches its parent line

- **WHEN** a merge commit opens a line for its second parent
- **THEN** the line leaves the node horizontally at the row's middle and curves
  down into the new position at the row's bottom edge

#### Scenario: A shifted line keeps continuity

- **WHEN** a line moves one or more positions left on a row
- **THEN** it leaves the row's top edge in its old position and reaches the
  row's bottom edge in its new position through two 3-pixel turns joined by a
  horizontal run

#### Scenario: A line crosses a row boundary

- **GIVEN** the row edges do not line up with whole device pixels, as they do
  not at a zoom of 125%
- **WHEN** a lane continues from one row into the row below
- **THEN** the stroke reads as one unbroken line, with no lighter pixel row
  where the two rows meet

#### Scenario: Text follows each row's own graph width

- **WHEN** one row has a single active line and another row has four
- **THEN** the first row's text begins after a two-position graph cell and the
  second row's text begins after a five-position graph cell

### Requirement: Commit graph colors

Graph lines SHALL use a restyled palette that is clearly distinct from VS Code's
Source Control Graph while keeping the same hue families and readable contrast: a
new line SHALL take the next color of the five-color rotation `#D6A700` (gold),
`#E0065B` (crimson), `#A66200` (copper), `#3EAD76` (emerald), `#9362F4`
(violet), in the order lines are created from the top of the graph and
restarting after the fifth. A first parent SHALL continue its child's line
color. A commit that carries the checked-out branch SHALL color the line it
continues blue, a commit that carries that branch's upstream SHALL color it
purple, and a commit that carries the branch's base branch SHALL color it
orange, in that priority; a new line toward such a commit SHALL take that color
instead of a rotation color. The blue SHALL be `#0088CD` in the light theme and
`#00A8FB` in the dark theme, the purple `#81359C` in the light theme and
`#C27FDD` in the dark theme, and the orange `#F66140` in both. The blue and
purple SHALL switch between their light and dark variants with the host theme.
Every color SHALL keep at least a 2:1 contrast ratio against the panel
background in both themes. The base branch SHALL be the remote branch configured
as the branch's VS Code merge base, otherwise the default branch of the default
remote, and SHALL only apply when it differs from the upstream. A node SHALL
take the color of the line its first parent continues, or of its incoming line
when it has no parents, and a joining line SHALL keep its own color until it
reaches the node.

#### Scenario: Colors rotate per new line

- **WHEN** six branch lines are opened one after another without special
  references
- **THEN** they take the five rotation colors in order and the sixth line
  repeats the first color

#### Scenario: Checked-out branch is blue

- **WHEN** the checked-out branch points at a listed commit
- **THEN** that commit's node and the line toward its first parent are blue and
  the line keeps that color down to the next commit that changes it

#### Scenario: Upstream and base branches

- **WHEN** the checked-out branch's upstream and its base branch point at other
  listed commits
- **THEN** the upstream commit's line is purple and the base branch commit's
  line is orange

#### Scenario: Theme follows the application

- **WHEN** the application switches between light and dark themes
- **THEN** the checked-out and upstream colors switch to their matching variant
  without reloading the tab, while the rotation colors and the base color stay
  the same

#### Scenario: Colors stay legible in both themes

- **WHEN** the panel renders in the light theme or in the dark theme
- **THEN** every line, node and badge color keeps at least a 2:1 contrast ratio
  against the panel background
