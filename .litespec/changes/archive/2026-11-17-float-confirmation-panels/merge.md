# Merge Summary: float-confirmation-panels

- Date: 2026-11-17
- Change: float-confirmation-panels

## Notes

Implemented a shared non-modal native-themed frosted bottom panel for all confirmations and reference forms, preserving pane geometry and Git semantics. Added responsive content/actions, short-pane overflow fallback, prompt replacement and focus protection, busy/IME guards and in-form failures. Portable gate passed 376 tests; installed registry contract and served executable code/live Slot checks passed. Independent UI/UX source review completed; authenticated light/dark and narrow/short-pane click-through remains manual because browser control is unavailable.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 3 | 0 | 0 | updated |

### git-sidebar

- Added: 3, Modified: 0, Removed: 0
- Spec: updated
- Requirements added: Floating operation panels, Adaptive operation-panel content, Safe floating-panel interaction
