# Git Sidebar delta

## ADDED Requirements

### Requirement: Refresh completion ordering

The panel SHALL preserve a status refresh requested while an older status read is in flight by completing a subsequent read, coalescing overlapping requests without concurrent status reads. A successful repository operation SHALL wait for its required fresh status read before releasing its busy state. Unmounting the panel MUST prevent a queued read from starting.

#### Scenario: An older read overlaps a write

- **GIVEN** a status read began before a repository mutation completed
- **WHEN** the successful mutation requests its status refresh
- **THEN** a subsequent status read completes and its result becomes the displayed state before the operation becomes idle

#### Scenario: Several refresh requests overlap

- **WHEN** several refresh requests arrive during one pending status read
- **THEN** they are coalesced into a follow-up read and no two status reads run concurrently

#### Scenario: Failed read with a queued refresh

- **GIVEN** another refresh was requested while a status read was pending
- **WHEN** the older read fails
- **THEN** the queued refresh still runs and can replace the failure with fresh status

#### Scenario: Panel closes with a queued refresh

- **WHEN** the panel closes before its pending status read settles
- **THEN** settling that read does not start a queued refresh or update the closed panel

### Requirement: Cancelled watch setup stays cancelled

The Host MUST prevent asynchronous watch setup from acquiring or replacing repository watchers after its panel subscription is cancelled, a newer subscription supersedes it or the plugin's watch registry is disposed. Disposal SHALL be idempotent and permanent for that registry.

#### Scenario: Unload during repository discovery

- **GIVEN** a watch request is still resolving its repository or metadata directory
- **WHEN** the plugin unloads before resolution finishes
- **THEN** the request finishes without opening watchers or retaining a subscription

#### Scenario: Close before subscription is ready

- **WHEN** a panel cancels its subscription before asynchronous watch setup finishes
- **THEN** the obsolete request does not reopen watchers after cancellation

#### Scenario: Newer repository wins

- **GIVEN** two watch requests for the same panel resolve different repository directories
- **WHEN** the newer request finishes before the older one
- **THEN** the older result cannot replace or detach the newer subscription

#### Scenario: Repeated disposal and subsequent requests

- **WHEN** an already disposed registry is disposed again or receives a watch request
- **THEN** it remains idle without opening watchers or timers
