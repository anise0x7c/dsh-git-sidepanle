# Merge Summary: differentiate-graph-style

- Date: 2026-11-22
- Change: differentiate-graph-style

## Notes

Palette: OKLCH hue held within 1.6°, chroma raised where sRGB allows; amber is at the gamut edge and moves least. S-turn radius 5 → 4.5 px; joins and merges keep 11 px. The Code OSS equivalence oracle now takes the radius as an optional parameter (default 5), and the unit/UI path assertions pin the tuned radius.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 2 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 2, Removed: 0
- Spec: updated
- Requirements modified: Commit graph drawing, Commit graph colors

