# Typed and reproducible plugin maintenance workflow

## Why

JavaScript-only module boundaries and an ad-hoc build command leave type drift,
duplicate integration code and style regressions unchecked. Contributors need
one reproducible maintenance path without changing Git panel behavior.

## What Changes

- Require a lockfile-backed installation and an explicitly selected package manager.
- Provide checked source, tests and development scripts, with one quality gate
  covering types, code conventions, regression tests and generated-artifact freshness.
- Keep both installable JavaScript entry points committed so installing this
  directory still needs neither a compiler nor development dependencies.
- Document the new contributor commands and run the portable gate in CI.

The contributor-facing workflow is new; the existing Git Sidebar specification
and its 14 behavior requirements remain unchanged. Behavior-neutral code cleanup
and migration decisions are recorded in the design and refactor plan.

## Non-goals

- No new Git operations, UI redesign, route changes or DSH compatibility changes.
- No runtime dependencies, framework changes or migration of archived documents.
- No profile installation, service restart, automatic commit or release.
- No speculative rewrite of the graph algorithm or test renderer.
