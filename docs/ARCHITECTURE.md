# Architecture

One DSH bundle, two runtime halves, and shared **type-only** wire contracts:

- **Host**: `src/host-entry.ts` + `src/host/**`, bundled to Node ESM `index.js`.
- **Browser**: `src/client-entry.ts` + `src/client/**`, bundled to the wrapped
  DSH artifact `client.js`. React stays external and comes from the platform.
- **Wire types**: `src/shared/git.ts`. Type-only imports disappear from both
  builds: the browser never imports Host execution code.

The current refactor intentionally leaves the pure Code OSS graph algorithm
intact; section state, artwork and row presentation have separate owners
instead. Module boundaries, the build and quality gates, and the remaining
trust boundaries are described in this guide and the user guides.

Both distribution entries and their source maps are committed. Installation
needs neither a compiler nor development dependencies. The Git Sidebar behavior
specification remains the source of truth.

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
    git/exec.ts               shell-free literal-path Git execution and repository discovery
    git/paths.ts              lexical repository containment, including Windows drive boundaries
    git/files.ts              bounded no-follow untracked previews and verified untracked deletion
    git/changes.ts            stage/unstage/discard/ignore file operations
    git/mutations.ts          commit and reference mutations, including remote-branch checkout
    git/remotes.ts            remote listing/configuration and network synchronization operations
    validation.ts             untrusted RPC field validation, not repository dispatch
    git/status.ts             porcelain parser and repository status
    git/history.ts            history, commit metadata and changed-file parsing
    git/references.ts         graph references: checked-out, upstream, base
    git/branches.ts           local and remote-tracking branch listing, plus branch existence
    git/ignore.ts             literal root-anchored .gitignore rules and append handling
    git/diff.ts               working-tree/commit diffs and unified parser
    watch/classify.ts         watch-event classification (pure)
    watch/registry.ts         shared repository watchers and change counters
    session.ts                resolve Session working directory
    errors.ts                 typed failure normalization
    rpc.ts                    operation dispatch and route constants
  client-entry.ts             browser exports only
  client/
    types/                    local structural DSH and UI/domain contracts
    constants.ts              identifiers, paths, rendering limits
    locale/{en,zh}.ts          UI dictionaries
    styles/                   per-area CSS sections and the ordered cascade assembly
    styles.ts                 effect-owned, refcounted style lease
    icons.ts                  SVG renderers
    host-file-icon.ts         the host's file-type glyph, resolved softly with the plugin icon as fallback
    toast/                    the single-notice store and the native Toast host with a shared-service fallback
    data/caller.ts            the only fetch layer
    git/{format,list,graph,tree}.ts pure formatting, list ordering, commit-file tree, Code OSS graph port
    menu/                     targets, triggers, clipboard, actions, command bus
    panel/
      controls.ts, rows.ts    controls and rows for the flat change lists and the commit-details folder tree
      change-groups.ts        pure grouping, path ordering and display-letter rules
      Section.ts              collapsible section header
      feedback.ts             empty states
      FloatingPanel.ts        shared panel-local floating operation surface and actions
      BranchMenu.ts           branch picker
      confirm.ts              confirmation wording
      menu.ts                 panel-scoped command wiring
      split.ts                pure split-ratio range, pointer mapping and key steps
      scroll.ts               pure near-end rule that pages the commit history
      autosize.ts             commit-message height rule and its one element pass
      hooks/                  repository/history/branches/details/expansion/action hooks
      views/                  branch/commit/change/graph sections, the commit-details card, reference dialogs and the split view
        graph/                shared SVG artwork, commit row/badge and expanded change-row presentation
      GitPanel.ts             hook and view assembly
    diff/                     diff panel and pure diff rendering
    titles.ts, plugin.ts      tab titles and plugin registration assembly
scripts/
  build.ts                    both build targets, watch, read-only freshness gate
  verify-contract.ts          integration with the real installed DSH registry
