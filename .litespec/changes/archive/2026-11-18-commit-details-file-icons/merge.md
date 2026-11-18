# Merge Summary: commit-details-file-icons

- Date: 2026-11-18
- Change: commit-details-file-icons

## Notes

The commit-details view now draws the host's file-type icon before each changed file's name through a new explicit row option; the merge/staged/changes lists keep their current rows. Verified with pnpm check (456 tests), verify:contract (5 targets, 24 commands) and the served artifact (rev 9477c9edfda0 serves the rebuilt client.js on port 45963). Remaining: the user's light/dark click-through of the details view.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Commit details

