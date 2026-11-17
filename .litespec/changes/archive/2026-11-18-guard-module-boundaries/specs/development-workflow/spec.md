# Development Workflow delta

## MODIFIED Requirements

### Requirement: Automated maintenance gate

The project SHALL offer a documented single command that checks source, test and script types, rejects unused declarations, enforces code conventions, runs the behavior regression suite and rejects stale distribution artifacts. The gate MUST also reject runtime dependency cycles, cross-runtime imports, runtime imports of shared wire declarations, forbidden dependencies in designated pure logic and unreachable executable production modules. It SHALL return a nonzero exit status with a diagnostic when any check fails, without repairing source or artifacts.

#### Scenario: Valid changes

- **WHEN** a contributor runs the gate after regenerating artifacts for valid source changes
- **THEN** all checks complete successfully

#### Scenario: Invalid or stale changes

- **WHEN** a contributor runs the gate with a type error, an unused declaration, a convention violation, a failing regression or a stale generated artifact
- **THEN** the gate fails with a diagnostic instead of silently repairing the defect

#### Scenario: Runtime layering violation

- **WHEN** a contributor introduces a runtime cycle, imports one runtime half from the other, imports shared wire declarations as runtime values or adds a forbidden dependency to designated pure logic
- **THEN** the gate rejects the change and identifies the offending module dependency

#### Scenario: Orphaned production module

- **WHEN** a contributor leaves an executable production module unreachable from either distribution entry point
- **THEN** the gate identifies the orphaned module and fails

#### Scenario: Erased type dependency

- **WHEN** a view imports a hook's contract only as a type, or either runtime imports shared wire types only as types
- **THEN** that erased dependency alone does not count as a runtime cycle or layering violation
