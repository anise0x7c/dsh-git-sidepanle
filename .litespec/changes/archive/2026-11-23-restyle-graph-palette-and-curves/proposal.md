# Restyled commit graph palette and tighter S-turns

## Why

The previous round tuned the graph palette by raising vividness while holding
each hue, and tightened the S-turn only from 5 to 4.5 pixels. Both changes were
too subtle: side by side with VS Code's Source Control Graph the result still
read as the same palette and the same loops. The graph should look clearly
different without becoming harder to see, and the S-turn should be visibly
tighter.

## What Changes

The rotation moves to five fresh, more separated colors — gold, crimson, copper,
emerald and violet — and the checked-out blue, upstream purple and base orange
reference colors are restyled within their own hue families. Every value is
chosen from the light and dark panel backgrounds with measured contrast: the
weakest line/badge color now clears 2:1 against both backgrounds (the previous
palette's worst values were 1.79:1 on white and 1.99:1 on the dark panel), and
the badge lettering therefore stays as legible as before or better. The rotation
order, first-parent inheritance, the blue/purple/orange reference meanings and
the light/dark switching are unchanged.

A shifting lane's S-turn tightens to a 3-pixel radius: it still descends from the
row's top edge, turns into the horizontal run at the row's middle and turns back
down, but the bend is noticeably sharper than the previous 4.5 pixels. The
quarter-turn joins and merge launches keep their 11-pixel curves because the row
geometry fixes their endpoints.

## Non-goals

- Row height, lane pitch, line width, node shapes, node gaps, badge layout and
  the light/dark theme mechanism stay unchanged.
- The hue *families* (blue checked-out, purple upstream, orange base) and the
  five-color rotation order stay recognizable; this is a restyle, not a new
  color language.
- No wide-gamut color space: all colors stay inside sRGB so every display
  renders the same values.
