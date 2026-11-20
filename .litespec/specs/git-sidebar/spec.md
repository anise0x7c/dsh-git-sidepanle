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
no folder rows, sorted by its repository-relative path. Every row SHALL show
the Web application's own file-type icon for that file's path before the file
name, drawn as the application's workspace explorer draws it, the file's
repository-relative path, and the status letter identifying added, modified,
deleted, renamed, untracked, or conflicted state at the row's end in that
status's color, matching the files listed under an expanded commit. When the
application provides no file-type icon set, the row SHALL show the plugin's
plain document icon instead. A file with both staged and unstaged
modifications SHALL appear in both the staged and the unstaged group. A file
that Git reports as conflicted SHALL appear under merge conflicts with the
conflicted status letter and SHALL remain listed until the conflict is
resolved.

#### Scenario: Partially staged file

- **WHEN** a tracked file has staged edits and further unstaged edits
- **THEN** the file appears under staged changes and again under changes not yet staged

#### Scenario: File type icons

- **GIVEN** a repository changed a JavaScript file, a stylesheet and an image
- **WHEN** the change lists are shown
- **THEN** every row shows the application's glyph for its path before the file
  name, its status letter stays at the row's end, and the stage, unstage and
  discard controls keep their positions

#### Scenario: Status letter at the row's end

- **WHEN** the change groups are shown
- **THEN** every row shows its status letter after the file name and dimmed
  directory and in that status's color, as the last element of the row

#### Scenario: The application provides no file-type icons

- **GIVEN** the application does not provide its file-type icon set
- **WHEN** the change lists are shown
- **THEN** every row shows the plugin's plain document icon, and staging,
  unstaging, discarding and opening a diff keep working

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

The panel SHALL accept a multi-line commit message and SHALL commit staged changes only. It SHALL refuse to run any commit action when the message is empty or only whitespace. When nothing is staged, Commit, Commit and Push, and Commit and Sync SHALL each first ask whether to stage every change and commit them together, while Commit (Amend) SHALL NOT stage anything on its own. After a successful commit the panel SHALL clear the message and refresh the change groups and history. A failed commit SHALL keep the message and the staged changes, and SHALL show Git's error.

#### Scenario: Commit staged changes

- **WHEN** the user enters a message for staged changes and commits
- **THEN** a new commit contains exactly those staged changes, the message box clears, and the change groups refresh

#### Scenario: Nothing staged

- **WHEN** the user asks to commit while no changes are staged
- **THEN** the panel offers to stage all changes and commit, and only commits after the user confirms

#### Scenario: Nothing staged for a combined action

- **WHEN** the user chooses Commit and Sync while no changes are staged
- **THEN** the panel asks to stage every change first and only commits, pulls and pushes after the user confirms

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

The panel SHALL load on open, refresh after every completed operation, and
refresh on demand. While the tab is visible, changes made outside DSH SHALL
appear without user action as they settle: the Host SHALL detect repository
changes and make them known to the panel, and a periodic check SHALL remain
only as a fallback where change detection is unavailable. It SHALL report Git
failures through the shared notification with a retry action while keeping the
last loaded content and the pane's geometry, and a missing Git executable SHALL
be explained as such.

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

#### Scenario: Failed refresh keeps the loaded content

- **WHEN** a refresh of an already loaded repository fails
- **THEN** the failure appears as a non-success Toast with a retry action, the
  last loaded change list and graph stay in place, and retrying clears the
  failure when the next read succeeds

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
opening a diff, staging or unstaging its files, discarding them, and adding a
working-change file to the repository-root `.gitignore`. Choosing a menu command
SHALL have the same effect, the same confirmation before discarding, the same
busy indication, the same failure report, and the same refresh as the equivalent
inline control. The ignore command SHALL add one root-anchored literal rule for
the selected repository-relative path, SHALL NOT duplicate an identical rule,
and SHALL NOT be offered for a file shown only in commit history. A successful
ignore SHALL make an untracked file disappear on the following refresh without
deleting or staging it, and SHALL explain that a tracked file stays tracked.
A symbolic link or non-regular target MUST be rejected without following it or
changing the file it points at.

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

#### Scenario: Add a nested file to .gitignore

- **WHEN** a working-change file such as `logs/local output.txt` chooses **Add to .gitignore**
- **THEN** the repository-root file gains a root-anchored literal rule for that path, an untracked file remains on disk but leaves the refreshed change list, and choosing the command again adds no duplicate rule

#### Scenario: Linked .gitignore is refused

- **GIVEN** the repository's `.gitignore` is a symbolic link to a file outside the repository
- **WHEN** the user chooses the ignore command
- **THEN** the Host refuses the write, the linked file remains unchanged, and the panel reports the failure

#### Scenario: Ignore write fails

- **WHEN** the Host cannot update `.gitignore`, or Git rejects the path rule
- **THEN** the panel reports the failure and does not report that the file was ignored

#### Scenario: Operation rejected from a menu

- **WHEN** a Git operation chosen from a context menu fails
- **THEN** the panel reports Git's error in the same way as for the equivalent
  inline control and refreshes the displayed availability from the repository

### Requirement: Copy actions in context menus

The panel SHALL offer copying a changed file's repository-relative path and
absolute path, and copying a commit's full identifier under **Copy commit hash**
and the existing subject-line value under **Copy commit message**. The renamed
message command SHALL keep copying the subject rather than adding the body. A
successful copy SHALL be confirmed to the user, and an unavailable clipboard
SHALL be reported as a failure rather than being ignored.

#### Scenario: Copy a relative path

- **WHEN** the user chooses the copy-relative-path command for a changed file
- **THEN** the clipboard holds the file's path relative to the repository root
  and the panel confirms the copy

#### Scenario: Copy a commit identifier

- **WHEN** the user chooses **Copy commit hash** for a commit in the graph
- **THEN** the clipboard holds that commit's full identifier and the panel
  confirms the copy

#### Scenario: Copy a commit message

- **WHEN** the user chooses **Copy commit message** for a commit with a subject and a longer body
- **THEN** the clipboard receives the existing subject-line value without adding the body

#### Scenario: Clipboard unavailable

- **WHEN** the browser refuses clipboard access while copying from a menu
- **THEN** the panel reports that the copy failed and no repository operation
  runs

### Requirement: Context-menu invocation and dismissal

The panel SHALL open these menus from a pointer right-click at the pointer
position and from the keyboard context-menu gesture on a focused row. Opening a
menu, opening a native submenu, cancelling a naming or deletion dialog, and
closing a menu SHALL NOT run any repository command or change repository state.
Every menu SHALL list the commands that apply to the object that was invoked,
SHALL list at least one command, and SHALL retain the separators and conditional
nesting its object requires. A menu SHALL close without side effects when the
user presses Escape, selects a command, or interacts elsewhere, and all menus
and submenus SHALL follow the host's shared native theme and language. When the
host offers no context-menu facility, the panel SHALL remain fully usable
through its inline controls.

#### Scenario: Pointer invocation

- **WHEN** the user right-clicks a changed file
- **THEN** a menu appears at the pointer listing that file's operations

#### Scenario: Menu commands follow the invoked object

