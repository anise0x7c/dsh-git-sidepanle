# AGENTS.md

## What this project is

`@local/dsh-git-graph` — a DSH bundle that adds a VS Code-style Git
source-control surface to the Web GUI's right Sidebar: staged/unstaged/merge
changes as a folder tree, a commit box, unified diff tabs, a commit graph,
branch switching, and right-click menus.

- One bundle, two halves: Host (`index.js`, Node ESM) and browser
  (`client.js`, a DSH client artifact).
- Zero runtime and dev dependencies. Tests run on the Node built-in test
  runner (`npm test`, Node ≥ 22).
- Behavior truth lives in `.litespec/specs/git-sidebar/spec.md`
  (13 requirements). User-facing docs: `README.md`, `docs/DETAIL.md` (English),
  `docs/DETAIL.zh.md` (Chinese).
- Structural work in flight: `docs/REFACTOR-PLAN.md` describes the planned
  split of the two single-file halves. Read it before large edits and keep its
  baseline numbers current.

## Where things live

| Path | Purpose |
|---|---|
| `index.js` | Host half: `inject = ['webServer']`, the guarded Git RPC route, the health route, Git execution and porcelain/diff parsing |
| `client.js` | Browser half: the single client artifact — dictionaries, CSS, icons, helpers, context-menu contribution, `GitPanel`, `DiffPanel`, tab titles, `apply` |
| `cordis.patch.yml` | Loader patch: inserts one row `git-graph` named `@local/dsh-git-graph` |
| `package.json` | `dsh.client` manifest (`platform: web`, `immediately`, `inject`), exports, version |
| `locale/*.json` | Plugin **metadata** locale (title, description, detail doc). Not UI copy |
| `test/host.test.mjs` | Real loopback server + real Git fixture repositories |
| `test/client.test.mjs` | Bundle factory/registration assertions without a DOM |
| `test/ui.test.mjs` | Rendered panel behavior over `test/support/mini-react.mjs` |
| `icon.svg`, `docs/` | Artwork and documentation |

## Commands

```bash
npm test        # node --test test/*.test.mjs — 35 tests, must stay green
```

There is currently no build step: `client.js` is hand-written and is the shipped
artifact. If REFACTOR-PLAN phase 1 lands, `npm run build`, `npm run dev`
(watch), `npm run check:build` and `client.js.map` appear — update this file
and the layout table when that happens.

## Contracts you must not break

1. **Browser artifact contract.** The artifact must call
   `window.__ModuleLoader__.load({ id: '<package name>', factory })`. The
   factory must be side-effect free and return `{ inject, apply }`; styles,
   timers, listeners and registrations belong inside `apply` via `ctx.effect`.
   `require` resolves only the platform table plus declared package externals —
   in this bundle only `react`. Never bundle or re-export React.
2. **Shared context-menu registry contract.** Registering a contribution
   (`ctx.contextMenus.register({ id, target, order, resolve })`) means the
   registry calls `resolve` with the **captured target's value**, not with the
   `{ kind, value }` wrapper the trigger received. Unwrapping `.value` again
   silently opens an empty menu — exactly the defect fixed in `7cac4e6`.
   Test doubles must mirror this wrapper, never the implementation's assumption.
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
   and exists in both dictionaries inside `client.js`. `locale/*.json` is only
   plugin metadata. The copy tests assert the key list for both languages.
7. **Theme and keyboard.** Style with `--dsw-*` theme tokens only. Rows and
   triggers keep `tabIndex` / `aria-haspopup="menu"` semantics and the host's
   dismissal behavior.

## Install and the development loop

- Install: DSH **Plugins → Add plugin** with this directory, or `install_bundle`
  with the directory path.
- **Host half changes** take effect only after a Host restart (Host halves do
  not hot-reload by default).
- **Browser half changes** hot-reload: DSH polls the artifact (~500 ms) and
  swaps the plugin in the open page. To check what the running Host serves,
  read the public events stream, take the row URL/rev for `@local/dsh-git-graph`,
  and fetch it:

  ```bash
  curl -sN --max-time 3 http://127.0.0.1:<gui-port>/plugins/events
  # graph.entries[] → {id, url, rev}; then curl http://127.0.0.1:<gui-port>/<url>
  ```

- Verify user-visible behavior in the real page when possible: right-click a
  row (menus), stage/unstage, discard confirmation, commit, diff tab, branch
  switch. There is no browser control in this environment; use the served
  artifact, the events stream and client Slots inspection, then ask the user
  for the final click-through.

## Testing conventions

- Built-in `node:test` only; no third-party test frameworks or DOM libraries.
- **Test doubles mirror host contracts, not implementation assumptions.** When
  a real host service is mocked, mock the wrapper/ordering the host applies
  (see contract 2 and the stand-ins in `test/client.test.mjs` and
  `test/ui.test.mjs`).
- Prefer a failing regression test first; do not weaken assertions to make a
  refactor pass — the spec is the behavior.
- Host tests spawn real `git` in fixture repositories; keep them self-contained
  and clean up through the file's module-level `after()` hook.
- UI tests render over `test/support/mini-react.mjs`; add harness capabilities
  there rather than reaching into component internals.

## Specs, docs and history

- **Observable behavior change** → LiteSpec change: scaffold with
  `litespec_new`, write `proposal.md` + delta in
  `changes/<id>/specs/<capability>/spec.md`, tick `tasks.md`, run
  `litespec_validate`, then `litespec_archive`. Never hand-edit
  `.litespec/specs/` and never archive with `force` to silence validation.
- **Internal refactor** (no behavior/contract change) → no delta needed; use
  the refactor plan's checklist and keep each step green. Optionally record a
  change with only `proposal.md` + `design.md`.
- Keep `docs/DETAIL.md` and `docs/DETAIL.zh.md` in sync; document behavior, not
  implementation.
- Commit style: imperative single-line subject, no type prefix; a short body
  when the reason is not obvious. Bump patch for fixes, minor for features.

## Style

- 2-space indent, single quotes, no semicolons, no tabs; comments in English.
- Keep pure logic (parsing, tree building, path/menu action resolution) free of
  React and context services so it stays directly testable.
- Add new code to the matching banner section of the current files until the
  refactor lands; keep functions small and give exported helpers JSDoc.

## Do not

- Do not edit `.litespec/specs/` directly or delete archived changes.
- Do not add runtime dependencies to the bundle without checking the DSH
  version contract in `package.json` (`engines.dsh`) and the module-table limits.
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
