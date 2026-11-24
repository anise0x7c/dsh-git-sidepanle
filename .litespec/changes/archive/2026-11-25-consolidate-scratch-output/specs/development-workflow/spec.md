# development-workflow delta

## ADDED Requirements

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
