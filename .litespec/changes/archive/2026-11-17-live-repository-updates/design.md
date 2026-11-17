# Design: live repository updates

## Signal transport

The Host watches; the browser polls two counters. Neither side pushes events.

- `watch` (POST, `{ panel }`) subscribes or refreshes one panel and returns
  `{ watching, worktree, references }`. Counters are per repository, monotonic,
  and survive across panels of that repository.
- `unwatch` (`{ panel }`) releases the subscription. The route family, trust
  fence, Session resolution and repository-relative rule are unchanged: the
  browser sends a panel identity and never a repository path.

A counter poll costs one in-memory lookup, not a Git process. The alternative —
a long-lived server-sent-events stream — would have needed a new route and a
header or credential workaround, because `EventSource` cannot send the bundle
header `x-dsh-git-graph: 1`. Counters also survive a Host restart without
special-casing: an unknown panel simply asks to subscribe again.

A panel polls every 700 ms while visible and idle. The Host debounces a burst
for 600 ms, so an external change is normally visible within 1.3 seconds plus
the read; the requirement budget is two seconds.

## Watch set

Per repository, the registry opens three watchers:

1. the repository root, recursive, which reports working-tree edits including
   untracked files;
2. the absolute Git metadata directory (from `git rev-parse
   --absolute-git-dir`), non-recursive, which reports `HEAD`, `index`,
   `packed-refs`, configuration and operation markers;
3. the metadata directory's `refs` tree, recursive, because a non-recursive
   directory watcher does not see a file written below `refs/heads/`.

Linked worktrees resolve the real metadata directory in step 2, so their refs
and index are watched even though `.git` is only a pointer file. Events under
`.git` seen by watcher 1 are ignored; watcher 2 reports them with a precise
classification. Lock files (`*.lock`) are ignored, and `objects`, `logs`,
`info`, `hooks` and `worktrees` metadata entries are ignored: they accompany an
operation whose real entry changes. Unknown metadata entries count as reference
changes, which is the conservative choice — an extra reference read is cheap, a
missed one leaves stale colors.

The recursive root watcher also creates OS watches below `.git`; the plugin
filters those events but cannot exclude the directories from the recursive
watch API. This mirrors VS Code's recursive repository watcher and is bounded by
one watcher set per open repository.

## Lifecycle

Subscriptions are keyed by panel id. A repository keeps its watchers while at
least one panel is subscribed and closes them when the last one leaves, when the
Session directory resolves to a different repository, when the panel's
subscription lapses, or when the plugin unloads (`ctx.effect` disposer). A panel
that crashes leaves no `unwatch`: each subscription has a 15-second idle
deadline refreshed by every poll, so the last watcher is released at most one
deadline after the tab stops polling. Watchers and timers are non-persistent, so
they never keep the Host process alive on their own.

If any required watcher cannot start, or a watcher errors, the repository is
released and `watch` reports `watching: false`. The browser then keeps the old
5-second status poll as the fallback; no watcher failure is surfaced.

## Browser refresh scope

`useLiveUpdates` remembers the counters from its subscription and compares them
on every poll:

- **worktree moved** → `loadStatus({ silent: true })` only.
- **references moved** → `references` read, then `loadStatus`, then — only when
  the checked-out revision is not among the loaded commits — a newest-page
  `history` reload.
- **both** → the reference path (it refreshes the status too).

While an action, confirmation, or status read is in flight the baseline is not
advanced, so the change is retried after the panel is idle instead of dropped.

`GraphSection` now re-binds the three fixed-color references to the commits they
currently point at before laying the graph out (`bindReferenceTargets`). A
history read's decoration strings lag behind an external checkout or fetch; the
references read is current. Re-binding moves the checked-out, upstream and base
badges to the current targets and demotes a stale checked-out badge when `HEAD`
detaches, all without refetching commits or touching scroll position. Other
reference decorations remain as read until the next history load; the change
only promises the three references the graph colors specially.

## Deliberate limits

- No data is pushed over a new connection; the existing route family carries
  everything.
- No per-file Git command and no custom change detection: `git status` and the
  existing readers stay authoritative.
- No re-decoration of references beyond the checked-out, upstream and base
  ones, because that would need a second history read for the loaded rows.
- No persisted watcher state: a Host restart starts from an unsubscribed state
  and the next poll resubscribes.
