# Architecture

This bundle is one DSH plugin with two halves that never share code:

- a **Host half** (`index.js` + `src/host/**`, plain Node ESM) that owns the
  loopback Git RPC route and runs Git, and
- a **browser half** (`src/client/**`, bundled by esbuild into `client.js`)
  that owns the right-Sidebar tabs, the React panel, the diff viewer and the
  context-menu contribution.

`docs/REFACTOR-PLAN.md` records the split that produced this layout; behaviour
is described in `docs/DETAIL.md` and pinned by `.litespec/specs/git-sidebar/`.

## Directory map

```text
index.js                     Host entry: inject = ['webServer'] + apply
client.js                    GENERATED browser artifact (do not hand-edit)
client.js.map                GENERATED source map (committed)
cordis.patch.yml             loader patch: one row named @local/dsh-git-graph
locale/en.json, zh.json      plugin metadata (title, description), not UI copy
src/
  host/
    http/respond.js          sendJson, readJsonBody
    http/trust.js            loopback / same-origin trust fence
    git/exec.js              runGit, gitOrThrow, repository root, path checks
    git/status.js            parseStatus, readStatus
    git/history.js           readHistory, readCommitDetails, parseCommitMeta,
                             parseNameStatus
    git/branches.js          readBranches, branchExists
    git/diff.js              readDiff, readCommitDiff, parseUnifiedDiff
    session.js               resolveSessionDirectory
    errors.js                GitGraphError, normalizeFailure
    rpc.js                   dispatch table + RPC/health paths
  client/
    constants.js             package id, route path, tab ids, limits
    locale/{en,zh}.js        UI dictionaries
    styles.css               stylesheet, inlined by the build
    styles.js                injects the stylesheet once
    icons.js                 inline SVG icons
    data/caller.js           createCaller, makeFailure (the only fetch layer)
    git/format.js            status letters, staging state, names, refs, time
    git/tree.js              buildTree, collectTreePaths
    menu/bus.js              command bus + the shared panel subscription point
    menu/trigger.js          row -> host trigger props adapter
    menu/clipboard.js        absolute paths, clipboard copy
    menu/actions.js          which commands apply to a menu target
    panel/controls.js        IconButton
    panel/Section.js         collapsible section header
    panel/rows.js            folder/file rows + tree renderer
    panel/feedback.js        Banner, EmptyState
    panel/BranchMenu.js      branch picker
    panel/confirm.js         discard confirmation copy
    panel/menu.js            the panel's menu wiring
    panel/hooks/*.js         useRepoStatus, useHistory, useCommitDetails,
                             useBranches, useChangeActions, useMenuCommands
    panel/views/*.js         BranchHeader, CommitBox, CommitDetails,
                             ChangeGroups, GraphSection
    panel/GitPanel.js        assembles hooks + views
    diff/DiffPanel.js        diff tab body
    diff/render.js           unified diff renderer
    titles.js                tab titles
    plugin.js                inject + apply (slots, shortcut, dictionary, menu)
  client-entry.js            build entry: exports { inject, apply }
scripts/build-client.mjs     esbuild build (build / --watch / --check)
scripts/verify-contract.mjs  menu contract check against the real DSH registry
test/
  host.test.mjs              real loopback server + real Git fixtures
  client.test.mjs            factory/registration assertions without a DOM
  ui.test.mjs                rendered panel behaviour over mini-react
  unit/                      pure-function tests (no Git process, no DOM)
  support/                   fake ctx, menu stand-in, fixtures, mini-react
```

## Dependency rule

```text
client-entry -> plugin -> { titles, panel/GitPanel, diff/DiffPanel, menu/*, locale/* }
GitPanel -> panel/hooks/* -> { data/caller, menu/actions, git/*, menu/bus }
panel/views/* -> { panel/controls, icons, git/format }
pure layer (git/*, menu/actions, constants, locale/*, icons) -> no React, no ctx
host: http/* -> nothing; git/* -> git/exec; rpc -> all; index -> rpc + http/*
```

The pure layer must stay importable in Node without a DOM — that is what makes
`test/unit/` possible. Views never call `fetch` or the command caller; only
hooks do. Do not introduce project-to-project cycles.

## Data flow

1. A tab mounts from the `sidebar.right.pane.tab` slot. The slot passes standard
   props (`t`, `sessionId`, `useTabInfo`, `useContextMenu`).
2. `useRepoStatus` builds the command caller (one `fetch` per command to
   `/api/dsh-git-graph/rpc`), loads `status` and polls every 5 s while the tab
   is visible and no modal or command is in flight.
