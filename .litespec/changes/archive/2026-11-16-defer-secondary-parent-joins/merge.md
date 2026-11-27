# Merge Summary: defer-secondary-parent-joins

- Date: 2026-11-16
- Change: defer-secondary-parent-joins

## Notes

Every parent connection now keeps its own lane until the parent's row, including secondary parents whose target is already expected. Nodes are selected by the oldest expectation, so an older line keeps its branch identity and color; a shared parent row can receive several incoming lanes. The unlisted-parent fold remains for secondary parents below the visible window. Verified with a failing-then-passing regression, exact SVG paths, 600-seed invariant fuzzing plus an independent 3000-DAG review, 214 tests, build/contract checks, a local before/after render of the reported 60-commit history, and a served-artifact match at revision 65a17a8f12aa. No Host restart needed.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Commit graph and branch switching

