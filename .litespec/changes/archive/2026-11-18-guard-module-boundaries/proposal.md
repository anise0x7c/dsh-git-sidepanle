# Detect architectural regressions in the maintenance gate

## Why

The documented runtime and pure-logic boundaries are enforced only by reviewer memory. Feature work can silently reintroduce cross-runtime coupling, dependency cycles, unused declarations or unreachable production modules even while behavior tests pass.

## What Changes

The existing read-only maintenance command also checks runtime module boundaries and unused declarations. Failures identify the offending source modules. Positive and deliberately invalid fixtures exercise the architecture checker itself, so a checker that always passes is not sufficient.

## Non-goals

- No new runtime or development dependencies, new build entry points, source rewriting or arbitrary file-length limits.
- Type-only view/hook contracts remain allowed; runtime dependency rules are not confused with erased TypeScript imports.
- This does not claim to detect every unused public export or every semantic coupling problem.