test/
  *.test.ts                   Host contract, loader, workflow and architecture regressions
  registration.test.ts        loader registration, style lease and factory side effects
  tooling.test.ts             package manifest, exports, gate wiring and artifact contracts
  ui/*.test.ts                rendered-UI behavior, one file per surface: layout, graph,
                              changes, commit, prompts, header, remote, details, expansion,
                              diff, menu, menu-fallback, live, toast
  types/rpc.type-test.ts      compile-only RPC request/response assertions
  support/architecture.ts     TypeScript-AST import graph checks over virtual source trees
  support/ui-panel.ts         shared rendered-UI harness: bundle loader, mountGit and helpers
  unit/*.test.ts              pure modules, no Git process or DOM
  support/*.ts                fixtures, minimal React, fake context/menu, Code OSS graph oracle
```

## Dependency direction

```text
client-entry -> plugin -> { titles, panel/GitPanel, diff/DiffPanel, menu/*, locale/*, toast/* }
GitPanel -> panel/hooks/* -> { data/caller, panel/menu, menu/bus, git/* }
panel/views/* -> { panel/FloatingPanel, panel/Section, panel/BranchMenu, panel/autosize, panel/controls, panel/feedback, panel/rows, panel/split, icons, host-file-icon, menu/trigger, git/format, git/graph, git/tree, type-only hooks/types }
pure git/menu/locale logic -> no React, no ctx
host-file-icon -> { icons, react, one guarded host-module request }
toast/ToastHost -> { toast/notify, icons, react, one guarded host-module request }
toast/notify -> no React, no ctx
host: http/* -> nothing; git/paths -> errors; git/exec -> errors
      git/files -> { exec, paths }; git/changes -> { exec, paths, files, ignore }
      git/mutations -> { exec, branches }; git/remotes -> { exec }
      readers -> { exec, paths, files as needed }
      validation -> { errors, git/exec }; watch/* -> git/exec
      rpc -> { validation, session, errors, git/exec, readers, changes, mutations, remotes, watch }
      host-entry -> { rpc, http/*, watch, errors }
either half -- import type --> shared/git
```

Pure logic stays directly importable in Node. Views never call `fetch`; hooks
own requests and state. DSH interfaces are local structural subsets of the
installed API, not runtime imports. Unknown network/request inputs are validated
at boundaries instead of assuming TypeScript makes untrusted input safe.

The existing maintenance gate executes `test/architecture.test.ts` against the
real source graph and intentional violations. It rejects cross-runtime imports,
runtime imports of shared wire declarations, runtime cycles, pure-zone dependency
escapes and orphaned executable modules. Whole-clause `import type` and
`export type` are erased; inline `{ type T }` specifiers still retain module
side effects under `verbatimModuleSyntax` and count as runtime edges. Type-only
view/hook contracts are permitted. This checks module reachability, not whether
every public export or semantic branch has a consumer.

## Data flow

1. The keyed `sidebar.right.pane.tab` slot supplies Session identity, translation,
   tab-info and context-menu hooks.
2. `useRepoStatus` creates a caller for `/api/dsh-git-graph/rpc` and loads status.
   While the tab is visible, `useLiveUpdates` subscribes the panel's repository to
   the Host watch registry and polls two in-memory counters (working tree/index
   and references) about every 700 ms; a counter move refreshes only the status,
   or the status plus the graph references, without re-reading the commits. The
   old 5-second status check stays as the fallback while the Host cannot watch
   and stands down once the counters are live. Status reads are serialized;
   explicit requests during a read coalesce into a follow-up, and a successful
   action waits for its post-write read before releasing its busy lock.
3. The Host watch registry shares one recursive working-tree watcher, one Git
   metadata watcher and one refs watcher per repository, coalesces a burst with a
   short debounce, and releases them when the last panel unsubscribes, its
   subscription lapses, the Session moves, or the plugin unloads. Watch events
   only move counters; the Git reads still happen when the browser asks.
   Per-panel setup identities invalidate cancelled or superseded asynchronous
   discovery, and registry disposal permanently fences off new watchers.
4. History loads one page on mount and more on demand. `history` returns commits
   in `--topo-order` with full decorations, an `offset` for earlier pages, a
   `hasMore` flag, and the checked-out, upstream and base references; reaching
   the end of the graph pane (`panel/scroll.ts`) asks the history hook to append
   the next page. `git/graph.ts` turns the loaded commits into Code OSS swimlane
   view models, SVG paths, node shapes and reference badges (a port of Code OSS's
   `scmHistory.ts`, checked against a literal transcription in
   `test/support/code-oss-scm-history.ts`). The lines of the whole list are one
   layer with one path per color, so a lane that crosses a row boundary is
   rasterized as one stroke; each row's cell keeps only its node and its graph
   width, and the node gaps are circles in the layer's mask that the section
   closes for the hovered row.
5. The body is a resizable split: change groups scroll above the graph in their
   own pane, and `panel/split.ts` owns the 20%–80% ratio mapped from pointer and
   keyboard gestures. `GitPanel` keeps the ratio so commit details (opened from
   the commit row's View Details menu action) can overlay the still-mounted
   split as a card and reveal it again, while commit metadata and files load
   lazily. Activating a commit row instead toggles `useCommitExpansion`, which
   reads each expanded commit's files
   with its own request token; `GraphSection` derives one list of inserted rows
   per commit and hands its lengths to `graphLayer`, which offsets the commit
   rows below and draws Code OSS's graph-placeholder lanes through the inserted
   rows (the node lane in a separate three-pixel element).
6. Change actions share a busy lock, failure handling, confirmation and refresh
   path. Commit/checkout also refresh history. The commit box sizes itself to its
   message (`panel/autosize.ts`): one line at rest, ten at most, re-measured from
   a layout effect per message and from a width watcher when the box rewraps.
   The commit action is a split button: the main control commits, and the
   trailing expand control opens the presentational `views/CommitMenu`, whose
   dismissal lives in `useCommitActionMenu`; both halves share one disabled
   state, so an empty message or a running action disables the whole control
   and closes the menu. `useChangeActions` runs every
   variant (Commit, Amend, Commit and Push, Commit and Sync) through the same
   busy lock, committing first and treating a failed push or sync as a reported
   failure that keeps the commit.
   `FloatingPanel` owns the presentation shared by discard/commit confirmations
   and reference forms: a non-modal absolute layer anchored inside the panel,
   with native frosted surface tokens, a height-bounded scrolling content area,
   and a separate wrapping action footer. It does not enter the split's flex
   layout. `GitPanel` keeps prompts mutually exclusive; hooks retain all
   operation state and Git calls.
   Success and failure notices use a stable callback passed through the Git and
   diff bodies' Slot injection faces. `plugin.ts` owns one single-notice store;
   when the shell's frozen module table provides the native `Toast` component,
   a `shell.overlay` host renders that notice with the host's placement,
   replacement and dismissal: successes keep the native check and failures add
   the warning icon and a longer hold. A retryable read failure attaches one
   localized retry action. When the native component is absent the same
   callback falls back to `contextMenus.notify`, and delivery errors are
   isolated from Git work. There is no private notice state, timer or strip in
   the panel layout. Missing notification support does not gate the pane or its
   inline controls.
7. Triggers capture targets. The shared overlay calls a contribution with the
   target's **value**, never the wrapper. Nested native checkout/deletion submenus
   come from the commit's local branch heads. Menu actions travel through the bus
   to the owning panel, guarded by Session id, panel id, busy and stale checks;
   name/deletion dialogs open only after a command is selected, and their writes
   share the same busy and refresh wrapper. Graph gestures capture the invoking
   row for dialog focus restoration; deletion defaults to Cancel and idle Escape
   cancels. Ignoring appends a literal escaped path rule at the repository root,
   not in the Session's subdirectory. A no-follow descriptor rejects links and
   non-regular targets, then reads and appends through one regular-file handle.

## Remote data flow

The commit graph header's Fetch, Pull and Push controls and its overflow menu
call the guarded RPC like every other panel action. `remotes` reads
`git remote -v` into name, fetch URL and push URL; publish uses that list to
prefer `origin`, offer a choice, or report that none exists. `fetch`, `pull`, `push`, `sync` and `publish` run on the Host
with the shared literal argument-vector executor, a longer bounded timeout,
terminal prompts disabled, and `GIT_MERGE_AUTOEDIT=no` so a merge never waits
for an editor. Pull merges (`--no-rebase`), Pull (Rebase) rebases, and Sync
stops before pushing when its pull fails. `add-remote` and `remove-remote`
write repository configuration; `checkout-remote` creates or switches to the
local branch tracking a listed remote branch. Successful writes use the same
busy lock, success Toast and post-write status refresh as local actions; a
failed network action still refreshes the status so conflicts and partially
fetched refs appear.

## Runtime contracts

- Routes stay `POST /api/dsh-git-graph/rpc` and
  `GET /api/dsh-git-graph/health`. Accept only loopback sockets/Host, bundle
  header `x-dsh-git-graph: 1`, no forwarding headers, and same-origin markers.
  Git never runs through a shell and file arguments are literal pathspecs.
  Browser requests contain Session ids and repository-relative paths, never a
  repository root supplied by the browser. Direct filesystem operations reject
  linked parents; untracked previews use a bounded no-follow regular-file handle,
  and both previews and deletion recheck Git's current untracked classification.
  Normal Git hooks/configuration and local-account trust remain unchanged; these
  checks do not sandbox concurrent local replacement of ancestor directories.
- The browser factory calls `window.__ModuleLoader__.load({id, factory})`,
  returns `{inject, apply}`, and has no side effects. Registrations belong to
  `apply` with `ctx.effect`; style leases are shared across module replacements
  and released on disposal. The platform supplies `react`; the only other
  runtime requests are the two guarded host-primitive wrappers: the file-type
  icon in `host-file-icon.ts` and the native Toast component in
  `toast/ToastHost.ts`.
- `props.useContextMenu` is bound once inside `useMemo`. No DSH UI package is
  imported as a module; the guarded host-icon and native-Toast requests above
  are the only exceptions.
- Absolute copy paths use `repo.root`, never the possibly nested Session cwd.
- All visible copy comes from the bound English/Chinese dictionaries. Styling
  retains the Host theme tokens and keyboard/menu focus semantics. The one
  exception is the commit graph, which uses a restyled version of Code OSS's
  `scmGraph.*` palette as `--dshgg-scm-*` variables (same hue families,
  contrast-checked, dark variants under `body[data-ds-dark-theme]`) and Code OSS's 22px graph rows and curve geometry.

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
  Graph changes must keep the Code OSS equivalence test green or document the
  deviation in the oracle's header and the change's design notes.
- Put new state/request logic in a hook and new presentation in a view.
- Extend shared DTOs and validate Host inputs before adding an RPC operation.
- Update source, tests and docs, run `pnpm build && pnpm check`, then run the
  real DSH contract check when touching registration or menu boundaries.
