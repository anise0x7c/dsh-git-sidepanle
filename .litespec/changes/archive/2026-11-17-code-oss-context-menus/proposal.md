# Complete Code OSS-style context menus

## Why

The change-file menu cannot add a file to `.gitignore`, and commit rows offer only copy actions. Users must leave the Sidebar to ignore files, check out a commit or branch, or create branches and tags. The new commit menu should retain DSH's native menu presentation while following the familiar Code OSS action hierarchy rather than introducing a separate plugin menu appearance.

## What Changes

- Add **Add to .gitignore** to every working-change file menu, without offering it for files shown as history. The command adds one root-anchored, literal path rule to the repository-root file and refreshes the change list.
- Give commit rows a Code OSS-ordered menu: branch checkout and detached checkout, create branch, conditional branch deletion, create tag, then **Copy commit hash** and **Copy commit message**. Checkout and deletion submenus appear only when the commit carries local branch heads; their entries render as native DSH nested menu items.
- Let users create a branch at the selected commit and switch to it, create a lightweight or annotated tag at that commit, and confirm deletion of a non-current local branch. Empty names and cancellations do not perform Git operations, and failures stay visible without false success feedback.
- Preserve the existing copy payloads: the full commit identifier and the existing subject-line value. Only their labels change.
- Keep all menu surface, typography, keyboard, submenu and dismissal behavior in DSH's shared context-menu renderer. Name and deletion dialogs use host theme tokens, associated descriptions, initial focus, idle Escape cancellation, busy feedback and trigger-focus restoration; tag annotations preserve ordinary Enter for a newline. Ignore writes reject symbolic links and other non-regular files, and reported successes explain that tracked files remain tracked.

## Non-goals

- No fetch, pull, push, cherry-pick, merge, rebase, reset, stash or remote-branch creation.
- No automatic force-deletion of unmerged branches and no custom replacement for DSH's shared menu overlay.
- No change to the graph's lane layout or to the behavior of commit-details file menus and diff-header menus.
