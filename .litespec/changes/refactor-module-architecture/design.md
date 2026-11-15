# Design — module boundaries and build contract

## Context
`docs/REFACTOR-PLAN.md` (in the repository, reviewed with the user) is the
source of truth for the target layout. This file records the technical choices
the plan deferred and the reasons for them.

## Decided up front
1. **Build tool: esbuild.** Chosen over a hand-rolled concatenator because it
   gives source maps, CSS-as-text, and a stable CJS output for the artifact
   wrapper. It is installed as a devDependency; the plugin keeps zero runtime
   dependencies and the committed artifact is what the Host loads.
2. **Artifacts are committed** (`client.js`, `client.js.map`). The plugin is
   installed by directory (a profile `link:`), and the Host reads `client.js`
   directly; requiring a build before install would be more fragile than
   reviewing generated diffs. The generated file carries a banner pointing at
   `src/`.
3. **Type checking: JSDoc + `// @ts-check` only** on the pure-function layer.
   The plan's fallback is honored: `@ts-check` markers plus JSDoc, and no
   `typescript` dependency is added by this change.
4. **LiteSpec**: internal refactor, so no capability delta. The change records
   the intent, module boundaries and verification strategy.

## Dependency direction (review rule)
```
client-entry -> plugin -> { titles, panel/GitPanel, diff/DiffPanel, menu/*, locale/* }
GitPanel -> hooks/* -> { data/caller, menu/actions, git/format, git/tree }
views/*   -> { panel/controls, icons, git/format }
pure layer (git/*, menu/actions, locale/*, icons, constants) -> no React, no ctx
host: http/* -> nothing; git/* -> git/exec; rpc -> all; index -> rpc + http/respond
```
Pure modules must stay importable in Node without a DOM; views never call
`fetch`; only hooks touch the command caller.

## Artifact wrapper
`scripts/build-client.mjs` runs esbuild with:

| option | value |
|---|---|
| entryPoints | `src/client-entry.js` |
| bundle / format / platform / target | `true` / `cjs` / `neutral` / `es2022` |
| external | `['react']` |
| loader | `{ '.css': 'text' }` |
| sourcemap | `true` (external `client.js.map`, `sourcesContent` included) |
| banner.js | `window.__ModuleLoader__.load({ id: '@local/dsh-git-graph', factory: (require) => { var module = { exports: {} };` |
| footer.js | `return module.exports } })` |

Banner and footer are esbuild options (not post-processing) so the source map
offsets stay valid. `--check` rebuilds in memory and diffs against the committed
artifact; `--watch` runs the esbuild context watcher for the HMR dev loop.

## Verification strategy
- Floor: the 35 existing integration assertions (`test/host.test.mjs`,
  `test/client.test.mjs`, `test/ui.test.mjs`) must pass unchanged after every
  step; they load the built artifact, so they also cover the wrapper.
- New: direct unit tests for Host parsing/path helpers and browser pure helpers.
- `npm run check:build` must be clean after every commit.
- `scripts/verify-contract.mjs` loads the real installed
  `@deepseek-ai/dsh-client-ui-context-menu` registry, registers the plugin's
  shipped contribution through a fake context, and asserts that a changed file,
  a folder, a group header and a commit each resolve at least one command. This
  is the regression gate for the defect fixed in `7cac4e6`.
