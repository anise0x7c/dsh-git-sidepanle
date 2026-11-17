# Git Sidebar delta

## ADDED Requirements

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