- **WHEN** the user invokes the menu on a commit row and then on a changed file
- **THEN** the commit's menu lists its checkout, reference and copy commands in
  the required groups, and the changed file's menu lists opening, staging or
  unstaging, ignoring, optional discarding, and both path copies

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
way back to the change list when the user chooses the View Details action from
the commit row's context menu. The changed files SHALL be grouped into a folder
tree: each folder SHALL appear once as a row above the files and folders it
contains, and each nested level SHALL be indented one step further than its
parent. A folder whose subtree is a single unbranched chain of folders SHALL be
shown as one row joining those folder names with `/` (for example `aa/bb/cc`),
so the chain costs one indentation level instead of one per folder; a file in a
folder or more than one child SHALL end the collapse there. Within a folder,
subfolders SHALL precede files, and both SHALL be ordered by name
case-insensitively with numeric runs compared as numbers. Folder rows SHALL be
disclosure controls: each SHALL show an expansion arrow in place of a folder
icon, pointing right while the folder is collapsed and down while it is
expanded, and SHALL expose its expanded state to assistive technology. Activating
a folder row by pointer, Enter or Space SHALL collapse or expand every nested
folder and file row beneath it, without opening a diff or a menu. Every folder
SHALL start expanded whenever the details view opens, and collapsing or
expanding one folder SHALL NOT change another folder's state. The collapse state
SHALL belong to the open details card and SHALL be discarded when the user
returns to the change list. Each file row SHALL show the file's name with the
Web application's own file-type icon for its repository-relative path before the
name, drawn as the application's workspace explorer draws it, and the status
letter identifying the file's change at the row's end in that status's color;
the full path SHALL remain in the row tooltip. When the application provides no
such icon set, the file row SHALL show the plugin's plain document icon instead.
A renamed file SHALL show its original path. The metadata SHALL identify the
commit by its short identifier and show its subject, author, relative time, and
message body when present. Activating a changed file SHALL open that file's
diff for the commit. A commit that changed no files SHALL be presented as such
rather than as an empty list, a failed read SHALL be reported with a retry path,
and returning from the details view SHALL restore the change list and graph
without changing the repository. The details view SHALL open as a card above
the panel's content, with its own separating border and a translucent,
backdrop-blurred theme surface with a readable solid fallback where filtering
is unavailable, so the change list, graph and commit box stay mounted beneath
it and are already in place when the card leaves. The card SHALL slide in from the
panel's right edge when it opens and SHALL slide back out to that edge, and the
content beneath it SHALL accept no pointer or keyboard input while the card is
present. Pressing Escape in the Git panel while the card is open SHALL dismiss it
through the same transition as the back control, without running Git or
changing the repository; an open operation prompt or branch menu SHALL keep
priority for Escape instead. A View Details action for a commit that is no longer listed
SHALL be reported as stale instead of opening an empty view. When the system
asks for reduced motion the card SHALL appear and leave at its final position
without moving.

#### Scenario: Open a commit's details

- **WHEN** the user chooses View Details from a commit row's context menu
- **THEN** the panel shows that commit's short identifier, subject, author,
  relative time and changed files as a folder tree with folder rows and file
  rows carrying their status letters and paths, as a card above the change list
  and graph, which stay mounted beneath it

#### Scenario: Changed files form a folder tree

- **GIVEN** a commit changed several files below a shared directory
- **WHEN** the user opens that commit's details
- **THEN** each folder appears once above its contents with its expansion arrow,
  the files inside are one indentation level below that folder, more deeply
  nested contents are indented further, and no folder row shows a folder glyph

#### Scenario: Unbranched folder chains collapse into one row

- **GIVEN** a commit changed a file at a deeply nested path whose folders form a
  single unbranched chain
- **WHEN** the user opens that commit's details
- **THEN** that chain appears as one folder row joining its folder names with
  `/`, the file sits one indentation level below it, and the chain costs one
  level of indentation rather than one per folder

#### Scenario: A branch ends the folder collapse

- **GIVEN** a commit changed files in two sibling folders of the same parent
- **WHEN** the user opens that commit's details
- **THEN** the shared parent appears as its own folder row and each sibling
  folder is a separate row one indentation level below it

#### Scenario: Folders start expanded

- **WHEN** the user opens a commit's details
- **THEN** every folder row shows the down arrow of an expanded folder and its
  whole subtree is listed

#### Scenario: A folder collapses and expands

- **GIVEN** a folder row is expanded and its subtree contains files and folders
- **WHEN** the user activates that folder row
- **THEN** every nested folder and file row disappears, the folder row stays in
  place with a right-pointing arrow, and activating it again restores the
  subtree

#### Scenario: Nested folders toggle independently

- **GIVEN** a folder has two expanded subfolders
- **WHEN** the user collapses one subfolder
- **THEN** only that subfolder's descendants disappear while the parent, the
  other subfolder and the surrounding rows keep their places and states

#### Scenario: Keyboard toggles a folder

- **GIVEN** a folder row has keyboard focus
- **WHEN** the user presses Enter or Space
- **THEN** the folder collapses or expands as a pointer activation would and
  the row keeps focus

#### Scenario: A collapsed chain hides its contents

- **GIVEN** an unbranched folder chain is shown as one row
- **WHEN** the user collapses that row
- **THEN** the rows of every folder and file below it disappear, and expanding
  the row again restores them below it

#### Scenario: Another commit starts expanded

- **GIVEN** the user collapsed a folder in one commit's details and returned to
  the change list
- **WHEN** the user opens any commit's details again
- **THEN** every folder of the newly opened details is expanded

#### Scenario: Folder rows open nothing else

- **WHEN** the user activates a folder row by pointer or keyboard
- **THEN** no diff opens and no menu appears

#### Scenario: The card matches the operation prompt's material

- **GIVEN** the details card is open
- **WHEN** the browser can filter the background behind the card
- **THEN** the card uses the same translucent menu surface and backdrop blur as
  the bottom operation prompt, with its separating border and no shadow

#### Scenario: Frosting unavailable

- **WHEN** the browser cannot filter the background behind the card
- **THEN** the card remains readable on the solid theme surface

#### Scenario: The content beneath the card stays in place

- **GIVEN** the user has scrolled the change list or graph and chosen a split ratio
- **WHEN** the user opens a commit's details
- **THEN** the change list, graph and commit box remain mounted beneath the card
  with that split ratio and those scroll positions, and the content is already
  in place while the card arrives

#### Scenario: The content beneath accepts no input

- **WHEN** the details card is open or sliding away
- **THEN** the change list, graph and commit box beneath it accept no pointer or
  keyboard input and are hidden from assistive technology

#### Scenario: Escape closes the details

- **GIVEN** a commit's details are open, the Git panel has keyboard focus, and no
  operation prompt or branch menu is open
- **WHEN** the user presses Escape
- **THEN** the card slides back out to the right edge like the back control,
  reveals the content beneath it, and no Git command runs

#### Scenario: Escape keeps the surface that owns it

- **GIVEN** a commit's details are open and an operation prompt or the branch menu is open
- **WHEN** the user presses Escape
- **THEN** that prompt or menu is dismissed and the details card stays open

#### Scenario: Escape without details

- **WHEN** the details view is closed and the user presses Escape in the Git panel
- **THEN** no details view opens and existing Escape behavior elsewhere is unchanged

#### Scenario: Activating the row does not open the details

- **WHEN** the user activates a commit row by pointer or keyboard
- **THEN** the commit's changes expand inline and the details view does not open

#### Scenario: A changed file shows its type icon

- **GIVEN** a commit changed a JavaScript file, a Markdown file and an image
- **WHEN** the user opens that commit's details
- **THEN** folder rows group the files and each file row shows the application's
  glyph for its path before the file name, while its status letter, name and
  rename arrow keep their places

#### Scenario: Status letter at the row's end

