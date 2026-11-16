# git-sidebar delta

## MODIFIED Requirements

### Requirement: Commit graph and branch switching

The panel SHALL show recent commits reachable from the repository's branches as
a commit graph: every listed commit is a node, and every parent it shares with
another listed commit is joined to it by a drawn line, so that divergent
branches and merges appear as separate lines that part and join instead of as
plain text. Lines SHALL be grouped in branch lanes whose colors differ from one
another within the visible graph, and the graph column SHALL stay aligned
across rows. A first-parent line SHALL continue in its commit's lane when it opens a new parent line. A newly
opened secondary-parent line SHALL use the nearest available lane to the right
of its source commit, rather than wrapping around to reuse a lane on its left.
A connector joining another lane SHALL retain its source branch's color until
the join, while the destination lane and node retain their own color. A curved
connector SHALL have symmetric curvature, enter and leave its lane vertically,
and remain within the graph column without cutting through an unrelated node.
The graph SHALL show ref labels for HEAD, branches, and tags, the commit
subject, author, and relative time. It SHALL let the user switch to another
local branch, mark the current branch, and refresh the panel after a successful
switch. A failed switch SHALL be reported and SHALL leave the current branch in
effect.

#### Scenario: Graph reflects branches

- **WHEN** the repository has commits on the checked-out branch and another local branch
- **THEN** the graph section lists those commits as nodes joined by their lane lines and labels the checked-out branch

#### Scenario: Merged branch topology

- **WHEN** the repository's history contains a branch that diverged from the
  checked-out branch and was merged back
- **THEN** the graph draws the merge commit and both of its parents as nodes
  joined by lines, and the diverged branch's line uses a different color from
  the first-parent line

#### Scenario: Linear history

- **WHEN** every listed commit has the previous listed commit as its only parent
- **THEN** each commit is a node on one lane, joined by an uninterrupted line

#### Scenario: Several branch tips

- **WHEN** the listed commits are reachable from more than one branch tip
- **THEN** each branch tip starts its own colored lane, and the lanes converge where their histories meet

#### Scenario: A fork cannot wrap to the left

- **WHEN** a secondary parent needs a new lane while a vacant lane exists to the left of its source commit
- **THEN** the connector opens the nearest available lane to the right of the source commit, appending one if necessary, rather than crossing left to the vacancy

#### Scenario: A convergence keeps branch identity

- **WHEN** a branch joins a parent whose existing lane lies to its left or right and has a different color
- **THEN** the joining connector preserves the source branch's color until it reaches the destination lane, and the destination node retains the destination lane's color

#### Scenario: A curved connector stays readable

- **WHEN** a parent connection changes lanes
- **THEN** its line leaves the source and enters the destination vertically with symmetric curvature, without a hairpin, horizontal overshoot, or clipping beyond the graph column

#### Scenario: Switch branch

- **WHEN** the user picks a different local branch
- **THEN** the repository checks out that branch, the header shows its name, and the graph and change groups refresh

#### Scenario: Switch rejected

- **WHEN** Git refuses to switch branches, for example because of local changes
- **THEN** the panel shows Git's message and the current branch stays checked out
