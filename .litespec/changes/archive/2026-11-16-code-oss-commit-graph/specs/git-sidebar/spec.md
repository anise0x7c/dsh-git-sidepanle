# git-sidebar delta

## REMOVED Requirements

### Requirement: Commit graph and branch switching
Removed because its custom lane, color and row rules are replaced by the Code OSS
Source Control Graph behavior described in the commit graph swimlanes, drawing,
nodes, colors, and rows requirements; branch switching keeps its own requirement.

## ADDED Requirements

### Requirement: Commit graph swimlanes
The panel SHALL show the most recent commits reachable from the repository's
local branches, tags, and remote-tracking branches in topological order, with
every commit after all of its children, as a commit graph laid out with Code OSS's Source Control Graph swimlane rules. Every row SHALL carry an ordered
set of incoming lines from the row above and outgoing lines toward the row
below, each line heading for one commit:

- A commit's node SHALL sit on the leftmost incoming line heading for it; a
  commit that no line expects SHALL place its node in a new position after
  every incoming line.
- The commit's first parent SHALL continue in the node's position, and every
  other incoming line heading for the same commit SHALL join the node on that
  row and end there.
- Every additional parent of a merge SHALL open a new outgoing line at the right
  end of the row, even when another line already heads for that parent.
- Lines to the right of an ended line SHALL move left on the same row to close
  the gap, keeping their order.
- A commit without parents SHALL end only its own lines; every other line SHALL
  continue.
- A line heading for a commit outside the listed window SHALL continue to the
  bottom of the graph.

#### Scenario: Linear history
- **WHEN** every listed commit has the next listed commit as its only parent
- **THEN** every node sits in the first position and one uninterrupted vertical
  line joins them

#### Scenario: Merged branch topology
- **WHEN** a merge commit's second parent is a branch that diverged from its
  first parent's line
- **THEN** the merge opens a second line on its right, the branch's commits sit
  on that line, and the line joins its fork point's node on the fork point's row

#### Scenario: Several branch tips
- **WHEN** a branch tip is listed after commits of another branch and no
  earlier line expects it
- **THEN** its node starts a new line to the right of the active lines, and the
  line joins the shared ancestor's node on that ancestor's row

#### Scenario: A merge parent that is already expected
- **GIVEN** a line already heads for a merge commit's second parent
- **WHEN** the merge commit's row is drawn
- **THEN** the merge still opens a new line at the right end for that parent,
  and both lines join the parent's node on its row

#### Scenario: Lanes close up after a join
- **WHEN** a line ends by joining a node while other lines run to its right
- **THEN** those lines move one position left on that row and continue
  vertically below it

#### Scenario: A root commit does not end other branches
- **WHEN** a commit without parents is listed while other lines are still
  active
- **THEN** only the root commit's own lines end and every other line continues
  to its next commit

#### Scenario: Parent outside the window
- **WHEN** the oldest listed commit's parent is not listed
- **THEN** its line continues to the bottom edge of the graph

### Requirement: Commit graph drawing
The graph SHALL reproduce Code OSS's Source Control Graph geometry: rows 22
pixels high, line positions 11 pixels apart with the first position 11 pixels
from the graph's left edge, nodes centered vertically in their row, and lines
drawn one pixel wide with round caps. A continuing line SHALL be vertical. A
line that moves left on a row SHALL descend briefly, turn with a 5-pixel radius
into a horizontal run at the row's middle, and turn with the same radius down
into its new position. A line joining a node from the right SHALL turn with an
11-pixel quarter curve from its position into the row's middle and run
horizontally into the node. A merge's additional parent line SHALL leave the
node horizontally and turn with an 11-pixel quarter curve down into its own
position at the row's bottom edge. Each row's graph cell SHALL be one position
wider than the larger of its incoming and outgoing line counts, and the row's
text SHALL begin right after that cell.

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
  row's bottom edge in its new position through two 5-pixel turns joined by a
  horizontal run

#### Scenario: Text follows each row's own graph width
- **WHEN** one row has a single active line and another row has four
- **THEN** the first row's text begins after a two-position graph cell and the
  second row's text begins after a five-position graph cell

### Requirement: Commit graph nodes
Every listed commit SHALL be drawn as a node in Code OSS's shapes: a filled dot
for a commit with at most one parent, a ring with a filled center dot for a
merge commit, and a hollow ring for the checked-out commit, which takes
precedence over the merge shape. Each node SHALL be separated by a clear gap
from the lines that touch it, and the gap outside the node's outer edge SHALL
close while the pointer hovers the row.

#### Scenario: Checked-out commit
- **WHEN** the history contains the commit HEAD points at
- **THEN** that commit's node is a hollow ring in its line's color

#### Scenario: Merge commit
- **WHEN** a listed commit has two or more parents and is not checked out
- **THEN** its node is a ring around a smaller filled dot

#### Scenario: Ordinary commit
- **WHEN** a listed commit has one parent or none and is not checked out
- **THEN** its node is a filled dot in its line's color

