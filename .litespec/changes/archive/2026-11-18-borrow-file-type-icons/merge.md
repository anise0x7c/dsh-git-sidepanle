# Merge Summary: borrow-file-type-icons

- Date: 2026-11-18
- Change: borrow-file-type-icons

## Notes

Expanded commit file rows now draw the host's FileTypeIcon (resolved from the Web shell's frozen module table behind a guarded require, with the plugin's plain document icon as fallback). Verified with pnpm check (454 tests), verify:contract (5 targets, 24 commands) and the served artifact (rev e2a90066471b serves the rebuilt client.js). Remaining: the user's light/dark click-through in the running page.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Inline commit changes

