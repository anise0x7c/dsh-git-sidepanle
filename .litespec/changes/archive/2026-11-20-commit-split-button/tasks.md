# Tasks: commit-split-button

## Host

- [x] Add `amend` to the `commit` RPC payload and pass it through the dispatcher.
- [x] Amend in `commitChanges`: refuse an unborn branch with `nothing-to-amend`, run `git commit --amend -m`, and skip the staged-changes requirement.
- [x] Host tests: amend replaces HEAD; amend on an unborn branch fails with `nothing-to-amend`.

## Browser

- [x] Add the `CommitMode` union and the commit-action menu view with its five entries and separator.
- [x] Render the commit action as a full-width split button with a check icon, a trailing chevron, and the menu anchored at its trailing edge.
- [x] Add menu state: open/close, outside-click and Escape dismissal.
- [x] Run Commit, Amend, Commit and Push, and Commit and Sync through the single busy lock; commit first, then push or sync, keeping the commit when the remote step fails.
- [x] Keep the stage-all confirmation for Commit, Commit and Push, and Commit and Sync.
- [x] Add the locale keys for the menu entries and the new failure text in both dictionaries.
- [x] Map `nothing-to-amend` to its locale text.

## Verification

- [x] UI tests: split wrapper and menu order, Escape/outside dismissal, amend payload, combined call order, failed push keeping the commit, no-upstream entries, stage-all confirmation for a combined action, and an empty change list.
- [x] Unit test: `nothing-to-amend` maps to its locale text.
- [x] `pnpm check` (types, Biome, 549 tests, artifact freshness).
- [x] Update `docs/DETAIL.md`, `docs/DETAIL.zh.md` and `docs/ARCHITECTURE.md`.
- [x] `litespec_validate`, then `litespec_archive`.
