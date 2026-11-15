# git-sidebar delta

## ADDED Requirements

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

## MODIFIED Requirements

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
