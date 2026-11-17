# Changelog

All notable changes to `@local/dsh-git-graph`. The DSH compatibility statement
is the `engines.dsh` range in `package.json`.

## 0.9.1

Commit graph lines no longer break where two rows meet:

- A lane that continues from one commit row into the next is drawn as one
  stroke. The whole graph's lines now live in a single layer with one path per
  color, instead of a separate clipped cell per row, so the browser rasterizes
  a lane that crosses a row edge once and no seam can appear between the two
  rows.
- The break showed up whenever row edges did not line up with device pixels — a
  page zoom of 125%, for example — as a one-pixel lighter spot in every lane that
  crossed the boundary.
- Each row keeps its node and its graph width, so the text still starts after
  the row's own cell, and the node gap still closes while a row is hovered: the
  gap belongs to the layer now, so the section tracks the hovered row and passes
  it to the layer's mask.
- Lane positions, row height, curve geometry, node shapes, node gaps, colors and
  the per-row cell width are unchanged, and each row's paths still match VS
  Code's geometry exactly.
- Tests: 293 (was 282), covering the layer's per-color paths and offsets, the
  node gaps in layer coordinates, the row cells holding only their node, and the
  hovered row closing its gap.
- This is a browser-only change: no Host restart is needed.

## 0.9.0

The commit message box now takes the height its message needs:

- The box starts one line high instead of three, so an empty or one-line message
  leaves the space to the change list and the graph.
- Typing grows it by one line for every line the message wraps onto, and deleting
  text shrinks it back, down to a single line.
- It stops at ten lines: a longer message scrolls inside the box instead of
  pushing the rest of the panel out.
- A message that rewraps because the Sidebar or the window became narrower is
  re-measured without waiting for the next keystroke.
- The manual resize handle is gone: the content decides the height, and a
  dragged height would contradict the ten-line limit.

Tests: 282 (was 273), covering the height rule, the measuring pass and its width
watcher, and the one-row message box.
This is a browser-only change: no Host restart is needed.

## 0.8.2

Pinned section headers now cover the pane's top edge completely:

- The resting inset above the first section now belongs to the section instead
  of the scroll frame. A pinned header reaches the very top edge of the pane, so
  no sliver of a row can show in the strip above it.
- Tests stay at 273; the stylesheet assertions now cover the scroll-frame and
  first-section geometry.
- This is a browser-only change: no Host restart is needed.

## 0.8.1

Pinned section headers keep their hover highlight:

- The opaque surface that hides the rows beneath a pinned header now sits on
  the header itself, with the host hover highlight painted above it, so section
  headers highlight on hover again — inside their rounded corners — while the
  rows stay hidden. Pinning and the single-pinned-header rule are unchanged.
- Tests stay at 273; the stylesheet assertions were updated to the new surface
  and hover arrangement.
- This is a browser-only change: no Host restart is needed.

## 0.8.0

Section headers now stay pinned to their pane's top edge while their group or
the commit graph scrolls, and only the nearest header is stuck at a time.

Pinned section headers:

- Each change-group and commit-graph header now stays pinned to the top edge of
  its scrolling pane while its own section still reaches into the pane, with the
  host surface masking the rows that scroll beneath it. The next section's
  header takes the top edge as the previous section leaves, so only one header
  is pinned at a time, and the pinned header's toggle, count and context menu
  keep working.
- Tests: 273 (was 272), covering the sticky and masking rules in the served
  stylesheet and the per-section header containment the single-header rule
  depends on.
- This is a browser-only change: no Host restart is needed.

## 0.7.0

The commit graph now pages backwards through history, and the changes and graph
scroll in independent resizable panes.

Paged commit graph:

- The commit graph no longer stops at the 60 newest commits. Reaching the end
  of the graph pane appends the next page of earlier commits below the loaded
  rows, and the end of the list offers a "Load earlier commits" control as the
  keyboard path. The loaded rows keep their place and scroll position, lines
  that ended at the old bottom connect to their commits, and the graph offers no
  further page once the oldest commit arrives. A failed page keeps the loaded
  rows and offers retry; refresh, including after a commit or a branch switch,
  starts over from the newest page.
