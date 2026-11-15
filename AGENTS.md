# AGENTS.md

## What this project is

`@local/dsh-git-graph` — a DSH bundle that adds a VS Code-style Git
source-control surface to the Web GUI's right Sidebar: staged/unstaged/merge
changes as a folder tree, a commit box, unified diff tabs, a commit graph,
branch switching, and right-click menus.

- One bundle, two halves: Host (`index.js` + `src/host/**`, plain Node ESM) and
  browser (`src/client/**`, bundled into the DSH client artifact `client.js`).
- Zero runtime dependencies. One devDependency: `esbuild`, used only to build
  the browser half. Tests run on the Node built-in test runner (`npm test`,
  Node ≥ 22).
- Behavior truth lives in `.litespec/specs/git-sidebar/spec.md`
  (13 requirements). User-facing docs: `README.md`, `docs/DETAIL.md` (English),
  `docs/DETAIL.zh.md` (Chinese). Architecture: `docs/ARCHITECTURE.md`.
  `docs/REFACTOR-PLAN.md` records the 0.3.0 split that produced the current
  layout — read it for rationale, not as a to-do list.

## Where things live

| Path | Purpose |
|---|---|
| `index.js` | Host entry: `inject = ['webServer']`, `apply` registers the RPC and health routes and maps failures |
| `src/host/http/` | `respond.js` (sendJson, readJsonBody), `trust.js` (loopback/same-origin fence) |
| `src/host/git/` | `exec.js` (process execution, repository root, path checks), `status.js`, `history.js`, `branches.js`, `diff.js` |
| `src/host/` | `rpc.js` (dispatch + paths), `session.js`, `errors.js` |
| `src/client/**` | Browser half, layered: `constants`, `locale/`, `styles.css`, `icons`, `data/caller`, `git/` (pure), `menu/` (pure + clipboard), `panel/` component files, `panel/hooks`, `panel/views`, `panel/GitPanel.js`, `diff/`, `titles.js`, `plugin.js` |
| `src/client-entry.js` | Build entry: exports `{ inject, apply }` from `src/client/plugin.js` |
| `client.js`, `client.js.map` | **Generated** by `scripts/build-client.mjs` — never hand-edit; committed |
| `scripts/build-client.mjs` | esbuild build: `npm run build`, `npm run dev` (watch), `npm run check:build` |
| `scripts/verify-contract.mjs` | Menu registry contract check against the real installed DSH package |
| `cordis.patch.yml` | Loader patch: inserts one row `git-graph` named `@local/dsh-git-graph` |
| `package.json` | `dsh.client` manifest (`platform: web`, `immediately`, `inject`), exports, version, scripts |
| `locale/*.json` | Plugin **metadata** locale (title, description, detail doc). Not UI copy |
| `test/host.test.mjs` | Real loopback server + real Git fixture repositories |
| `test/client.test.mjs` | Bundle factory/registration assertions without a DOM |
| `test/ui.test.mjs` | Rendered panel behavior over `test/support/mini-react.mjs` |
| `test/unit/` | Pure-function tests: Host parsers, browser formatting/tree/locale/menu actions |
| `test/support/` | Fake ctx + menu stand-in, fixtures, mini React |
| `icon.svg`, `docs/`, `CHANGELOG.md` | Artwork and documentation |

## Commands

```bash
npm install        # once: fetches the esbuild build dependency
npm test           # pretest builds client.js, then 159 tests must stay green
npm run build      # write client.js + client.js.map from src/client/**
npm run dev        # watch mode: rebuild on save; the open page hot-reloads
npm run check:build# fail when the committed artifact does not match the sources
npm run verify:contract  # menu contract against the real DSH installation
```

The build is part of the contract, not a convenience: `client.js` and
`client.js.map` are committed, and `check:build` must be clean at every commit.

## Contracts you must not break

1. **Browser artifact contract.** The artifact must call
   `window.__ModuleLoader__.load({ id: '<package name>', factory })`. The
   factory must be side-effect free and return `{ inject, apply }`; styles,
   timers, listeners and registrations belong inside `apply` via `ctx.effect`.
   `require` resolves only the platform table plus declared package externals —
   in this bundle only `react`. Never bundle or re-export React. The bundler
   wrapper lives in `scripts/build-client.mjs`; do not hand-edit its output.
2. **Shared context-menu registry contract.** Registering a contribution
   (`ctx.contextMenus.register({ id, target, order, resolve })`) means the
   registry calls `resolve` with the **captured target's value**, not with the
   `{ kind, value }` wrapper the trigger received. Unwrapping `.value` again
   silently opens an empty menu — exactly the defect fixed in `7cac4e6`.
   Test doubles must mirror this wrapper, never the implementation's assumption;
   `scripts/verify-contract.mjs` checks it against the real registry.
3. **Slot standard props.** The panel receives `props.useContextMenu` from the
   root standard props; call it once inside `useMemo`. Do not import DSH client
   packages or UI primitives directly.
4. **Host route and trust fence.** One route family:
   `/api/dsh-git-graph/rpc` plus `/api/dsh-git-graph/health`. A request must
   come from a loopback socket with a loopback `Host`, send the bundle header
   `x-dsh-git-graph: 1`, carry no proxy headers (`x-forwarded-for`,
   `cf-connecting-ip`), and present same-origin markers
   (`sec-fetch-site: same-origin`, matching `Origin` when present). Never run
   through a shell, and never accept a repository path from the browser (only
   session ids and repository-relative paths).
5. **Copy-path base.** Absolute paths are formed from `repo.root`. `repo.cwd`
   is the Session's working directory and may be a subdirectory of the
   repository.
