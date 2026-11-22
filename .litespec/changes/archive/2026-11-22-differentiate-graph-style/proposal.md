# Differentiate the commit graph palette and S-turns

## Why

The commit graph follows VS Code's Source Control Graph closely, and deliberately
so: the same swimlane rules, the same 22-pixel rows, and until now the same
`scmGraph.*` hex values and the same 5-pixel S-turn radius. That fidelity is
useful for familiarity, but it also makes the graph look like a direct copy of
VS Code's renderer. A small style shift keeps the graph instantly recognizable
while giving the plugin a rendering of its own.

## What Changes

Every graph color becomes slightly more vivid while holding its hue: the five
rotation colors, the checked-out-branch blue (both theme variants), the upstream
purple (both variants) and the base-branch orange. The colors stay in the same
hue families — amber, magenta, brown, teal, violet, blue, purple and orange — so
the rotation order and the reference meaning of each color are unchanged. The
amber rotation color already sits at the edge of the sRGB gamut, so its hue moves
by under two degrees and its vividness barely changes; every other color gains
chroma.

The turns of a lane shifting left on a row tighten from a 5-pixel to a 4.5-pixel
radius: the two quarter-turns and the horizontal run between them keep their
shape, but the bend is slightly sharper. The quarter-turn joins and merge
launches keep their 11-pixel curves because the row geometry fixes their
endpoints.

## Non-goals

- Row height, lane pitch, line width, node shapes, node gaps, badge rules and
  layout stay VS Code's.
- The reference color semantics (blue checked-out branch, purple upstream,
  orange base) and their light/dark theme switching are unchanged.
- No wide-gamut color space: the palette stays within sRGB so every display
  renders the same values.