- Host: the `history` operation takes an `offset` and reports whether older
  commits remain, so each page is one bounded Git read and the browser never
  receives unbounded history. An invalid offset is refused as a bad request.
- Tests: 272 (was 264), adding Host offset paging over a 61-commit fixture,
  pure near-end units, and rendered-panel checks for scroll loading, the manual
  control, a failed page's retry and a refresh back to the first page.
- This change touches the Host half: restart the Host together with the page
  reload so the new `history` value is served.

Resizable change and graph panes, plus panel detail polish:

- The change groups and the commit graph now scroll in two independent panes,
  split by a divider that can be dragged. Both panes keep a 20% minimum height,
  the divider is a keyboard focus stop (Arrow keys 5%, Page keys 10%, Home/End
  for the limits), and opening a commit's details and returning restores the
  chosen ratio.
- Divider hairlines use the host's standard divider color, and section header
  titles take the host's 14px strong step with a heavier weight.
- The toolbar and diff header's 38px heights now include their hairlines, so
  their rules meet the conversation header's rule at the same 76px instead of
  sitting one pixel low.
- The clean-workspace state is text only; the green check icon is gone.
- Tests: 264 (was 253), adding pure split-ratio units, rendered-panel checks for
  independent panes, pointer/keyboard resizing, the commit-detail round trip,
  the text-only clean state, and the theme/type assertions.
- This is a browser-only change: no Host restart is needed.

Development toolchain:

- pnpm is pinned to 12.21.0 (was 11.28.5). The lockfile now records the pinned
  package manager under `packageManagerDependencies`, and
  `pnpm install --frozen-lockfile` passes with pnpm 12.
- `@biomejs/biome` stays on 2.6.7. pnpm 12 holds back releases younger than its
  24-hour `minimumReleaseAge` window; rather than excluding a fresh patch from
  that gate, the toolchain waits the window out and upgrades later.
  `@types/node` 22.20.5, `@types/react` 18.3.31, esbuild 0.28.2, tsx 4.23.15
  and TypeScript 5.9.3 are already the newest versions within their pinned
  major ranges. Major upgrades for `@types/node` (26), `@types/react` (19) and
  TypeScript (7) were checked but left out of this change.
- No runtime dependencies; no Host restart is needed.

VS Code commit graph (breaking change to the graph's look and the `history`
wire value). The commit graph is now a port of VS Code's Source Control Graph:

- History is listed in `--topo-order` with full decorations
  (`refs/heads/…`, `refs/remotes/…`, `tag: refs/tags/…`), and `history`
  additionally returns `references` — the checked-out branch (or detached
  commit), its upstream, and its base branch (configured
  `branch.<name>.vscode-merge-base`, otherwise the default remote's `HEAD`).
  Nothing is written to the repository configuration.
- Layout follows VS Code's swimlanes: a node takes the leftmost line heading for
  it, further lines join it on its row, every extra merge parent opens a line at
  the right end, and lines right of an ended line shift left. The previous
  vacancy-preserving lane allocator and conflict-avoiding coloring are gone.
  One deliberate fix: a root commit no longer cuts the other lines.
- Drawing uses VS Code's geometry and path commands (22px rows, 11px lanes,
  1px round-capped strokes, 11px quarter turns, 5px S-shifts), VS Code's node
  shapes (dot, merge ring, checked-out ring) with masked gaps that close on
  hover, and VS Code's palette: `#FFB000`, `#DC267F`, `#994F00`, `#40B0A6`,
  `#B66DFF` in rotation, blue/purple/orange for checked-out/upstream/base.
- Rows show the subject (bold on the checked-out commit) and dimmed author,
  then VS Code's colored reference badges with target/branch/cloud/tag icons
  grouped by color and kind. Short ID, relative time and every reference moved
  into the tooltip; the narrow-row container queries are gone.
