# Merge Summary: fix-merge-conflict-paths

- Date: 2026-11-15
- Change: fix-merge-conflict-paths

## Notes

Conflicted entries now keep their repository-relative path (parser capture 10 instead of 11), so the merge-changes group renders with folder tree and the row's open/stage actions work. Coverage: parser unit case, real-Git conflicting-merge e2e over the RPC route, rendered-panel test for a nested conflicted file. Version 0.3.1.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Change overview

