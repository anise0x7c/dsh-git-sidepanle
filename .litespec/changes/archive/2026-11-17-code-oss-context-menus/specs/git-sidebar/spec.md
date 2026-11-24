## ADDED Requirements

### Requirement: Commit graph context-menu structure

A commit row SHALL present actions in this order: a checkout submenu when the commit carries any local branch head, detached checkout, a separator, branch creation, a deletion submenu when it carries a deletable local branch head, a separator after the branch group, tag creation, a separator, full commit-hash copy, and commit-message copy. Submenus SHALL contain the available local branch heads at that commit, in name order, and SHALL NOT contain remote-tracking branches, tags, or HEAD markers. The current head MAY be disabled in the checkout submenu and SHALL NOT be offered for deletion. Menus and submenus SHALL use the application's shared native menu presentation and theme.

#### Scenario: Ordinary commit

- **WHEN** the user invokes the menu on a commit with no local branch heads
- **THEN** it offers detached checkout, create branch, create tag, copy commit hash and copy commit message, with the specified separators and no checkout or deletion submenu

#### Scenario: Branch-head commit

- **GIVEN** a commit carries local branches `feature` and `main` plus `origin/main`
- **WHEN** the user invokes its menu
- **THEN** native checkout and deletion submenus precede the create-branch and subsequent groups, and their entries contain only `feature` and `main` where applicable, never `origin/main`

#### Scenario: Opening a submenu has no side effects

- **WHEN** the user opens checkout or deletion choices but selects none
- **THEN** no Git command runs and the repository remains unchanged

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

## MODIFIED Requirements

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
