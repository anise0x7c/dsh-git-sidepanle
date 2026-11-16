# Git Sidebar Specification

## Purpose
Give Web GUI users a VS Code-style source-control surface for the Session's workspace: review changes, stage and commit them, inspect diffs, and follow branch history without leaving DSH.

## Requirements

### Requirement: Right-Sidebar entry

The Git panel SHALL be a tab type of the right Sidebar and SHALL be offered as an entry on the right Sidebar's guide page, so opening the entry shows the panel for the current Session.

#### Scenario: Opening from the guide

- **WHEN** the user opens the right Sidebar guide and picks the source-control entry
- **THEN** a tab titled with the Git panel's localized title opens in the active docked pane and shows the current Session's repository state

#### Scenario: Entry already open

- **WHEN** the panel's tab is already open in a docked pane and the entry is picked again
- **THEN** that tab is focused instead of a duplicate being created

### Requirement: Repository summary

The panel SHALL show the repository it resolved from the Session's working directory, including the current branch, whether HEAD is detached or has no commits yet, the upstream branch name when one exists, and how many commits the branch is ahead of or behind its upstream. When the working directory is not inside a repository, the panel SHALL explain that instead of offering change actions.

#### Scenario: Branch with upstream divergence

- **WHEN** the checked-out branch tracks an upstream and is two commits ahead and one behind
- **THEN** the header shows the branch name with ahead and behind counts

#### Scenario: No repository

- **WHEN** the Session's working directory is not inside a Git repository
- **THEN** the panel shows a no-repository explanation naming the directory and offers refresh, with no stage, commit, or discard controls

### Requirement: Change overview

The panel SHALL list the repository's changes as three groups in VS Code's order: merge conflicts, staged changes, and changes not yet staged. Every entry SHALL carry the status letter identifying added, modified, deleted, renamed, untracked, or conflicted state and its repository-relative path, and entries SHALL be arranged in a folder tree whose folders collapse and expand. A file with both staged and unstaged modifications SHALL appear in both the staged and the unstaged group. A file that Git reports as conflicted SHALL appear under merge conflicts with the conflicted status letter and its folder path, and SHALL remain listed until the conflict is resolved.

#### Scenario: Partially staged file

- **WHEN** a tracked file has staged edits and further unstaged edits
- **THEN** the file appears under staged changes and again under changes not yet staged

#### Scenario: Nested files

- **WHEN** changed files live in several nested directories
- **THEN** the panel groups them under collapsible folder rows that preserve their relative paths

#### Scenario: Merge conflict

- **WHEN** a merge leaves a tracked file conflicted
- **THEN** the file appears under merge conflicts with the conflicted status letter and its path in the folder tree

#### Scenario: Conflict in a nested folder

- **WHEN** a conflicted file lives in a nested directory
- **THEN** merge conflicts shows the file inside its folder rows, like the other groups

### Requirement: Staging and unstaging

The panel SHALL stage or unstage one file or every file in a group on request, and SHALL refresh the grouping, counts, and empty states after the operation succeeds. A failed operation SHALL be reported to the user and SHALL NOT be presented as if the repository changed.

#### Scenario: Stage one file

- **WHEN** the user stages an unstaged file and the Git operation succeeds
- **THEN** that file moves to the staged group and both group counts update

#### Scenario: Stage all

- **WHEN** the user stages every change in the unstaged group
- **THEN** every file in that group, including untracked files, appears under staged changes

#### Scenario: Git rejects the operation

- **WHEN** a stage or unstage command fails
- **THEN** the panel shows the command's error and leaves the displayed grouping to be refreshed from the repository

### Requirement: Discarding changes

Before discarding, the panel SHALL ask for explicit confirmation. Confirming SHALL restore tracked files to the committed version and SHALL delete untracked files; cancelling SHALL leave the repository untouched.

#### Scenario: Discard a tracked file

- **WHEN** the user discards a modified tracked file and confirms
- **THEN** the file leaves the change list and its content matches the committed version

#### Scenario: Cancel discard

- **WHEN** the user starts a discard and cancels the confirmation
- **THEN** no Git command runs and the change list is unchanged

### Requirement: Commit workflow

The panel SHALL accept a multi-line commit message and SHALL commit staged changes only. It SHALL refuse to commit when the message is empty or only whitespace. When nothing is staged, the commit action SHALL first ask whether to stage every change and commit them together. After a successful commit the panel SHALL clear the message and refresh the change groups and history. A failed commit SHALL keep the message and the staged changes, and SHALL show Git's error.

#### Scenario: Commit staged changes

- **WHEN** the user enters a message for staged changes and commits
- **THEN** a new commit contains exactly those staged changes, the message box clears, and the change groups refresh

#### Scenario: Nothing staged

- **WHEN** the user asks to commit while no changes are staged
- **THEN** the panel offers to stage all changes and commit, and only commits after the user confirms

#### Scenario: Empty message

- **WHEN** the message is empty or whitespace only
- **THEN** the commit action is unavailable

#### Scenario: Commit hook rejects