- **WHEN** the user opens a commit's details
- **THEN** every changed file shows its status letter at the end of its row in
  that status's color, as the files under an expanded commit do

#### Scenario: The application provides no file-type icons

- **GIVEN** the application does not provide its file-type icon set
- **WHEN** the user opens that commit's details
- **THEN** every file row shows the plugin's plain document icon, the list still
  opens as usual, and its rows still open their diffs

#### Scenario: Commit with a rename

- **WHEN** a commit renamed a file and the user opens that commit's details
- **THEN** the renamed file is listed with its new path and its original path

#### Scenario: Commit without file changes

- **WHEN** the user opens the details of a commit that changed no files
  relative to its first parent
- **THEN** the details view says that the commit has no file changes instead of
  showing an empty list

#### Scenario: Commit cannot be read

- **WHEN** reading the commit or its file list fails, for example because the
  commit is no longer reachable
- **THEN** the details view reports the failure and offers retry, and the back
  control still returns to the change list and graph

#### Scenario: Return to the changes

- **WHEN** the user activates the back control in the details view
- **THEN** the card travels towards the right edge and reveals the change list
  and graph already in place beneath it, with the repository unchanged, the same
  split ratio, the same scroll positions and the same commits expanded as before

#### Scenario: Details arrive from the right edge

- **WHEN** the details view opens for a commit
- **THEN** it starts out beyond the panel's right edge and moves leftwards into
  place above the content instead of appearing where it will stay

#### Scenario: Reduced motion keeps the details still

- **WHEN** the system asks for reduced motion and the user opens a commit's
  details and then returns
- **THEN** the card appears and leaves at its final position without moving, and
  the change list and graph stay in place beneath it

#### Scenario: Stale View Details

- **WHEN** a View Details action arrives for a commit the graph no longer lists
- **THEN** the panel reports a stale target and keeps showing the change list
  and graph

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
text SHALL begin right after that cell. A line that enters a row from above
SHALL join the line the row above leaves at its bottom edge without a break,
including when the rows' edges fall between device pixels.

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
  author and relative time, and activating the row still toggles the commit's
  inline file list

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
overlay the split with a card without resizing or unmounting either pane, and
returning SHALL reveal the same split with the ratio and scroll positions the
user left.

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
that edge. A header SHALL already rest at the pane's top edge in both its
normal and pinned positions, so beginning to scroll its pane SHALL NOT shift
the header; only the rows SHALL move beneath it. A pinned header SHALL paint
the host's opaque surface from the pane's top edge down, so the rows scrolling
beneath it are hidden and no part of a row is visible above or through the
header. A header SHALL show the host's hover highlight over that surface while
the pointer is over it, and the highlight SHALL stay inside the header's
rounded corners. At most one header SHALL be pinned at a time: while a header
is pinned, the next section's header SHALL keep its normal position until the
pinned header's section has left the top edge, and SHALL then take that place.
A pinned header SHALL keep its toggle, its count where it shows one, and its
context menu usable. A pane whose content fits without scrolling SHALL show
every header in its normal position.

#### Scenario: A group header stays while its rows scroll

- **GIVEN** the changes group is taller than its pane
- **WHEN** the user scrolls the change list down
- **THEN** the changes header stays at the top edge of that pane while its rows pass beneath it

#### Scenario: Scrolling does not shift the header

- **GIVEN** a change group is taller than its pane and the pane is at its top
- **WHEN** the user begins to scroll the pane
- **THEN** the group header stays flush at the pane's top edge from the first scrolled pixel, and only the rows move beneath it

#### Scenario: Rows do not show through a pinned header

- **WHEN** rows scroll under a pinned header
- **THEN** the header's opaque surface hides them

#### Scenario: Nothing shows above a pinned header

- **GIVEN** a group is taller than its pane
- **WHEN** the user scrolls so that a row crosses the top edge of the pane
- **THEN** the header's surface begins at the pane's top edge and no sliver of the row appears above the header

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

### Requirement: Commit message sizing

The panel SHALL size the commit message input to its content: one line while the message fits on one line, one additional line for every line the message wraps onto, and at most ten lines, after which the message scrolls inside the input instead of growing it. The input SHALL follow both a change to the message and a change to the width available for it, and it SHALL offer no manual resize handle.

#### Scenario: Empty message box

- **WHEN** the panel shows an empty commit message input
- **THEN** the input is one line high and needs no scrolling

#### Scenario: A wrapped message grows the input

- **WHEN** the user types a message that wraps onto four lines
- **THEN** the input is four lines high and shows the whole message without scrolling

#### Scenario: A long message stops at ten lines

- **WHEN** the message needs more than ten lines
- **THEN** the input stays ten lines high and the message scrolls inside it

#### Scenario: Deleting text shrinks the input

- **WHEN** the user deletes the message back to a single line
- **THEN** the input shrinks back to one line high

#### Scenario: Narrowing the panel rewraps the message

- **WHEN** the Sidebar becomes narrow enough that the same message needs more lines
- **THEN** the input grows to the new height of the same message without further typing

#### Scenario: Input disabled while committing

- **WHEN** a commit is running and the input is disabled
- **THEN** its height still matches the message it holds

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

### Requirement: Commit graph context-menu structure

A commit row SHALL present actions in this order: View Details, a separator, a checkout submenu when the commit carries any local branch head, detached checkout, a separator, branch creation, a deletion submenu when it carries a deletable local branch head, a separator after the branch group, tag creation, a separator, full commit-hash copy, and commit-message copy. View Details SHALL stay available while another operation is running, because it does not change the repository. Submenus SHALL contain the available local branch heads at that commit, in name order, and SHALL NOT contain remote-tracking branches, tags, or HEAD markers. The current head MAY be disabled in the checkout submenu and SHALL NOT be offered for deletion. Menus and submenus SHALL use the application's shared native menu presentation and theme.

#### Scenario: Ordinary commit

- **WHEN** the user invokes the menu on a commit with no local branch heads
- **THEN** it offers view details, detached checkout, create branch, create tag, copy commit hash and copy commit message, with the specified separators and no checkout or deletion submenu

#### Scenario: Branch-head commit

- **GIVEN** a commit carries local branches `feature` and `main` plus `origin/main`
- **WHEN** the user invokes its menu
- **THEN** View Details comes first, native checkout and deletion submenus precede the create-branch and subsequent groups, and their entries contain only `feature` and `main` where applicable, never `origin/main`

#### Scenario: Opening a submenu has no side effects

- **WHEN** the user opens checkout or deletion choices but selects none
- **THEN** no Git command runs and the repository remains unchanged

#### Scenario: View Details while busy

- **WHEN** another panel operation is running and the user invokes a commit row's menu
- **THEN** View Details is enabled while the repository-changing actions are disabled

### Requirement: Checkout from commit history

The graph SHALL let the user switch to a local branch whose head is the selected commit, or check out the selected commit itself with a detached HEAD. These operations SHALL refresh the repository summary and graph after success, retain the current branch on failure, and report the failure instead of claiming a switch.

#### Scenario: Checkout a branch head

- **WHEN** the user selects another local branch from a commit's checkout submenu and Git succeeds
- **THEN** that branch is checked out and the branch header, changes and graph reflect it

#### Scenario: Checkout detached

- **WHEN** the user selects detached checkout for a listed commit and Git succeeds
- **THEN** HEAD points directly at that full commit and the branch header reports a detached state

#### Scenario: Working tree prevents checkout

