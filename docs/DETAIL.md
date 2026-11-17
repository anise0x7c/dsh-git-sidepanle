# Git source control

A VS Code-style source-control surface for the right Sidebar. It reads the Git repository that contains the current Session's working directory and lets you review and act on it without leaving the Web GUI.

The panel is drawn with the host's own theme tokens, type scale, and component conventions, so it follows light and dark themes and matches the Sidebar's rows, headers, dividers, controls, and menus.

## Open it

Open the right Sidebar (the expand control at the conversation header's right corner), then pick **Source control** on the guide page. The same page opens with the sidebar toggle shortcut: `Ctrl+Shift+G` on Windows and Linux, `Cmd+Shift+G` on macOS.

The Git tab and its diff tabs live in the right Sidebar's normal docking surface, so they can be split, floating, or restored with the Sidebar's saved layout.

## What it shows

- **Branch header**: the checked-out branch, detached or unborn state, upstream tracking, and ahead/behind counts. Pick the header to switch to another local branch.
- **Commit box**: a multi-line message with `Ctrl+Enter` (`Cmd+Enter` on macOS) to commit. The box is one line high until the message wraps, grows with it, and stops at ten lines, where the message scrolls instead of pushing the change list down. Staged changes only; when nothing is staged, committing offers to stage every change first. A failed commit keeps the message and the staged files.
- **Merge changes / Staged changes / Changes**: VS Code's three change groups, each a single-layer, path-sorted list with no folder rows. Every row carries a status letter (`M` modified, `A` added, `D` deleted, `R` renamed, `U` untracked, `!` conflicted), the file name, and its dimmed parent directory; the full path is in the row tooltip. Hover a row for its stage, unstage, or discard action. When the working tree is clean, the change area says so in text, without an icon.
- **Resizable panes**: the change groups scroll in their own pane above the commit graph, so a long change list does not bury history. Drag the divider between them to change the split; with the divider focused, `ArrowUp`/`ArrowDown` move it by 5%, `PageUp`/`PageDown` by 10%, and `Home`/`End` jump to the limits. Each pane keeps a usable minimum height and its own scroll position. The ratio survives opening a commit's details and returning, but resets when the tab is closed and reopened.
- **Pinned headers**: while a change group or the graph is taller than its pane, its section header stays at the pane's top edge as you scroll, painted on the panel surface so the rows pass beneath it and nothing shows above it. The next section's header takes that place as the previous section leaves, so only one header is pinned at a time.
- **Graph**: a reproduction of VS Code's Source Control Graph for recent commits across local branches, tags, and remote-tracking branches, listed in topological order as VS Code's "All" filter lists them. Lines follow VS Code's swimlane rules: a commit sits on the leftmost line heading for it and its first parent continues there; further lines heading for the same commit curve into its node on that row; each extra merge parent opens a new line at the right end; and lines to the right of an ended line shift left. Rows are 22 pixels high with an 11-pixel lane pitch, thin lines, quarter-turn joins and merges, and short S-turns for shifts; a lane stays unbroken where two rows meet, at any zoom. Nodes use VS Code's shapes — a dot, a ring around a dot for merges, and a hollow ring for the checked-out commit — with a small gap that closes while you hover the row. Colors follow VS Code: new lines rotate through amber, magenta, brown, teal, and violet; the checked-out branch is blue, its upstream purple, and its base branch orange (the configured VS Code merge base, otherwise the default remote branch). Each row shows the subject (bold for the checked-out commit) with the dimmed author, then VS Code's colored reference badges: the first reference with its name, and the rest as icon badges for branches, remote branches, and tags grouped by color, with a count when they stand for several references. The short ID, relative time, and every reference are in the row tooltip; activating the row opens the commit details. Up to 60 commits are shown at first; reaching the end of the graph pane appends the next 60 earlier commits below the loaded rows (the same page is available from the "Load earlier commits" control at the end of the list), and the rows already shown keep their place while lines that ended at the old bottom connect to their commits. When the last page arrives no further page is offered, a page that fails to load keeps the loaded rows and offers retry, and refresh starts over from the newest page.
- **Commit details**: click a commit row in the graph (or focus it and press `Enter` / `Space`) to replace the split panes with that commit's details: short ID, subject, author, relative time, message body, and a single-layer, path-sorted list of the files the commit changed, with status letters and rename sources. Click a changed file to open its commit-scoped diff. The back control returns to the change list and graph at the previous split ratio without touching the repository. A commit that changed nothing relative to its first parent says so, a failure is reported with retry, and at most 1,000 changed files are listed.
- **Diff tab**: click any changed file. Staged entries compare the index with the committed version, unstaged entries compare the working tree with the index, and untracked entries render as additions. A file opened from a commit's details compares that commit with its first parent — the empty tree for a root commit — and the header names the commit; a pure rename is explained instead of showing an empty diff. Binary and oversized files are identified rather than decoded.

Status refreshes when the page opens, after every action, when the refresh control is used, and every few seconds while the tab is visible.

## Context menus

Right-click a row, or focus a changed file or commit (or a button inside a group or diff header) and press the context-menu key or `Shift+F10`. Menus use the application's shared context-menu presentation, so position, dismissal, focus return, theme, and language match the rest of DSH.

- **Changed file**: open changes, stage or unstage, discard when the file can be discarded, and copy its relative or full path.
- **Group header**: the group-level actions that apply to that group: stage or unstage every file in it, discard every change in it, and refresh.
- **Commit**: copy the full commit ID or the commit subject.
- **Diff header**: copy the file's relative or full path.
- **Commit-details file**: copy its relative or full path. A past commit is history, so staging, unstaging, and discarding are not offered there.

Full paths are formed from the repository root, which may differ from the Session's working directory when the Session runs in a subdirectory of the repository. The subject is the first line of a commit message, not its body.

Menu commands behave like the equivalent hover control: same confirmation, same failure report, and same refresh. While a Git operation is running, commands that change the repository are disabled, and a command whose change disappeared in the meantime reports that instead of doing nothing. Opening a menu runs no Git command. Copies confirm success, and an unavailable clipboard is reported instead of being ignored. Without a context-menu facility in the host application, the panel and all of its inline controls keep working.

## Host execution and trust

Every Git command runs on the Host in the Session's working directory, through a single local route (`/api/dsh-git-graph/rpc`). The route accepts only unproxied loopback requests with the bundle's own request header and same-origin browser markers; it never runs through a shell and never accepts a repository path from the browser.

## Limitations

- No network operations: fetch, pull, push, and remote management are not part of this bundle.
- No stash, tag creation, merge, rebase, amend, or repository initialization.
- Conflicts can be staged to mark them resolved, but there is no merge editor.
- One repository at a time; the one containing the Session's working directory.
- A commit's changed files and per-file diff compare against its first parent; comparing against a second parent, another arbitrary commit, or the working tree is not offered.
- The panel is UI only. No agent tool exposes these operations, so the model cannot stage or commit on its own.
