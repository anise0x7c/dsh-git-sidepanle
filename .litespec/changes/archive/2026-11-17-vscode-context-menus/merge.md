# Merge Summary: vscode-context-menus

- Date: 2026-11-17
- Change: vscode-context-menus

## Notes

Added native DSH nested commit menus in the requested VS Code order, safe repository-root .gitignore writes, branch/tag creation and guarded reference mutations, and keyboard-accessible naming/deletion dialogs. Follow-up review accepted the no-follow and focus-regression fixes. Full check: 363 tests pass; real DSH contract: 5 targets, 23 actions; served GUI client rev 651546473dbb confirmed. Host restart and the user's real-page visual/keyboard click-through remain the final manual checks.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 5 | 3 | 0 | updated |

### git-sidebar

- Added: 5, Modified: 3, Removed: 0
- Spec: updated
- Requirements added: Commit graph context-menu structure, Checkout from commit history, Create references at a commit, Delete a branch from commit history, Keyboard-accessible reference-operation dialogs
- Requirements modified: Change context menus, Copy actions in context menus, Context-menu invocation and dismissal