- Tests: an equivalence test compares the port with a literal transcription of
  VS Code's algorithm on 200 random histories; new Host parser and end-to-end
  tests cover topological order and the reference resolution.
- The Host must be restarted to serve the new `history` value; until then the
  browser falls back to rotation colors and short decorations.

Maintenance workflow and behavior-preserving TypeScript migration:

- Host, browser, development scripts, regression tests and test support are
  checked TypeScript. Shared erased DTOs connect RPC operation/result types;
  local structural interfaces document the DSH services actually consumed.
- Both `index.js` and `client.js`, plus their embedded-source maps, are generated
  and committed. A prepared directory remains compiler-free and has zero runtime
  dependencies. Host source changes now require both rebuilding and restarting
  the Host; this work does not restart it automatically.
- pnpm 11.28.5 and its lockfile replace npm. Biome owns source formatting,
  import organization and lint checks. `pnpm check` is a read-only quality gate
  for strict types, conventions, regressions and artifact freshness; CI runs it
  on Node 22 and 24 after a frozen installation.
- Cleaned duplicated Slot/optional-service registration and panel/diff caller
  wiring. Styles now follow the existing side-effect-free factory contract:
  install through a scoped effect, share across overlapping lifetimes, refresh
  on replacement and release only owned resources.
- Tests: 251 passing (208 retained plus 43 new boundary, distribution and
  registration/lifetime regressions), with additional compile-only RPC assertions.
- Git panel behavior, guarded route contracts, keyboard actions, locale copy,
  graph geometry and DSH compatibility range remain unchanged.

## 0.6.0

Flat change lists. The staging area and a commit's changed files are now one
single-layer, path-sorted list instead of a folder tree:

- Each changed file occupies one row; folder rows and their collapse state are
  gone. The row keeps the status letter and shows the file name with its
  dimmed parent directory, with the full path in the tooltip and accessible
  label. Rows are ordered by repository-relative path, case-insensitively and
  with numeric runs compared as numbers.
- The commit-details file list uses the same flat list, so a commit's changed
  files no longer need folders opened to be read. Status letters, rename
  sources, activation, loading, empty, truncated and failure states are
  unchanged.
- Folder context menus and the former folder target kinds are gone with the
  folder rows. File and group-header menus keep opening diffs, staging,
  unstaging, discarding, and copying relative or absolute paths; group-header
  actions still cover every file in the group.
- Staging, discarding, committing, diffing, history, branch switching, Host
  APIs and theme behavior are unchanged. This browser-only change needs no
  Host restart.
- Tests: 208 (was 210). The tree-builder units are replaced by flat-list
  ordering and path-splitting units, plus rendered flat-list checks.

## 0.5.2

Defer every shared-parent join to the parent's own row so a branch line no
longer starts at an intermediate child:

- A secondary parent now opens and keeps its own right-hand lane even when
  another lane already expects that parent. The line keeps its source branch
  color until the shared parent's row, where it joins the node together with
  every other expected lane. A commit row can receive several branch lines, and
  a merge commit can launch a distinct lane for each parent.
- The node stays on the oldest expectation's lane, so an older line keeps its
  branch identity when a newer connector opens a free lane to its left.
- Secondary parents below the 60-commit window still fold into the existing
  trailing line, because they have no visible row where both lines could join;
  first parents keep their own lane there as everywhere else.
- Commit order, parent topology, graph result and edge contracts, text
  clearance, lane squeezing, colors, commit details, activation, menus, Host
  APIs, and theme behavior remain unchanged.
- Tests: 214 (was 210), including the shared-secondary-parent regression with
  exact SVG paths and rendered-panel margins, lane ownership for an older
  expectation, and the invisible-parent boundary. This browser-only change
  needs no Host restart.

## 0.5.1

Correct lane ownership for shared parents and refine the commit graph's grid
presentation:

- First-parent lines remain vertical in their own lanes even when another lane
  already expects the same parent. Parallel branches now hold those lanes until
  the actual shared-parent row, where the additional incoming lines join the
  node; an intermediate child no longer turns early into the reserved lane.
