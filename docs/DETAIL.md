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

## Context menus

Right-click a row, or focus a changed file, folder, or commit (or a button inside a group or diff header) and press the context-menu key or `Shift+F10`. Menus use the application's shared context-menu presentation, so position, dismissal, focus return, theme, and language match the rest of DSH.

- **Changed file**: open changes, stage or unstage, discard when the file can be discarded, and copy its relative or full path.
- **Folder**: the same staging, unstaging, and discarding for every changed file below it, plus copying the folder's paths.
- **Group header**: the group-level actions that apply to that group: stage or unstage every file in it, discard every change in it, and refresh.
- **Commit**: copy the full commit ID or the commit subject.
- **Diff header**: copy the file's relative or full path.

Full paths are formed from the repository root, which may differ from the Session's working directory when the Session runs in a subdirectory of the repository. The subject is the first line of a commit message, not its body.

Menu commands behave like the equivalent hover control: same confirmation, same failure report, and same refresh. While a Git operation is running, commands that change the repository are disabled, and a command whose change disappeared in the meantime reports that instead of doing nothing. Opening a menu runs no Git command. Copies confirm success, and an unavailable clipboard is reported instead of being ignored. Without a context-menu facility in the host application, the panel and all of its inline controls keep working.

## Host execution and trust

Every Git command runs on the Host in the Session's working directory, through a single local route (`/api/dsh-git-graph/rpc`). The route accepts only unproxied loopback requests with the bundle's own request header and same-origin browser markers; it never runs through a shell and never accepts a repository path from the browser.

## Limitations

- No network operations: fetch, pull, push, and remote management are not part of this bundle.
- No stash, tag creation, merge, rebase, amend, or repository initialization.
- Conflicts can be staged to mark them resolved, but there is no merge editor.
- One repository at a time; the one containing the Session's working directory.
- The panel is UI only. No agent tool exposes these operations, so the model cannot stage or commit on its own.
