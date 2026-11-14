# Merge Summary: fix-context-menu-resolution

- Date: 2026-11-15
- Change: fix-context-menu-resolution

## Notes

Right-clicking a row opened an empty menu: the contribution resolved actions from the wrapper's `value` while the shared registry already unwraps the target to its captured value, so every menu resolved zero commands. The registration now consumes the captured value directly, with the contract documented beside it. Both test stand-ins now call the contribution exactly as the shared registry does, so the same mismatch can no longer pass the suite, and a new UI test asserts every menu surface (file, folder, group header, commit) resolves at least one command. Tests: 35 passing; 13 of them fail against the pre-fix bundle. Verified in the running installation: the served bundle carries the fix, the Host pushed an HMR rebuild event to open pages, and the plugin bundle resolves 5 commands for a changed file and 2 for a commit through the host's installed context-menu registry (0.2.2-rc.3).

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Context-menu invocation and dismissal

