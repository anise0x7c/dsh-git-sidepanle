# Live repository updates

## Why

The panel learns about changes made outside DSH only from a fixed 5-second
`status` poll, and the commit graph reloads only after the panel's own writes
or a manual refresh. A branch switch, fetch, commit, or
`git checkout --detach` run in a terminal therefore leaves the branch header,
the change list, ahead/behind counts, and the graph's checked-out reference
stale until the user refreshes - while the panel is visible and supposed to be
trustworthy.

VS Code does not work this way. Its Git extension watches the repository's
working tree with the platform file watcher and the `.git` directory (HEAD,
index and packed references) with a second watcher, coalesces events with a
one-second debounce, skips status while another operation runs, and runs
`git status` only when the window is focused; the graph view refreshes when the
checked-out reference changes. The plugin's Host is the natural place to
provide the same event-driven freshness, because only the Host can watch the
repository and run Git.

## What Changes

- **Repository watching on the Host.** While a panel uses a repository, the
  Host watches its working tree and Git metadata (HEAD, index, refs and packed
  refs), coalesces a burst of changes into one update, and makes the change
  known to the panel. Watching starts with the first read and stops when the
  last panel closes or the plugin unloads.
- **Prompt external updates.** A file edit, `git add`, external commit, fetch,
  branch switch or checkout becomes visible without user action, within about
  two seconds of the change settling. The periodic status check is demoted to a
  fallback for when watching is unavailable.
- **Scoped refresh.** A working-tree or index change refreshes the repository
  summary and change list only: the commit graph keeps its loaded pages,
  scroll position and selection. A HEAD or reference change also refreshes the
  checked-out, upstream and base references, so the already loaded graph
  re-colors and re-badges in place; when the checked-out commit is not among
  the loaded rows, the newest graph page is reloaded so the new tip appears.
- **Bounded work.** Watching is per repository, shared by every panel of that
  repository, and released with the panel or plugin; a repository with no open
  panel is not watched and receives no watch-driven Git reads.

## Non-goals

- No change to staging, committing, discarding, diffing, checkout, paging or
  graph drawing rules; this change only decides when existing reads run.
- No new detached-HEAD color rule. The graph already follows VS Code when its
  references are current; this change only makes sure an external checkout,
  attached or detached, is read promptly.
- No Git hooks, no shell, and no changes to the guarded route paths or the
  trust fence. Whether the Host pushes updates over the existing route family
  or the panel polls a cheap revision is an implementation choice.
- No per-file Git commands and no custom change detection that replaces
  `git status`; the Host still asks Git for the authoritative status.
- No watching of repositories that no panel uses, and no watcher state
  persisted across plugin reloads.
- No change to failure copy: a watcher that cannot start is not shown as an
  error, because the periodic fallback still keeps the panel current.