- **WHEN** Git refuses either checkout because local changes would be overwritten
- **THEN** the previous branch remains checked out and the panel shows Git's failure

### Requirement: Create references at a commit

The graph SHALL ask for a name before creating a branch or tag at the selected commit. Cancelling or submitting only whitespace SHALL NOT perform a Git operation. Branch creation SHALL create the branch at that commit and check it out. Tag creation SHALL create a lightweight tag, or an annotated tag when the user supplies a non-empty message. Invalid names, duplicates and other Git failures SHALL be reported and SHALL leave the naming dialog open with its text intact.

#### Scenario: Create and switch branch

- **GIVEN** the user supplies the new branch name `feature/review` for a selected older commit
- **WHEN** the creation succeeds
- **THEN** `feature/review` points at that commit, becomes the current branch, and the header and graph refresh

#### Scenario: Create annotated tag

- **GIVEN** the user supplies tag name `v2.0` and an annotation message
- **WHEN** the creation succeeds
- **THEN** that annotated tag points at the selected commit and appears after the graph refreshes

#### Scenario: Cancel creation

- **WHEN** the user cancels a branch or tag naming dialog, or confirms an empty name
- **THEN** the repository receives no reference-creation command

#### Scenario: Duplicate name

- **WHEN** Git rejects the entered branch or tag name because that reference already exists
- **THEN** the panel reports the failure and leaves the entered values available for correction

### Requirement: Delete a branch from commit history

The graph SHALL offer deletion only for local branch heads on the selected commit that are not currently checked out. Choosing one SHALL ask for explicit confirmation before deleting it. The operation SHALL NOT force deletion when Git considers the branch unmerged, and SHALL refresh references after success or show Git's failure after rejection.

#### Scenario: Delete requires confirmation

- **WHEN** the user chooses a non-current branch from the deletion submenu
- **THEN** no branch deletion runs until the user confirms

#### Scenario: Deletion succeeds

- **WHEN** the user confirms deletion of another fully merged branch and Git succeeds
- **THEN** that local branch is removed and its badge disappears after the graph refreshes

#### Scenario: Unmerged branch is retained

- **WHEN** Git refuses deletion because the branch contains unmerged commits
- **THEN** the branch remains present and the panel shows Git's failure

### Requirement: Keyboard-accessible reference-operation dialogs

A branch/tag naming dialog SHALL initially focus its name input, and a branch-deletion confirmation SHALL initially focus Cancel. Their descriptions SHALL be associated with the dialog for assistive technology. Idle Escape SHALL cancel the dialog, and closing it SHALL restore focus to the originating commit row while that row remains available. A tag annotation SHALL allow an ordinary Enter to insert a newline without submitting; the command SHALL require the submit button or Ctrl/Cmd+Enter. While a reference operation is pending, the dialog SHALL announce its progress, prevent a duplicate operation, and preserve its text and logical focus after a failure.

#### Scenario: Escape branch deletion

- **GIVEN** a keyboard user opened branch deletion from a commit row
- **WHEN** the confirmation is announced with Cancel focused and the user presses Escape before any operation starts
- **THEN** the dialog closes without deleting the branch and focus returns to the originating commit row

#### Scenario: Multiline annotation

- **WHEN** the user presses ordinary Enter in the tag annotation field
- **THEN** the message can receive a newline and no tag operation runs until the button or Ctrl/Cmd+Enter submits the form

#### Scenario: Failed submission keeps the editing context

- **WHEN** Git rejects a submitted name or deletion
- **THEN** the pending indicator clears, Git's failure is shown, and the dialog retains its current values and logical focus for correction or cancellation

### Requirement: Commit graph header

The commit graph SHALL sit under a collapsible header that shows the graph
title, its toggle and its context menu, and that header SHALL NOT show a count
of the commits loaded so far. The change-group headers SHALL keep showing their
file counts.

#### Scenario: Loaded commits are not counted in the header

- **GIVEN** the graph has loaded one or more commits
- **WHEN** the graph section header is shown
- **THEN** the header shows the graph title without a count chip

#### Scenario: Change-group headers keep their counts

- **GIVEN** the staged and unstaged groups list files
- **WHEN** the panel is shown
- **THEN** each change-group header still shows the number of files in its group

### Requirement: Floating operation panels

The panel SHALL present discard confirmations, stage-all-and-commit
confirmation, reference naming and branch deletion in a consistent rounded
bottom-anchored floating surface within the Git panel, without changing the
change-list or graph pane geometry or split ratio. The surface SHALL use the
host theme's colors, typography, borders, controls and focus treatment, with
translucency and backdrop blur where supported and a readable solid fallback
otherwise. The surface SHALL rise into place from the panel's bottom edge when
it opens and SHALL lower out of the panel before it is removed when it is
dismissed, and it SHALL accept no input while it leaves. Its motion SHALL NOT
scroll the pane or shift its content: the pane keeps its scroll position and
its header and lists stay where they are while the card rises or lowers. Only
one operation prompt SHALL be visible at a time; requesting another idle prompt
SHALL replace the previous one without executing it. When the system asks for
reduced motion the surface SHALL appear and disappear at its final position
without moving.

#### Scenario: Confirm without resizing the lists

- **GIVEN** the change list and graph are visible at a user-selected split ratio
- **WHEN** the user opens a discard confirmation
- **THEN** a rounded frosted card rises from the pane's bottom edge and settles
  above the bottom of the panel while the panes and their split ratio retain
  their geometry

#### Scenario: The moving prompt leaves the pane still

- **GIVEN** the change list or graph is scrolled within its pane
- **WHEN** the user opens a confirmation and then dismisses it
- **THEN** the pane keeps that scroll position and neither the branch header,
  the lists nor the graph jump while the card rises or lowers

#### Scenario: Reuse for reference forms

- **WHEN** the user creates a branch or tag, deletes a branch, or confirms staging all changes before committing
- **THEN** the same floating surface and content/action hierarchy are used with the appropriate fields and controls

#### Scenario: Replace an idle prompt

- **GIVEN** an operation prompt is open but has not been submitted
- **WHEN** the user requests a different operation prompt
- **THEN** only the new prompt remains and no repository command runs for the replaced prompt

#### Scenario: Backdrop filtering unavailable

- **WHEN** the browser cannot filter the background behind the floating surface
- **THEN** the surface remains readable on a solid theme-derived background

#### Scenario: A dismissed prompt leaves the pane

- **WHEN** the user cancels an idle prompt
- **THEN** the card moves down out of the pane before it is removed, it accepts
  no further input on the way out, and no Git command runs

#### Scenario: Reduced motion keeps the prompt in place

- **WHEN** the system asks for reduced motion and the user opens and dismisses an
  operation prompt
- **THEN** the card appears and disappears at its final position without moving

### Requirement: Adaptive operation-panel content

The floating surface SHALL separate its copy and optional form fields from its action footer. Long text and translated action labels SHALL wrap within the available width. Content exceeding the available panel height SHALL scroll while the actions remain reachable, and reference-operation failures SHALL remain visible with the retained form values. The surface SHALL dynamically span the Git pane's width with equal 4px left, right and bottom gutters, without a fixed maximum width, overlaying the underlying content rather than resizing it. Its content and footer SHALL retain 8px horizontal insets without reducing vertical content spacing or button hit areas.

#### Scenario: Long text in a narrow sidebar

- **WHEN** a confirmation contains a long unbroken filename or branch name in a narrow sidebar
- **THEN** its copy wraps without horizontal overflow and the action labels remain readable on wrapping controls below the content

