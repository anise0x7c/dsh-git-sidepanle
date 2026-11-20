# git-sidebar delta

## MODIFIED Requirements

### Requirement: Shared transient feedback

The panel SHALL present every success and failure notification through DSH's
native Toast when available, using the user's language and the host's
placement, replacement and dismissal behavior instead of a private inline
notice or banner. Successful operations SHALL use the Toast's native success
presentation and its check icon; failures SHALL use the warning icon so the
message type is distinguishable at a glance. A failure the user can retry
SHALL offer one localized retry action on the Toast, and choosing it SHALL
dismiss the notice before the retry runs. The notification SHALL NOT insert a
notice into the panel layout, move the change list or graph, or resize the
split. Stale-target and busy refusals SHALL NOT be styled as successes.
Unavailable or failing host notifications SHALL NOT prevent repository
operations, message clearing, confirmation handling or refreshes, and SHALL NOT
be reported as Git failures.

#### Scenario: Commit staged changes

- **WHEN** a commit of staged changes succeeds
- **THEN** one native success Toast confirms the commit with its returned short
  identifier, the message clears and the changes and graph refresh without
  inserting a notice into the panel layout

#### Scenario: Stage all and commit

- **WHEN** the user confirms staging all changes and the commit succeeds
- **THEN** one native success Toast confirms the commit and the normal
  confirmation, message clearing and refresh behavior is preserved

#### Scenario: Ignore tracked and untracked files

- **WHEN** adding a working-change path to the repository's ignore rules succeeds
- **THEN** one native success Toast confirms the action, still explaining when
  the file remains tracked, and the change list refreshes without an inline
  notice

#### Scenario: Reference operation succeeds

- **WHEN** detached checkout, branch creation or deletion, or tag creation succeeds
- **THEN** its existing localized confirmation appears once as a native success
  Toast, the existing refresh and form-closing behavior is preserved and no
  private notice is inserted

#### Scenario: Stale menu target

- **WHEN** a selected menu action refers to a change that no longer exists
- **THEN** a non-success Toast with the warning icon explains that the target is
  stale and no repository write runs

#### Scenario: Busy menu command

- **WHEN** a mutating menu command reaches a panel already running a repository operation
- **THEN** a non-success Toast with the warning icon explains that the panel is
  busy and no second operation runs

#### Scenario: Failed repository operation

- **WHEN** a commit, ignore, reference or remote operation fails
- **THEN** one non-success Toast with the warning icon and Git's message appears,
  no success Toast is emitted, and a failed commit keeps its message and staged
  files

#### Scenario: Retryable read failure

- **WHEN** a status, history, commit-details or diff read fails
- **THEN** one non-success Toast with the warning icon and the failure text
  appears with a localized retry action, the panel keeps its current layout and
  scroll positions, and choosing retry dismisses the notice and runs the read
  again

#### Scenario: Failure remains reachable after the Toast fades

- **WHEN** the graph, commit-details or diff pane fails to load
- **THEN** the pane keeps a compact failed state with a retry control while the
  Toast supplies the failure text, and the retry control runs the read again

#### Scenario: A later notice replaces the earlier one

- **GIVEN** one notification is showing
- **WHEN** another success or failure notification is delivered
- **THEN** the new notice replaces the earlier one with the host's own
  transition instead of stacking or duplicating it

#### Scenario: Open form keeps its values on failure

- **WHEN** a remote or reference operation submitted from an open form fails
- **THEN** the failure appears as a non-success Toast and the form stays open
  with its entered values and logical focus

#### Scenario: Host notifications unavailable

- **WHEN** the host's native Toast component and the shared notification
  service are both absent or cannot deliver feedback and the user completes an
  otherwise valid inline commit
- **THEN** the commit still clears its message and refreshes changes and history
  without recreating a private notice or showing a notification failure as a
  Git error

### Requirement: Freshness and failures

The panel SHALL load on open, refresh after every completed operation, and
refresh on demand. While the tab is visible, changes made outside DSH SHALL
appear without user action as they settle: the Host SHALL detect repository
changes and make them known to the panel, and a periodic check SHALL remain
only as a fallback where change detection is unavailable. It SHALL report Git
failures through the shared notification with a retry action while keeping the
last loaded content and the pane's geometry, and a missing Git executable SHALL
be explained as such.

#### Scenario: External change

- **WHEN** a file changes outside DSH while the panel is visible
- **THEN** the change appears without any user action within two seconds

#### Scenario: Manual refresh

- **WHEN** the user activates the refresh control
- **THEN** the panel re-reads the repository status and history

#### Scenario: Git unavailable

- **WHEN** the Git executable is missing
- **THEN** the panel explains that Git could not be run and offers retry

#### Scenario: Change detection unavailable

- **WHEN** the Host cannot watch the repository's files
- **THEN** external changes still appear after the periodic check and no
  watcher failure is shown to the user

#### Scenario: Failed refresh keeps the loaded content

- **WHEN** a refresh of an already loaded repository fails
- **THEN** the failure appears as a non-success Toast with a retry action, the
  last loaded change list and graph stay in place, and retrying clears the
  failure when the next read succeeds

### Requirement: Remote operation feedback and refresh

A successful remote operation SHALL show a localized success message and SHALL
refresh the repository summary and commit graph. A failed remote operation
SHALL be reported through the shared notification with the warning icon, SHALL
NOT show a success message, and SHALL also refresh the repository summary so
conflicts or partially fetched refs become visible. The panel SHALL run only
one remote operation at a time, SHALL keep an open publish form's entered
remote and values after a failure, and SHALL close the form after success.

#### Scenario: Successful sync is reported

- **WHEN** a Sync succeeds
- **THEN** a localized success message is shown and the header, change list and
  graph reflect the synchronized state

#### Scenario: Failed pull keeps the repository readable

- **GIVEN** a pull stops with a merge conflict
- **WHEN** the failure is reported
- **THEN** the change list refreshes and lists the conflicted files, and no
  success message is shown

#### Scenario: Failed publish keeps the form usable

- **WHEN** publishing the current branch fails
- **THEN** the failure appears as a non-success Toast, the open form keeps its
  entered remote and stays open for correction, and no success message is shown

#### Scenario: One remote operation at a time

- **WHEN** a remote operation is running
- **THEN** remote actions and other repository writes are unavailable until it
  finishes

### Requirement: Remote management feedback and refresh

A successful remote configuration change or remote-branch checkout SHALL show
localized success feedback and SHALL refresh the remotes list, repository
summary and commit graph as applicable. A failure SHALL be reported through the
shared notification with the warning icon, SHALL keep the form's entered
values, and SHALL NOT show success feedback. Remote management SHALL run only
one Git operation at a time and SHALL be unavailable while another operation
runs.

#### Scenario: Success refreshes the panel

- **WHEN** adding a remote, removing a remote, or checking out a remote branch
  succeeds
- **THEN** the affected lists, branch summary and graph reflect the new state
  and a localized success message is shown

#### Scenario: Failure keeps the form usable

- **WHEN** adding a remote fails
- **THEN** the failure appears as a non-success Toast, the entered name and URL
  stay editable, and no success message is shown

#### Scenario: Busy panel

- **WHEN** another Git operation is running
- **THEN** remote management and remote-branch checkout are unavailable
