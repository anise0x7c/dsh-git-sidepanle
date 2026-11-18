# Merge Summary: close-details-with-escape

- Date: 2026-11-19
- Change: close-details-with-escape

## Notes

The visible Git panel listens for a bubble-phase document keydown while commit details are open and closes the card with the existing slide-out. Escape is skipped when a prompt, the branch menu, an already-handled event, or focus outside the panel owns the key; a body focus after the underlay is inerted still counts as in-panel. The test harness now records document keydown listeners so UI tests cover the shortcut, branch-menu precedence and the no-details case. Verified with 465 passing tests, `pnpm check` and `pnpm verify:contract`.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Commit details