#### Scenario: Tag annotation in a short panel

- **WHEN** a tag form and its annotation exceed the panel height
- **THEN** the content area scrolls within the floating surface and the action footer remains reachable

#### Scenario: Reference creation fails

- **WHEN** Git rejects a submitted branch or tag name
- **THEN** the floating form displays the failure and retains the name and annotation for correction or cancellation

#### Scenario: Full-width floating surface with equal gutters

- **WHEN** an operation prompt opens in a narrow or wide Git pane, or the pane is resized while the prompt is open
- **THEN** the card fills the pane width except for equal 4px left and right gutters, sits 4px above the pane bottom, and overlays the underlying graph without changing its geometry
- **THEN** its content and footer retain 8px horizontal insets, with unchanged vertical content spacing and button hit areas

### Requirement: Safe floating-panel interaction

The floating surface SHALL expose a named dialog and associate a non-empty description for assistive technology. Plain confirmations SHALL initially focus Cancel, while reference creation SHALL retain initial focus on the name field. Escape SHALL cancel an idle prompt without running Git, and a prompt that remains open while an operation is busy SHALL reject cancellation and duplicate submission. Ordinary Enter in a tag annotation SHALL remain a newline rather than submitting it.

#### Scenario: Cancel a discard with Escape

- **WHEN** the user opens a discard confirmation and presses Escape while idle
- **THEN** the dialog closes and no discard command runs

#### Scenario: Confirmation without a description

- **WHEN** the stage-all-and-commit confirmation has no additional description
- **THEN** the dialog is named and contains no dangling description reference or empty description block

#### Scenario: Operation in flight

- **WHEN** a reference operation is pending and the user presses Escape or activates a submit or cancel control again
- **THEN** the original request remains the only operation and the prompt stays visible with its progress feedback

### Requirement: Shared transient feedback

The panel SHALL present every success and failure notification through DSH's
native Toast when available, using the user's language and the host's
placement, replacement and dismissal behavior instead of a private inline
notice or banner. Successful operations SHALL use the Toast's native success
presentation and its check icon; failures SHALL use the warning icon so the
message type is distinguishable at a glance. A failure the user can retry
SHALL offer one localized retry action on the Toast, and choosing it SHALL
dismiss the notice before the retry runs. The notification SHALL NOT insert a
notice into the panel layout, move the change list or graph, or resize the
split. Stale-target and busy refusals SHALL NOT be styled as successes.
Unavailable or failing host notifications SHALL NOT prevent repository
operations, message clearing, confirmation handling or refreshes, and SHALL NOT
be reported as Git failures.

#### Scenario: Commit staged changes

- **WHEN** a commit of staged changes succeeds
- **THEN** one native success Toast confirms the commit with its returned short
  identifier, the message clears and the changes and graph refresh without
  inserting a notice into the panel layout

#### Scenario: Stage all and commit

- **WHEN** the user confirms staging all changes and the commit succeeds
- **THEN** one native success Toast confirms the commit and the normal
  confirmation, message clearing and refresh behavior is preserved

#### Scenario: Ignore tracked and untracked files

- **WHEN** adding a working-change path to the repository's ignore rules succeeds
- **THEN** one native success Toast confirms the action, still explaining when
  the file remains tracked, and the change list refreshes without an inline
  notice

#### Scenario: Reference operation succeeds

- **WHEN** detached checkout, branch creation or deletion, or tag creation succeeds
- **THEN** its existing localized confirmation appears once as a native success
  Toast, the existing refresh and form-closing behavior is preserved and no
  private notice is inserted

#### Scenario: Stale menu target

- **WHEN** a selected menu action refers to a change that no longer exists
- **THEN** a non-success Toast with the warning icon explains that the target is
  stale and no repository write runs

#### Scenario: Busy menu command

- **WHEN** a mutating menu command reaches a panel already running a repository operation
- **THEN** a non-success Toast with the warning icon explains that the panel is
  busy and no second operation runs

#### Scenario: Failed repository operation

- **WHEN** a commit, ignore, reference or remote operation fails
- **THEN** one non-success Toast with the warning icon and Git's message appears,
  no success Toast is emitted, and a failed commit keeps its message and staged
  files

#### Scenario: Retryable read failure

- **WHEN** a status, history, commit-details or diff read fails
- **THEN** one non-success Toast with the warning icon and the failure text
  appears with a localized retry action, the panel keeps its current layout and
  scroll positions, and choosing retry dismisses the notice and runs the read
  again

#### Scenario: Failure remains reachable after the Toast fades

- **WHEN** the graph, commit-details or diff pane fails to load
- **THEN** the pane keeps a compact failed state with a retry control while the
  Toast supplies the failure text, and the retry control runs the read again

#### Scenario: A later notice replaces the earlier one

- **GIVEN** one notification is showing
- **WHEN** another success or failure notification is delivered
- **THEN** the new notice replaces the earlier one with the host's own
  transition instead of stacking or duplicating it

#### Scenario: Open form keeps its values on failure

- **WHEN** a remote or reference operation submitted from an open form fails
- **THEN** the failure appears as a non-success Toast and the form stays open
  with its entered values and logical focus

#### Scenario: Host notifications unavailable

- **WHEN** the host's native Toast component and the shared notification
  service are both absent or cannot deliver feedback and the user completes an
  otherwise valid inline commit
- **THEN** the commit still clears its message and refreshes changes and history
  without recreating a private notice or showing a notification failure as a
  Git error

### Requirement: Literal file-action scope

The Host MUST interpret accepted repository-relative file paths literally rather than as patterns when staging, unstaging, discarding tracked changes or reading file diffs. It MUST reject paths outside the repository while accepting ordinary filenames beginning with two dots.

#### Scenario: Pattern-shaped filename

- **GIVEN** the repository contains both a changed file with a literal pattern character in its name and another file that would match that pattern
- **WHEN** the user stages, unstages or discards only the first file
- **THEN** the second file's index and working-tree content remain unchanged

#### Scenario: Pattern-shaped diff path

- **WHEN** the user opens a working-tree or commit diff for a filename containing pattern characters
- **THEN** the diff includes only the selected path and its rename source when applicable

#### Scenario: Double-dot-prefixed filename

- **WHEN** the user acts on a file named `..notes` within the repository
- **THEN** the Host handles it as a file inside the repository rather than rejecting it as parent-directory traversal

#### Scenario: Escaping path

- **WHEN** a file action supplies an absolute path or a relative path that escapes the repository
- **THEN** the Host rejects the action without reading or changing that target

### Requirement: Direct filesystem target safety

The Host MUST verify that a target is actually untracked and not ignored before previewing or deleting it as an untracked file, rather than trusting the caller's classification. It MUST refuse an untracked-file preview when the target is a symbolic link or a non-regular file. Direct filesystem previews and untracked-file deletion MUST refuse a path with a symbolic-link parent directory. Deleting an untracked symbolic link itself SHALL remove the link without following or changing its target.

#### Scenario: Tracked file mislabeled as untracked

- **GIVEN** a file is tracked in the current index, including one staged after its change row was captured
- **WHEN** a request claims the file is untracked and asks to preview or delete it through the untracked path
- **THEN** the Host rejects the request and does not remove the tracked file

#### Scenario: Ignored target

- **GIVEN** a file is excluded from the change list by an ignore rule
- **WHEN** a request claims it is an ordinary untracked file and asks for a preview or deletion
- **THEN** the Host rejects the request without returning its contents or deleting it

#### Scenario: Linked preview file

