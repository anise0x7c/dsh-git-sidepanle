# git-sidebar delta

## MODIFIED Requirements

### Requirement: Commit workflow

The panel SHALL accept a multi-line commit message and SHALL commit staged changes only. It SHALL refuse to run any commit action when the message is empty or only whitespace. When nothing is staged, Commit, Commit and Push, and Commit and Sync SHALL each first ask whether to stage every change and commit them together, while Commit (Amend) SHALL NOT stage anything on its own. After a successful commit the panel SHALL clear the message and refresh the change groups and history. A failed commit SHALL keep the message and the staged changes, and SHALL show Git's error.

#### Scenario: Commit staged changes

- **WHEN** the user enters a message for staged changes and commits
- **THEN** a new commit contains exactly those staged changes, the message box clears, and the change groups refresh

#### Scenario: Nothing staged

- **WHEN** the user asks to commit while no changes are staged
- **THEN** the panel offers to stage all changes and commit, and only commits after the user confirms

#### Scenario: Nothing staged for a combined action

- **WHEN** the user chooses Commit and Sync while no changes are staged
- **THEN** the panel asks to stage every change first and only commits, pulls and pushes after the user confirms

#### Scenario: Empty message

- **WHEN** the message is empty or whitespace only
- **THEN** the commit action is unavailable

#### Scenario: Commit hook rejects

- **WHEN** a commit fails, for example because a hook or author identity rejects it
- **THEN** the panel shows the failure, keeps the message text, and keeps the staged files staged

## ADDED Requirements

### Requirement: Commit action menu

The panel SHALL render the commit action as a primary button that fills the width of the commit box, with a check icon and a separate expand control at its trailing edge. The expand control SHALL open a menu listing Commit, Commit (Amend), a separator, Commit and Push, and Commit and Sync, in that order. Choosing an entry SHALL run only the chosen sequence. The menu SHALL close when an action starts, when the user clicks outside it, or when the user presses Escape. Every entry SHALL be unavailable while the message is empty or an action is running, and Commit and Push and Commit and Sync SHALL also be unavailable when the current branch has no upstream, with the reason offered on hover.

#### Scenario: The commit button fills the row

- **WHEN** the panel shows the commit box with a non-empty message
- **THEN** the primary commit button spans the box width and the expand control sits at its trailing edge

#### Scenario: The menu lists the actions

- **WHEN** the user activates the expand control
- **THEN** the menu lists Commit, Commit (Amend), a separator, Commit and Push, and Commit and Sync in that order

#### Scenario: Escape closes the menu

- **WHEN** the menu is open and the user presses Escape
- **THEN** the menu closes and no Git command runs

#### Scenario: Amend replaces the tip commit

- **GIVEN** the current branch has at least one commit
- **WHEN** the user chooses Commit (Amend) with a message and staged changes
- **THEN** HEAD is replaced by a commit that carries the typed message and the staged changes, and the number of commits does not grow

#### Scenario: Amend without a commit is refused

- **GIVEN** the current branch has no commit yet
- **WHEN** the user chooses Commit (Amend)
- **THEN** the panel reports that there is no commit to amend and the repository is unchanged

#### Scenario: Commit and Push sends the new commit

- **GIVEN** the branch has an upstream and the user has staged changes
- **WHEN** the user chooses Commit and Push
- **THEN** the panel commits and then pushes, and the change groups and history refresh

#### Scenario: Commit and Sync pulls before it pushes

- **GIVEN** the branch has an upstream that can be merged
- **WHEN** the user chooses Commit and Sync
- **THEN** the panel commits, merges the upstream, and only then pushes

#### Scenario: A failed remote step keeps the commit

- **GIVEN** the push fails after the commit succeeded
- **WHEN** the user chooses Commit and Push
- **THEN** the panel reports the push failure, keeps the created commit, clears the message, and refreshes the change groups and history

#### Scenario: No upstream blocks the combined actions

- **GIVEN** the current branch has no upstream
- **WHEN** the user opens the commit action menu
- **THEN** Commit and Push and Commit and Sync are unavailable and explain that the branch has no upstream
