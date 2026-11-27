# Merge Summary: animate-split-collapse

- Date: 2026-11-23
- Change: animate-split-collapse

## Notes

Collapsed panes now fold with a short transition and keep their rows mounted while the shrinking pane clips them. The divider stays visible as the pane boundary but is inert (no hover, drag, focus or ratio change) until a section expands again. The reduced-motion preference takes the new height at once.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Independent change and graph panes