- **GIVEN** an untracked symbolic link points to a file outside the repository
- **WHEN** its content is requested as an untracked diff
- **THEN** the Host rejects the read and returns no linked file content

#### Scenario: Linked parent directory

- **GIVEN** a path inside the repository passes through a symbolic-link directory
- **WHEN** an untracked preview or deletion is requested for a file below that directory
- **THEN** the Host refuses the operation and the linked target remains unread and unchanged

#### Scenario: Delete a link rather than its target

- **WHEN** the user confirms discarding an untracked symbolic link whose parent directories are ordinary directories
- **THEN** only the link is deleted and its target remains unchanged

#### Scenario: Regular-file preview

- **WHEN** the user opens an ordinary untracked file inside ordinary repository directories
- **THEN** its existing bounded text or binary preview remains available

### Requirement: Refresh completion ordering

The panel SHALL preserve a status refresh requested while an older status read is in flight by completing a subsequent read, coalescing overlapping requests without concurrent status reads. A successful repository operation SHALL wait for its required fresh status read before releasing its busy state. Unmounting the panel MUST prevent a queued read from starting.

#### Scenario: An older read overlaps a write

- **GIVEN** a status read began before a repository mutation completed
- **WHEN** the successful mutation requests its status refresh
- **THEN** a subsequent status read completes and its result becomes the displayed state before the operation becomes idle

#### Scenario: Several refresh requests overlap

- **WHEN** several refresh requests arrive during one pending status read
- **THEN** they are coalesced into a follow-up read and no two status reads run concurrently

#### Scenario: Failed read with a queued refresh

- **GIVEN** another refresh was requested while a status read was pending
- **WHEN** the older read fails
- **THEN** the queued refresh still runs and can replace the failure with fresh status

#### Scenario: Panel closes with a queued refresh

- **WHEN** the panel closes before its pending status read settles
- **THEN** settling that read does not start a queued refresh or update the closed panel

### Requirement: Cancelled watch setup stays cancelled

The Host MUST prevent asynchronous watch setup from acquiring or replacing repository watchers after its panel subscription is cancelled, a newer subscription supersedes it or the plugin's watch registry is disposed. Disposal SHALL be idempotent and permanent for that registry.

#### Scenario: Unload during repository discovery

- **GIVEN** a watch request is still resolving its repository or metadata directory
- **WHEN** the plugin unloads before resolution finishes
- **THEN** the request finishes without opening watchers or retaining a subscription

#### Scenario: Close before subscription is ready

- **WHEN** a panel cancels its subscription before asynchronous watch setup finishes
- **THEN** the obsolete request does not reopen watchers after cancellation

#### Scenario: Newer repository wins

- **GIVEN** two watch requests for the same panel resolve different repository directories
- **WHEN** the newer request finishes before the older one
- **THEN** the older result cannot replace or detach the newer subscription

#### Scenario: Repeated disposal and subsequent requests

- **WHEN** an already disposed registry is disposed again or receives a watch request
- **THEN** it remains idle without opening watchers or timers

### Requirement: Inline commit changes

Activating a commit row in the graph, by pointer or by Enter or Space while
the row has keyboard focus, SHALL toggle a list of the files that commit
changed relative to its first parent directly below the row, as VS Code's
Source Control Graph expands a history item. The row SHALL expose whether it is
expanded to assistive technology. Several commits SHALL be able to stay
expanded at the same time, and activating an expanded row SHALL collapse its list. Each listed file
SHALL take one 22-pixel row showing the Web application's own file-type icon
for that file's path, drawn as the application's workspace explorer draws it,
the file name, its dimmed repository-relative directory when it has one, and
its status letter at the row's end in that status's color; the files SHALL be
sorted by path, and a renamed file's tooltip SHALL name its original path. When
the application provides no file-type icon set, the row SHALL show the plugin's
plain document icon instead and SHALL otherwise stay unchanged. Activating a
listed file, by pointer or keyboard, SHALL open that file's diff for the
commit. While the file list is read the commit SHALL show one loading row; a
commit without file changes SHALL show one row saying so; a failed read SHALL
show one row with the failure and a retry control; a capped list SHALL end with
a row saying that only the first files are shown. Listed files SHALL keep the
copy-only context menu of past-commit files. Expanding or collapsing SHALL NOT
change the repository and SHALL NOT replace the change list or the graph.

#### Scenario: Expand a commit

- **WHEN** the user activates a collapsed commit row
- **THEN** the commit's changed files appear directly below it in path order,
  each with its icon, name, dimmed directory and status letter, while the change
  list, the rest of the graph and the commit box stay in place

#### Scenario: Collapse a commit

- **WHEN** the user activates a commit row whose files are listed
- **THEN** its file rows disappear and the next commit row follows it directly

#### Scenario: File type icons

- **GIVEN** a commit changed `src/app.ts`, `assets/logo.png` and a file with no
  recognized type
- **WHEN** the user expands that commit
- **THEN** the rows show the application's glyphs for those paths, a TypeScript
  glyph, an image glyph and its generic document glyph, while the row height,
  name, dimmed directory and status letter stay unchanged

#### Scenario: The application provides no file-type icons

- **GIVEN** the application does not provide its file-type icon set
- **WHEN** the user expands a commit
- **THEN** every file row shows the plugin's plain document icon, the list opens
  as usual, and its rows still open their diffs

#### Scenario: Keyboard toggle

- **WHEN** a commit row has keyboard focus and the user presses Enter or Space
- **THEN** its file list expands, or collapses when it is already expanded,
  without changing the repository

#### Scenario: Several commits expanded

- **GIVEN** one commit's file list is expanded
- **WHEN** the user activates another commit row
- **THEN** both commits list their files below their own rows

#### Scenario: Open a file from an expanded commit

- **WHEN** the user activates a file row under an expanded commit
- **THEN** a diff tab shows the change that commit made to the file relative to
  its first parent and identifies the commit

#### Scenario: Expanded commit without file changes

- **WHEN** the user expands a commit that changed no files relative to its
  first parent
- **THEN** one row under the commit says that it has no file changes

#### Scenario: Expanded commit cannot be read

- **WHEN** reading an expanded commit's file list fails
- **THEN** one row under the commit reports the failure, and activating its
  retry control reads the list again

#### Scenario: Context menu of an expanded file

- **WHEN** the user invokes the context menu on a file row under an expanded
  commit
- **THEN** it offers only the relative-path and absolute-path copy actions

### Requirement: Expanded commit drawing

The rows listed under an expanded commit SHALL continue the commit graph as VS
Code draws an expanded history item's changes: every line that leaves the
commit's row at its bottom edge SHALL continue vertically in its own position
and color through each listed row, the line in the commit node's position SHALL
be drawn three pixels wide and the others one pixel wide, and the next commit
row's lines SHALL join them at its top edge without a break. The expanded
commit's own row SHALL draw the line in its node's position three pixels wide
only from the node down to the row's bottom edge, so the wide line begins at the
node and continues unbroken into the listed rows, while the segment arriving
from the commit above the node SHALL stay one pixel wide; a collapsed commit row
SHALL keep one-pixel lines, and a lane the commit is not on SHALL keep one pixel
in both cases. A listed row's icon SHALL begin just after a graph area one
position wider than the number of lines leaving the commit. Expanded rows SHALL
NOT move the nodes, curves or colors of any commit row.

#### Scenario: Lanes run through the expanded rows

- **GIVEN** three lines leave an expanded commit's row and the commit's node
  sits in the second position
