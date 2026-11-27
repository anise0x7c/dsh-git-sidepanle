# git-sidebar delta

## MODIFIED Requirements

### Requirement: Commit graph and branch switching

The panel SHALL show recent commits reachable from the repository's branches as
a commit graph: every listed commit is a node, and every parent it shares with
another listed commit is joined to it by a drawn line, so that divergent
branches and merges appear as separate lines that part and join instead of as
plain text. Lines SHALL be grouped in branch lanes whose colors differ from one
another within the visible graph, and the graph column SHALL stay aligned
across rows. The graph SHALL show ref labels for HEAD, branches, and tags, the
commit subject, author, and relative time. It SHALL let the user switch to
another local branch, mark the current branch, and refresh the panel after a
successful switch. A failed switch SHALL be reported and SHALL leave the
current branch in effect.

#### Scenario: Graph reflects branches

- **WHEN** the repository has commits on the checked-out branch and another local branch
- **THEN** the graph section lists those commits as nodes joined by their lane lines and labels the checked-out branch

#### Scenario: Merged branch topology

- **WHEN** the repository's history contains a branch that diverged from the checked-out branch and was merged back
- **THEN** the graph draws the merge commit and both of its parents as nodes joined by lines, and the diverged branch's line uses a different color from the first-parent line

#### Scenario: Linear history

- **WHEN** every listed commit has the previous listed commit as its only parent
- **THEN** each commit is a node on one lane, joined by an uninterrupted line

#### Scenario: Several branch tips

- **WHEN** the listed commits are reachable from more than one branch tip
- **THEN** each branch tip starts its own colored lane, and the lanes converge where their histories meet

#### Scenario: Switch branch

- **WHEN** the user picks a different local branch
- **THEN** the repository checks out that branch, the header shows its name, and the graph and change groups refresh

#### Scenario: Switch rejected

- **WHEN** Git refuses to switch branches, for example because of local changes
- **THEN** the panel shows Git's message and the current branch stays checked out

### Requirement: Host execution and presentation

Git commands SHALL run on the Host in the Session's working directory, and the
panel SHALL only transmit structured status and results between the browser and
the Host. The panel SHALL present itself in the host application's visual
language: colors, borders, surfaces, and focus rings SHALL come from the host
theme tokens, and section headers, rows, metadata, and controls SHALL use the
host's text sizes and weights, row heights, spacing, and corner radii. The
panel's visible text SHALL follow the user's language, providing English and
Chinese copy.

#### Scenario: Theme follows the application

- **WHEN** the application switches between light and dark themes
- **THEN** the panel's surfaces, text, and graph and diff colors update with the host theme without reloading the tab

#### Scenario: Matches the host sidebar

- **WHEN** the panel is shown beside the sidebar's own sections and rows
- **THEN** its section headers, file rows, metadata, controls, and menus share the host's text scale, row heights, spacing, and corner radii instead of introducing a separate scale

#### Scenario: Chinese interface

- **WHEN** the application language is Chinese
- **THEN** the panel's controls, messages, and empty states are shown in Chinese
