# git-sidebar delta

## MODIFIED Requirements

### Requirement: Commit workflow

The panel SHALL accept a multi-line commit message and SHALL commit staged
changes only. It SHALL refuse to run any commit action when the message is
empty or only whitespace. When nothing is staged, Commit, Commit and Push, and
Commit and Sync SHALL each first ask whether to stage every change and commit
them together, while Commit (Amend) SHALL NOT stage anything on its own. After
a successful commit the panel SHALL clear the message and refresh the change
groups and history. A failed commit SHALL keep the message and the staged
changes, and SHALL show Git's error. When the working tree has no changes, the
checked-out branch tracks an upstream, and the branch is ahead of that upstream
by at least one commit, the panel SHALL replace the primary commit action with
a sync action that names the number of local commits ahead. That sync action
SHALL run Sync — pull by merging, then push — without a message, SHALL NOT
offer the commit modes beside it, and SHALL show its running state while it
runs. After it completes the panel SHALL refresh the change groups and the
history, and the action SHALL return to Commit as soon as the workspace has a
change again.

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

#### Scenario: A clean workspace with unpushed commits shows the sync action

- **GIVEN** the working tree has no changes and the checked-out branch tracks
  an upstream and is ahead of it by three commits
- **WHEN** the panel shows the commit box
- **THEN** its primary action names three local commits to sync, is available
  with an empty message, and offers no commit modes

#### Scenario: Syncing a clean workspace

- **WHEN** the user activates the sync action from the commit box
- **THEN** the panel runs Sync without committing anything, reports that the
  branch was synced, and refreshes the change groups and the history

#### Scenario: The commit action returns with the first change

- **WHEN** the workspace gains a change while the branch is still ahead of its
  upstream
- **THEN** the primary action is Commit again and needs a message

#### Scenario: A branch without an upstream keeps the commit action

- **GIVEN** the working tree has no changes and the checked-out branch tracks
  no upstream
- **WHEN** the panel shows the commit box
- **THEN** its primary action stays Commit
