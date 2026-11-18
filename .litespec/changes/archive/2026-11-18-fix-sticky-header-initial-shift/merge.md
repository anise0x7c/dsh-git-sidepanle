# Merge Summary: fix-sticky-header-initial-shift

- Date: 2026-11-18
- Change: fix-sticky-header-initial-shift

## Notes

The header now pins at the same offset where it already rests: one shared 2px inset sizes the first section's top padding, the section gap, the header's sticky top and its upward surface shadow. A headless Firefox measurement showed the header offset staying at the inset for scroll positions 0, 1 and 40 at both 2px and 20px insets, with the strip above the header painted by the header surface. Browser-only change; refresh the Web page.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 0 | 1 | 0 | updated |

### git-sidebar

- Added: 0, Modified: 1, Removed: 0
- Spec: updated
- Requirements modified: Section headers stay pinned while scrolling

