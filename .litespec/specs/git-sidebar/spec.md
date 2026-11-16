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

The panel SHALL list the repository's changes as three groups in VS Code's
order: merge conflicts, staged changes, and changes not yet staged. Within a
group, every changed file SHALL appear as one row in a single-layer list with
no folder rows, sorted by its repository-relative path. Every row SHALL carry
the status letter identifying added, modified, deleted, renamed, untracked, or
conflicted state and the file's repository-relative path. A file with both
staged and unstaged modifications SHALL appear in both the staged and the
unstaged group. A file that Git reports as conflicted SHALL appear under merge
conflicts with the conflicted status letter and SHALL remain listed until the
conflict is resolved.

#### Scenario: Partially staged file

- **WHEN** a tracked file has staged edits and further unstaged edits
- **THEN** the file appears under staged changes and again under changes not yet staged

#### Scenario: Nested files

- **WHEN** changed files live in several nested directories
- **THEN** every file is listed directly in its group's single-layer list in path order, with no collapsible folder rows

#### Scenario: Merge conflict

- **WHEN** a merge leaves a tracked file conflicted
- **THEN** the file appears under merge conflicts with the conflicted status letter and its repository-relative path

#### Scenario: Conflict in a nested folder

- **WHEN** a conflicted file lives in a nested directory
- **THEN** merge conflicts lists the file directly, showing its directory with its name, like the other groups

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
theme tokens, divider lines SHALL use the host's standard divider color, and
rows, metadata, and controls SHALL use the host's text sizes and weights, row
heights, spacing, and corner radii. Section header titles SHALL use one text
size step above file rows and a heavier weight than their surrounding metadata.
The commit graph is the one exception: its line, node and reference badge colors
and its compact row height SHALL follow VS Code's Source Control Graph as the
commit graph requirements describe. The panel's visible text SHALL follow the
user's language, providing English and Chinese copy.

#### Scenario: Theme follows the application

- **WHEN** the application switches between light and dark themes
- **THEN** the panel's surfaces, text, diff colors, and graph badge text update with the host theme without reloading the tab

#### Scenario: Matches the host sidebar

- **WHEN** the panel is shown beside the sidebar's own sections and rows
- **THEN** its section headers, file rows, metadata, controls, menus and divider
  lines share the host's text scale, row heights, spacing, corner radii and
  standard divider color instead of introducing a separate scale, while commit
  graph rows keep VS Code's graph dimensions

#### Scenario: Chinese interface

- **WHEN** the application language is Chinese
- **THEN** the panel's controls, messages, and empty states are shown in Chinese

### Requirement: Change context menus

The panel SHALL offer a context menu on every changed file and change group
listed in the panel, containing only the operations valid for that object:
opening a diff, staging or unstaging its files, and discarding them. Choosing a
menu command SHALL have the same effect, the same confirmation before
discarding, the same busy indication, the same failure report, and the same
refresh as the equivalent inline control.

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

The panel SHALL offer copying a changed file's repository-relative path and
absolute path, and copying a commit's full identifier and the subject line of
its message. A successful copy SHALL be confirmed to the user, and an
unavailable clipboard SHALL be reported as a failure rather than being ignored.

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

- **WHEN** the user invokes the menu on a changed file, a change group header,
  a commit, or the diff header
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
repository-relative paths in a single-layer list with no folder rows, sorted by
path, and a renamed file SHALL show its original path. The metadata SHALL
identify the commit by its short identifier and show its subject, author,
relative time, and message body when present. Activating a changed file SHALL
open that file's diff for the commit. A commit that changed no files SHALL be
presented as such rather than as an empty list, a failed read SHALL be reported
with a retry path, and returning from the details view SHALL restore the change
list and graph without changing the repository.

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
  showing an empty list

#### Scenario: Commit cannot be read

- **WHEN** reading the commit or its file list fails, for example because the
  commit is no longer reachable
- **THEN** the details view reports the failure and offers retry, and the back
  control still returns to the change list and graph

#### Scenario: Return to the changes

- **WHEN** the user activates the back control in the details view
- **THEN** the change list and graph are shown again with the repository
  unchanged

### Requirement: Commit graph swimlanes

The panel SHALL show the most recent commits reachable from the repository's
local branches, tags, and remote-tracking branches in topological order, with
every commit after all of its children, as a commit graph laid out with VS
Code's Source Control Graph swimlane rules. Every row SHALL carry an ordered
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

The graph SHALL reproduce VS Code's Source Control Graph geometry: rows 22
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

Every listed commit SHALL be drawn as a node in VS Code's shapes: a filled dot
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

Graph lines SHALL take VS Code's Source Control Graph colors. A new line SHALL
take the next color of the five-color rotation `#FFB000`, `#DC267F`, `#994F00`,
`#40B0A6`, `#B66DFF`, in the order lines are created from the top of the graph
and restarting after the fifth. A first parent SHALL continue its child's line
color. A commit that carries the checked-out branch SHALL color the line it
continues blue, a commit that carries that branch's upstream SHALL color it
purple, and a commit that carries the branch's base branch SHALL color it
orange, in that priority; a new line toward such a commit SHALL take that color
instead of a rotation color. The blue and purple SHALL switch between VS Code's
light and dark variants with the host theme. The base branch SHALL be the remote
branch configured as the branch's VS Code merge base, otherwise the default
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
commit's subject and author SHALL be bold. Badges SHALL follow VS Code's rules:
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

