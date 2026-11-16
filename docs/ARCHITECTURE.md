# Architecture

One DSH bundle, two runtime halves, and shared **type-only** wire contracts:

- **Host**: `src/host-entry.ts` + `src/host/**`, bundled to Node ESM `index.js`.
- **Browser**: `src/client-entry.ts` + `src/client/**`, bundled to the wrapped
  DSH artifact `client.js`. React stays external and comes from the platform.
- **Wire types**: `src/shared/git.ts`. Type-only imports disappear from both
  builds: the browser never imports Host execution code.

Both distribution entries and their source maps are committed. Installation
needs neither a compiler nor development dependencies. The Git Sidebar behavior
specification remains the source of truth; migration decisions are recorded in
`docs/REFACTOR-PLAN.md` and the development-workflow LiteSpec change.

## Directory map

```text
index.js, index.js.map         GENERATED Host ESM + source map
client.js, client.js.map       GENERATED browser loader artifact + source map
cordis.patch.yml               one loader row: @local/dsh-git-graph
locale/{en,zh}.json            plugin metadata only, not UI copy
src/
  host-entry.ts               inject + apply; routes and failure envelopes
  shared/git.ts               wire DTOs and operation/result relationships
  host/
    context.ts                minimal structural DSH service contracts
    http/respond.ts           JSON response + bounded request-body reader
    http/trust.ts             loopback / same-origin fence
    git/exec.ts               execution, repository root and path validation
    git/status.ts             porcelain parser and repository status
    git/history.ts            history, commit metadata and changed-file parsing
    git/references.ts         graph references: checked-out, upstream, base
    git/branches.ts           branch list + branch existence
    git/diff.ts               working-tree/commit diffs and unified parser
    session.ts                resolve Session working directory
    errors.ts                 typed failure normalization
    rpc.ts                    operation dispatch and route constants
  client-entry.ts             browser exports only
  client/
    types/                    local structural DSH and UI/domain contracts
    constants.ts              identifiers, paths, rendering limits
    locale/{en,zh}.ts          UI dictionaries
    styles.css, styles.ts     inline stylesheet and effect-owned, refcounted style lease
    icons.ts                  SVG renderers
    data/caller.ts            the only fetch layer
    git/{format,list,graph}.ts pure formatting, list ordering, VS Code graph port
    menu/                     targets, triggers, clipboard, actions, command bus
    panel/
      controls.ts, rows.ts    controls and flat change-file rows
      Section.ts              collapsible section header
      feedback.ts             banners and empty states
      BranchMenu.ts           branch picker
      confirm.ts              confirmation wording
      menu.ts                 panel-scoped command wiring
      split.ts                pure split-ratio range, pointer mapping and key steps
      hooks/                  repository/history/branches/details/action hooks
      views/                  branch/commit/change/graph sections and the split view
      GitPanel.ts             hook and view assembly
    diff/                     diff panel and pure diff rendering
    titles.ts, plugin.ts      tab titles and plugin registration assembly
scripts/
  build.ts                    both build targets, watch, read-only freshness gate
  verify-contract.ts          integration with the real installed DSH registry
test/
  *.test.ts                   Host, loader, rendered UI and workflow regressions
  unit/*.test.ts              pure modules, no Git process or DOM
  support/*.ts                fixtures, minimal React, fake context/menu, VS Code graph oracle
```

## Dependency direction

```text
client-entry -> plugin -> { titles, panel/GitPanel, diff/DiffPanel, menu/*, locale/* }
GitPanel -> panel/hooks/* -> { data/caller, menu/actions, git/*, menu/bus }
panel/views/* -> { panel/controls, panel/split, icons, git/format, git/graph }
pure git/menu/locale logic -> no React, no ctx
host: http/* -> nothing; git/* -> git/exec; rpc -> readers; host-entry -> rpc + http/*
either half -- import type --> shared/git
```

Pure logic stays directly importable in Node. Views never call `fetch`; hooks
own requests and state. DSH interfaces are local structural subsets of the
installed API, not runtime imports. Unknown network/request inputs are validated
at boundaries instead of assuming TypeScript makes untrusted input safe.

