# Merge Summary: polish-panel-ui

- Date: 2026-11-15
- Change: polish-panel-ui

## Notes

The panel now shares the host's type scale, spacing, control and menu styling, and the commit history is drawn as a lane-based SVG tree from each commit's parents (the Host history payload returns `parents` instead of the ASCII graph prefix). 202 tests; graph layout and host parsing have pure unit coverage.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 2 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 2, Removed: 0
- Spec: updated
- Requirements modified: Commit graph and branch switching, Host execution and presentation

