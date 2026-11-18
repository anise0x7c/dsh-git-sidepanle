# Merge Summary: widen-expanded-commit-row-lane

- Date: 2026-11-18
- Change: widen-expanded-commit-row-lane

## Notes

An expanded commit row now draws its node lane three pixels wide above and below the node, so the wide line runs from the row's top edge through its listed rows instead of starting at the bottom edge. Verified with pnpm check (451 tests) and the graph/UI assertions; VS Code's own renderer keeps the row at one pixel, so this is a deliberate fidelity deviation. Follow-up: real-page click-through by the user.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Expanded commit drawing

