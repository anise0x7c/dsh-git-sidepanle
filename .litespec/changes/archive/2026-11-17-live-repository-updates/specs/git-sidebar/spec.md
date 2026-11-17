# git-sidebar delta

## MODIFIED Requirements

### Requirement: Freshness and failures

The panel SHALL load on open, refresh after every completed operation, and
refresh on demand. While the tab is visible, changes made outside DSH SHALL
appear without user action as they settle: the Host SHALL detect repository
changes and make them known to the panel, and a periodic check SHALL remain
only as a fallback where change detection is unavailable. It SHALL surface Git
failures inline with a retry path, and a missing Git executable SHALL be
explained as such.

#### Scenario: External change

- **WHEN** a file changes outside DSH while the panel is visible
- **THEN** the change appears without any user action within two seconds

#### Scenario: Manual refresh

- **WHEN** the user activates the refresh control
- **THEN** the panel re-reads the repository status and history

#### Scenario: Git unavailable

- **WHEN** the Git executable is missing
- **THEN** the panel explains that Git could not be run and offers retry

#### Scenario: Change detection unavailable

- **WHEN** the Host cannot watch the repository's files
- **THEN** external changes still appear after the periodic check and no
  watcher failure is shown to the user

## ADDED Requirements

### Requirement: Watched repository updates

The Host SHALL watch the working tree and the Git metadata of every repository
that a panel uses, covering tracked and untracked files, the index, `HEAD`, and
local, remote-tracking and tag references including packed ones. It SHALL
coalesce a burst of related changes into one update. It SHALL start watching
when the first panel reads the repository and stop when the last panel using
that repository closes, the Session moves to another repository, or the plugin
unloads.

#### Scenario: External file edit

- **WHEN** a file is edited in a terminal while the panel is visible
- **THEN** the changed row appears without any user action within two seconds

#### Scenario: External staging

- **WHEN** a file is staged in a terminal
- **THEN** it moves from the unstaged group to the staged group without any
  user action

#### Scenario: External branch switch

- **WHEN** a terminal switches the repository to another local branch
- **THEN** the branch header and its ahead/behind counts show the new branch,
  and the graph's checked-out and upstream references follow it

#### Scenario: Burst of changes

- **WHEN** a checkout rewrites many working-tree files at once
- **THEN** the panel performs one refresh after the burst settles and shows no
  error for the intermediate states

#### Scenario: Last panel closes

- **WHEN** the last panel showing a repository closes
- **THEN** the Host stops watching that repository and performs no further
  watch-driven reads for it

### Requirement: Refresh scope

An update SHALL refresh the smallest part of the panel that keeps it accurate.
A change to the working tree or the index SHALL refresh the repository summary
and change list without reloading the commit graph, moving its scroll
position, clearing loaded pages, or dropping the selected commit. A change to
`HEAD` or to a branch, tag, or remote-tracking reference SHALL also refresh the
checked-out, upstream and base references so the rows already loaded re-color
and re-badge in place; when the checked-out commit is not among the loaded
rows, the panel SHALL reload the newest graph page.

#### Scenario: Working-tree edit keeps the graph state

- **WHEN** a file changes outside DSH while the graph is scrolled into its
  earlier commits and a commit is selected
- **THEN** the change list updates while the loaded rows, scroll position and
  selected commit stay as they were

#### Scenario: Reference move recolors loaded rows

- **WHEN** a fetch moves the checked-out branch's upstream or base branch and
  the affected commits are already loaded
- **THEN** their lines, nodes and badges take the new reference colors without
  the graph returning to its first page

#### Scenario: Checked-out commit outside the loaded rows

- **WHEN** a terminal commits on the checked-out branch while the graph is
  scrolled into earlier commits
- **THEN** the newest graph page is reloaded and the new checked-out commit is
  marked at its top
