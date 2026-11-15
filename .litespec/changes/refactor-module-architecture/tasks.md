# Tasks

## Stage 0 — no-risk cleanup
- [ ] 0.1 Extract shared test doubles into `test/support/{fake-ctx,fake-menu,fixtures}.js`; make `test/client.test.mjs` and `test/ui.test.mjs` import them
- [ ] 0.2 Split the Host half into `src/host/**`; `index.js` keeps only `inject` + `apply`
- [ ] 0.3 Add direct unit tests for `parseStatus`, `parseUnifiedDiff`, `resolveRepositoryPath`
- [ ] 0.4 Fix the misplaced "Copy" banner in `client.js`, add the four-layer file header, partition-comment `GitPanel`
- [ ] 0.5 Add `docs/ARCHITECTURE.md`
- [ ] 0 acceptance: all tests green, host e2e unchanged

## Stage 1 — build contract
- [ ] 1.1 Add `esbuild` devDependency and `scripts/build-client.mjs` (`build` / `--watch` / `--check`)
- [ ] 1.2 Move the browser source into `src/client/**` + `src/client-entry.js`; generate and commit `client.js` + `client.js.map`
- [ ] 1.3 Wire npm scripts `build`, `dev`, `pretest`, `test`, `check:build`
- [ ] 1 acceptance: build idempotent, `check:build` clean, 35 tests green against the built artifact, source map points into `src/`

## Stage 2 — migrate the browser source by layer
- [ ] 2.1 locale dictionaries, `styles.css`, icons
- [ ] 2.2 pure layer: `git/format`, `git/tree`, `menu/*` (+ unit tests)
- [ ] 2.3 view layer: `panel/rows`, `Section`, `controls`, `feedback`, `titles`
- [ ] 2.4 `GitPanel` state machine into five hooks
- [ ] 2.5 `GitPanel` views: branch header, commit box, change groups, graph section
- [ ] 2.6 `DiffPanel` + `renderDiff`
- [ ] 2.7 `plugin.js` assembly + `client-entry.js`; artifact is wrapper only
- [ ] 2 acceptance: `GitPanel` ≤ 250 lines, `client.js` ≤ 150 lines, all tests green, `check:build` clean

## Stage 3 — quality gates
- [ ] 3.1 `scripts/verify-contract.mjs` against the real installed context-menu registry
- [ ] 3.2 `// @ts-check` + JSDoc on the pure layer
- [ ] 3.3 `CHANGELOG.md`, version `0.3.0`, `docs/ARCHITECTURE.md` refreshed, `AGENTS.md` layout/commands updated
- [ ] 3 acceptance: full test suite + contract script + `check:build` green; litespec validate clean
