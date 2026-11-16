# Merge Summary: vscode-commit-graph

- Date: 2026-11-16
- Change: vscode-commit-graph

## Notes

Replaced the custom lane graph with a port of VS Code's Source Control Graph (swimlanes, path geometry, node shapes, scmGraph palette, reference badges, topo order, current/upstream/base references). Deliberate deviations: root commits keep other lanes; node gaps are SVG masks; base branch from config or default remote only. Follow-ups not taken: incoming/outgoing rows, inline file expansion, avatars, paging. Requires a Host restart to serve the new history value.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 6 | 1 | 1 | updated |

### git-sidebar

- Added: 6, Modified: 1, Removed: 1
- Spec: updated
- Requirements added: Commit graph swimlanes, Commit graph drawing, Commit graph nodes, Commit graph colors, Commit rows and reference badges, Branch switching
- Requirements modified: Host execution and presentation
- Requirements removed: Commit graph and branch switching

