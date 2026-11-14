# Merge Summary: add-git-context-menus

- Date: 2026-11-15
- Change: add-git-context-menus

## Notes

Delivered shared-host context menus for change rows, folders, group headers, commits, and the diff header. A UI/UX review caught two delivery blockers that were fixed before archiving: absolute paths now use the repository root (a Session running in a subdirectory previously got wrong paths), and commit rows are keyboard focus stops. Review polish also landed: busy-state disabling, stale-change feedback, per-pane command ownership, menu ARIA/tooltips, consistent group-discard wording, and a commit-subject label fix. Test suite: 34 passing.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 3 | 0 | 0 | updated |

### git-sidebar

- Added: 3, Modified: 0, Removed: 0
- Spec: updated
- Requirements added: Change context menus, Copy actions in context menus, Context-menu invocation and dismissal

