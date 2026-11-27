# git-sidebar delta

## MODIFIED Requirements

### Requirement: Commit details

The panel SHALL show a commit's changed files, that commit's metadata, and a
way back to the change list when the user chooses the View Details action from
the commit row's context menu. The changed files SHALL carry their change
status letters and their repository-relative paths in a single-layer list with
no folder rows, sorted by path, and a renamed file SHALL show its original
path. Each changed file SHALL also show the Web application's own file-type
icon for its path before the file name, drawn as the application's workspace
explorer draws it, and SHALL show the plugin's plain document icon instead when
the application provides no such icon set. The metadata SHALL identify the
commit by its short identifier and show its subject, author, relative time, and
message body when present. Activating a changed file SHALL open that file's
diff for the commit. A commit that changed no files SHALL be presented as such
rather than as an empty list, a failed read SHALL be reported with a retry path,
and returning from the details view SHALL restore the change list and graph
without changing the repository. A View Details action for a commit that is no
longer listed SHALL be reported as stale instead of opening an empty view.

#### Scenario: Open a commit's details

- **WHEN** the user chooses View Details from a commit row's context menu
- **THEN** the panel shows that commit's short identifier, subject, author,
  relative time and changed files with their status letters and paths, and the
  change list is replaced until the user returns

#### Scenario: Activating the row does not open the details

- **WHEN** the user activates a commit row by pointer or keyboard
- **THEN** the commit's changes expand inline and the details view does not open

#### Scenario: A changed file shows its type icon

- **GIVEN** a commit changed a JavaScript file, a Markdown file and an image
- **WHEN** the user opens that commit's details
- **THEN** each file row shows the application's glyph for its path before the
  file name, while its status letter, name, dimmed directory and rename arrow
  keep their places

#### Scenario: The application provides no file-type icons

- **GIVEN** the application does not provide its file-type icon set
- **WHEN** the user opens a commit's details
- **THEN** every file row shows the plugin's plain document icon, the list still
  opens as usual, and its rows still open their diffs

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
