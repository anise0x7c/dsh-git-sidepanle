# Development Workflow Specification

## Purpose
Give plugin contributors a reproducible maintenance path that catches regressions before distribution.

## Requirements

### Requirement: Reproducible contributor installation

The project SHALL declare a package-manager version and a committed dependency lock so a clean, frozen installation reproduces the development dependency graph without modifying that lock.

#### Scenario: Clean checkout

- **WHEN** a contributor installs development dependencies with the documented frozen-install command
- **THEN** the selected dependency versions match the committed lock and the lock remains unchanged

#### Scenario: Dependency metadata disagrees

- **WHEN** dependency declarations and the committed lock disagree
- **THEN** the frozen-install command fails rather than silently resolving a new dependency graph

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

### Requirement: Single scratch folder

The project SHALL keep every project-local scratch artifact under one ignored
`.temp/` folder at the repository root, with caches, logs, browser profiles and
package-manager state under `.temp/cache/` and screenshots and probe HTML under
`.temp/preview/`. The project SHALL NOT create or ignore another root-level
scratch directory. Tests SHALL use operating-system temporary directories
unless they specifically need a path inside the workspace.

#### Scenario: Sandboxed installation

- **WHEN** the documented Linux sandbox workaround points `XDG_RUNTIME_DIR`
  into the workspace
- **THEN** it uses `.temp/cache/runtime` and the pnpm store stays under
  `node_modules/`

#### Scenario: Preview artifact

- **WHEN** a contributor captures a screenshot or writes a probe page while
  checking the panel
- **THEN** the artifact is written under `.temp/preview/`

#### Scenario: Obsolete scratch roots

- **WHEN** a contributor checks the repository's ignore rules
- **THEN** `.temp/` is ignored and no separate cache, preview or test-temp root
  is ignored

#### Scenario: Test scratch space

- **WHEN** a test needs a temporary repository
- **THEN** it creates one in an operating-system temporary directory and
  removes it afterwards

### Requirement: Third-party attribution and notices

The plugin SHALL ship its own license together with a third-party notices
document that names every third-party component it contains or is derived
from, that component's license, and its copyright holder, including the full
license text where the license requires one. A source file derived from another
project SHALL retain that project's copyright line and point at the notices
document. A dependency or asset that enters the distributed file set SHALL be
recorded in the notices document in the same change, and the document SHALL
state which runtime externals and build-time dependencies are not distributed.

#### Scenario: Install a prepared directory

- **WHEN** the prepared plugin directory is installed
- **THEN** it contains the plugin's license and the third-party notices, and the
  notices name Code OSS with its MIT license text

#### Scenario: Derived source file

- **WHEN** a contributor ports code from another project into a source file
- **THEN** the file keeps that project's copyright line and the notices
  document records the component, its license and its holder

#### Scenario: New distributed material

- **WHEN** a change adds a dependency or asset that is distributed with the
  plugin
- **THEN** the notices document is updated in the same change, or the material
  is marked as host-provided or build-time only

#### Scenario: Unshipped dependencies

- **WHEN** a consumer reads the notices to learn what the plugin does not bundle
- **THEN** the runtime externals and the build-time development dependencies are
  identified as not distributed
