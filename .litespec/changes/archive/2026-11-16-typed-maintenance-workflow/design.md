# Design

## Migration boundaries

- All authored executable project code moves to TypeScript: Host, browser,
  build/contract scripts and test/support code. CSS, JSON, SVG and loader YAML
  retain their native formats. Generated JavaScript remains JavaScript.
- TypeScript runs in strict, no-emit mode. Internal imports use explicit `.ts`
  extensions; tests and scripts execute through the development-only `tsx`
  loader. React stays external and only its declarations are installed.
- esbuild bundles `src/host-entry.ts` to `index.js` (Node ESM, built-ins external)
  and `src/client-entry.ts` to the existing wrapped `client.js` artifact. Both
  source maps are committed with embedded source content.
- Domain/RPC types can be shared through erased type-only imports. Minimal
  structural DSH interfaces describe only verified methods the plugin consumes;
  no DSH runtime package is added to the dependency graph.

## Tooling

- Pin the available pnpm 11.28.5; use its committed lockfile. Remove the npm
  lockfile after successful migration. No dependency install scripts are needed.
- Biome owns formatting/import organization and recommended lint checks for
  authored TypeScript and configuration. Generated artifacts, historical
  specs and preview files are excluded, not silently rewritten.
- The read-only quality gate checks types and style, runs tests without
  rebuilding, then checks both generated artifacts against a fresh in-memory
  build. This prevents pretest from hiding stale artifacts. `pnpm test` remains
  convenient and builds first; CI uses the read-only gate.
- The real installed DSH context-menu contract check stays a separate explicit
  integration gate because portable CI has no DSH installation.

## Baseline and risks

Baseline: 208 tests in 35 suites pass on 2026-11-16. Preserve all assertions,
loopback/same-origin protections, repository-relative path validation, menu
captured-value semantics, locale parity and keyboard behavior. Generated Host
code now needs rebuilding as well as a Host restart to become live. No Host
restart or profile operation is performed by this change.

Review focuses on concrete duplication and unchecked module boundaries, not
cosmetic algorithm rewrites. Existing UI behavior is pinned by regression tests.

## Review outcomes

- Extracted repeated keyed-Slot and optional-service registration while retaining
  registration order, diagnostics and failure isolation.
- Shared panel/diff caller and trigger wiring, and made operation payloads
  mandatory where required through compile-only type regressions.
- Corrected pre-existing top-level DOM style injection, which violated the
  documented side-effect-free browser factory contract. Styles now use an
  effect-owned, lazy per-document lease registry across module replacements;
  cleanup is idempotent, replacement updates CSS, and adopted tags are not removed.
- Removed an identical duplicate chevron color rule. Two component-local SVG
  specificity exceptions and the Cordis void-or-disposer type are explained
  locally rather than disabling a lint category globally.
- Host unknown inputs retain runtime validation. The success-value assertion at
  the trusted local RPC boundary remains explicit; a broad schema rewrite and a
  discriminated menu-target redesign are deliberately deferred.
- Normal builds validate both targets before writing either; watch builds use
  the same validation. Build metadata rejects non-builtin Host imports and
  browser externals other than React.
