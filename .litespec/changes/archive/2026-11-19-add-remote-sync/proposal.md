# Add remote synchronization and publish

## Why

The Git panel can review, stage, commit, switch local branches, and read
history, but it cannot move commits between the repository and its remotes.
Users must leave the Web GUI and run `git fetch`, `git pull`, or `git push` in
a terminal to see and publish remote work. Code OSS's Source Control view keeps
those actions in the panel, so this change closes the largest remaining gap
between the two surfaces.

## What Changes

- The toolbar gains a remote status control and an overflow menu. The control
  syncs the current branch when it has an upstream, and publishes it when it
  does not. The menu offers Fetch, Pull, Pull (Rebase), Push, and Sync.
- Fetch updates every configured remote's tracking branches and prunes
  tracking branches whose remote ref no longer exists.
- Pull integrates the upstream by merging; Pull (Rebase) integrates it by
  rebasing. Push sends the current branch's commits to its upstream. Sync
  pulls and then pushes, and stops before pushing when the pull fails.
- Publish Branch pushes the current branch to a chosen remote and sets that
  remote branch as its upstream. The panel prefers `origin`, asks the user to
  choose when several remotes exist, and reports when no remote is configured.
- Remote actions use the existing single-operation busy lock, localized
  progress and success feedback, the existing failure banner and operation
  panels, and a status and graph refresh after the operation settles.
- The Host gains guarded remote operations that run Git without a shell, never
  prompt for credentials on a terminal, bound their duration, and validate
  every browser-supplied remote name and URL.

## Non-goals

- No remote configuration UI and no remote-branch checkout in this change;
  they are the follow-up change `add-remote-management`.
- No force push, push to an arbitrary remote when an upstream already exists,
  remote tag push, or remote branch deletion.
- No credential storage or interactive credential prompt. A credential helper
  or SSH agent remains the user's responsibility.
- No cancellation of an in-flight network operation, no shallow clone, and no
  repository initialization.
- Network operations never run automatically; the repository watcher stays
  read-only.
