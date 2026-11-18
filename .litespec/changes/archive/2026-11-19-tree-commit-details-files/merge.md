# Merge Summary: tree-commit-details-files

- Date: 2026-11-19
- Change: tree-commit-details-files

## Notes

The details file list is built by the pure `src/client/git/tree.ts` builder and rendered through `renderFileTree`; folder rows use the plugin's FolderIcon and are non-interactive, file rows keep icons, rename arrows, menus and right-aligned status letters, and unbranched folder chains collapse into one `aa/bb/cc` row. Covered by 6 new builder unit tests plus UI tests for row order, indentation, collapsed chains and non-interactive folder rows; `pnpm check` passed 474 tests, `pnpm verify:contract` passed, and the running Host serves the rebuilt artifact (refresh the page to load it).

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Commit details

