# Merge Summary: double-layer-hover

- Date: 2026-11-26
- Change: double-layer-hover

## Notes

Hover now paints two layers from the host's translucent interactive hover token: the row or header surface keeps the whole-surface highlight, and a control inside it (section toggle, header actions, file-row actions, graph header remote controls) adds its own rounded highlight above that surface. The graph header's controls-only mode is gone: the shared Section no longer takes a hover prop and every header highlights like the change groups. Live GUI verification stays manual: the connected page must be refreshed to load the rebuilt client bundle, then hover a section header, its action buttons, a file row's revealed actions, and the graph header's Fetch/Pull/Push controls.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 1 | 1 | 0 | updated |

### git-sidebar

- Added: 1, Modified: 1, Removed: 0
- Spec: updated
- Requirements added: Hover highlights a surface and its controls
- Requirements modified: Section headers stay pinned while scrolling


## Follow-up

The section toggle's second hover layer was dropped after review, on request
without a further litespec change. The capability spec was corrected in place:
the toggle keeps only the header's surface highlight, and a header's action
controls still layer theirs above it.
