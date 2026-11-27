# Merge Summary: frost-details-card

- Date: 2026-11-19
- Change: frost-details-card

## Notes

The details card now shares the floating operation prompt's theme-derived translucent menu surface and backdrop blur, with the solid layer-1 background as the @supports fallback. Its clipped elevation shadow and the now-unused elevation stroke variable are removed; border, radius, 4px gutter and slide behavior are unchanged. Style tests cover both the CSS source and the built bundle. Verified with 466 passing tests, `pnpm check` and `pnpm verify:contract`.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Commit details

