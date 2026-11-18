# git-sidebar delta

## ADDED Requirements

### Requirement: Inline commit changes

Activating a commit row in the graph, by pointer or by Enter or Space while
the row has keyboard focus, SHALL toggle a list of the files that commit
changed relative to its first parent directly below the row, as VS Code's
Source Control Graph expands a history item. The row SHALL expose whether it is
expanded to assistive technology. Several commits SHALL be able to stay
expanded at the same time, and activating an expanded row SHALL collapse its list. Each listed file
SHALL take one 22-pixel row showing a file icon, the file name, its dimmed
repository-relative directory when it has one, and its status letter at the
row's end in that status's color; the files SHALL be sorted by path, and a
renamed file's tooltip SHALL name its original path. Activating a listed file,
by pointer or keyboard, SHALL open that file's diff for the commit. While the
file list is read the commit SHALL show one loading row; a commit without file
changes SHALL show one row saying so; a failed read SHALL show one row with the
failure and a retry control; a capped list SHALL end with a row saying that only
the first files are shown. Listed files SHALL keep the copy-only context menu of
past-commit files. Expanding or collapsing SHALL NOT change the repository and
SHALL NOT replace the change list or the graph.

#### Scenario: Expand a commit

- **WHEN** the user activates a collapsed commit row
- **THEN** the commit's changed files appear directly below it in path order,
  each with its icon, name, dimmed directory and status letter, while the change
  list, the rest of the graph and the commit box stay in place

#### Scenario: Collapse a commit

- **WHEN** the user activates a commit row whose files are listed
- **THEN** its file rows disappear and the next commit row follows it directly

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
row's lines SHALL join them at its top edge without a break. A listed row's
icon SHALL begin just after a graph area one position wider than the number of
lines leaving the commit. Expanded rows SHALL NOT move the nodes, curves or
colors of any commit row.

#### Scenario: Lanes run through the expanded rows

- **GIVEN** three lines leave an expanded commit's row and the commit's node
  sits in the second position
- **WHEN** its file rows are shown
- **THEN** three vertical lines in their own colors run through every file
  row, the second one three pixels wide, and the file icons begin after a
  four-position graph area

#### Scenario: The next commit keeps its geometry

- **WHEN** a commit above another is expanded
- **THEN** the lower commit's node, curves and colors are drawn exactly as when
  nothing is expanded, only lower by the height of the inserted rows

## MODIFIED Requirements

### Requirement: Commit details

The panel SHALL show a commit's changed files, that commit's metadata, and a
way back to the change list when the user chooses the View Details action from
the commit row's context menu. The changed files SHALL carry their change
status letters and their repository-relative paths in a single-layer list with
no folder rows, sorted by path, and a renamed file SHALL show its original
path. The metadata SHALL identify the commit by its short identifier and show
its subject, author, relative time, and message body when present. Activating a
changed file SHALL open that file's diff for the commit. A commit that changed
no files SHALL be presented as such rather than as an empty list, a failed read
SHALL be reported with a retry path, and returning from the details view SHALL
restore the change list and graph without changing the repository. A View
Details action for a commit that is no longer listed SHALL be reported as stale
instead of opening an empty view.

#### Scenario: Open a commit's details

- **WHEN** the user chooses View Details from a commit row's context menu
- **THEN** the panel shows that commit's short identifier, subject, author,
  relative time and changed files with their status letters and paths, and the
  change list is replaced until the user returns

#### Scenario: Activating the row does not open the details

- **WHEN** the user activates a commit row by pointer or keyboard
- **THEN** the commit's changes expand inline and the details view does not open

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
- **THEN** the change list and graph are shown again with the repository
  unchanged and with the same commits expanded as before

#### Scenario: Stale View Details

- **WHEN** a View Details action arrives for a commit the graph no longer lists
- **THEN** the panel reports a stale target and keeps showing the change list
  and graph

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
