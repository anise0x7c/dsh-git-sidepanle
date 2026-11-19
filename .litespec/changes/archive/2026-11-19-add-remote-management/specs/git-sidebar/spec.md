# git-sidebar delta

## ADDED Requirements

### Requirement: Remote configuration

The panel SHALL list the repository's configured remotes and SHALL offer Add
Remote and Remove Remote. Add Remote SHALL require a name and a URL, SHALL
reject an empty, malformed, or duplicate name and an empty or malformed URL
without changing the repository, and SHALL configure the remote on success.
Remove Remote SHALL require confirmation, SHALL remove only the chosen
configured remote, and SHALL report a failure without pretending the remote was
removed. Cancelling either form SHALL run no Git command.

#### Scenario: Add a remote

- **WHEN** the user enters a valid name and URL and submits Add Remote
- **THEN** the remote is configured, the remotes list refreshes, and a localized
  success message names it

#### Scenario: Invalid remote input

- **WHEN** the name or URL is empty, starts with a dash, or is not valid for Git
- **THEN** the form reports the problem, keeps the entered text, and the
  repository configuration is unchanged

#### Scenario: Remove a remote

- **GIVEN** the repository has a configured remote
- **WHEN** the user chooses it in Remove Remote and confirms
- **THEN** the remote and its remote-tracking branches are removed and the
  branch summary refreshes

#### Scenario: Removing a remote fails

- **WHEN** Git refuses to remove the chosen remote
- **THEN** the panel reports Git's message and the remote list refreshes from the
  repository

#### Scenario: Cancel a remote form

- **WHEN** the user cancels Add Remote or Remove Remote
- **THEN** no Git command runs and the repository is unchanged

### Requirement: Remote branch listing

The branch picker SHALL list remote-tracking branches in a group separate from
local branches, SHALL show each as the remote name and branch name separated by a slash (for example `origin/main`) with its remote and
branch parts, and SHALL exclude symbolic remote `HEAD` pointers. The current
local branch SHALL remain marked, and the local and remote groups SHALL report
loading, failure and empty states without hiding the other group.

#### Scenario: Remote branches appear separately

- **GIVEN** the repository has local branches and remote-tracking branches
- **WHEN** the user opens the branch picker
- **THEN** local branches are listed first and remote-tracking branches follow
  under their own heading, each named the remote name and branch name separated by a slash (for example `origin/main`)

#### Scenario: Remote HEAD pointer is not a branch

- **GIVEN** a remote publishes a symbolic `HEAD` pointer
- **WHEN** the branch picker lists remote-tracking branches
- **THEN** the pointer is not listed as a selectable branch

#### Scenario: Branch list failure

- **WHEN** the branch list cannot be read
- **THEN** the picker reports the failure with a retry and the panel remains
  usable

### Requirement: Remote branch checkout

Selecting a remote-tracking branch SHALL check out a local branch with the same
short name. When that local branch does not exist, the panel SHALL create it
with the selected remote branch as its upstream. When it already exists, the
panel SHALL check out the existing local branch and SHALL leave its upstream
unchanged. A failed checkout SHALL be reported and SHALL leave the previously
checked-out branch in effect. A successful checkout SHALL refresh the branch
summary and graph.

#### Scenario: Create a tracking branch from a remote branch

- **GIVEN** no local branch has the remote branch's short name
- **WHEN** the user picks that remote branch
- **THEN** a local branch is created, checked out, and set to track the selected
  remote branch

#### Scenario: A local branch already exists

- **GIVEN** a local branch with the remote branch's short name exists
- **WHEN** the user picks the remote branch
- **THEN** the existing local branch is checked out and its upstream is
  unchanged

#### Scenario: Checkout is rejected

- **WHEN** Git refuses to check out the selected remote branch
- **THEN** the panel reports Git's message and the previous branch stays checked
  out

### Requirement: Remote management feedback and refresh

A successful remote configuration change or remote-branch checkout SHALL show
localized success feedback and SHALL refresh the remotes list, repository
summary and commit graph as applicable. A failure SHALL be reported in the
existing inline failure presentation or the open form, SHALL keep the form's
entered values, and SHALL NOT show success feedback. Remote management SHALL
run only one Git operation at a time and SHALL be unavailable while another
operation runs.

#### Scenario: Success refreshes the panel

- **WHEN** adding a remote, removing a remote, or checking out a remote branch
  succeeds
- **THEN** the affected lists, branch summary and graph reflect the new state
  and a localized success message is shown

#### Scenario: Failure keeps the form usable

- **WHEN** adding a remote fails
- **THEN** the error appears inside the open form, the entered name and URL stay
  editable, and no success message is shown

#### Scenario: Busy panel

- **WHEN** another Git operation is running
- **THEN** remote management and remote-branch checkout are unavailable
