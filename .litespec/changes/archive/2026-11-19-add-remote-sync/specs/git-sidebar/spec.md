# git-sidebar delta

## ADDED Requirements

### Requirement: Remote synchronization actions

The panel SHALL offer Fetch, Pull, Pull (Rebase), Push, and Sync for the
current branch, and SHALL run only the action the user chooses. Fetch SHALL
update remote-tracking branches from every configured remote and SHALL prune
remote-tracking branches whose remote ref no longer exists. Pull SHALL
integrate the upstream into the current branch by merging, and Pull (Rebase)
SHALL integrate it by rebasing. Push SHALL send the current branch's commits to
its upstream. Sync SHALL pull by merging and then push, and when the pull fails
it SHALL NOT push.

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

### Requirement: Publish branch

When the current branch has commits and no upstream, the panel SHALL offer
Publish Branch. Publishing SHALL push the branch to a configured remote and
SHALL set that remote branch as its upstream. The panel SHALL prefer `origin`
when it exists, otherwise the first configured remote, SHALL ask the user to
choose when several remotes are configured, and SHALL report when no remote is
configured without changing the repository.

#### Scenario: Publish to the only remote

- **GIVEN** the current branch has no upstream and exactly one remote is configured
- **WHEN** the user chooses Publish Branch
- **THEN** the branch is pushed to that remote, its upstream is set, and the
  refreshed header shows the tracking branch

#### Scenario: Choose among several remotes

- **GIVEN** the current branch has no upstream and several remotes are configured
- **WHEN** the user chooses Publish Branch
- **THEN** the panel asks which remote to publish to before running Git

#### Scenario: No remotes configured

- **GIVEN** the current branch has no upstream and no remote is configured
- **WHEN** the user chooses Publish Branch
- **THEN** the panel reports that a remote must be added and does not run a
  network operation

#### Scenario: Detached or unborn branch

- **WHEN** HEAD is detached or the branch has no commits
- **THEN** Publish Branch is unavailable and no network operation runs

### Requirement: Remote status control

The toolbar SHALL provide one remote control for the current branch. When the
branch has an upstream, activating the control SHALL sync it; when the branch
has no upstream, activating the control SHALL publish it. The control SHALL be
disabled while another Git operation runs and SHALL not act when there is no
repository, HEAD is detached, or the branch has no commits. The existing ahead
and behind counts SHALL remain visible alongside it.

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

### Requirement: Remote operation feedback and refresh

A successful remote operation SHALL show a localized success message and SHALL
refresh the repository summary and commit graph. A failed remote operation
SHALL be reported in the existing inline failure presentation, SHALL NOT show
a success message, and SHALL also refresh the repository summary so conflicts
or partially fetched refs become visible. The panel SHALL run only one remote
operation at a time, SHALL keep an open publish form's entered remote and
failure visible after a failure, and SHALL close the form after success.

#### Scenario: Successful sync is reported

- **WHEN** a Sync succeeds
- **THEN** a localized success message is shown and the header, change list and
  graph reflect the synchronized state

#### Scenario: Failed pull keeps the repository readable

- **GIVEN** a pull stops with a merge conflict
- **WHEN** the failure is reported
- **THEN** the change list refreshes and lists the conflicted files, and no
  success message is shown

#### Scenario: One remote operation at a time

- **WHEN** a remote operation is running
- **THEN** remote actions and other repository writes are unavailable until it
  finishes

### Requirement: Non-interactive remote execution

The Host MUST execute remote operations in the Session's repository without a
shell, MUST NOT accept a repository path from the browser, MUST validate every
remote name and URL before using it as a Git argument, and MUST NOT wait
indefinitely for an interactive credential prompt. It MUST disable the
terminal prompts Git controls and MUST bound every remote command. A remote
operation that exceeds the Host's time bound MUST fail with a reported timeout
instead of remaining pending. Adding a remote URL SHALL be treated as
user-authorized repository configuration; Git's configured transports,
credential helpers and hooks remain part of the local trust boundary.

#### Scenario: Option-like input is rejected

- **WHEN** a request supplies a remote name or URL that begins with a dash or
  is otherwise not a valid remote name or URL
- **THEN** the Host rejects the request before running Git and the repository
  is unchanged

#### Scenario: Credentials are unavailable

- **GIVEN** a remote requires an interactive credential that the Host cannot obtain
- **WHEN** the user fetches, pulls, or pushes
- **THEN** the operation ends with Git's message or the Host's timeout error
  instead of waiting indefinitely for input

#### Scenario: A remote operation times out

- **GIVEN** a remote operation runs longer than the Host allows
- **WHEN** the bound is reached
- **THEN** the Host stops the Git process and reports a timeout failure
