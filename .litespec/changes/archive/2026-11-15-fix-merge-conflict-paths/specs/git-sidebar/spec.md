# git-sidebar delta

## MODIFIED Requirements

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
