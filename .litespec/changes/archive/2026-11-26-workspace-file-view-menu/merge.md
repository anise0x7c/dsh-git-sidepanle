# Merge Summary: workspace-file-view-menu

- Date: 2026-11-26
- Change: workspace-file-view-menu

## Notes

The view switch ended up as the Workspace header's own dropdown (an ellipsis trigger like the commit graph's remote overflow menu) rather than a host context menu, so the change was reopened before archiving: no `workspace` section menu target, no `setChangeView` panel command, no `MenuTargetValue.view`. `views/ChangeViewMenu.ts` owns its open state and dismisses on Escape, an outside press or a chosen view; the stylesheet raises a header that holds an open menu above the headers after it. Live-page interaction stayed blocked by the Host pairing auth (the page answers 401 for this session), so the click-through is left to the user.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 1 | 2 | 0 | updated |

### git-sidebar

- Added: 1, Modified: 2, Removed: 0
- Spec: updated
- Requirements added: Workspace view menu
- Requirements modified: Change overview, Change list view mode

