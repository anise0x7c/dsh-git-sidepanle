# Merge Summary: collapse-commit-details-tree

- Date: 2026-11-19
- Change: collapse-commit-details-tree

## Notes

Folder rows are now disclosure controls (`role=button`, `aria-expanded`, chevron, Enter/Space and pointer toggle, expanded by default) and `visibleFileTree` in the pure tree module filters collapsed subtrees while preserving other rows. Every nested tree row draws one absolute guide line per ancestor folder over its indentation padding, aligned with the parent disclosure column. Covered by 6 new `visibleFileTree` unit tests, expanded UI guide assertions, a new collapse/expand/keyboard UI test, and `pnpm check` (481 tests) plus `pnpm verify:contract` both passing; the running Host serves the rebuilt client artifact, so refresh the page to load it.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Commit details