- **WHEN** its file rows are shown
- **THEN** three vertical lines in their own colors run through every file
  row, the second one three pixels wide, and the file icons begin after a
  four-position graph area

#### Scenario: The wide line starts at the expanded node

- **WHEN** the user expands a commit row
- **THEN** the line below its node is three pixels wide and runs unbroken into
  its file rows, while the line above the node and the commit rows above and
  below keep one-pixel lines

#### Scenario: A collapsed row keeps one-pixel lines

- **WHEN** the user collapses an expanded commit row
- **THEN** the line through that row is one pixel wide again and only its node
  still marks it

#### Scenario: The next commit keeps its geometry

- **WHEN** a commit above another is expanded
- **THEN** the lower commit's node, curves and colors are drawn exactly as when
  nothing is expanded, only lower by the height of the inserted rows

### Requirement: Remote synchronization actions

The panel SHALL offer Fetch, Pull, Pull (Rebase), Push, and Sync for the
current branch, and SHALL run only the action the user chooses. Fetch SHALL
update remote-tracking branches from every configured remote and SHALL prune
remote-tracking branches whose remote ref no longer exists. Pull SHALL
integrate the upstream into the current branch by merging, and Pull (Rebase)
SHALL integrate it by rebasing. Push SHALL send the current branch's commits to
its upstream. Sync SHALL pull by merging and then push, and when the pull fails
it SHALL NOT push.

#### Scenario: Fetch updates remote-tracking state

- **GIVEN** a remote has new commits that the local repository has not fetched
- **WHEN** the user chooses Fetch
- **THEN** the fetched remote-tracking branches update and the refreshed header
  shows the new ahead or behind counts

#### Scenario: Pull merges the upstream

- **GIVEN** the current branch has an upstream with commits not yet local
- **WHEN** the user chooses Pull
- **THEN** the upstream is merged into the current branch and the change list,
  branch summary and graph refresh

#### Scenario: Pull with rebase replays local commits

- **GIVEN** the current branch has an upstream and local commits
- **WHEN** the user chooses Pull (Rebase)
- **THEN** Git rebases the local commits onto the upstream and the refreshed
  graph shows the replayed commits

#### Scenario: Push sends local commits

- **GIVEN** the current branch tracks an upstream and is ahead of it
- **WHEN** the user chooses Push
- **THEN** the local commits reach the upstream and the refreshed header no
  longer reports them as ahead

#### Scenario: Sync pulls before it pushes

- **WHEN** the user chooses Sync on a branch whose upstream can be merged
- **THEN** the panel pulls first and pushes only after the pull succeeds

#### Scenario: A failed pull stops Sync

- **GIVEN** a pull from the upstream fails
- **WHEN** the user chooses Sync
- **THEN** the panel reports the pull failure and does not push

### Requirement: Publish branch

When the current branch has commits and no upstream, the panel SHALL offer
Publish Branch. Publishing SHALL push the branch to a configured remote and
SHALL set that remote branch as its upstream. The panel SHALL prefer `origin`
when it exists, otherwise the first configured remote, SHALL ask the user to
choose when several remotes are configured, and SHALL report when no remote is
configured without changing the repository.

#### Scenario: Publish to the only remote

- **GIVEN** the current branch has no upstream and exactly one remote is configured
- **WHEN** the user chooses Publish Branch
- **THEN** the branch is pushed to that remote, its upstream is set, and the
  refreshed header shows the tracking branch

#### Scenario: Choose among several remotes

- **GIVEN** the current branch has no upstream and several remotes are configured
- **WHEN** the user chooses Publish Branch
- **THEN** the panel asks which remote to publish to before running Git

#### Scenario: No remotes configured

- **GIVEN** the current branch has no upstream and no remote is configured
- **WHEN** the user chooses Publish Branch
- **THEN** the panel reports that a remote must be added and does not run a
  network operation

#### Scenario: Detached or unborn branch

- **WHEN** HEAD is detached or the branch has no commits
- **THEN** Publish Branch is unavailable and no network operation runs

### Requirement: Remote status control

The toolbar SHALL provide one remote control for the current branch. When the
branch has an upstream, activating the control SHALL sync it; when the branch
has no upstream, activating the control SHALL publish it. The control SHALL be
disabled while another Git operation runs and SHALL not act when there is no
repository, HEAD is detached, or the branch has no commits. The existing ahead
and behind counts SHALL remain visible alongside it.

#### Scenario: Sync from the status control

- **GIVEN** the current branch tracks an upstream
- **WHEN** the user activates the remote status control
- **THEN** the panel syncs the branch, with the control showing that the
  operation is running

#### Scenario: Publish from the status control

- **GIVEN** the current branch has no upstream
- **WHEN** the user activates the remote status control
- **THEN** the panel starts the same publish flow as Publish Branch

#### Scenario: No usable branch

- **WHEN** there is no repository, HEAD is detached, or the branch has no commits
- **THEN** the remote status control is unavailable and runs no Git command

### Requirement: Remote operation feedback and refresh

A successful remote operation SHALL show a localized success message and SHALL
refresh the repository summary and commit graph. A failed remote operation
SHALL be reported through the shared notification with the warning icon, SHALL
NOT show a success message, and SHALL also refresh the repository summary so
conflicts or partially fetched refs become visible. The panel SHALL run only
one remote operation at a time, SHALL keep an open publish form's entered
remote and values after a failure, and SHALL close the form after success.

#### Scenario: Successful sync is reported

- **WHEN** a Sync succeeds
- **THEN** a localized success message is shown and the header, change list and
  graph reflect the synchronized state

#### Scenario: Failed pull keeps the repository readable

- **GIVEN** a pull stops with a merge conflict
- **WHEN** the failure is reported
- **THEN** the change list refreshes and lists the conflicted files, and no
  success message is shown

#### Scenario: Failed publish keeps the form usable

- **WHEN** publishing the current branch fails
- **THEN** the failure appears as a non-success Toast, the open form keeps its
  entered remote and stays open for correction, and no success message is shown

#### Scenario: One remote operation at a time

- **WHEN** a remote operation is running
- **THEN** remote actions and other repository writes are unavailable until it
  finishes

### Requirement: Non-interactive remote execution

The Host MUST execute remote operations in the Session's repository without a
shell, MUST NOT accept a repository path from the browser, MUST validate every
remote name and URL before using it as a Git argument, and MUST NOT wait
indefinitely for an interactive credential prompt. It MUST disable the
terminal prompts Git controls and MUST bound every remote command. A remote
operation that exceeds the Host's time bound MUST fail with a reported timeout
instead of remaining pending. Adding a remote URL SHALL be treated as
user-authorized repository configuration; Git's configured transports,
credential helpers and hooks remain part of the local trust boundary.

#### Scenario: Option-like input is rejected

- **WHEN** a request supplies a remote name or URL that begins with a dash or
  is otherwise not a valid remote name or URL
- **THEN** the Host rejects the request before running Git and the repository
  is unchanged

#### Scenario: Credentials are unavailable

- **GIVEN** a remote requires an interactive credential that the Host cannot obtain
- **WHEN** the user fetches, pulls, or pushes
- **THEN** the operation ends with Git's message or the Host's timeout error
  instead of waiting indefinitely for input

#### Scenario: A remote operation times out

- **GIVEN** a remote operation runs longer than the Host allows
- **WHEN** the bound is reached
- **THEN** the Host stops the Git process and reports a timeout failure

### Requirement: Remote configuration