## Data flow

1. The keyed `sidebar.right.pane.tab` slot supplies Session identity, translation,
   tab-info and context-menu hooks.
2. `useRepoStatus` creates a caller for `/api/dsh-git-graph/rpc`, loads status and
   polls every 5 seconds while visible and no modal/operation is in flight.
3. History and branches load on mount/on demand. `history` returns commits in
   `--topo-order` with full decorations plus the checked-out, upstream and base
   references; `git/graph.ts` turns them into VS Code swimlane view models, SVG
   paths, node shapes and reference badges (a port of VS Code's
   `scmHistory.ts`, checked against a literal transcription in
   `test/support/vscode-scm-history.ts`).
4. The body is a resizable split: change groups scroll above the graph in their
   own pane, and `panel/split.ts` owns the 20%–80% ratio mapped from pointer and
   keyboard gestures. `GitPanel` keeps the ratio so commit details can replace
   the split and return to it, while commit metadata and files load lazily.
5. Change actions share a busy lock, failure handling, confirmation and refresh
   path. Commit/checkout also refresh history.
6. Triggers capture targets. The shared overlay calls a contribution with the
   target's **value**, never the wrapper. Menu actions travel through the bus to
   the owning panel, guarded by Session id, panel id, busy and stale checks.

## Runtime contracts

- Routes stay `POST /api/dsh-git-graph/rpc` and
  `GET /api/dsh-git-graph/health`. Accept only loopback sockets/Host, bundle
  header `x-dsh-git-graph: 1`, no forwarding headers, and same-origin markers.
  Git never runs through a shell. Browser requests contain Session ids and
  repository-relative paths, never a repository root supplied by the browser.
- The browser factory calls `window.__ModuleLoader__.load({id, factory})`,
  returns `{inject, apply}`, and has no side effects. Registrations belong to
  `apply` with `ctx.effect`; style leases are shared across module replacements and released on disposal. Only `react` is external.
- `props.useContextMenu` is bound once inside `useMemo`. No DSH UI package is
  imported into the client artifact.
- Absolute copy paths use `repo.root`, never the possibly nested Session cwd.
- All visible copy comes from the bound English/Chinese dictionaries. Styling
  retains the Host theme tokens and keyboard/menu focus semantics. The one
  exception is the commit graph, which uses VS Code's `scmGraph.*` palette as
  `--dshgg-scm-*` variables (dark variants under `body[data-ds-dark-theme]`)
  and VS Code's 22px graph rows.

## Build and quality gates

TypeScript is strict and no-emit, including scripts and test support. Explicit
`.ts` imports are executed only by the development-only `tsx` loader. esbuild
emits self-contained JavaScript with embedded-source maps, targeting ES2022.
The Host target is Node ESM; the browser is CJS inside its DSH loader wrapper,
with CSS imported as text and React external. Both are dependency-free at install.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm check
pnpm verify:contract --dsh-root /path/to/installed/dsh
```

`pnpm check` runs strict types, Biome, tests and an in-memory comparison with all
four committed artifact/map files. It never rebuilds first. `pnpm test` builds
first for the normal edit/test loop. `pnpm dev` watches both source trees; Host
changes still require a Host restart. Browser reload behavior must be verified
against the current DSH Web build/watch setup; do not assume rebuilding this
bundle alone guarantees HMR in every deployment.

Biome manages authored TypeScript, CSS and JSON, not generated output or historical
specifications. pnpm pins development resolution; no runtime dependencies or
install scripts are added. CI runs the portable gate on Node 22 and 24. The real
installed-DSH contract check remains an explicit local integration gate.

## Adding code

- Put new pure rules beside the matching formatter/parser/menu module and add a
  unit test; keep graph topology changes separate from maintenance refactors.
  Graph changes must keep the VS Code equivalence test green or document the
  deviation in the oracle's header and the change's design notes.
- Put new state/request logic in a hook and new presentation in a view.
- Extend shared DTOs and validate Host inputs before adding an RPC operation.
- Update source, tests and docs, run `pnpm build && pnpm check`, then run the
  real DSH contract check when touching registration or menu boundaries.