- The graph uses bounded row-and-column curves, branch-meeting color assignment,
  and one-line information beside each node. Text leaves clearance for active
  right-hand lines and narrow rows progressively suppress secondary metadata.
- Commit order, parent topology, commit details, row activation, context menus,
  Host APIs, and theme behavior remain unchanged.
- Tests: 210 (was 209), including a regression with two multi-commit chains
  converging on one parent, the exact shared-parent SVG paths, cross-lane palette
  conflicts, and rendered-panel text clearance. This browser-only fix needs no
  Host restart.

## 0.5.0

Native look and a real commit graph. The panel now sits in the host's visual
language, and the commit history is drawn as a lane graph instead of ASCII art:

- The panel uses the host's theme tokens and type scale throughout: 13px/500
  section headers, 28px rows with `--dsw-radius-md` hover fills, 0.5px
  hairlines, the host's icon-button and primary/secondary button metrics, the
  host menu surface and elevation for the branch picker, and the host input
  treatment for the commit box. Light and dark themes follow the application,
  and `prefers-reduced-motion` is respected.
- The commit graph is a tree drawn with inline SVG: every commit is a node on a
  colored lane, a first parent continues the lane, extra parents open side
  lanes, and a parent another branch already expects is joined by a curve into
  that lane. Lane colors come from theme tokens (business blue, violet,
  success, warn, error, chart neutral) and are shared by every row so the
  graph column stays aligned; a wide graph squeezes its lanes instead of
  widening past 96px.
- Commit rows keep a full-width subject and a muted hash/author/time line. Ref
  labels are compact chips — HEAD, branches, tags — and a remote-tracking label
  that only repeats a shown branch is folded away.
- Spacing follows the sidebar's rhythm: 8px inline inset, 30px section
  headers, 28px file/folder rows with 14px nesting steps, and a quieter
  toolbar/commit-box hierarchy. No decorative animation was added; only the
  refresh spinner and the chevron rotation remain.
- Host: the `history` operation now returns each commit's `parents` instead of
  the ASCII `--graph` prefix; `parseHistory` is pure and unit-tested. The
  payload is otherwise unchanged.
- Upgrade note: the Host half changed, so restart the Host once after
  installing this version; the browser half hot-reloads its styling
  immediately, and until the Host restarts commits render as nodes without
  connectors because the old payload has no parent list.
- Tests: 202 (was 178), including graph-layout unit tests (linear, fork and
  merge, branch tips, octopus merge, parent outside the window, palette
  cycling, wide-lane squeezing and SVG geometry), parent-order assertions
  against a real merges repository, and rendered-panel assertions for nodes,
  lane lines, colors, and ref folding. Both detail docs and the architecture
  doc were updated.

## 0.4.0

Commit details. Clicking a commit in the graph now shows what that commit
changed instead of leaving history read-only:

- Activating a commit row — pointer click, or Enter/Space on a focused row —
  opens a details view in place of the change list. It shows the short
  identifier, subject, author, relative time, message body, and the commit's
  changed files as the same foldable folder tree the change groups use, with
  status letters (added, modified, deleted, renamed, copied, type changed) and
  the original path for renames. A back control returns to the changes without
  touching the repository.
- Clicking a changed file opens it in the existing unified-diff tab, scoped to
  that commit: the diff is taken against the commit's first parent, or against
  the empty tree for a root commit. The diff header names the commit, the tab
  title carries the short identifier, and a pure rename is explained instead
  of showing an empty diff. Merge commits compare against their first parent.
- A commit that changed nothing relative to its first parent says so; a failed
  read shows the Host error with retry. Up to 1,000 changed files are listed
  and the view reports when the list was truncated.
- Files and folders inside the details view offer a context menu with the
  path-copy commands only; staging and discarding are not offered for history.
