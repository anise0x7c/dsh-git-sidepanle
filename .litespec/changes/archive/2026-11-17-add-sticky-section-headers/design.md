# Design: pinned section headers

## Mechanism: sticky positioning inside each section

The header is a child of its own `<section>` and becomes the sticky element
(`position: sticky; top: 0`). That parent is the header's containing block, so
the browser clamps the pinned header to its own section's box: as the section's
bottom edge passes the top of the pane, the header leaves with it. Because each
header is constrained by a different containing block, a header can never be
pinned while another one is coming up behind it — no scroll listener, scroll
math, or state is needed to get exactly one pinned header, and the next header
takes the top edge on the same frame the previous one leaves.

The markup already had this shape (`Section.ts` renders header and body as the
children of one `section`), so the change is stylesheet-only. The UI test that
asserts a header is the first child of its section records the invariant the
single-header rule depends on: a refactor that moves headers into a shared
wrapper or a sibling of the sections would break the clamping silently.

## Masking: a square surface layer behind the header

Rows scroll under a pinned header, so the header must paint the surface behind
it. A docked tab body in the right Sidebar is painted with
`--dsw-alias-bg-base` (DSH's docking kit gives each docked tab host that fill),
and a floating tab is painted with `--dsw-alias-bg-layer-2`; the stylesheet
picks the same token in each case, including the `[data-dockkit-float]`
ancestor the host marks on floating panes, so the mask follows the theme and
the pane without JavaScript. The surface is a `::before` layer (square,
`z-index: -1`) rather than the header's own background: the header keeps its
`--dsw-radius-md` hover highlight, whose rounded corners would otherwise leave
row pixels visible at the corners. The header's `z-index: 1` makes its stacking
context paint over the non-positioned rows of every section, including the
commit-graph rows and their SVG.

The pane's 2px top padding differs between engines (Chromium pins `top: 0` at
the padding edge, Firefox at the content edge below that padding). No row can
occupy that band: the next header pins only once the previous section's bottom
has passed the pane's top edge, and rows belonging to the pinned section are
below its own header. The surface layer therefore needs no negative offset.

## Alternatives rejected

- Scroll listener plus per-header `data-stuck` state: duplicates in JavaScript
  what the sticky containing block already guarantees, and would add scroll
  work to the pane that also feeds the graph's paging handler.
- Stacking all headers in a shared sticky wrapper: produces several pinned
  headers, which the change explicitly rules out.
- `backdrop-filter` masking: DSH's surfaces can be translucent, but a blur over
  moving rows changes with the content instead of cleanly hiding it, and the
  requirement is that rows are not visible.
