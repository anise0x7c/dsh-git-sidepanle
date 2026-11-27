# git-sidebar delta

## MODIFIED Requirements

### Requirement: Section headers stay pinned while scrolling

Each collapsible section header SHALL remain visible at the top edge of its
scrolling pane for as long as any part of its own section still reaches below
that edge. A header SHALL already rest at the pane's top edge in both its
normal and pinned positions, so beginning to scroll its pane SHALL NOT shift
the header; only the rows SHALL move beneath it. A pinned header SHALL paint
the host's opaque surface from the pane's top edge down, so the rows scrolling
beneath it are hidden and no part of a row is visible above or through the
header. A header SHALL show the host's hover highlight while the pointer is
over it, and the highlight SHALL stay inside the header's rounded corners. The
commit graph header SHALL instead highlight each of its controls separately —
the section toggle and each action control — without highlighting the surface
between them. At most one header SHALL be pinned at a time: while a header
is pinned, the next section's header SHALL keep its normal position until the
pinned header's section has left the top edge, and SHALL then take that place.
A pinned header SHALL keep its toggle, its count where it shows one, and its
context menu usable. A pane whose content fits without scrolling SHALL show
every header in its normal position.

#### Scenario: A group header stays while its rows scroll

- **GIVEN** the changes group is taller than its pane
- **WHEN** the user scrolls the change list down
- **THEN** the changes header stays at the top edge of that pane while its rows pass beneath it

#### Scenario: Scrolling does not shift the header

- **GIVEN** a change group is taller than its pane and the pane is at its top
- **WHEN** the user begins to scroll the pane
- **THEN** the group header stays flush at the pane's top edge from the first scrolled pixel, and only the rows move beneath it

#### Scenario: Rows do not show through a pinned header

- **WHEN** rows scroll under a pinned header
- **THEN** the header's opaque surface hides them

#### Scenario: Nothing shows above a pinned header

- **GIVEN** a group is taller than its pane
- **WHEN** the user scrolls so that a row crosses the top edge of the pane
- **THEN** the header's surface begins at the pane's top edge and no sliver of the row appears above the header

#### Scenario: Hovering a header highlights it

- **WHEN** the pointer moves over a section header, whether it is pinned or in its normal position
- **THEN** the header shows the host hover highlight over its surface and the rows beneath a pinned header stay hidden

#### Scenario: Hovering the graph header highlights one control

- **WHEN** the pointer moves over the commit graph header's toggle or one of its action controls
- **THEN** only that control shows the hover highlight, while the rest of the header surface keeps its background

#### Scenario: Only one header is pinned

- **GIVEN** a group header is pinned
- **WHEN** the user scrolls past that group's last row and the next group reaches the top edge
- **THEN** the previous header leaves with its group and only the next group's header is pinned

#### Scenario: The pinned header keeps its controls

- **WHEN** the user activates a pinned header's toggle or opens its context menu
- **THEN** the section collapses or expands as usual and the menu opens with that group's actions

#### Scenario: The graph pane pins its own header

- **WHEN** the user scrolls the graph pane
- **THEN** the graph header stays at that pane's top edge while the change pane keeps its own scroll position

#### Scenario: Short panes keep their headers in place

- **GIVEN** the change list fits in its pane without scrolling
- **WHEN** the panel is shown
- **THEN** every group header stays in its normal position

### Requirement: Remote synchronization actions

The panel SHALL offer Fetch, Pull, Pull (Rebase), Push, and Sync for the
current branch, and SHALL run only the action the user chooses. The commit
graph section header SHALL present Fetch, Pull and Push as icon controls, and
that header's overflow menu SHALL present Pull (Rebase), Sync, Publish Branch
when the branch has no upstream, and the Remote configuration group. Fetch SHALL
be labelled as fetching from every configured remote and SHALL use a dashed
twin-tail arrow, so it stays distinguishable from Pull's solid arrow. Fetch
SHALL remain available when HEAD is detached or the branch has no commits. Pull
and Push SHALL be unavailable when the current branch has no upstream. The
overflow menu SHALL NOT repeat Fetch, Pull or Push. Fetch SHALL update
remote-tracking branches from every configured remote and SHALL prune
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

#### Scenario: Fetch is distinguishable from Pull

- **WHEN** the commit graph section header is shown
- **THEN** the Fetch control names every configured remote and draws a dashed
  twin-tail arrow, while the Pull control draws a solid arrow

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

## REMOVED Requirements

### Requirement: Remote status control

The branch toolbar no longer carries a remote status control. Sync and Publish
Branch remain reachable from the commit graph header's overflow menu, and the
ahead and behind counts stay in the branch chip.