6. **Locale.** Every visible string goes through `ctx.locale.bind('gitGraph')`
   and exists in both dictionaries inside `src/client/locale/`. `locale/*.json`
   is only plugin metadata. The locale unit test asserts key and placeholder
   parity for both languages.
7. **Theme and keyboard.** Style with `--dsw-*` theme tokens only. Rows and
   triggers keep `tabIndex` / `aria-haspopup="menu"` semantics and the host's
   dismissal behavior.

## Dependency direction (review rule)

```text
client-entry -> plugin -> { titles, panel/GitPanel, diff/DiffPanel, menu/*, locale/* }
GitPanel -> panel/hooks/* -> { data/caller, menu/actions, git/*, menu/bus }
panel/views/* -> { panel/controls, icons, git/format }
pure layer (git/*, menu/actions, constants, locale/*, icons) -> no React, no ctx
host: http/* -> nothing; git/* -> git/exec; rpc -> all; index -> rpc + http/*
```

Pure modules must stay importable in Node without a DOM — that is what makes
`test/unit/` possible. Views never call `fetch` or the command caller; only
hooks do. Do not introduce project-to-project cycles.

## Install and the development loop

- Install: DSH **Plugins → Add plugin** with this directory, or `install_bundle`
  with the directory path. The profile links the directory (`link:`), so the
  Host reads the committed `client.js` artifact directly and no build is needed
  at install time.
- **Browser half changes**: edit `src/client/**` → `npm run build` (or keep
  `npm run dev` running) → DSH polls the artifact (~500 ms) and swaps the
  plugin in the open page. To check what the running Host serves, read the
  public events stream, take the row URL/rev for `@local/dsh-git-graph`, and
  fetch it:

  ```bash
  curl -sN --max-time 3 http://127.0.0.1:<gui-port>/plugins/events
  # graph.entries[] → {id, url, rev}; then curl http://127.0.0.1:<gui-port>/<url>
  ```

- **Host half changes** (`index.js`, `src/host/**`) take effect only after a
  Host restart (Host halves do not hot-reload by default).
- Verify user-visible behavior in the real page when possible: right-click a
  row (menus), stage/unstage, discard confirmation, commit, diff tab, branch
  switch. There is no browser control in this environment; use the served
  artifact, the events stream, `npm run verify:contract` and client Slots
  inspection, then ask the user for the final click-through.

## Testing conventions

- Built-in `node:test` only; no third-party test frameworks or DOM libraries.
- Layered suite: `test/unit/` imports pure modules directly (no build, no DOM,
  no Git process); `test/host.test.mjs` spawns real `git` in fixture repos;
  `test/client.test.mjs` and `test/ui.test.mjs` load the built artifact.
- **Test doubles mirror host contracts, not implementation assumptions.** When
  a real host service is mocked, mock the wrapper/ordering the host applies
  (see contract 2 and `test/support/fake-ctx.js`).
- Prefer a failing regression test first; do not weaken assertions to make a
  refactor pass — the spec is the behavior.
- Host tests clean up through the file's module-level `after()` hook.
- UI tests render over `test/support/mini-react.mjs`; add harness capabilities
  there rather than reaching into component internals.

## Specs, docs and history

- **Observable behavior change** → LiteSpec change: scaffold with
  `litespec_new`, write `proposal.md` + delta in
  `changes/<id>/specs/<capability>/spec.md`, tick `tasks.md`, run
  `litespec_validate`, then `litespec_archive`. Never hand-edit
  `.litespec/specs/` and never archive with `force` to silence validation.
- **Internal refactor** (no behavior/contract change) → no LiteSpec change:
  `litespec_validate` requires a spec delta, so behavior-neutral work is
  recorded in `docs/REFACTOR-PLAN.md` and `CHANGELOG.md` instead. Use the
  plan's checklist pattern and keep every step green.
- Keep `docs/DETAIL.md` and `docs/DETAIL.zh.md` in sync; document behavior, not
  implementation. Update `docs/ARCHITECTURE.md` when module boundaries move and
  `CHANGELOG.md` for every released version.
- Commit style: imperative single-line subject, no type prefix; a short body
  when the reason is not obvious. Bump patch for fixes, minor for features.

## Style

- 2-space indent, single quotes, no semicolons, no tabs; comments in English.
- Keep pure logic (parsing, tree building, path/menu action resolution) free of
  React and context services so it stays directly testable; the pure layer
  carries JSDoc and `// @ts-check`.
- Keep functions small; give exported helpers JSDoc, and keep view modules
  presentational (props in, elements out).

## Do not

- Do not hand-edit `client.js` or `client.js.map`; edit `src/client/**` and
  rebuild. `npm run check:build` catches a stale artifact.
- Do not edit `.litespec/specs/` directly or delete archived changes.
- Do not add runtime dependencies; check the DSH version contract in
  `package.json` (`engines.dsh`) and the module-table limits before adding a
  client external.
- Do not touch `node_modules/` or `.tmp-test*/`; they are ignored.
- Do not log or transmit repository contents beyond the local loopback route.
- Do not rename the artifact or its exports (`./client`, `{ inject, apply }`);
  the Host module system depends on them.

<!-- litespec:start -->
## Spec-driven workflow (litespec)

This project uses litespec. Current behavior lives in `.litespec/specs/`.
Before changing observable behavior, create a change under `.litespec/changes/<change-id>/`
with a proposal and a spec delta, implement its tasks, then run `litespec validate`.
<!-- litespec:end -->
