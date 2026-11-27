# Development Workflow Delta

## Purpose

Give plugin contributors a reproducible maintenance path that catches regressions before distribution.

## ADDED Requirements

### Requirement: Reproducible contributor installation

The project SHALL declare a package-manager version and a committed dependency lock so a clean, frozen installation reproduces the development dependency graph without modifying that lock.

#### Scenario: Clean checkout

- **WHEN** a contributor installs development dependencies with the documented frozen-install command
- **THEN** the selected dependency versions match the committed lock and the lock remains unchanged

#### Scenario: Dependency metadata disagrees

- **WHEN** dependency declarations and the committed lock disagree
- **THEN** the frozen-install command fails rather than silently resolving a new dependency graph

### Requirement: Automated maintenance gate

The project SHALL offer a documented single command that checks source, test and script types, enforces code conventions, runs the behavior regression suite and rejects stale distribution artifacts, returning a nonzero exit status when any check fails.

#### Scenario: Valid changes

- **WHEN** a contributor runs the gate after regenerating artifacts for valid source changes
- **THEN** all checks complete successfully

#### Scenario: Invalid or stale changes

- **WHEN** a contributor runs the gate with a type error, a convention violation, a failing regression or a stale generated artifact
- **THEN** the gate fails with a diagnostic instead of silently repairing the defect

### Requirement: Compiler-free plugin installation

The plugin SHALL retain committed JavaScript distribution entry points that can be loaded without development dependencies or a compilation step and preserve the existing Host and browser loader contracts.

#### Scenario: Install a prepared directory

- **WHEN** DSH loads a prepared plugin directory without its development dependencies
- **THEN** the Host entry and browser module factory expose the existing injection and application exports without needing a compiler

### Requirement: Continuous integration parity

The project SHALL run the documented frozen installation and maintenance gate in continuous integration using supported runtime versions.

#### Scenario: Proposed maintenance change

- **WHEN** a change is submitted to the configured continuous integration workflow
- **THEN** the same portable type, convention, regression and artifact checks used locally determine whether it passes
