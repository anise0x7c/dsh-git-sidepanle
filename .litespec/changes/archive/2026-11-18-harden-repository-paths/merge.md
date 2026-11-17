# Merge Summary: harden-repository-paths

- Date: 2026-11-18
- Change: harden-repository-paths

## Notes

Implemented literal Git pathspecs, cross-drive/segment containment, no-follow bounded previews, linked-parent refusals and authoritative non-ignored untracked checks with localized refusals. Host dispatch/validation/path/filesystem/mutations separated. Final pnpm check: 436 tests / 57 suites pass, strict unused checks/Biome/artifact freshness pass; real DSH registry: 5 targets / 23 commands + Toast. Host restart and user click-through remain required; hooks/config/local account remain trusted.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 2 | 0 | 0 | updated |

### git-sidebar

- Added: 2, Modified: 0, Removed: 0
- Spec: updated
- Requirements added: Literal file-action scope, Direct filesystem target safety

