# AGENTS.md

## What this project is

`@local/dsh-git-graph` — a DSH bundle that adds a VS Code-style Git
source-control surface to the Web GUI's right Sidebar: staged/unstaged/merge
changes as flat, path-sorted lists, a commit box, unified diff tabs, a commit graph
whose commits expand inline to list the files they changed (the details view
opens from the commit menu's View Details), branch switching, local and remote
branch checkout, fetch/pull/push/sync/publish, remote configuration, and
right-click menus.

- One bundle, two TypeScript halves: Host (`src/host-entry.ts` + `src/host/**`)
  and browser (`src/client-entry.ts` + `src/client/**`). Shared wire types live
  in `src/shared/git.ts` and are imported type-only.
- Zero runtime dependencies. Development tools: TypeScript, tsx, esbuild,
  Biome and Node/React declarations. Tests use Node's built-in runner.
  Development needs Node ≥ 22.13 (pnpm 12); generated runtime artifacts stay Node ≥ 22.
- Both halves compile to committed JavaScript: `index.js`, `client.js` and
  their maps. A prepared plugin directory needs no compiler at install time.
- Behavior truth lives in `.litespec/specs/git-sidebar/spec.md`
  (52 requirements; latest archived change 2026-11-20 native-toast-notifications). User-facing docs: `README.md`, `docs/DETAIL.md` (English),
  `docs/DETAIL.zh.md` (Chinese). Architecture: `docs/ARCHITECTURE.md`.
  `docs/REFACTOR-PLAN.md` records the 0.3.0 split that produced the current
  layout and subsequent maintenance rounds — read completed sections for rationale,
  not as a fresh to-do list. `docs/MAINTENANCE-AUDIT.md` records the 2026-11-18
  findings, verification evidence and remaining trust boundaries.

## Where things live

| Path | Purpose |
|---|---|
| `src/host-entry.ts` | Host source entry: `inject = ['webServer']`, `apply` registers the RPC and health routes and maps failures |
| `src/host/http/` | `respond.ts` (sendJson, readJsonBody), `trust.ts` (loopback/same-origin fence) |
| `src/host/git/` | `exec.ts` (literal-path Git execution + repository discovery), `paths.ts` (containment), `files.ts` (safe direct untracked access), `changes.ts` (file actions), `mutations.ts` (commit/ref writes and remote-branch checkout), `remotes.ts` (remote listing/configuration and network synchronization), `status.ts`, `history.ts`, `references.ts` (graph's checked-out/upstream/base refs), `branches.ts` (local and remote-tracking branch listing), `diff.ts`, `ignore.ts` |
| `src/host/watch/` | `classify.ts` (watch-event to change-kind rules, pure), `registry.ts` (shared per-repository watchers, debounce, subscription lifetime, change counters) |
| `src/host/` | `rpc.ts` (dispatch + route paths), `validation.ts` (wire fields), `session.ts`, `errors.ts` |
| `src/client/**` | Browser half, layered: `constants`, `types/` (local domain/DSH contracts), `locale/`, `styles/` (per-area CSS + ordered assembly in `index.ts`) and `styles.ts` (style lease), `icons`, `host-file-icon` (the host's file-type glyph with a local fallback), `toast/` (the single-notice store and the native `Toast` host, both with a shared-service fallback), `data/caller`, `git/` (pure), `menu/` (pure + clipboard), `panel/` component files, `panel/hooks`, `panel/views`, `panel/GitPanel.ts`, `diff/`, `titles.ts`, `plugin.ts` |
| `src/client-entry.ts` | Build entry: exports `{ inject, apply }` from `src/client/plugin.ts` |
| `index.js`, `index.js.map`, `client.js`, `client.js.map` | **Generated** by `scripts/build.ts` — never hand-edit; committed |
| `scripts/build.ts` | esbuild build: `pnpm build`, `pnpm dev` (watch), `pnpm check:build` |
| `scripts/verify-contract.ts` | Menu registry contract check against the real installed DSH package |
| `cordis.patch.yml` | Loader patch: inserts one row `git-graph` named `@local/dsh-git-graph` |
| `package.json` | `dsh.client` manifest (`platform: web`, `immediately`, `inject`), exports, version, scripts |
| `locale/*.json` | Plugin **metadata** locale (title, description, detail doc). Not UI copy |
| `test/host.test.ts`, `test/host-paths.test.ts`, `test/host-watch-lifecycle.test.ts` | Real loopback/Git behavior, literal-path and direct-file safety, deterministic watch cancellation/disposal races |
| `test/client.test.ts` | Bundle factory/registration assertions without a DOM |
| `test/registration.test.ts` | Loader registration, style lease and side-effect-free factory over the built artifact |
| `test/tooling.test.ts` | Package manifest, exports, CI workflow and generated-artifact contracts |
| `test/types/rpc.type-test.ts` | Compile-only RPC request/response assertions; never executed |
| `test/ui.test.ts` | Rendered panel behavior over `test/support/mini-react.ts` |
| `test/architecture.test.ts` | AST-based runtime boundary/cycle/reachability gate plus deliberately invalid fixtures; helper in `test/support/architecture.ts` |
| `test/unit/` | Pure-function and lifecycle tests: Host parsers, browser formatting/list/grouping/graph/split/locale/menu actions, clipboard and test harness cleanup |
| `test/support/` | Fake ctx + menu stand-in, fixtures, mini React, `vscode-scm-history.ts` (literal VS Code graph oracle for the equivalence test) |
| `icon.svg`, `docs/`, `CHANGELOG.md` | Artwork and documentation |

## Commands

```bash
pnpm install --frozen-lockfile # pinned pnpm and committed dependency graph
pnpm build                    # generate Host/browser JavaScript + maps
pnpm test                     # build first, then run regression tests
pnpm check                    # read-only: types, Biome, tests, artifact freshness
pnpm lint:fix                 # safe lint/import/format fixes
pnpm format                   # formatting only
pnpm dev                      # watch both halves; Host still needs restart
pnpm check:build               # in-memory freshness check of all four artifacts
pnpm verify:contract           # integration with the real installed DSH registry
```

Do not put an automatic build before `pnpm check`: it must reject stale
artifacts, not repair them. CI runs the portable gate on Node 22 and 24.
`verify:contract` stays separate because CI does not include DSH. Dependency
build scripts are disabled; optional platform binaries supply the tooling.
Dependency upgrades respect pnpm 12's 24-hour `minimumReleaseAge` window: wait
for a release to age out instead of adding `minimumReleaseAgeExclude` entries
to force a fresh version, and never chase patch releases the day they ship.

## Contracts you must not break

1. **Browser artifact contract.** The artifact must call
   `window.__ModuleLoader__.load({ id: '<package name>', factory })`. The
   factory must be side-effect free and return `{ inject, apply }`; styles,
   timers, listeners and registrations belong inside `apply` via `ctx.effect`.
   `require` resolves only the platform table plus declared package externals —
   in this bundle `react` and the two guarded host-primitive requests described in
   contract 3. Never bundle or re-export React. The bundler wrapper lives in
   `scripts/build.ts`; do not hand-edit its output.
2. **Shared context-menu registry contract.** Registering a contribution
   (`ctx.contextMenus.register({ id, target, order, resolve })`) means the
   registry calls `resolve` with the **captured target's value**, not with the
   `{ kind, value }` wrapper the trigger received. Unwrapping `.value` again
   silently opens an empty menu — exactly the defect fixed in `7cac4e6`.
   Test doubles must mirror this wrapper, never the implementation's assumption;
   `scripts/verify-contract.ts` checks it against the real registry.
3. **Slot standard props.** The panel receives `props.useContextMenu` from the
   root standard props; call it once inside `useMemo`. Do not import DSH client
   packages or UI primitives directly. The two exceptions are
   `src/client/host-file-icon.ts`, which resolves the host's `FileTypeIcon` from
   the shell's frozen module table inside a guarded `require` and falls back to
   the plugin's own document icon, and `src/client/toast/ToastHost.ts`, which
   resolves the host's native `Toast` the same way and falls back to the shared
   `contextMenus.notify` service. The architecture gate rejects that request
   from every other module.
4. **Host route and trust fence.** One route family:
   `/api/dsh-git-graph/rpc` plus `/api/dsh-git-graph/health`. A request must
   come from a loopback socket with a loopback `Host`, send the bundle header
   `x-dsh-git-graph: 1`, carry no proxy headers (`x-forwarded-for`,
   `cf-connecting-ip`), and present same-origin markers
   (`sec-fetch-site: same-origin`, matching `Origin` when present). Never run
   through a shell, and never accept a repository path from the browser (only
   session ids and repository-relative paths). Git file arguments remain literal.
   Remote operations additionally validate every remote name, URL and branch
   before Git sees them, disable terminal credential prompts, and use a bounded
   network timeout. Adding a remote is user-authorized configuration; Git
   transports, credential helpers and hooks stay inside the local trust boundary.
   Direct previews/deletion reject linked parent directories, and untracked
   classification is rechecked on the Host before direct access. A final link
   cannot be previewed but can be unlinked without touching its target. These
   checks do not sandbox trusted Git hooks/configuration or local directory races.
5. **Copy-path base.** Absolute paths are formed from `repo.root`. `repo.cwd`
   is the Session's working directory and may be a subdirectory of the
   repository.
6. **Locale.** Every visible string goes through `ctx.locale.bind('gitGraph')`
   and exists in both dictionaries inside `src/client/locale/`. `locale/*.json`
   is only plugin metadata. The locale unit test asserts key and placeholder
   parity for both languages.
7. **Theme and keyboard.** Style with `--dsw-*` theme tokens only — except the
   commit graph, which reproduces VS Code's Source Control Graph: its
   `--dshgg-scm-*` palette (VS Code `scmGraph.*` values, dark variants under
   `body[data-ds-dark-theme]`) and 22px rows are deliberate. Rows and
   triggers keep `tabIndex` / `aria-haspopup="menu"` semantics and the host's
   dismissal behavior.

## Dependency direction (review rule)

```text
client-entry -> plugin -> { titles, panel/GitPanel, diff/DiffPanel, menu/*, locale/*, toast/* }
GitPanel -> panel/hooks/* -> { data/caller, panel/menu, menu/bus, git/* }
panel/views/* -> { panel/FloatingPanel, panel/Section, panel/BranchMenu, panel/autosize, panel/controls, panel/feedback, panel/rows, panel/split, icons, host-file-icon, menu/trigger, git/*, type-only hooks/types }
pure logic (git/*, menu/actions, constants, locale/*) -> no React, no ctx
icons -> React only (presentational SVG, no ctx)
host-file-icon -> { icons, react, one guarded host-module request }
toast/ToastHost -> { toast/notify, icons, react, one guarded host-module request }
toast/notify -> no React, no ctx
host: http/* -> no project imports; git/exec -> errors; git/paths -> errors
      git/files -> { exec, paths }; git/changes -> { exec, paths, files, ignore }
      git/mutations -> { exec, branches }; git/remotes -> { exec }
      readers -> exec/paths/files as needed
      validation -> { errors, git/exec }; watch -> git/exec
      rpc -> { validation, session, errors, git/exec, readers, changes, mutations, remotes, watch }
      host-entry -> { rpc, http, watch, errors }
```

Pure modules must stay importable in Node without a DOM — that is what makes
`test/unit/` possible. Views never call `fetch` or the command caller; only
hooks do. Do not introduce project-to-project cycles. The existing test command
runs `test/architecture.test.ts` to check runtime cycles, Host/client isolation,
shared type-only imports, pure-zone dependencies and unreachable executable
modules; do not replace its deliberately invalid fixtures with passing-only tests.
Under `verbatimModuleSyntax`, use whole-clause `import type` / `export type` for
erased edges: inline type specifiers retain the module's side effects.

## Install and the development loop

- Install: DSH **Plugins → Add plugin** with this directory, or `install_bundle`
  with the directory path. The profile links the directory (`link:`), so the
  Host reads the committed `client.js` artifact directly and no build is needed
  at install time.
- **Sandboxed installs (Linux, DSH `workspace-write`)**: pnpm 12 keeps its
  store operation lock in `$XDG_RUNTIME_DIR/pnpm-store-operation-locks-<uid>`,
  which the file sandbox blocks with `ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`
  (`EROFS`), even when `--store-dir` points inside the workspace. Point the
  runtime directory into the workspace instead:

  ```bash
  mkdir -p .cache/runtime
  XDG_RUNTIME_DIR="$PWD/.cache/runtime" pnpm install --frozen-lockfile
  ```

  pnpm then uses a store under `node_modules/` and completes without touching
  the sandbox boundary or asking for approval. This is a Linux-sandbox
  workaround only: in a normal terminal, or on macOS/Windows, plain
  `pnpm install --frozen-lockfile` works and must stay the documented command.
  On a machine without pnpm, install the pinned version once with
  `npm i -g pnpm@12.21.0`.
- **Browser half changes**: edit `src/client/**` → `pnpm build` (or keep
  `pnpm dev` running) → verify the running Web build/watch setup before promising HMR;
  otherwise refresh the existing page. To check what the running Host serves, read the
  public events stream, take the row URL/rev for `@local/dsh-git-graph`, and
  fetch it:

  ```bash
  curl -sN --max-time 3 http://127.0.0.1:<gui-port>/plugins/events
  # graph.entries[] → {id, url, rev}; then curl http://127.0.0.1:<gui-port>/<url>
  ```

- **Host source changes** (`src/host-entry.ts`, `src/host/**`) require
  `pnpm build` followed by a Host restart. Do not edit generated `index.js`.
- Verify user-visible behavior in the real page when possible: right-click a
  row (menus), stage/unstage, discard confirmation, commit, diff tab, branch
  switch. There is no browser control in this environment; use the served
  artifact, the events stream, `pnpm verify:contract` and client Slots
  inspection, then ask the user for the final click-through.

## Testing conventions

- Built-in `node:test` only; no third-party test frameworks or DOM libraries.
- Layered suite: `test/unit/` imports pure modules directly (no build, no DOM,
  no Git process); `test/host.test.ts` spawns real `git` in fixture repos;
  `test/client.test.ts` and `test/ui.test.ts` load the built artifact.
- **Test doubles mirror host contracts, not implementation assumptions.** When
  a real host service is mocked, mock the wrapper/ordering the host applies
  (see contract 2 and `test/support/fake-ctx.ts`).
- Prefer a failing regression test first; do not weaken assertions to make a
  refactor pass — the spec is the behavior.
- Host tests clean up through the file's module-level `after()` hook.
- UI tests render over `test/support/mini-react.ts`; add harness capabilities
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
- **No automatic commits or version bumps.** Never run `git commit` (or push)
  and never change the version in `package.json` / `CHANGELOG.md` on your own
  initiative; do either only when the user explicitly asks. When asked:
  commits follow Conventional Commits (`feat(scope): ...`, `fix(scope): ...`,
  `docs: ...`, `chore(release): ...`) with an imperative subject and a short
  body when the reason is not obvious; version bumps follow SemVer (breaking →
  major, feature → minor, fix → patch) and update `CHANGELOG.md` in the same
  change.

## Style

- 2-space indent, single quotes, no semicolons, no tabs; comments in English.
- Keep pure logic (parsing, flat-list ordering, path/menu action resolution) free
  of React and context services so it stays directly testable; the pure layer
  carries explicit TypeScript contracts and concise API comments.
- Keep functions small; give exported helpers JSDoc, and keep view modules
  presentational (props in, elements out).

## Do not

- Do not hand-edit `index.js`, `client.js` or either source map; edit `src/**` and
  rebuild. `pnpm check:build` catches a stale artifact.
- Do not edit `.litespec/specs/` directly or delete archived changes.
- Do not add runtime dependencies; check the DSH version contract in
  `package.json` (`engines.dsh`) and the module-table limits before adding a
  client external.
- Do not hand-edit `node_modules/`, `.cache/` or `.tmp-test*/`; package managers and tests own them.
- Do not log or transmit repository contents beyond the local loopback route.
- Do not rename the artifact or its exports (`./client`, `{ inject, apply }`);
  the Host module system depends on them.

## Spec-driven workflow (litespec)

This project uses litespec. Current behavior lives in `.litespec/specs/`.
Before changing observable behavior, create a change under `.litespec/changes/<change-id>/`
with a proposal and a spec delta, implement its tasks, then run `litespec validate`.

