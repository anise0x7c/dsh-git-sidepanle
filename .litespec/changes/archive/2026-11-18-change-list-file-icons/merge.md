# Merge Summary: change-list-file-icons

- Date: 2026-11-18
- Change: change-list-file-icons

## Notes

Every flat file-row list now draws the host's file-type icon: the merge-conflicts, staged and changes lists share the same renderer as the details view, so the per-list icon option was removed. Verified with pnpm check (456 tests), verify:contract (5 targets, 24 commands) and the served artifact (rev 6ca449a04706 serves the rebuilt client.js on port 45963). Remaining: the user's light/dark click-through of the change lists.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Change overview