- Host: new `commit-details` operation returning the metadata and
  `--name-status` file list, and a `commit` scope on `diff`. Both require a full
  40-character commit identifier and are compared against the first parent.
  `parseCommitMeta` and `parseNameStatus` are pure and unit-tested.
- Tests: 178 (was 161), including real-Git rename/delete/root/merge fixtures,
  rendered-panel click-through, keyboard activation, commit-scoped diff tabs,
  and past-commit menu resolution. Docs and both locale dictionaries updated.

## 0.3.1

Fix the merge-conflict group. The Host status parser read a conflicted entry's
path from the wrong capture group, so conflicted rows arrived without a path
and the panel could not build the merge-changes group (the row's open and stage
actions were unreachable). Conflicted files now appear under merge changes with
their folder path and the `!` status letter, and behave like the other groups.

- Tests: a parser unit case with nested conflicted paths, a real-Git end-to-end
  test that creates a conflicting merge and reads the status over the RPC route,
  and a rendered-panel test for a conflicted file inside nested folders.
- `git diff` renders a conflicted file's combined diff with conflict markers as
  plain text; there is still no merge editor.

## 0.3.0

Internal refactor. **No observable behavior change**: the routes, trust fence,
panel markup, copy, menus and shortcuts are identical; the 35 behavior tests
from 0.2.1 pass unchanged and are joined by pure-function unit tests.

- Host half split into `src/host/**` ES modules; `index.js` is a 77-line entry
  that only declares `inject` and `apply`. The porcelain/diff/path parsers gain
  direct unit tests that spawn no Git process.
- Browser half is now built: `src/client/**` is the source of truth and
  `client.js` + `client.js.map` are generated by `scripts/build-client.mjs`
  (esbuild), committed next to the sources. New scripts: `npm run build`,
  `npm run dev` (watch), `npm run check:build` (freshness), and `pretest` builds
  before the suite.
- Browser source migrated into layers: dictionaries, styles, icons, the
  command caller, pure `git/format` and `git/tree` helpers, the menu modules,
  the small view components, the diff tab, tab titles and the plugin assembly.
- `GitPanel` (674 lines) became `panel/GitPanel.js` (248 lines) over five hooks
  (`useRepoStatus`, `useHistory`, `useBranches`, `useChangeActions`,
  `useMenuCommands`) and four view components. The browser tree has 34 files;
  the largest is 248 lines.
- Shared test doubles moved to `test/support/` (fake context with a real-registry
  shaped `contextMenus` stand-in, menu trigger mock, fixtures). Test count went
  from 35 to 159; the environment `npm test` run covers host e2e, artifact
  registration, rendered panel behavior and pure-function units.
- `scripts/verify-contract.mjs` pins the context-menu registry contract against
  the real installed `dsh-client-ui-context-menu` and replaces the ad-hoc probe
  used for the 0.2.1 fix. Run it with `npm run verify:contract`.
- Docs: new `docs/ARCHITECTURE.md`; `AGENTS.md` and `README.md` describe the new
  layout and build loop. User-facing `docs/DETAIL.md` is unchanged.
- The generated artifact is a pretty-printed bundle (2,082 lines, 96 KiB); the
  refactor plan's 150-line artifact target assumed chunk splitting, which the
  chosen build does not do. Review generated diffs by the sources only.

Host-half changes require a Host restart; browser-half changes hot-reload in the
open page.

## 0.2.1

Fix right-click menus opening empty. The shared context-menu registry already
hands a contribution the captured target value, so the contribution must not
unwrap `.value` a second time. Adds the regression tests, a non-empty-menu
assertion for every listed object, and documents the contract in `AGENTS.md`.

## 0.2.0

Add right-click context menus for file rows, folder rows, change-group headers,
commit rows and the diff header, rendered by the host's shared menu overlay and
executed through the panel's normal confirmation, busy and refresh paths.

## 0.1.0

Initial source-control sidebar: merge/staged/changes trees, stage/unstage,
discard with confirmation, commit box, unified diff tabs, commit history graph,
branch switching, 5 s status polling, and the `Ctrl+Shift+G` toggle.
