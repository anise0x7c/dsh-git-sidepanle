# Merge Summary: expand-commit-changes-inline

- Date: 2026-11-18
- Change: expand-commit-changes-inline

## Notes

Commit rows toggle a Code OSS-style inline file list (graph-placeholder lanes, node lane 3px, file icon/name/dir/status); the details view moved to the new first commit-menu action View Details. Verified by pnpm check (449 tests, Code OSS placeholder oracle equivalence) and pnpm verify:contract. Follow-up: real-page click-through by the user.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 2 | 3 | 0 | updated |

### git-sidebar

- Added: 2, Modified: 3, Removed: 0
- Spec: updated
- Requirements added: Inline commit changes, Expanded commit drawing
- Requirements modified: Commit details, Commit graph context-menu structure, Commit rows and reference badges

