# Merge Summary: restructure-panel-sections

- Date: 2026-11-26
- Change: restructure-panel-sections

## Notes

Implemented in the client panel: a new WorkspaceSection owns the top-level Workspace header, ChangeGroups renders the three change groups as nested sections at depth 1, split.ts sizes the folded pane to the Workspace plus group headers, and section.css pins nested headers one Workspace header below the pane edge. Rows in the groups take one nesting indent. Verified with the full portable gate (585 tests) and a fresh bundle; live-page checking was blocked by the Host's pairing auth.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 1 | 3 | 0 | updated |

### git-sidebar

- Added: 1, Modified: 3, Removed: 0
- Spec: updated
- Requirements added: Workspace and commit graph sections
- Requirements modified: Independent change and graph panes, Section headers stay pinned while scrolling, Clean workspace state