The panel SHALL list the repository's configured remotes and SHALL offer Add
Remote and Remove Remote. Add Remote SHALL require a name and a URL, SHALL
reject an empty, malformed, or duplicate name and an empty or malformed URL
without changing the repository, and SHALL configure the remote on success.
Remove Remote SHALL require confirmation, SHALL remove only the chosen
configured remote, and SHALL report a failure without pretending the remote was
removed. Cancelling either form SHALL run no Git command.

#### Scenario: Add a remote

- **WHEN** the user enters a valid name and URL and submits Add Remote
- **THEN** the remote is configured, the remotes list refreshes, and a localized
  success message names it

#### Scenario: Invalid remote input

- **WHEN** the name or URL is empty, starts with a dash, or is not valid for Git
- **THEN** the form reports the problem, keeps the entered text, and the
  repository configuration is unchanged

#### Scenario: Remove a remote

- **GIVEN** the repository has a configured remote
- **WHEN** the user chooses it in Remove Remote and confirms
- **THEN** the remote and its remote-tracking branches are removed and the
  branch summary refreshes

#### Scenario: Removing a remote fails

- **WHEN** Git refuses to remove the chosen remote
- **THEN** the panel reports Git's message and the remote list refreshes from the
  repository

#### Scenario: Cancel a remote form

- **WHEN** the user cancels Add Remote or Remove Remote
- **THEN** no Git command runs and the repository is unchanged

### Requirement: Remote branch listing

The branch picker SHALL list remote-tracking branches in a group separate from
local branches, SHALL show each as the remote name and branch name separated by a slash (for example `origin/main`) with its remote and
branch parts, and SHALL exclude symbolic remote `HEAD` pointers. The current
local branch SHALL remain marked, and the local and remote groups SHALL report
loading, failure and empty states without hiding the other group.

#### Scenario: Remote branches appear separately

- **GIVEN** the repository has local branches and remote-tracking branches
- **WHEN** the user opens the branch picker
- **THEN** local branches are listed first and remote-tracking branches follow
  under their own heading, each named the remote name and branch name separated by a slash (for example `origin/main`)

#### Scenario: Remote HEAD pointer is not a branch

- **GIVEN** a remote publishes a symbolic `HEAD` pointer
- **WHEN** the branch picker lists remote-tracking branches
- **THEN** the pointer is not listed as a selectable branch

#### Scenario: Branch list failure

- **WHEN** the branch list cannot be read
- **THEN** the picker reports the failure with a retry and the panel remains
  usable

### Requirement: Remote branch checkout

Selecting a remote-tracking branch SHALL check out a local branch with the same
short name. When that local branch does not exist, the panel SHALL create it
with the selected remote branch as its upstream. When it already exists, the
panel SHALL check out the existing local branch and SHALL leave its upstream
unchanged. A failed checkout SHALL be reported and SHALL leave the previously
checked-out branch in effect. A successful checkout SHALL refresh the branch
summary and graph.

#### Scenario: Create a tracking branch from a remote branch

- **GIVEN** no local branch has the remote branch's short name
- **WHEN** the user picks that remote branch
- **THEN** a local branch is created, checked out, and set to track the selected
  remote branch

#### Scenario: A local branch already exists

- **GIVEN** a local branch with the remote branch's short name exists
- **WHEN** the user picks the remote branch
- **THEN** the existing local branch is checked out and its upstream is
  unchanged

#### Scenario: Checkout is rejected

- **WHEN** Git refuses to check out the selected remote branch
- **THEN** the panel reports Git's message and the previous branch stays checked
  out

### Requirement: Remote management feedback and refresh

A successful remote configuration change or remote-branch checkout SHALL show
localized success feedback and SHALL refresh the remotes list, repository
summary and commit graph as applicable. A failure SHALL be reported through the
shared notification with the warning icon, SHALL keep the form's entered
values, and SHALL NOT show success feedback. Remote management SHALL run only
one Git operation at a time and SHALL be unavailable while another operation
runs.

#### Scenario: Success refreshes the panel

- **WHEN** adding a remote, removing a remote, or checking out a remote branch
  succeeds
- **THEN** the affected lists, branch summary and graph reflect the new state
  and a localized success message is shown

#### Scenario: Failure keeps the form usable

- **WHEN** adding a remote fails
- **THEN** the failure appears as a non-success Toast, the entered name and URL
  stay editable, and no success message is shown

#### Scenario: Busy panel

- **WHEN** another Git operation is running
- **THEN** remote management and remote-branch checkout are unavailable

### Requirement: Commit action menu

The panel SHALL render the commit action as a primary button that fills the width of the commit box, with a check icon and a separate expand control at its trailing edge. The expand control SHALL open a menu listing Commit, Commit (Amend), a separator, Commit and Push, and Commit and Sync, in that order. Choosing an entry SHALL run only the chosen sequence. The menu SHALL close when an action starts, when the user clicks outside it, or when the user presses Escape. The commit button and the expand control SHALL share one disabled state: both SHALL be unavailable and use the disabled appearance while the message is empty or an action is running, and the menu SHALL NOT open then. Commit and Push and Commit and Sync SHALL also be unavailable when the current branch has no upstream, with the reason offered on hover while the menu is open.

#### Scenario: The commit button fills the row

- **WHEN** the panel shows the commit box with a non-empty message
- **THEN** the primary commit button spans the box width and the expand control sits at its trailing edge

#### Scenario: The menu lists the actions

- **GIVEN** the message is not empty
- **WHEN** the user activates the expand control
- **THEN** the menu lists Commit, Commit (Amend), a separator, Commit and Push, and Commit and Sync in that order

#### Scenario: An empty message disables both halves

- **WHEN** the message is empty or whitespace only
- **THEN** the commit button and the expand control are both unavailable and share the disabled appearance, and activating the expand control opens no menu

#### Scenario: A running action disables both halves

- **WHEN** a Git action is running
- **THEN** the commit button and the expand control are both unavailable and the menu is closed

#### Scenario: Escape closes the menu

- **WHEN** the menu is open and the user presses Escape
- **THEN** the menu closes and no Git command runs

#### Scenario: Amend replaces the tip commit

- **GIVEN** the current branch has at least one commit
- **WHEN** the user chooses Commit (Amend) with a message and staged changes
- **THEN** HEAD is replaced by a commit that carries the typed message and the staged changes, and the number of commits does not grow

#### Scenario: Amend without a commit is refused

- **GIVEN** the current branch has no commit yet
- **WHEN** the user chooses Commit (Amend)
- **THEN** the panel reports that there is no commit to amend and the repository is unchanged

#### Scenario: Commit and Push sends the new commit

- **GIVEN** the branch has an upstream and the user has staged changes
- **WHEN** the user chooses Commit and Push
- **THEN** the panel commits and then pushes, and the change groups and history refresh

#### Scenario: Commit and Sync pulls before it pushes

- **GIVEN** the branch has an upstream that can be merged
- **WHEN** the user chooses Commit and Sync
- **THEN** the panel commits, merges the upstream, and only then pushes

#### Scenario: A failed remote step keeps the commit

- **GIVEN** the push fails after the commit succeeded
- **WHEN** the user chooses Commit and Push
- **THEN** the panel reports the push failure, keeps the created commit, clears the message, and refreshes the change groups and history

#### Scenario: No upstream blocks the combined actions

- **GIVEN** the current branch has no upstream
- **WHEN** the user opens the commit action menu
- **THEN** Commit and Push and Commit and Sync are unavailable and explain that the branch has no upstream