- **WHEN** a commit fails, for example because a hook or author identity rejects it
- **THEN** the panel shows the failure, keeps the message text, and keeps the staged files staged

### Requirement: File diff

The panel SHALL open a unified diff for any listed file in a right-Sidebar tab.
A staged entry SHALL show the difference between the index and the committed
version; an unstaged entry SHALL show the difference between the working tree
and the index; an untracked entry SHALL show its content as added lines. A file
listed for a commit SHALL show the difference that commit introduced relative
to the commit's first parent, or relative to the empty tree when the commit has
no parent, and the diff SHALL identify the commit it belongs to. The diff SHALL
show line numbers, added and removed markers, and the file's path with rename
information when present. Binary and over-large files SHALL be identified
instead of rendering undecodable content. Opening a second file SHALL reuse the
open diff tab and show the new file.

#### Scenario: Unstaged diff

- **WHEN** the user opens an unstaged file
- **THEN** a diff tab shows its working-tree changes against the index with added and removed lines marked

#### Scenario: Untracked file

- **WHEN** the user opens an untracked file
- **THEN** its whole content appears as added lines

#### Scenario: Commit diff

- **WHEN** the user opens a changed file from a commit's details view
- **THEN** a diff tab shows the lines that commit added and removed relative to
  its first parent and identifies the commit in the diff header

#### Scenario: Root commit diff

- **WHEN** the user opens a file that a root commit introduced
- **THEN** the file's committed content appears as added lines

#### Scenario: Renamed file diff

- **WHEN** the user opens a file that a commit renamed from another path
- **THEN** the diff header shows the original path along with the new path

#### Scenario: Reuse the diff tab

- **WHEN** a diff tab is open and the user opens another changed file
- **THEN** the same tab updates to the newly chosen file rather than opening a second diff tab

#### Scenario: Binary file

- **WHEN** the user opens a changed binary file
- **THEN** the diff tab states that the content cannot be shown as text

### Requirement: Commit graph and branch switching

The panel SHALL show recent commits reachable from the repository's branches as
a commit graph: every listed commit is a node, and every parent it shares with
another listed commit is joined to it by a drawn line, so that divergent
branches and merges appear as separate lines that part and join instead of as
plain text. Lines SHALL be grouped in branch lanes, and the graph column SHALL
stay aligned across rows. A first-parent line SHALL continue vertically in its
commit's lane, even when another lane already expects the same parent. A
secondary-parent connection SHALL open a lane of its own even when another lane
already expects that parent, and SHALL keep that lane active until the parent's
row instead of joining the existing lane at the child. A newly opened
secondary-parent line SHALL use the nearest available lane to the right of its
source commit, rather than wrapping around to reuse a lane on its left. Every
lane expecting a listed commit SHALL remain active until that commit's row; one
commit row MAY receive several incoming lanes, and they SHALL join the commit's
node there and MUST NOT join early at an intermediate child.

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

#### Scenario: A secondary parent keeps its own lane

- **GIVEN** a merge commit whose secondary parent is already the target of another active lane
- **WHEN** the merge commit's row and the rows between it and that parent are drawn
- **THEN** the merge opens a separate lane on its own row and the line remains active until the shared parent's row
- **AND** the line turns into the shared parent's node there instead of folding into the existing lane at the merge commit's row

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

#### Scenario: Switch branch

- **WHEN** the user picks a different local branch
- **THEN** the repository checks out that branch, the header shows its name, and the graph and change groups refresh

#### Scenario: Switch rejected

- **WHEN** Git refuses to switch branches, for example because of local changes
- **THEN** the panel shows Git's message and the current branch stays checked out

### Requirement: Freshness and failures

The panel SHALL load on open, refresh after every completed operation, refresh on demand, and refresh periodically while the tab is visible. It SHALL surface Git failures inline with a retry path, and a missing Git executable SHALL be explained as such.

#### Scenario: External change

- **WHEN** a file changes outside DSH while the panel is visible
- **THEN** the change appears without any user action after the periodic refresh

#### Scenario: Manual refresh

- **WHEN** the user activates the refresh control
- **THEN** the panel re-reads the repository status and history

#### Scenario: Git unavailable

- **WHEN** the Git executable is missing
- **THEN** the panel explains that Git could not be run and offers retry

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

### Requirement: Change context menus

The panel SHALL offer a context menu on every changed file, folder, and change
group listed in the panel, containing only the operations valid for that
object: opening a diff, staging or unstaging its files, and discarding them.
Choosing a menu command SHALL have the same effect, the same confirmation
before discarding, the same busy indication, the same failure report, and the
same refresh as the equivalent inline control.

#### Scenario: Stage a file from its menu

- **WHEN** the user invokes the context menu on a file in the changes group and
  chooses the stage command
- **THEN** that file moves to the staged group and both group counts update

#### Scenario: Unstage a file from its menu

- **WHEN** the user invokes the context menu on a file in the staged group and
  chooses the unstage command
- **THEN** that file appears in the changes group and both group counts update

