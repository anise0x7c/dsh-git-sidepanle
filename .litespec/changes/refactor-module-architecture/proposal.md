# Refactor bundle into modular source with a build contract

## Why
Both halves of the bundle are single files — `client.js` 1,969 lines and
`index.js` 769 lines — and each mixes six unrelated responsibilities. The
browser half in particular has reached the point where the largest component
(`GitPanel`, 674 lines) owns 17 `useState`, 6 `useEffect`, 5 `useCallback` and
7 `useMemo` hooks, so every UI change forces edits in a 2,000-line file. The
Host half has the milder version of the same problem: parsing, trust checks, Git
execution and dispatch all share one scope.

The browser loader requires exactly one client artifact per package, so the
browser half cannot simply be split into sibling files that `import` each other
at runtime. The intended fix is the documented one: keep `client.js` as a
generated artifact and add a minimal build that emits it from modular sources.

This change is an internal refactor. It changes no observable behavior: the
routes, JSON shapes, trust fence, rendering, menus, shortcuts and copy stay
identical, and the artifact keeps the `window.__ModuleLoader__.load({ id,
factory })` contract with `{ inject, apply }` exports.

## What Changes
**Source layout (internal only).** The Host half moves to `src/host/**` ES
modules behind a thin `index.js` entry. The browser half moves to `src/client/**`
in four layers — contract/data, pure functions, views, assembly — and
`src/client-entry.js` becomes the single build entry. `client.js` and
`client.js.map` become generated files produced by `scripts/build-client.mjs`
(esbuild), committed to the repository.

**Test and verification infrastructure.** Shared test doubles move to
`test/support/`; pure parsing and path helpers gain direct unit tests that spawn
no Git process; `scripts/verify-contract.mjs` pins the shared context-menu
registry contract against the real installed registry; `npm run check:build`
guards artifact freshness. Test count grows from 35 to roughly 55 while the 35
existing integration assertions stay untouched.

**Docs and metadata.** New `docs/ARCHITECTURE.md`, updated `AGENTS.md` layout
table, `CHANGELOG.md`, and version `0.3.0`.

No capability delta is attached: the behavior record in
`.litespec/specs/git-sidebar/spec.md` is unchanged by this change.

## Non-goals
- No change to the visible UI, interaction design, copy, or menu contents.
- No change to the Host RPC shape, trust fence, or loopback rules.
- No new runtime dependencies; `esbuild` is a devDependency only, and the
  installed bundle keeps zero runtime dependencies.
- No TypeScript migration: the pure layer gets JSDoc plus `// @ts-check` only.
- No split into multiple packages or artifacts.
