# Keep scratch output under one ignored .temp folder

## Why

Scratch output was spread over three ignore roots (`.cache/`, `.preview/` and
`.tmp-test*`), so a contributor had to know which folder a given artifact
belonged in, and the root collected a scratch directory per tool. At the same
time the changelog lived in `docs/` while the contributor guide named a
repository-root `CHANGELOG.md`, so the documented path did not exist.

The working tree already performed this housekeeping; this change records the
contributor-facing rule and updates the documents that pointed at removed
files.

## What Changes

- Every project-local scratch artifact lives under one ignored `.temp/` folder
  at the repository root: caches, logs, browser profiles and package-manager
  state under `.temp/cache/`, screenshots and probe HTML under
  `.temp/preview/`.
- The ignore rules drop the obsolete `.cache/`, `.preview/` and `.tmp-test*`
  entries and ignore `.temp/` instead.
- The documented Linux sandbox workaround points `XDG_RUNTIME_DIR` at
  `.temp/cache/runtime`.
- The changelog returns to the repository root, where
  [AGENTS.md](../../AGENTS.md) and the README already point.
- The README and the architecture guide link only to documents that exist. The
  historical Chinese refactor and maintenance records are removed; their
  durable rules remain in the guides and in this specification.

## Non-goals

- No runtime behavior, RPC contract or Git operation changes.
- `node_modules/`, the pnpm store location and OS-level temporary directories
  used by tests stay where their tooling puts them.
- The changelog's released sections keep their content; only the file's
  location and the unreleased entries change.
