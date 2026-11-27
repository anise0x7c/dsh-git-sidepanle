# Merge Summary: keep-pane-still-while-prompt-moves

- Date: 2026-11-18
- Change: keep-pane-still-while-prompt-moves

## Notes

The motion wrapper is now a pane-sized, out-of-flow clip box (position: absolute; inset: 0; overflow: clip; pointer-events: none) instead of display: contents. Overflow: clip was chosen over hidden because hidden would make the box a scroll container, which the browser could scroll to reveal the focused Cancel control; clip neither scrolls nor lets the translated card extend any ancestor's scrollable area. The clip bounds equal the host tab body's, so the card's shadow and backdrop blur are unchanged.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Floating operation panels

