# Merge Summary: preserve-refresh-lifetimes

- Date: 2026-11-18
- Change: preserve-refresh-lifetimes

## Notes

Status refreshes are serialized and coalesced without dropping post-mutation reads; busy waits for the drain, errors still allow queued retry and unmount drops queued work. Watcher registry permanently fences disposal and invalidates cancelled/superseded discovery using per-panel setup identities. Deterministic watcher and delayed-UI regressions plus reliable, error-reporting test cleanup. Final 436 tests / 57 suites and installed registry contract pass; no automatic Host restart or real page click-through.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| git-sidebar | 2 | 0 | 0 | updated |

### git-sidebar

- Added: 2, Modified: 0, Removed: 0
- Spec: updated
- Requirements added: Refresh completion ordering, Cancelled watch setup stays cancelled

