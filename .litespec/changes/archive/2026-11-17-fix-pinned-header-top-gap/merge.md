# Merge Summary: fix-pinned-header-top-gap

- Date: 2026-11-17
- Change: fix-pinned-header-top-gap

## Notes

Moved the 2px resting inset from the scroll frame to the first section, so a pinned header reaches the pane's top edge and no row can show above it. Hover layer and single-pinned-header behavior unchanged; 273 tests pass.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Section headers stay pinned while scrolling

