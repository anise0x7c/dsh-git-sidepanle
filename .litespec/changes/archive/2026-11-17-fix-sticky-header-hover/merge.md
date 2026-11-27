# Merge Summary: fix-sticky-header-hover

- Date: 2026-11-17
- Change: fix-sticky-header-hover

## Notes

The opaque surface that masks rows under a pinned header now lives on the header itself, and the host hover highlight is a rounded layer above it, so section headers highlight on hover again while rows stay hidden. Pinning and the single-header rule are untouched; it is a browser-only change, so reload the page without restarting the Host.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Section headers stay pinned while scrolling

