# Animate collapsed split panes and keep the divider inert

## Why

Collapsing a section already shrinks its pane to the headers, but the pane
snaps to its new height in one frame and the divider disappears. Collapsing the
commit graph therefore reads as a teleport: its content blinks out, the header
jumps to the bottom edge of the panel, and the split loses the hairline that
marks where the two panes meet. The result still works, but it does not look
like a fold and it removes a piece of the frame the user is used to.

## What Changes

A pane that folds to or from its header height animates the height change over
the panel's short motion duration instead of snapping, and the section body
stays mounted while the pane folds so its rows are clipped by the shrinking
pane rather than vanishing first. The divider stays visible between the panes
while a pane is collapsed, keeps its hairline, and becomes inert: it shows no
hover highlight, accepts no drag, takes no keyboard focus and changes no ratio.
Expanding a section animates the pane back to the ratio it had and makes the
divider operable again. With reduced motion the pane takes its new height at
once and the divider still becomes inert.

## Non-goals

- The ratio, its persisted lifetime and the minimum pane heights stay
  unchanged; this only animates the existing collapsed geometry.
- A pane that renders no section at all (a clean workspace) still keeps its
  share of the split and keeps an operable divider.
- The scroll position of a pane that folds away is not restored; the pane's
  content is clipped while it folds, so this change does not promise a scroll
  offset that the collapsed pane cannot hold.
