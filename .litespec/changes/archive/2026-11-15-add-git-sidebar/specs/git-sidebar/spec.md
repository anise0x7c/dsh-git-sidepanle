# git-sidebar delta

## Purpose
Give Web GUI users a VS Code-style source-control surface for the Session's workspace: review changes, stage and commit them, inspect diffs, and follow branch history without leaving DSH.

## ADDED Requirements

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
The panel SHALL list the repository's changes as three groups in VS Code's order: merge conflicts, staged changes, and changes not yet staged. Every entry SHALL carry a status letter identifying added, modified, deleted, renamed, untracked, or conflicted state, and entries SHALL be arranged in a folder tree whose folders collapse and expand. A file with both staged and unstaged modifications SHALL appear in both the staged and the unstaged group.

#### Scenario: Partially staged file
- **WHEN** a tracked file has staged edits and further unstaged edits
- **THEN** the file appears under staged changes and again under changes not yet staged

#### Scenario: Nested files
- **WHEN** changed files live in several nested directories
- **THEN** the panel groups them under collapsible folder rows that preserve their relative paths

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
The panel SHALL open a unified diff for any listed file in a right-Sidebar tab. A staged entry SHALL show the difference between the index and the committed version; an unstaged entry SHALL show the difference between the working tree and the index; an untracked entry SHALL show its content as added lines. The diff SHALL show line numbers, added and removed markers, and the file's path with rename information when present. Binary and over-large files SHALL be identified instead of rendering undecodable content. Opening a second file SHALL reuse the open diff tab and show the new file.

#### Scenario: Unstaged diff
- **WHEN** the user opens an unstaged file
- **THEN** a diff tab shows its working-tree changes against the index with added and removed lines marked

#### Scenario: Untracked file
- **WHEN** the user opens an untracked file
- **THEN** its whole content appears as added lines

#### Scenario: Reuse the diff tab
- **WHEN** a diff tab is open and the user opens another changed file
- **THEN** the same tab updates to the newly chosen file rather than opening a second diff tab

#### Scenario: Binary file
- **WHEN** the user opens a changed binary file
- **THEN** the diff tab states that the content cannot be shown as text

### Requirement: Commit graph and branch switching
The panel SHALL show recent commits reachable from the repository's branches, with graph lines, ref labels for HEAD, branches, and tags, the commit subject, author, and relative time. It SHALL let the user switch to another local branch, mark the current branch, and refresh the panel after a successful switch. A failed switch SHALL be reported and SHALL leave the current branch in effect.

#### Scenario: Graph reflects branches
- **WHEN** the repository has commits on the checked-out branch and another local branch
- **THEN** the graph section lists those commits with graph lines and labels the checked-out branch

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
Git commands SHALL run on the Host in the Session's working directory, and the panel SHALL only transmit structured status and results between the browser and the Host. The panel SHALL use the host's theme tokens so it follows light and dark themes, and its visible text SHALL follow the user's language, providing English and Chinese copy.

#### Scenario: Theme follows the application
- **WHEN** the application switches between light and dark themes
- **THEN** the panel's surfaces, text, and diff colors update with the host theme without reloading the tab

#### Scenario: Chinese interface
- **WHEN** the application language is Chinese
- **THEN** the panel's controls, messages, and empty states are shown in Chinese
