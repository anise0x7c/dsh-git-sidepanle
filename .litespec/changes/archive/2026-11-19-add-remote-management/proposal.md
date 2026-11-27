# Manage remotes and check out remote branches

## Why

The panel can synchronize with an existing upstream after `add-remote-sync`,
but it still cannot configure where that upstream lives, and its branch picker
lists only local branches. A user who clones a repository and wants to add a
fork, replace a dead remote, or start work on a colleague's remote branch must
still use a terminal.

## What Changes

- The overflow menu gains a Remote group. Add Remote asks for a name and URL,
  validates both, and writes the remote; Remove Remote lists the configured
  remotes, asks for confirmation, and removes the chosen one.
- The remotes list loads on demand and reports loading, empty and failure
  states. A failed or cancelled form leaves the repository unchanged, and a
  successful change refreshes the remotes, repository summary and graph.
- The branch picker lists remote-tracking branches in their own group, shown as
  the remote name and branch name separated by a slash (for example `origin/main`), excluding the symbolic remote `HEAD` pointer and keeping
  the current local branch marked.
- Picking a remote-tracking branch checks out a local branch with the same short
  name that tracks the selected remote branch. When a local branch of that name
  already exists, the panel checks out that local branch without changing its
  upstream.
- Add, remove and remote-branch checkout use the existing busy lock, localized
  success and failure feedback, and the existing refresh rules.

## Non-goals

- No remote rename, URL editing, or per-remote fetch/push URL editing beyond
  what Add Remote writes.
- No remote branch deletion, remote tag operations, force push, or push to a
  specific remote when an upstream already exists.
- No interactive credential prompt or credential storage.
- No storage of the remotes list across panel mounts; it is read from the
  repository on demand.
