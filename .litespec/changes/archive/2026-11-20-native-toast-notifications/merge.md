# Merge Summary: native-toast-notifications

- Date: 2026-11-20
- Change: native-toast-notifications

## Notes

Every success/failure notice now renders through DSH's native Toast: successes keep the native check, failures use the warning icon and a 6 s hold, retryable read failures attach a localized retry action, and the inline Banner component/styles were removed. The plugin registers a guarded shell.overlay host (`git-graph.toast`), borrowed from the frozen primitives table with a contextMenus.notify fallback. Forms keep their values; graph/details/diff keep compact retry states. pnpm check: typecheck, Biome, 557 tests, fresh artifacts; live Slots inspection confirmed the `git-graph.toast` overlay occupant; verify:contract OK (5 targets, 24 commands).

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 4 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 4, Removed: 0
- Spec: updated
- Requirements modified: Shared transient feedback, Freshness and failures, Remote operation feedback and refresh, Remote management feedback and refresh