3. `useHistory` and `useBranches` load on mount and on demand;
   `useCommitDetails` loads a commit's metadata and file list when a graph row
   is activated, and the details view replaces the change list until the user
   goes back.
4. `useChangeActions` wraps stage/unstage/discard/commit/checkout in one busy
   lock: it sets the failure banner, refreshes status silently and refreshes the
   graph when a commit moved it.
5. Rows and group headers hand their target to the host overlay through
   `menu/trigger.js`. The overlay renders what `menu/actions.js` describes; the
   chosen command travels back over `menu/bus.js` to `useMenuCommands`, which
   checks the panel id, the stale/busy guards, and then runs the same action the
   inline control runs. The two entry points stay identical by construction.

## Host route

One route family: `POST /api/dsh-git-graph/rpc` with `{op, ...}` and
`GET /api/dsh-git-graph/health`. A request must arrive on a loopback socket with
a loopback `Host`, carry `x-dsh-git-graph: 1`, present no proxy headers
(`x-forwarded-for`, `cf-connecting-ip`), and carry same-origin markers
(`sec-fetch-site: same-origin`, matching `Origin` when present). Git never runs
through a shell; the browser only sends session ids and repository-relative
paths and full commit identifiers. `rpc.js` dispatches to the `git/*` readers —
`status`, `history`, `commit-details`, `branches`, `stage`, `unstage`,
`discard`, `commit`, `checkout`, and `diff` (either a working-tree comparison or
a commit-scoped comparison) — and maps failures to
`{ok:false, error:{code, message}}`.

## Build contract (browser half)

The loader requires exactly one artifact per package, so `client.js` is
generated:

```js
window.__ModuleLoader__.load({
  id: '@local/dsh-git-graph',
  factory: (require) => { /* bundled src/client-entry.js */ return module.exports },
})
```

`scripts/build-client.mjs` runs esbuild with `bundle`, `format: cjs`,
`platform: neutral`, `target: es2022`, `external: ['react']`,
`loader: {'.css': 'text'}`, `sourcemap: true` and the wrapper as
`banner`/`footer` (so map offsets stay correct). The committed artifact carries
a generated banner; edit `src/`, then:

```bash
npm run build         # write client.js + client.js.map
npm run dev           # watch; the page hot-reloads on each rebuild
npm run check:build   # fail when the committed artifact is stale
```

A `link:`-installed profile serves the file directly, so a browser-half change
needs no Host restart: DSH polls the artifact and swaps the plugin in the open
page. Host-half changes need a Host restart.

The artifact is a pretty-printed bundle (about 2,300 lines, 104 KiB) rather than
a thin wrapper: esbuild bundles the whole browser half into it so the loader
still sees exactly one artifact per package. Review and blame the sources, never
the generated diff; the source map points back at `src/client/**` for DevTools
breakpoints.

## Contracts you must not break

1. **Artifact contract** — one artifact, `__ModuleLoader__.load`, factory
   returns `{ inject, apply }`, only `react` external. `apply` owns every
   registration and side effect (`ctx.effect`).
2. **Context-menu registry contract** — the shared registry calls a
   contribution's `resolve` with the captured target **value**, not the
   `{kind, value}` wrapper; `scripts/verify-contract.mjs` pins this against the
   real installed registry. Test doubles must mirror the wrapper.
3. **Slot standard props** — use `props.useContextMenu` once inside `useMemo`;
   never import DSH client packages.
4. **Trust fence and route shape** — see above; never add a repository path
   parameter from the browser.
5. **Copy-path base** — absolute paths come from `repo.root`, not `repo.cwd`
   (the Session directory may be a subdirectory).
6. **Locale** — every visible string goes through `ctx.locale.bind('gitGraph')`
   and exists in both dictionaries.
7. **Theme and keyboard** — `--dsw-*` tokens only; rows keep `tabIndex` and
   `aria-haspopup="menu"` semantics and the host dismissal behaviour.

## Adding code

- A new pure rule (formatting, path math, tree, menu description) goes into the
  matching `src/client/git/*` or `menu/*` module and gets a `test/unit/` test.
- A new panel state or request goes into the matching hook; a new visual
  section goes into `panel/views/` and is wired from `GitPanel.js`.
- A new Host operation is a `case` in `src/host/rpc.js` delegating to a
  `src/host/git/*` reader plus a lane in `test/host.test.mjs`.
- After any browser-half edit: `npm run build && npm test`, and
  `npm run check:build` before committing.
