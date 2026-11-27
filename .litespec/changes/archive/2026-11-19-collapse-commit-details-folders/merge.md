# Merge Summary: collapse-commit-details-folders

- Date: 2026-11-19
- Change: collapse-commit-details-folders

## Notes

Folder rows in the commit-details tree are now disclosure controls with a rotating chevron in place of the folder glyph, toggling by pointer, Enter or Space; collapse filtering lives in buildFileTree and the collapsed set is owned by useCommitDetails and reset per commit. Verified with 479 passing tests, pnpm check and verify:contract; the running Host serves the rebuilt client artifact, so refresh the page to load it.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Commit details