### Requirement: Commit graph colors
Graph lines SHALL take Code OSS's Source Control Graph colors. A new line SHALL
take the next color of the five-color rotation `#FFB000`, `#DC267F`, `#994F00`,
`#40B0A6`, `#B66DFF`, in the order lines are created from the top of the graph
and restarting after the fifth. A first parent SHALL continue its child's line
color. A commit that carries the checked-out branch SHALL color the line it
continues blue, a commit that carries that branch's upstream SHALL color it
purple, and a commit that carries the branch's base branch SHALL color it
orange, in that priority; a new line toward such a commit SHALL take that color
instead of a rotation color. The blue and purple SHALL switch between Code OSS's
light and dark variants with the host theme. The base branch SHALL be the remote
branch configured as the branch's Code OSS merge base, otherwise the default
branch of the default remote, and SHALL only apply when it differs from the
upstream. A node SHALL take the color of the line its first parent continues,
or of its incoming line when it has no parents, and a joining line SHALL keep
its own color until it reaches the node.

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
  without reloading the tab, while the rotation colors stay the same

### Requirement: Commit rows and reference badges
Each commit row SHALL show, on one line beside its graph cell, the commit's
subject followed by its dimmed author, truncated together with an ellipsis,
and then the commit's reference badges, which keep their size. The checked-out
commit's subject and author SHALL be bold. Badges SHALL follow Code OSS's rules:
references are ordered by the checked-out branch, its upstream, its base
branch, then local branches, remote branches and tags by name; the first
reference is a badge with its icon and its name, truncated beyond 100 pixels;
the remaining references are grouped by color and then by kind into icon
badges that show a count when they stand for more than one reference. A badge
SHALL use the reference's color as its background and the panel background as
its text color, where the checked-out branch, its upstream and its base branch
keep their own colors and every other reference takes its node's color. The
checked-out branch SHALL use a target icon, local branches a branch icon,
remote branches a cloud icon and tags a tag icon. A remote's default-branch
pointer and a detached HEAD marker SHALL NOT be shown as badges. The row's
tooltip SHALL list every reference, the short identifier, subject, author and
relative time.

#### Scenario: Checked-out branch with its upstream
- **WHEN** the checked-out commit carries the checked-out branch and its
  upstream remote branch
- **THEN** the row shows a blue badge with a target icon and the branch name,
  followed by a purple cloud badge without a name

#### Scenario: Branch and its remote on another line
- **WHEN** a commit on a yellow line carries a local branch and its
  remote-tracking branch
- **THEN** the row shows a yellow badge with a branch icon and the branch name,
  followed by a yellow cloud badge without a name

#### Scenario: Several references of one kind
- **WHEN** a commit carries one named badge and two further tags of the same
  color
- **THEN** the tags appear as one tag badge showing the count two

#### Scenario: A narrow row keeps its badges
- **WHEN** the row is too narrow for the subject, author and badges
- **THEN** the subject and author are truncated with an ellipsis while the
  badges keep their size

#### Scenario: Details remain in the tooltip
- **WHEN** the user hovers a commit row
- **THEN** the tooltip shows every reference, the short identifier, subject,
  author and relative time, and activating the row still opens the commit
  details

### Requirement: Branch switching
The panel SHALL let the user switch to another local branch, mark the current
branch, and refresh the panel after a successful switch. A failed switch SHALL
be reported and SHALL leave the current branch in effect.

#### Scenario: Switch branch
- **WHEN** the user picks a different local branch
- **THEN** the repository checks out that branch, the header shows its name, and the graph and change groups refresh

#### Scenario: Switch rejected
- **WHEN** Git refuses to switch branches, for example because of local changes
- **THEN** the panel shows Git's message and the current branch stays checked out

## MODIFIED Requirements

### Requirement: Host execution and presentation

Git commands SHALL run on the Host in the Session's working directory, and the
panel SHALL only transmit structured status and results between the browser and
the Host. The panel SHALL present itself in the host application's visual
language: colors, borders, surfaces, and focus rings SHALL come from the host
theme tokens, and section headers, rows, metadata, and controls SHALL use the
host's text sizes and weights, row heights, spacing, and corner radii. The
commit graph is the one exception: its line, node and reference badge colors and
its compact row height SHALL follow Code OSS's Source Control Graph as the commit
graph requirements describe. The panel's visible text SHALL follow the user's
language, providing English and Chinese copy.

#### Scenario: Theme follows the application

- **WHEN** the application switches between light and dark themes
- **THEN** the panel's surfaces, text, diff colors, and graph badge text update with the host theme without reloading the tab

#### Scenario: Matches the host sidebar

- **WHEN** the panel is shown beside the sidebar's own sections and rows
- **THEN** its section headers, file rows, metadata, controls, and menus share the host's text scale, row heights, spacing, and corner radii instead of introducing a separate scale, while commit graph rows keep Code OSS's graph dimensions

#### Scenario: Chinese interface

- **WHEN** the application language is Chinese
- **THEN** the panel's controls, messages, and empty states are shown in Chinese
