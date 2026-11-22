# Revert the commit graph curve tuning

## Why

The S-turn of a shifting lane was tightened from VS Code's 5-pixel radius to 4.5
and then to 3 to make the graph look less like a direct copy. At the graph's 22px
row height the difference is not noticeable in practice, so the deliberate
deviation costs a spec exception, a parameterized equivalence oracle and special
test expectations without giving the user anything visible. The curve tuning is
therefore dropped.

## What Changes

A lane shifting left on a row returns to VS Code's 5-pixel turn radius, and the
graph's drawing geometry is exactly VS Code's Source Control Graph geometry
again. The VS Code equivalence oracle goes back to its literal, unparameterized
form, and the unit and rendered-panel path assertions go back to VS Code's path
commands.

The restyled palette from the previous round is kept: it is the visible
difference, and it also keeps the colors readable in both themes.

## Non-goals

- The palette, its hue families, its 2:1 contrast floor and the light/dark
  reference variants stay as they are.
- Row height, lane pitch, line width, node shapes, node gaps and badge layout are
  unchanged.
