# Lazy-load earlier commits in the commit graph

## Why
The commit graph reads only the 60 newest commits, so anything older is
unreachable from the panel: a user who wants to find an older commit hits a hard
end with no way forward. Loading the whole history up front would fix
reachability at the cost of a large first read on repositories with long history
and a graph that grows without bound. The graph needs a small first read that
can be extended on demand.

## What Changes
- **First page:** opening the panel keeps today's behavior — the 60 newest
  commits across local branches, tags and remote-tracking branches in
  topological order.
- **Earlier pages:** while older commits exist, reaching the end of the graph
  pane loads the next 60 commits and appends them below the rows already shown.
  The shown rows stay in place and keep their scroll position; lines that ran to
  the bottom of the graph because their parent was not loaded yet connect to
  their commits once the page that holds them arrives.
- **End of history:** when the last page arrives, no further page is offered.
- **Paging controls:** the end of the graph shows a "Load earlier commits"
  control while older commits remain, a loading note while a page is on its
  way, and a failure note with retry when a page cannot be read. Loaded rows
  stay visible when a page fails.
- **Refresh:** the panel's refresh, including the one after a commit or a branch
  switch, starts over from the newest page.
- **Host:** the history operation takes an offset and reports whether earlier
  commits remain; the repository is still resolved from the Session, and the
  browser still never sends a repository path.

This reverses the previous change's explicit non-goal ("no load more paging; the
window stays at the most recent 60 commits").

## Non-goals
- No unbounded auto-loading: one page is loaded per end-of-pane arrival, so the
  user always sees the appended rows before another page can start.
- No change to the revision set being paged: local branches, tags and
  remote-tracking branches stay the "All" filter, and no branch/author/date
  filtering or jump-to-commit is added.
- No change to commit details, diffs, staging, committing, menus or branch
  switching.
