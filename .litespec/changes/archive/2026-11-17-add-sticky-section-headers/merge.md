# Merge Summary: add-sticky-section-headers

- Date: 2026-11-17
- Change: add-sticky-section-headers

## Notes

Each collapsible section header now pins to the top edge of its own scrolling pane, painted on the host's tab surface so rows pass hidden beneath it. Because every header is constrained by its own section, only one header is pinned at a time and the next section's header takes the edge as the previous one leaves. The change is stylesheet-only plus its regression tests; no Host restart is needed.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 1 | 0 | 0 | updated |

### git-sidebar

- Added: 1, Modified: 0, Removed: 0
- Spec: updated
- Requirements added: Section headers stay pinned while scrolling

