# Git source-control sidebar with Code OSS parity

## Why
DSH has no way to inspect or act on a workspace's Git state from the Web GUI. Users must switch to another tool to review changes, stage files, or commit, which breaks the agent-assisted edit/review loop. The right Sidebar already hosts workspace tools (files, previews, terminals), so Git belongs there next to them.

## What Changes
Add a Git tab type to the right Sidebar, reachable from the guide, that shows branch and sync state, staged/unstaged/merge changes as a file tree with stage, unstage, and discard actions, a commit message box that commits staged changes (or offers to stage everything), a per-file unified diff tab, and a recent-commit graph with branch switching. All Git work runs on the Host in the Session's working directory; the browser only renders and requests it.

## Non-goals
- Network operations: fetch, pull, push, and remote management.
- History rewriting or workspace mutations beyond stage, unstage, discard, commit, and branch checkout (no stash, tags, merge, rebase, amend, or `git init`).
- Conflict resolution beyond marking a conflicted file staged; no merge editor.
- Multiple repositories per workspace, submodule views, blame, or per-line history.
- Agent tools: this change adds UI only.
