# Design: Code OSS commit graph

## Reference
The layout, drawing and badge rules are ported from Code OSS's
`src/vs/workbench/contrib/scm/browser/scmHistory.ts`
(`toISCMHistoryItemViewModelArray`, `renderSCMHistoryItemGraph`),
`scmHistoryViewPane.ts` (`HistoryItemRenderer._renderBadges`), `media/scm.css`
and the Git extension's `historyProvider.ts` (reference icons and order) —
Copyright (c) Microsoft Corporation, MIT License. The port keeps Code OSS's
constants (`SWIMLANE_HEIGHT = 22`, `SWIMLANE_WIDTH = 11`,
`SWIMLANE_CURVE_RADIUS = 5`, `CIRCLE_RADIUS = 4`, `CIRCLE_STROKE_WIDTH = 2`),
emits the same SVG path commands, and keeps Code OSS's color identifiers as
plugin-scoped CSS variables.

## Data flow
- Host `history` runs `git log --branches --tags --remotes --topo-order
  --decorate=full` (Code OSS's "All" filter uses `--topo-order` and full
  decorations) and, in parallel, reads the graph references: one
  `for-each-ref` over `refs/heads` and `refs/remotes` (current branch marker,
  upstream, remote `HEAD` symrefs), `git remote`, the optional
  `branch.<name>.vscode-merge-base` configuration value, and `rev-parse HEAD`
  only when HEAD is detached. Nothing is written.
- The value is `{ commits, references: { current, remote, base } }`; each
  reference is `{ id, name, revision }` with a full ref name as `id` (a commit
  id for a detached HEAD, as Code OSS does).
- The browser builds Code OSS's color map: current → `ref`, upstream →
  `remote`, base → `base`; every other reference maps to "no fixed color", so
  its badge takes the node's color, exactly like the "All" filter.

## Pure layer
- `git/graph.ts` produces one view model per commit: `kind` (`HEAD` or `node`),
  `input` and `output` swimlanes (`{ id, color }`), parents, and colored
  references. `graphRowGeometry` turns a view model into SVG path data, the
  node shape, the gap radii and the cell width. `refBadges` reproduces
  `_renderBadges` (first colored reference with its name, then groups by color
  and icon).
- Colors are the identifiers `lane1`..`lane5`, `ref`, `remote`, `base`; the view
  maps them to `var(--dshgg-scm-…)`.

## Deliberate deviations from Code OSS
- Code OSS drops every outgoing line at a parentless commit (its first-parent
  loop only runs when the commit has parents), which cuts unrelated branches
  when a root commit is listed mid-graph. The port keeps the other lines and
  only ends the root commit's own lines; the node color rule is unchanged.
- Code OSS paints the node gap with `stroke: var(--vscode-sideBar-background)`.
  DSH's sidebar surfaces can be translucent, so the port cuts the lines with a
  per-row SVG mask instead: the masked radius is the node's outer stroke edge
  (6, 7 or 8 pixels) and shrinks to the node's visible edge (4, 5 or 6 pixels)
  on row hover, matching Code OSS's `stroke: transparent` hover rule. The node
  shapes are drawn as fill and stroke circles with the same visible radii.
- The base branch uses only the configured Code OSS merge base and the default
  remote's `HEAD`; the reflog heuristic is skipped because Code OSS persists its
  result into the repository configuration and the panel never writes it.
- Badge text uses the host base background (`--dsw-alias-bg-base`) in place of
  `panel.background`.
- No incoming/outgoing virtual rows, inline file expansion, avatars or hover
  card; the native row tooltip carries the remaining metadata.

## Palette
| Identifier | Light | Dark |
|---|---|---|
| `lane1` (`scmGraph.foreground1`) | `#FFB000` | `#FFB000` |
| `lane2` | `#DC267F` | `#DC267F` |
| `lane3` | `#994F00` | `#994F00` |
| `lane4` | `#40B0A6` | `#40B0A6` |
| `lane5` | `#B66DFF` | `#B66DFF` |
| `ref` (`charts.blue`) | `#1A85FF` | `#3794FF` |
| `remote` (`charts.purple`) | `#652D90` | `#B180D7` |
| `base` | `#EA5C00` | `#EA5C00` |

Dark values apply under the host's `body[data-ds-dark-theme]` attribute.
