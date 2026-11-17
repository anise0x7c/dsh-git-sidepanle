# Merge Summary: fill-floating-panel-width

- Date: 2026-11-18
- Change: fill-floating-panel-width

## Notes

Removed the fixed width cap and set equal 4px gutters so the shared bottom prompt fills the Git pane width without changing underlying layout. Full gate passed: 377 tests, typecheck, Biome and generated-artifact freshness. UI/UX source review found no blockers; clarified that uncovered areas remain usable. Existing GUI served the rebuilt full-width/equal-gutter artifact at rev 3c835f40aa1c (HTTP 200), superseding the reviewer's pre-build stale artifact observation. Actual browser visual/click-through remains manual.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Adaptive operation-panel content

