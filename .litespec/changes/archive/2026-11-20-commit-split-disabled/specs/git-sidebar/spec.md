# git-sidebar delta

## MODIFIED Requirements

### Requirement: Commit action menu

The panel SHALL render the commit action as a primary button that fills the width of the commit box, with a check icon and a separate expand control at its trailing edge. The expand control SHALL open a menu listing Commit, Commit (Amend), a separator, Commit and Push, and Commit and Sync, in that order. Choosing an entry SHALL run only the chosen sequence. The menu SHALL close when an action starts, when the user clicks outside it, or when the user presses Escape. The commit button and the expand control SHALL share one disabled state: both SHALL be unavailable and use the disabled appearance while the message is empty or an action is running, and the menu SHALL NOT open then. Commit and Push and Commit and Sync SHALL also be unavailable when the current branch has no upstream, with the reason offered on hover while the menu is open.

#### Scenario: The commit button fills the row

- **WHEN** the panel shows the commit box with a non-empty message
- **THEN** the primary commit button spans the box width and the expand control sits at its trailing edge

#### Scenario: The menu lists the actions

- **GIVEN** the message is not empty
- **WHEN** the user activates the expand control
- **THEN** the menu lists Commit, Commit (Amend), a separator, Commit and Push, and Commit and Sync in that order

#### Scenario: An empty message disables both halves

- **WHEN** the message is empty or whitespace only
- **THEN** the commit button and the expand control are both unavailable and share the disabled appearance, and activating the expand control opens no menu

#### Scenario: A running action disables both halves

- **WHEN** a Git action is running
- **THEN** the commit button and the expand control are both unavailable and the menu is closed

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
