# Git source control

A VS Code-style source-control surface for the right Sidebar. It reads the Git repository that contains the current Session's working directory and lets you review and act on it without leaving the Web GUI.

## Open it

Open the right Sidebar (the expand control at the conversation header's right corner), then pick **Source control** on the guide page. The same page opens with the sidebar toggle shortcut: `Ctrl+Shift+G` on Windows and Linux, `Cmd+Shift+G` on macOS.

The Git tab and its diff tabs live in the right Sidebar's normal docking surface, so they can be split, floating, or restored with the Sidebar's saved layout.

## What it shows

- **Branch header**: the checked-out branch, detached or unborn state, upstream tracking, and ahead/behind counts. Pick the header to switch to another local branch.
- **Commit box**: a multi-line message with `Ctrl+Enter` (`Cmd+Enter` on macOS) to commit. Staged changes only; when nothing is staged, committing offers to stage every change first. A failed commit keeps the message and the staged files.
- **Merge changes / Staged changes / Changes**: VS Code's three change groups, each a collapsible folder tree. Every row carries a status letter (`M` modified, `A` added, `D` deleted, `R` renamed, `U` untracked, `!` conflicted). Hover a row for its stage, unstage, or discard action.
- **Graph**: recent commits across local branches, tags, and remote-tracking branches, with graph lanes, ref labels, author, and relative time. Up to 60 commits are shown.
- **Diff tab**: click any changed file. Staged entries compare the index with the committed version, unstaged entries compare the working tree with the index, and untracked entries render as additions. Binary and oversized files are identified rather than decoded.

Status refreshes when the page opens, after every action, when the refresh control is used, and every few seconds while the tab is visible.

## Host execution and trust

Every Git command runs on the Host in the Session's working directory, through a single local route (`/api/dsh-git-graph/rpc`). The route accepts only unproxied loopback requests with the bundle's own request header and same-origin browser markers; it never runs through a shell and never accepts a repository path from the browser.

## Limitations

- No network operations: fetch, pull, push, and remote management are not part of this bundle.
- No stash, tag creation, merge, rebase, amend, or repository initialization.
- Conflicts can be staged to mark them resolved, but there is no merge editor.
- One repository at a time; the one containing the Session's working directory.
- The panel is UI only. No agent tool exposes these operations, so the model cannot stage or commit on its own.
