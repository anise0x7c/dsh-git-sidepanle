# Design notes

## Palette derivation

Each value was moved from VS Code's color to a slightly more chromatic version
of the same hue in OKLCH, staying inside sRGB. Hue is held at the source value;
chroma is raised as far as the sRGB gamut allows. `#FFB000` already sits on the
gamut boundary for amber, so it only moves to `#FFB300` (hue +1.56°, chroma
+0.0001); every other color gains chroma. Measured values:

| Token | VS Code | New | OKLCH hue shift | OKLCH chroma |
|---|---|---|---|---|
| `lane1` | `#FFB000` | `#FFB300` | +1.56° | 0.1704 → 0.1705 |
| `lane2` | `#DC267F` | `#E3007F` | +0.01° | 0.2221 → 0.2427 |
| `lane3` | `#994F00` | `#A85600` | −0.89° | 0.1238 → 0.1334 |
| `lane4` | `#40B0A6` | `#2CB2A7` | −0.18° | 0.1011 → 0.1113 |
| `lane5` | `#B66DFF` | `#B266FF` | −0.55° | 0.2120 → 0.2209 |
| `ref` | `#1A85FF` | `#0A7EFF` | +0.84° | 0.2028 → 0.2124 |
| `remote` | `#652D90` | `#672696` | −0.02° | 0.1582 → 0.1741 |
| `base` | `#EA5C00` | `#F26100` | +0.51° | 0.1921 → 0.1958 |
| `ref` dark | `#3794FF` | `#2E91FF` | −0.16° | 0.1806 → 0.1860 |
| `remote` dark | `#B180D7` | `#B37DDD` | −0.24° | 0.1341 → 0.1471 |

Lightness stays within ±0.034 of the original, so contrast against the panel
background and the badge text color is essentially unchanged; the base orange
moves least (+0.019) because its badge carries small text.

## Curve radius

`SWIMLANE_CURVE_RADIUS` becomes 4.5 (VS Code's is 5). The shift geometry is
otherwise formula-driven, so the vertical lead-in now ends at 6.5 instead of 6 and
the horizontal run between the two quarter-turns grows from 1 pixel to 2, which
is what makes the turn slightly sharper without touching row height or lane
pitch. The join and merge quarter-turns keep radius 11 because their endpoints
are fixed by the row geometry (top edge to row middle), so no curvature change
is possible there without moving nodes.

The VS Code equivalence oracle keeps 5 as its default and accepts a radius
parameter; `test/unit/client-graph.test.ts` renders it with the port's radius so
the remaining path commands are still compared literally. The exact 4.5 radius
is pinned by the hand-written path assertions in the unit and rendered-panel
tests.
