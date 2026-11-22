# Merge Summary: hold-toolbar-progress-minimum

- Date: 2026-11-22
- Change: hold-toolbar-progress-minimum

## Notes

The toolbar progress bar now stays visible for at least 500 ms once it appears, so fast reads and operations no longer flash it. Work that starts during the hold keeps it continuous without restarting the timer, and it still disappears immediately once work has finished after the minimum. Rendered-panel tests cover the hold after both the opening load and a quick operation.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Toolbar loading progress

