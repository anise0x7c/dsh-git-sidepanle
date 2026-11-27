# git-sidebar delta

## ADDED Requirements

### Requirement: Commit graph paging

The panel SHALL show the newest commits first and SHALL make the remaining
reachable history available on demand, in pages of up to 60 commits. While
earlier commits remain, reaching the end of the graph pane SHALL load the next
page of earlier commits and append them below the rows already shown, without
replacing, reordering or scrolling away from those rows. Lines that ended at the
bottom of the graph because their commit had not been loaded yet SHALL connect
to their commits once a page adds them. When no earlier commits remain, the
graph SHALL NOT offer another page.

#### Scenario: Reaching the end loads the next page

- **GIVEN** the graph shows a page of commits and older commits exist
- **WHEN** the user scrolls the graph pane to its end
- **THEN** the next page of earlier commits is appended below the shown rows and
  the pane keeps its scroll position

#### Scenario: Swimlanes continue across pages

- **GIVEN** a line reaches the bottom of the graph because its commit is not
  loaded yet
- **WHEN** the page that contains that commit is appended
- **THEN** the line connects to the commit's node and the appended rows follow
  the same swimlane, node and color rules as the first page

#### Scenario: End of history

- **WHEN** the appended page contains the oldest reachable commit
- **THEN** the graph shows every reachable commit and offers no further page

#### Scenario: Manual load

- **GIVEN** earlier commits remain
- **WHEN** the user activates the load-earlier-commits control at the end of the
  graph
- **THEN** the next page is appended exactly as reaching the end of the pane
  loads it

#### Scenario: A failed page keeps the loaded rows

- **GIVEN** the graph shows commits and earlier commits remain
- **WHEN** loading the next page fails
- **THEN** the rows already shown stay visible, the end of the graph explains
  the failure, and activating retry loads that page again

#### Scenario: Refresh starts over

- **WHEN** the panel refreshes the history, including after a commit or a branch
  switch
- **THEN** the graph shows only the newest page again
