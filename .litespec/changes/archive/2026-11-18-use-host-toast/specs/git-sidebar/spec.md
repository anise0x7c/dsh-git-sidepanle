# git-sidebar delta

## ADDED Requirements

### Requirement: Shared transient feedback

The panel SHALL present its existing transient commit, ignore, reference-operation and menu-guard feedback through DSH's shared Toast when available, using the user's language and the host's placement, replacement and dismissal behavior instead of a private inline notice. Successful operations SHALL use success feedback; stale-target and busy refusals SHALL NOT be styled as successes. Unavailable or failing host notifications SHALL NOT prevent repository operations, message clearing, confirmation handling or refreshes. Git operation failures SHALL retain their existing inline or open-form feedback rather than reporting success.

#### Scenario: Commit staged changes

- **WHEN** a commit of staged changes succeeds
- **THEN** one shared success Toast confirms the commit with its returned short identifier, the message clears and the changes and graph refresh without inserting a notice into the panel layout

#### Scenario: Stage all and commit

- **WHEN** the user confirms staging all changes and the commit succeeds
- **THEN** one shared success Toast confirms the commit and the normal confirmation, message clearing and refresh behavior is preserved

#### Scenario: Ignore tracked and untracked files

- **WHEN** adding a working-change path to the repository's ignore rules succeeds
- **THEN** one shared success Toast confirms the action, still explaining when the file remains tracked, and the change list refreshes without an inline notice

#### Scenario: Reference operation succeeds

- **WHEN** detached checkout, branch creation or deletion, or tag creation succeeds
- **THEN** its existing localized confirmation appears once as a shared success Toast, the existing refresh and form-closing behavior is preserved and no private notice is inserted

#### Scenario: Stale menu target

- **WHEN** a selected menu action refers to a change that no longer exists
- **THEN** shared non-success feedback explains that the target is stale and no repository write runs

#### Scenario: Busy menu command

- **WHEN** a mutating menu command reaches a panel already running a repository operation
- **THEN** shared non-success feedback explains that the panel is busy and no second operation runs

#### Scenario: Failed repository operation

- **WHEN** a commit or ignore operation fails
- **THEN** no success Toast is emitted, the existing failure surface reports the error and a failed commit keeps its message

#### Scenario: Host notifications unavailable

- **WHEN** the host notification facility is absent or cannot deliver feedback and the user completes an otherwise valid inline commit
- **THEN** the commit still clears its message and refreshes changes and history without recreating a private notice or showing a notification failure as a Git error
