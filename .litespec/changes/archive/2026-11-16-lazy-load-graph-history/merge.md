# Merge Summary: lazy-load-graph-history

- Date: 2026-11-16
- Change: lazy-load-graph-history

## Notes

The commit graph now pages backwards: the first read stays at 60 commits, and reaching the end of the graph pane (or the end-of-list control) appends the next 60 earlier commits, with loading, retry and end-of-history states. Pages are offset-based and verified to concatenate to one topological log; refresh returns to the first page. Requires a Host restart.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 1 | 0 | 0 | updated |

### git-sidebar

- Added: 1, Modified: 0, Removed: 0
- Spec: updated
- Requirements added: Commit graph paging

