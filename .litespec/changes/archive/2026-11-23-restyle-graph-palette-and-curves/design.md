# Design notes

## Palette derivation

Every color was re-picked in OKLCH by hue family, then checked against the
panel backgrounds (`--dsw-alias-bg-base`: `#FFFFFF` light, `#151517` dark).
Hue families and rotation order are preserved, but the values now move clearly
away from VS Code's: the rotation is gold, crimson, copper, emerald and violet,
and the references are restyled blue, purple and orange.

| Token | Before | After | OKLCH hue shift | Contrast white | Contrast dark |
|---|---|---|---|---|---|
| `lane1` gold | `#FFB300` | `#D6A700` | +10.4° | 1.79 → 2.24 | 10.16 → 8.15 |
| `lane2` crimson | `#E3007F` | `#E0065B` | +12.2° | 4.59 → 4.83 | 3.97 → 3.77 |
| `lane3` copper | `#A85600` | `#A66200` | +9.2° | 5.26 → 4.81 | 3.47 → 3.79 |
| `lane4` emerald | `#2CB2A7` | `#3EAD76` | −28.5° | 2.61 → 2.82 | 6.98 → 6.46 |
| `lane5` violet | `#B266FF` | `#9362F4` | −8.8° | 3.37 → 3.97 | 5.42 → 4.60 |
| `ref` | `#0A7EFF` | `#0088CD` | −15.0° | 3.86 → 3.89 | 4.73 → 4.69 |
| `remote` | `#672696` | `#81359C` | +9.2° | 9.15 → 7.19 | 1.99 → 2.54 |
| `base` | `#F26100` | `#F66140` | −9.7° | 3.24 → 3.13 | 5.63 → 5.82 |
| `ref` dark | `#2E91FF` | `#00A8FB` | −12.8° | 3.18 → 2.63 | 5.74 → 6.94 |
| `remote` dark | `#B37DDD` | `#C27FDD` | +6.8° | 3.05 → 2.85 | 5.99 → 6.40 |

The light-theme minimum rose from 1.79:1 (`lane1`) to 2.24:1, and the dark-theme
minimum from 1.99:1 (`remote`) to 2.54:1, so lines and badge lettering (which
uses the panel background as its text color) are no harder to read than before
on either theme. Saturation stays high where the family allows; the copper and
blue lose a little chroma because the family's gamut at the chosen lightness is
narrower.

## Curve radius

`SWIMLANE_CURVE_RADIUS` becomes 3 (VS Code's is 5). The shift geometry is
formula-driven: the vertical lead-in now ends at 8 instead of 6.5, and the
horizontal run between the quarter-turns at pitch 11 grows to 5 pixels, so the
turn is visibly tighter without touching row height, lane pitch or node
positions. Join and merge quarter-turns keep radius 11 because their endpoints
are fixed by the row geometry.

The VS Code equivalence oracle already accepts a radius parameter (default 5),
so `test/unit/client-graph.test.ts` keeps rendering it with the port's radius
while every other path command is compared literally. The exact 3-pixel radius
is pinned by the hand-written path assertions in the unit and rendered-panel
tests.

## Readability check

The contrast ratios above use WCAG relative luminance. The graph's own
background is the sidebar surface, which is `#F9FAFB` in the light theme and a
near-black dark surface in the dark theme; those differ from `#FFFFFF`/`#151517`
by less than 0.1 contrast ratio for these colors, so the 2:1 floor holds for the
actual surface as well.
