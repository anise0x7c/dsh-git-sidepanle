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
without changing the repository. The details view SHALL slide in from the
panel's right edge when it opens and SHALL slide back out to that edge before
the change list returns. A View Details action for a commit that is no longer
listed SHALL be reported as stale instead of opening an empty view. When the
system asks for reduced motion so the view SHALL appear and leave at its final
position without moving.

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
- **WHEN** the user opens that commit's details
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
- **THEN** the details view travels towards the right edge and the change list
  and graph are shown again with the repository unchanged and with the same
  commits expanded as before

#### Scenario: Details arrive from the right edge

- **WHEN** the details view opens for a commit
- **THEN** it starts out beyond the panel's right edge and moves leftwards into
  place instead of appearing where it will stay

#### Scenario: Reduced motion keeps the details still

- **WHEN** the system asks for reduced motion and the user opens a commit's
  details and then returns
- **THEN** the details view appears and leaves at its final position without
  moving, and the change list still returns

#### Scenario: Stale View Details

- **WHEN** a View Details action arrives for a commit the graph no longer lists
- **THEN** the panel reports a stale target and keeps showing the change list
  and graph

### Requirement: Floating operation panels

The panel SHALL present discard confirmations, stage-all-and-commit
confirmation, reference naming and branch deletion in a consistent rounded
bottom-anchored floating surface within the Git panel, without changing the
change-list or graph pane geometry or split ratio. The surface SHALL use the
host theme's colors, typography, borders, controls and focus treatment, with
translucency and backdrop blur where supported and a readable solid fallback
otherwise. The surface SHALL rise into place from the panel's bottom edge when
it opens and SHALL lower out of the panel before it is removed when it is
dismissed, and it SHALL accept no input while it leaves. Only one operation
prompt SHALL be visible at a time; requesting another idle prompt SHALL replace
the previous one without executing it. When the system asks for reduced motion
the surface SHALL appear and disappear at its final position without moving.

#### Scenario: Confirm without resizing the lists

- **GIVEN** the change list and graph are visible at a user-selected split ratio
- **WHEN** the user opens a discard confirmation
- **THEN** a rounded frosted card rises from the pane's bottom edge and settles
  above the bottom of the panel while the panes and their split ratio retain
  their geometry

#### Scenario: Reuse for reference forms

- **WHEN** the user creates a branch or tag, deletes a branch, or confirms staging all changes before committing
- **THEN** the same floating surface and content/action hierarchy are used with the appropriate fields and controls

#### Scenario: Replace an idle prompt

- **GIVEN** an operation prompt is open but has not been submitted
- **WHEN** the user requests a different operation prompt
- **THEN** only the new prompt remains and no repository command runs for the replaced prompt

#### Scenario: Backdrop filtering unavailable

- **WHEN** the browser cannot filter the background behind the floating surface
- **THEN** the surface remains readable on a solid theme-derived background

#### Scenario: A dismissed prompt leaves the pane

- **WHEN** the user cancels an idle prompt
- **THEN** the card moves down out of the pane before it is removed, it accepts
  no further input on the way out, and no Git command runs

#### Scenario: Reduced motion keeps the prompt in place

- **WHEN** the system asks for reduced motion and the user opens and dismisses an
  operation prompt
- **THEN** the card appears and disappears at its final position without moving
