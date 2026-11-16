# git-sidebar delta

## MODIFIED Requirements

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
