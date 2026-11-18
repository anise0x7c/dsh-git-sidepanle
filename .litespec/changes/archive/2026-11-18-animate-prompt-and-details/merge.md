# Merge Summary: animate-prompt-and-details

- Date: 2026-11-18
- Change: animate-prompt-and-details

## Notes

Both surfaces animate with CSS transforms in motion.css; the JS side owns only the exit timer (PROMPT_MOTION_MS/DETAILS_MOTION_MS in constants.ts, mirrored by the stylesheet and checked by test/unit/motion-style.test.ts). The leaving surface keeps rendering the element rendered last, so its content does not blink out. The host tab body (overflow: hidden/clip) does the clipping below the pane edge, so the prompt needs no clipping container and keeps its shadow; the details wrapper clears the scroll frame's 6px gutter with a generous translate.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 2 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 2, Removed: 0
- Spec: updated
- Requirements modified: Commit details, Floating operation panels

