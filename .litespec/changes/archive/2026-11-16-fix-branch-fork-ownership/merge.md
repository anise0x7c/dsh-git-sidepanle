# Merge Summary: fix-branch-fork-ownership

- Date: 2026-11-16
- Change: fix-branch-fork-ownership

## Notes

Preserve each ordinary first-parent chain in its own lane, retaining duplicate expectations until the actual listed shared parent, then joining additional incoming lines at that node with their source colors. Added direct topology, exact path, palette and text-clearance regressions. All 210 tests, check:build and the 5-target/16-command menu contract check pass; independent graph review passed. Browser-only release 0.5.1 needs no Host restart. Served executable matches the local build at revision 23c5bc30376f after accounting for the Host delimiter and source-map URL. Real-browser visual confirmation remains with the user because browser control is unavailable; no mock rendering or screenshot was substituted.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Commit graph and branch switching

