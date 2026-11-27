# git-sidebar delta

## ADDED Requirements

### Requirement: Workspace view menu

The Workspace section header SHALL carry its own file-view menu: a button in the
header's action area that drops a small menu below itself, drawn the same way as
the commit graph header's remote overflow menu, and reachable by pointer and by
keyboard focus and activation. The button SHALL report whether its menu is
currently open, and the menu SHALL list the two file views the change groups can
render — the flat list and the folder tree — as one choice of two, with the view
in effect marked both visually and as the checked choice, and the other view
offered for selection. Choosing either view SHALL close the menu and SHALL return
focus to the button that opened it. The menu SHALL close on `Escape`, without
consuming that key, and SHALL then leave focus on the same button; a pointer
press outside the menu SHALL close it without moving focus. It SHALL list both views
whether the working tree has changes or is clean, and both views SHALL stay
selectable while a Git operation runs, because they change no repository state.
The menu SHALL NOT depend on the host's context-menu facility, and the Workspace
section header SHALL offer no context menu of its own.

#### Scenario: Opening the menu

- **WHEN** the user activates the view button in the Workspace header
- **THEN** a menu opens below it listing the list and tree views, with the view
  in effect marked as the checked choice, and the button reports that it is open

#### Scenario: Opening the menu by keyboard

- **GIVEN** the view button has keyboard focus
- **WHEN** the user activates it with `Enter` or `Space`
- **THEN** the menu opens without running a Git operation

#### Scenario: Closing the menu

- **WHEN** the user presses `Escape`, presses the pointer outside the menu, or
  chooses a view
- **THEN** the menu closes, and choosing a view or pressing `Escape` also leaves
  focus on the view button

#### Scenario: A clean workspace keeps the menu

- **GIVEN** the working tree is clean so the Workspace section lists no group
- **WHEN** the user opens the view menu and chooses a view
- **THEN** both views are listed and the repository is left untouched

#### Scenario: A running operation does not block the view commands

- **GIVEN** a Git operation is running so the row and group actions are
  unavailable
- **WHEN** the user opens the view menu
- **THEN** both views stay selectable and choosing one switches the file view

#### Scenario: The host offers no context menus

- **GIVEN** the host provides no context-menu facility
- **WHEN** the panel renders its Workspace section
- **THEN** the view menu still opens, lists both views and switches between them

## MODIFIED Requirements

### Requirement: Change overview

The panel SHALL list the repository's changes as three groups in Code OSS's
order: merge conflicts, staged changes, and changes not yet staged. Each group
SHALL render as the file view the Workspace view menu currently selects, a
flat file list or a folder tree, and that view SHALL apply to every group at
once. In the flat list, every changed file SHALL appear as one row in a
single-layer list with no folder rows, sorted by its repository-relative path.
In the tree, a group's changed files SHALL be grouped into a folder tree that
follows the commit details tree's rules: every folder SHALL appear once as a row
above the files and folders it contains, an unbranched folder chain SHALL join
its names with `/` in one row that costs one indentation level, each nested level
SHALL be indented one step further than its parent, subfolders SHALL precede
files, both SHALL be ordered by name case-insensitively with numeric runs
compared as numbers, and every folder row SHALL be a disclosure control with an
expansion arrow that shows or hides its whole subtree.

Every file row SHALL show the Web application's own file-type icon for that
file's path before the file name, drawn as the application's workspace explorer
draws it, the file name with its dimmed parent directory in the flat list or the
file name alone below its folder rows in the tree, and the status letter
identifying added, modified, deleted, renamed, untracked, or conflicted state at
the row's end in that status's color, matching the files listed under an expanded
commit. When the application provides no file-type icon set, the row SHALL show
the plugin's plain document icon instead. A renamed file SHALL keep showing its
original name. Every file row SHALL keep the group's inline stage, unstage or
discard control and its context menu in both views. A file with both staged and
unstaged modifications SHALL appear in both the staged and the unstaged group. A
file that Git reports as conflicted SHALL appear under merge conflicts with the
conflicted status letter and SHALL remain listed until the conflict is resolved.

#### Scenario: Partially staged file

- **WHEN** a tracked file has staged edits and further unstaged edits
- **THEN** the file appears under staged changes and again under changes not yet
  staged

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

#### Scenario: Nested files in the flat list

- **WHEN** changed files live in several nested directories and the flat list is
  selected
- **THEN** every file is listed directly in its group's single-layer list in path
  order, with no collapsible folder rows

#### Scenario: Nested files in the tree

- **GIVEN** changed files live in several nested directories
- **WHEN** the user selects the tree view
- **THEN** each folder appears once above its contents with its expansion arrow,
  the files inside are one indentation level below that folder, and every file
  keeps its icon and status letter

#### Scenario: Merge conflict

- **WHEN** a merge leaves a tracked file conflicted
- **THEN** the file appears under merge conflicts with the conflicted status
  letter and its repository-relative path

#### Scenario: Conflict in a nested folder

- **WHEN** a conflicted file lives in a nested directory
- **THEN** merge conflicts lists the file in the selected view, in its folder
  row in the tree and showing its directory with its name in the flat list

### Requirement: Change list view mode

The Workspace header's view menu SHALL offer the flat list and the folder tree as
the change groups' file views, with the view in effect marked as the checked
choice and the other one offered for selection. The flat list SHALL be in effect when the panel opens.
Switching views SHALL apply to all three groups at once, SHALL NOT change which
group lists a file or a section's file count, SHALL NOT run Git, and SHALL NOT
open a diff. The selected view SHALL stay in effect while the panel remains
mounted, including across repository status refreshes, section collapsing and a
commit's details opening and closing; the panel SHALL show the flat list again
the next time it is opened.

#### Scenario: Switching to the tree

- **GIVEN** the change groups show their flat file lists
- **WHEN** the user chooses the tree view
- **THEN** every group renders its changed files as a folder tree, the tree view
  is the marked mode, and each group keeps its files and count

#### Scenario: Switching back to the flat list

- **GIVEN** the change groups show folder trees
- **WHEN** the user chooses the list view
- **THEN** every group renders its changed files as one flat path-sorted list
  again and no folder row remains

#### Scenario: The view survives a status refresh

- **GIVEN** the tree view is selected and a folder is collapsed
- **WHEN** the working tree changes and the panel refreshes its status
- **THEN** the tree view stays selected and the collapsed folder stays collapsed

#### Scenario: No Git operation from the view control

- **WHEN** the user switches between the flat list and the tree
- **THEN** no Git operation runs and no diff tab opens
