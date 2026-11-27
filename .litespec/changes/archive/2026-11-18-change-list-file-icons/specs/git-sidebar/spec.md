# git-sidebar delta

## MODIFIED Requirements

### Requirement: Change overview

The panel SHALL list the repository's changes as three groups in Code OSS's
order: merge conflicts, staged changes, and changes not yet staged. Within a
group, every changed file SHALL appear as one row in a single-layer list with
no folder rows, sorted by its repository-relative path. Every row SHALL carry
the status letter identifying added, modified, deleted, renamed, untracked, or
conflicted state, the Web application's own file-type icon for that file's path
before the file name, drawn as the application's workspace explorer draws it,
and the file's repository-relative path. When the application provides no
file-type icon set, the row SHALL show the plugin's plain document icon
instead. A file with both staged and unstaged modifications SHALL appear in
both the staged and the unstaged group. A file that Git reports as conflicted
SHALL appear under merge conflicts with the conflicted status letter and SHALL
remain listed until the conflict is resolved.

#### Scenario: Partially staged file

- **WHEN** a tracked file has staged edits and further unstaged edits
- **THEN** the file appears under staged changes and again under changes not yet staged

#### Scenario: File type icons

- **GIVEN** a repository changed a JavaScript file, a stylesheet and an image
- **WHEN** the change lists are shown
- **THEN** every row shows the application's glyph for its path before the file
  name, its status letter and path stay in place, and the stage, unstage and
  discard controls keep their positions

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