#### Scenario: Discard from a menu asks first

- **WHEN** the user chooses the discard command from a file's or a group's
  context menu
- **THEN** the panel asks for the same confirmation as its discard control and
  runs no Git command before the user confirms

#### Scenario: Stage a whole group from its header

- **WHEN** the user invokes the context menu on the changes group header and
  chooses the stage-all command
- **THEN** every file listed in that group, including untracked files, moves to
  the staged group

#### Scenario: Operation rejected from a menu

- **WHEN** a Git operation chosen from a context menu fails
- **THEN** the panel reports Git's error in the same way as for the equivalent
  inline control and refreshes the displayed availability from the repository

### Requirement: Copy actions in context menus

The panel SHALL offer copying a changed file's or folder's
repository-relative path and absolute path, and copying a commit's full
identifier and the subject line of its message. A successful copy SHALL be
confirmed to the user, and an unavailable clipboard SHALL be reported as a
failure rather than being ignored.

#### Scenario: Copy a relative path

- **WHEN** the user chooses the copy-relative-path command for a changed file
- **THEN** the clipboard holds the file's path relative to the repository root
  and the panel confirms the copy

#### Scenario: Copy a commit identifier

- **WHEN** the user chooses the copy-identifier command for a commit in the
  graph
- **THEN** the clipboard holds that commit's full identifier and the panel
  confirms the copy

#### Scenario: Clipboard unavailable

- **WHEN** the browser refuses clipboard access while copying from a menu
- **THEN** the panel reports that the copy failed and no repository operation
  runs

### Requirement: Context-menu invocation and dismissal

The panel SHALL open these menus from a pointer right-click at the pointer
position and from the keyboard context-menu gesture on a focused row. Opening a
menu SHALL NOT run any repository command or change repository state. Every menu
SHALL list the commands that apply to the object that was invoked, and SHALL
list at least one command. A menu SHALL close without side effects when the user
presses Escape, selects a command, or interacts elsewhere, and SHALL follow the
host's theme and language. When the host offers no context-menu facility, the
panel SHALL remain fully usable through its inline controls.

#### Scenario: Pointer invocation

- **WHEN** the user right-clicks a changed file
- **THEN** a menu appears at the pointer listing that file's operations

#### Scenario: Menu commands follow the invoked object

- **WHEN** the user invokes the menu on a commit row and then on a changed file
- **THEN** the commit's menu lists its copy commands and no staging or discarding
  commands, and the changed file's menu lists opening, staging or unstaging,
  discarding, and both path copies

#### Scenario: Every invoked menu offers a command

- **WHEN** the user invokes the menu on a changed file, a folder, a change group
  header, a commit, or the diff header
- **THEN** the menu lists at least one command for that object

#### Scenario: Keyboard invocation

- **WHEN** a changed file has keyboard focus and the user presses the
  context-menu key or Shift+F10
- **THEN** the same menu for that file opens without moving the repository

#### Scenario: Dismissal

- **WHEN** a context menu is open and the user presses Escape or clicks outside
  it
- **THEN** the menu closes, no command runs, and the change groups are
  unchanged

#### Scenario: Context menus unavailable

- **WHEN** the host provides no context-menu facility
- **THEN** the panel still lists changes and every inline stage, unstage,
  discard, diff, and refresh control keeps working

### Requirement: Commit details

The panel SHALL show a commit's changed files, that commit's metadata, and a
way back to the change list when the user activates the commit's row in the
graph. The changed files SHALL carry their change status letters and their
repository-relative paths in a folder tree whose folders collapse and expand,
and a renamed file SHALL show its original path. The metadata SHALL identify
the commit by its short identifier and show its subject, author, relative time,
and message body when present. Activating a changed file SHALL open that file's
diff for the commit. A commit that changed no files SHALL be presented as such
rather than as an empty list, a failed read SHALL be reported with a retry
path, and returning from the details view SHALL restore the change list and
graph without changing the repository.

#### Scenario: Open a commit's details

- **WHEN** the user activates a commit row in the graph
- **THEN** the panel shows that commit's short identifier, subject, author,
  relative time and changed files with their status letters and paths, and the
  change list is replaced until the user returns

#### Scenario: Keyboard activation

- **WHEN** a commit row has keyboard focus and the user presses Enter or Space
- **THEN** the same commit details open without changing the repository

#### Scenario: Commit with a rename

- **WHEN** a commit renamed a file and the user opens that commit
- **THEN** the renamed file is listed with its new path and its original path

#### Scenario: Commit without file changes

- **WHEN** the user opens a commit that changed no files relative to its first
  parent
- **THEN** the details view says that the commit has no file changes instead of
  showing an empty file tree

#### Scenario: Commit cannot be read

- **WHEN** reading the commit or its file list fails, for example because the
  commit is no longer reachable
- **THEN** the details view reports the failure and offers retry, and the back
  control still returns to the change list and graph

#### Scenario: Return to the changes

- **WHEN** the user activates the back control in the details view
- **THEN** the change list and graph are shown again with the repository
  unchanged
