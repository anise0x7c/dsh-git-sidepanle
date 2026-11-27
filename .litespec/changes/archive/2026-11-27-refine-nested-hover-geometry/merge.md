# Merge Summary: refine-nested-hover-geometry

- Date: 2026-11-27
- Change: refine-nested-hover-geometry

## Notes

Nested hover layers now share one geometry: 2px inside a control that fills the row or header height, corners at the surface radius minus that inset, and 4px between adjacent layers. Verified in the static light and dark probe pages; the live GUI needs a refresh to load the rebuilt client bundle.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Hover highlights a surface and its controls

