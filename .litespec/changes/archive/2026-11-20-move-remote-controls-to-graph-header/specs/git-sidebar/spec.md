# git-sidebar delta

## MODIFIED Requirements

### Requirement: Remote synchronization actions

The panel SHALL offer Fetch, Pull, Pull (Rebase), Push, and Sync for the
current branch, and SHALL run only the action the user chooses. The commit
graph section header SHALL present Fetch, Pull and Push as icon controls, and
that header's overflow menu SHALL present Pull (Rebase), Sync, Publish Branch
when the branch has no upstream, and the Remote configuration group. Fetch SHALL
remain available when HEAD is detached or the branch has no commits. Pull and
Push SHALL be unavailable when the current branch has no upstream. The overflow
menu SHALL NOT repeat Fetch, Pull or Push. Fetch SHALL update remote-tracking
branches from every configured remote and SHALL prune remote-tracking branches
whose remote ref no longer exists. Pull SHALL integrate the upstream into the
current branch by merging, and Pull (Rebase) SHALL integrate it by rebasing.
Push SHALL send the current branch's commits to its upstream. Sync SHALL pull
by merging and then push, and when the pull fails it SHALL NOT push.

#### Scenario: Fetch updates remote-tracking state

- **GIVEN** a remote has new commits that the local repository has not fetched
- **WHEN** the user chooses Fetch
- **THEN** the fetched remote-tracking branches update and the refreshed header
  shows the new ahead or behind counts

#### Scenario: Pull merges the upstream

- **GIVEN** the current branch has an upstream with commits not yet local
- **WHEN** the user chooses Pull
- **THEN** the upstream is merged into the current branch and the change list,
  branch summary and graph refresh

#### Scenario: Pull with rebase replays local commits

- **GIVEN** the current branch has an upstream and local commits
- **WHEN** the user chooses Pull (Rebase)
- **THEN** Git rebases the local commits onto the upstream and the refreshed
  graph shows the replayed commits

#### Scenario: Push sends local commits

- **GIVEN** the current branch tracks an upstream and is ahead of it
- **WHEN** the user chooses Push
- **THEN** the local commits reach the upstream and the refreshed header no
  longer reports them as ahead

#### Scenario: Sync pulls before it pushes

- **WHEN** the user chooses Sync on a branch whose upstream can be merged
- **THEN** the panel pulls first and pushes only after the pull succeeds

#### Scenario: A failed pull stops Sync

- **GIVEN** a pull from the upstream fails
- **WHEN** the user chooses Sync
- **THEN** the panel reports the pull failure and does not push

#### Scenario: Commit graph header runs one action

- **GIVEN** the current branch tracks an upstream
- **WHEN** the user activates the Fetch, Pull or Push control in the commit
  graph section header
- **THEN** only that action runs, and on success the repository summary and
  commit graph refresh

#### Scenario: No upstream disables Pull and Push

- **GIVEN** the current branch has no upstream
- **WHEN** the commit graph section header is shown
- **THEN** Pull and Push are unavailable, and Publish Branch is offered in the
  header's overflow menu

#### Scenario: Detached HEAD can still fetch

- **GIVEN** HEAD is detached or the branch has no commits
- **WHEN** the user activates Fetch in the commit graph section header
- **THEN** the remote-tracking branches update

#### Scenario: Overflow menu does not duplicate header actions

- **WHEN** the commit graph section header's overflow menu is open
- **THEN** it lists Pull (Rebase), Sync and the Remote group, and does not list
  Fetch, Pull or Push

### Requirement: Remote status control

The toolbar SHALL provide one remote status control for the current branch,
separate from the commit graph section header's Fetch, Pull and Push controls.
When the branch has an upstream, activating the control SHALL sync it; when the
branch has no upstream, activating the control SHALL publish it. The control
SHALL be disabled while another Git operation runs and SHALL not act when there
is no repository, HEAD is detached, or the branch has no commits. The existing
ahead and behind counts SHALL remain visible alongside it.

#### Scenario: Sync from the status control

- **GIVEN** the current branch tracks an upstream
- **WHEN** the user activates the remote status control
- **THEN** the panel syncs the branch, with the control showing that the
  operation is running

#### Scenario: Publish from the status control

- **GIVEN** the current branch has no upstream
- **WHEN** the user activates the remote status control
- **THEN** the panel starts the same publish flow as Publish Branch

#### Scenario: No usable branch

- **WHEN** there is no repository, HEAD is detached, or the branch has no commits
- **THEN** the remote status control is unavailable and runs no Git command
