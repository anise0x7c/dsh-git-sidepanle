# Merge Summary: grow-commit-message-box

- Date: 2026-11-17
- Change: grow-commit-message-box

## Notes

The height rule lives in `panel/autosize.ts`: `fitTextArea` clamps the measured content height to 1..10 lines, and `autoGrowTextArea` applies it from the commit box's layout effect and a width-guarded ResizeObserver. Tests: 282 (+9: the clamp, the measuring pass, the width watcher, the one-row box).

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 1 | 0 | 0 | updated |

### git-sidebar

- Added: 1, Modified: 0, Removed: 0
- Spec: updated
- Requirements added: Commit message sizing

