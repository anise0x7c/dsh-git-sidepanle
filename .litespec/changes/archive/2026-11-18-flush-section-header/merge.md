# Merge Summary: flush-section-header

- Date: 2026-11-18
- Change: flush-section-header

## Notes

Replaced the 2px resting inset and upward-shadow overlay with a flush header: the first section has no top inset and every header uses `top: 0`, so its own opaque surface starts at the pane's top edge and covers the top edge itself. Verified in headless Firefox: header top equals pane top at scrollTop 0, 1, 2, 40, 100 and 300, and the header is the topmost element at the pane's top edge. Browser-only change; refresh the page. No commit or version bump.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Section headers stay pinned while scrolling

