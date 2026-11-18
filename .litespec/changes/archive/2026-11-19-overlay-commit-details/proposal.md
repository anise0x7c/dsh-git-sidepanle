# Overlay commit details as a card

## Why

Choosing View Details currently unmounts the change list and graph before the
details view slides in, and returning shows an empty pane until the details
have finished sliding out. Both transitions blink: the user loses sight of the
content they came from, so the details read as a replacement rather than a
layer arriving above one.

## What Changes

- The commit details view opens as a card above the panel's content. The change
  list, graph and commit box stay mounted beneath it with their split ratio and
  scroll positions unchanged.
- The card owns a solid theme surface, a rounding border and a shadow, and sits
  above the content with a small edge gap, so the two layers stay visually
  distinct while the card travels.
- The card still slides in from the panel's right edge and slides back out to
  that edge. On the way out it reveals the content already in place, instead of
  a blank pane.
- While the card is present, the content beneath it accepts no pointer or
  keyboard input and is hidden from assistive technology.
- Reduced motion keeps showing and leaving the card at its final position
  without moving.

## Non-goals

- No change to the details content, changed-file list, diff entry points, back
  control, stale-target handling or reduced-motion behavior.
- No change to the floating operation prompt, its motion, focus handling or
  placement.
- No change to the change list, graph, commit box or diff tab behavior while no
  details card is open.
