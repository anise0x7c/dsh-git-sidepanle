# Merge Summary: overlay-commit-details

- Date: 2026-11-19
- Change: overlay-commit-details

## Notes

The commit details card is an absolutely positioned layer inside a new `.dshgg-stage`; the previous commit box, banners and split stay mounted beneath it and are inert/aria-hidden while the card is present. The card surface uses theme background, 0.5px border, radius and the prominent elevation shadow; the existing 200ms slide keyframes and reduced-motion fallback are unchanged. Verified with 462 passing tests, `pnpm check`, `pnpm verify:contract`, and the running Web Host serving the rebuilt client artifact.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 2 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 2, Removed: 0
- Spec: updated
- Requirements modified: Commit details, Independent change and graph panes

