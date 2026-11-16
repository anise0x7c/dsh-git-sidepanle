# git-sidebar delta

## MODIFIED Requirements

### Requirement: Commit graph and branch switching
The panel SHALL show recent commits reachable from the repository's branches as
a commit graph: every listed commit is a node, and every parent it shares with
another listed commit is joined to it by a drawn line, so that divergent
branches and merges appear as separate lines that part and join instead of as
plain text. Lines SHALL be grouped in branch lanes, and the graph column SHALL
stay aligned across rows. A first-parent line SHALL continue vertically in its
commit's lane, even when another lane already expects the same parent. A newly
opened secondary-parent line SHALL use the nearest available lane to the right
of its source commit, rather than wrapping around to reuse a lane on its left.
Every lane expecting a commit SHALL remain active until that commit's row;
additional incoming lanes SHALL join the commit's node there, and MUST NOT join
early at an intermediate child.

A lane change opened at a child SHALL begin at that commit's node, turn into a horizontal
channel within that commit's row, and turn vertically into its destination
lane. A connector arriving from another lane SHALL join at its parent's node,
using the corresponding mirrored turn. Forks and joins SHALL use mirrored turns
whose curvature is independent of the number of lanes crossed; a turn MUST NOT
cut through an unrelated node or leave the graph column. A connector joining
another lane SHALL retain its source branch's color until the join, while the
destination lane and node retain their own color. Branches meeting at the same
node SHALL have different colors whenever the available palette permits;
simultaneous lane lines SHOULD also have different colors within that limit.

Each commit SHALL present its ref labels, subject, short identifier, author,
and relative time in one line. The commit's text SHALL begin beside its own
slightly enlarged node rather than after the full width of the widest graph.
Text SHALL leave space for active lines to its right on that row, without
reserving unrelated lane space from other rows. As that row's available text
width narrows, secondary information SHALL be progressively suppressed to
preserve a readable, ellipsized subject. The graph SHALL show ref labels for
HEAD, branches, and tags. It SHALL let the
user switch to another local branch, mark the current branch, and refresh the
panel after a successful switch. A failed switch SHALL be reported and SHALL
leave the current branch in effect.

#### Scenario: Graph reflects branches

- **WHEN** the repository has commits on the checked-out branch and another local branch
- **THEN** the graph section lists those commits as nodes joined by their lane lines and labels the checked-out branch

#### Scenario: Merged branch topology

- **WHEN** the repository's history contains a branch that diverged from the checked-out branch and was merged back
- **THEN** the graph draws the merge commit and both of its parents as nodes joined by lines, and the diverged branch's line uses a different color from the first-parent line

#### Scenario: Linear history

- **WHEN** every listed commit has the previous listed commit as its only parent
- **THEN** each commit is a node on one lane, joined by an uninterrupted vertical line

#### Scenario: Several branch tips

- **WHEN** the listed commits are reachable from more than one branch tip
- **THEN** each branch tip starts its own colored lane, and the lanes converge where their histories meet

#### Scenario: A fork cannot wrap to the left

- **WHEN** a secondary parent needs a new lane while a vacant lane exists to the left of its source commit
- **THEN** the connector opens the nearest available lane to the right of the source commit, appending one if necessary, rather than crossing left to the vacancy

#### Scenario: First-parent lines wait for their shared node

- **GIVEN** two visible branches each reach the same listed parent through ordinary first-parent connections, on different lanes
- **WHEN** their intermediate child rows are drawn
- **THEN** each first-parent connection remains vertical and its other lane remains active until the shared parent's row
- **AND** the additional incoming line turns into the shared commit's node on that parent's row, rather than turning at an intermediate child

#### Scenario: A convergence keeps branch identity

- **WHEN** a branch joins a parent whose existing lane lies to its left or right and has a different color
- **THEN** the joining connector preserves the source branch's color until it reaches the destination lane, and the destination node retains the destination lane's color

#### Scenario: Meeting branches do not share an available color

- **WHEN** branches with otherwise interchangeable lane positions meet at one visible parent and enough unused palette colors exist
- **THEN** each incoming branch and the destination node's own line have distinct colors

#### Scenario: Grid-turned connectors stay readable

- **WHEN** a parent connection changes lanes by one or more columns
- **THEN** its horizontal displacement occurs on the relevant fork or shared-parent row, both turns use the same bounded curvature, the destination column continues vertically, and the path has no long diagonal, horizontal overshoot, or clipping beyond the graph column

#### Scenario: Commit information follows its own node

- **WHEN** one commit sits in a left-hand lane while another sits farther right in the same graph
- **THEN** each commit's subject, short identifier, author, relative time, and visible ref labels share one line beginning beside that commit's node, avoiding any active right-hand lines without an extra metadata row or a fixed outer text column

#### Scenario: A narrow commit row preserves its subject

- **WHEN** the text space beside a commit node becomes too narrow for all of its information
- **THEN** relative time, author, remaining metadata, and secondary ref labels are progressively reduced while the subject keeps a readable width and an ellipsis instead of the whole line being clipped without hierarchy
