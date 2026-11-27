# Tasks

- [x] Review current refresh and watcher lifetimes and define ordering scenarios.
- [x] Add regressions for overlapping status reads, mutation refreshes, read failure and unmount.
- [x] Serialize and drain coalesced status refreshes without changing polling or refresh scope.
- [x] Fence disposed, cancelled and superseded asynchronous watch setup with deterministic lifecycle tests.
- [x] Make rendered-UI test lifetimes clean up even after an assertion or render failure.
- [x] Update maintenance documentation and pass the integrated quality and contract gates.
- [x] Validate and archive this change.
