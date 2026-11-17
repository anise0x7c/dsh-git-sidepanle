# Merge Summary: fix-graph-row-line-seam

- Date: 2026-11-17
- Change: fix-graph-row-line-seam

## Notes

The whole graph's lines now share one layer with a path per color, so a lane that crosses a row boundary is rasterized once and keeps the same coverage it has anywhere else: no notch and no thicker spot at fractional zoom levels. Each row keeps only its node and its graph width; the node gaps are circles in the layer's mask, and the section closes the gap of the hovered row. `graphRowGeometry(row, offset)` still emits VS Code's per-row commands unchanged, which the equivalence suite keeps checking. Verified by unit and UI tests; the visual result still needs a look in the running page at the reported zoom.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Commit graph drawing

