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
without changing the repository. The details view SHALL open as a card above
the panel's content, with its own separating border and a translucent,
backdrop-blurred theme surface with a readable solid fallback where filtering
is unavailable, so the change list, graph and commit box stay mounted beneath
it and are already in place when the card leaves. The card SHALL slide in from the
panel's right edge when it opens and SHALL slide back out to that edge, and the
content beneath it SHALL accept no pointer or keyboard input while the card is
present. Pressing Escape in the Git panel while the card is open SHALL dismiss it
through the same transition as the back control, without running Git or
changing the repository; an open operation prompt or branch menu SHALL keep
priority for Escape instead. A View Details action for a commit that is no longer listed
SHALL be reported as stale instead of opening an empty view. When the system
asks for reduced motion the card SHALL appear and leave at its final position
without moving.

#### Scenario: Open a commit's details

- **WHEN** the user chooses View Details from a commit row's context menu
- **THEN** the panel shows that commit's short identifier, subject, author,
  relative time and changed files with their status letters and paths, as a
  card above the change list and graph, which stay mounted beneath it

#### Scenario: The card matches the operation prompt's material

- **GIVEN** the details card is open
- **WHEN** the browser can filter the background behind the card
- **THEN** the card uses the same translucent menu surface and backdrop blur as
  the bottom operation prompt, with its separating border and no shadow

#### Scenario: Frosting unavailable

- **WHEN** the browser cannot filter the background behind the card
- **THEN** the card remains readable on the solid theme surface

#### Scenario: The content beneath the card stays in place

- **GIVEN** the user has scrolled the change list or graph and chosen a split ratio
- **WHEN** the user opens a commit's details
- **THEN** the change list, graph and commit box remain mounted beneath the card
  with that split ratio and those scroll positions, and the content is already
  in place while the card arrives

#### Scenario: The content beneath accepts no input

- **WHEN** the details card is open or sliding away
- **THEN** the change list, graph and commit box beneath it accept no pointer or
  keyboard input and are hidden from assistive technology

#### Scenario: Escape closes the details

- **GIVEN** a commit's details are open, the Git panel has keyboard focus, and no
  operation prompt or branch menu is open
- **WHEN** the user presses Escape
- **THEN** the card slides back out to the right edge like the back control,
  reveals the content beneath it, and no Git command runs

#### Scenario: Escape keeps the surface that owns it

- **GIVEN** a commit's details are open and an operation prompt or the branch menu is open
- **WHEN** the user presses Escape
- **THEN** that prompt or menu is dismissed and the details card stays open

#### Scenario: Escape without details

- **WHEN** the details view is closed and the user presses Escape in the Git panel
- **THEN** no details view opens and existing Escape behavior elsewhere is unchanged

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
- **THEN** the card travels towards the right edge and reveals the change list
  and graph already in place beneath it, with the repository unchanged, the same
  split ratio, the same scroll positions and the same commits expanded as before

#### Scenario: Details arrive from the right edge

- **WHEN** the details view opens for a commit
- **THEN** it starts out beyond the panel's right edge and moves leftwards into
  place above the content instead of appearing where it will stay

#### Scenario: Reduced motion keeps the details still

- **WHEN** the system asks for reduced motion and the user opens a commit's
  details and then returns
- **THEN** the card appears and leaves at its final position without moving, and
  the change list and graph stay in place beneath it

#### Scenario: Stale View Details

- **WHEN** a View Details action arrives for a commit the graph no longer lists
- **THEN** the panel reports a stale target and keeps showing the change list
  and graph