### Requirement: Independent change and graph panes

The panel SHALL present the change groups above the commit graph in two
vertically stacked panes that scroll independently, separated by a divider.
The user SHALL be able to move the divider by dragging it, and both panes SHALL
keep a usable minimum height. Scrolling one pane SHALL NOT move the other or
change its scroll position. The divider SHALL be reachable by keyboard and
SHALL change the split with the arrow keys. Opening a commit's details SHALL
replace the split, and returning SHALL restore the ratio the user chose.

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

#### Scenario: Returning from commit details

- **WHEN** the user opens a commit's details and then returns to the split
- **THEN** the change list and graph return with the ratio they had before

### Requirement: Clean workspace state

When the repository exists and has no changes, the panel SHALL state that the
working tree is clean using localized text only, without an icon and without
empty change groups.

#### Scenario: Clean repository

- **WHEN** the repository has no merge, staged, or unstaged changes
- **THEN** the panel shows the clean-workspace title and description and no check icon

### Requirement: Commit graph paging

The panel SHALL show the newest commits first and SHALL make the remaining
reachable history available on demand, in pages of up to 60 commits. While
earlier commits remain, reaching the end of the graph pane SHALL load the next
page of earlier commits and append them below the rows already shown, without
replacing, reordering or scrolling away from those rows. Lines that ended at the
bottom of the graph because their commit had not been loaded yet SHALL connect
to their commits once a page adds them. When no earlier commits remain, the
graph SHALL NOT offer another page.

#### Scenario: Reaching the end loads the next page

- **GIVEN** the graph shows a page of commits and older commits exist
- **WHEN** the user scrolls the graph pane to its end
- **THEN** the next page of earlier commits is appended below the shown rows and
  the pane keeps its scroll position

#### Scenario: Swimlanes continue across pages

- **GIVEN** a line reaches the bottom of the graph because its commit is not
  loaded yet
- **WHEN** the page that contains that commit is appended
- **THEN** the line connects to the commit's node and the appended rows follow
  the same swimlane, node and color rules as the first page

#### Scenario: End of history

- **WHEN** the appended page contains the oldest reachable commit
- **THEN** the graph shows every reachable commit and offers no further page

#### Scenario: Manual load

- **GIVEN** earlier commits remain
- **WHEN** the user activates the load-earlier-commits control at the end of the
  graph
- **THEN** the next page is appended exactly as reaching the end of the pane
  loads it

#### Scenario: A failed page keeps the loaded rows

- **GIVEN** the graph shows commits and earlier commits remain
- **WHEN** loading the next page fails
- **THEN** the rows already shown stay visible, the end of the graph explains
  the failure, and activating retry loads that page again

#### Scenario: Refresh starts over

- **WHEN** the panel refreshes the history, including after a commit or a branch
  switch
- **THEN** the graph shows only the newest page again

### Requirement: Section headers stay pinned while scrolling

Each collapsible section header SHALL remain visible at the top edge of its
scrolling pane for as long as any part of its own section still reaches below
that edge. A pinned header SHALL paint the host's surface, so the rows scrolling
beneath it are hidden. A header SHALL show the host's hover highlight over that
surface while the pointer is over it, and the highlight SHALL stay inside the
header's rounded corners. At most one header SHALL be pinned at a time: while a
header is pinned, the next section's header SHALL keep its normal position until
the pinned header's section has left the top edge, and SHALL then take that
place. A pinned header SHALL keep its toggle, count and context menu usable. A
pane whose content fits without scrolling SHALL show every header in its normal
position.

#### Scenario: A group header stays while its rows scroll

- **GIVEN** the changes group is taller than its pane
- **WHEN** the user scrolls the change list down
- **THEN** the changes header stays at the top edge of that pane while its rows pass beneath it

#### Scenario: Rows do not show through a pinned header

- **WHEN** rows scroll under a pinned header
- **THEN** the header's surface hides them

#### Scenario: Hovering a header highlights it

- **WHEN** the pointer moves over a section header, whether it is pinned or in its normal position
- **THEN** the header shows the host hover highlight over its surface and the rows beneath a pinned header stay hidden

#### Scenario: Only one header is pinned

- **GIVEN** a group header is pinned
- **WHEN** the user scrolls past that group's last row and the next group reaches the top edge
- **THEN** the previous header leaves with its group and only the next group's header is pinned

#### Scenario: The pinned header keeps its controls

- **WHEN** the user activates a pinned header's toggle or opens its context menu
- **THEN** the section collapses or expands as usual and the menu opens with that group's actions

#### Scenario: The graph pane pins its own header

- **WHEN** the user scrolls the graph pane
- **THEN** the graph header stays at that pane's top edge while the change pane keeps its own scroll position

#### Scenario: Short panes keep their headers in place

- **GIVEN** the change list fits in its pane without scrolling
- **WHEN** the panel is shown
- **THEN** every group header stays in its normal position
