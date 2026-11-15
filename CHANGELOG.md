# Changelog

All notable changes to `@local/dsh-git-graph`. The DSH compatibility statement
is the `engines.dsh` range in `package.json`.

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
