# Collapsed sections shrink their split pane

## Why

The change list and the commit graph are two panes that share the panel height
at a user-chosen ratio. Collapsing a section only hides its rows: the pane keeps
its share of the split. So collapsing the commit graph leaves a tall empty
surface under its header, the graph header floats in the middle of the panel
instead of resting at the bottom, and the change list does not regain the room.
The same happens in the other direction when every change group is collapsed.

## What Changes

A pane whose sections are all collapsed takes only the height of their headers
instead of its share of the split. The change pane keeps its collapsed headers at
the top of the split and the graph pane keeps its collapsed header at the bottom
edge of the panel, so the collapse reads as folding the pane away. The expanded
pane takes the remaining height, and the divider disappears while a pane is
collapsed because there is no split to move. Expanding one section restores the
previous ratio and scroll positions, so collapsing and expanding is not a way to
lose the user's layout.

## Non-goals

- The split ratio itself, its persisted lifetime and the minimum pane heights
  stay unchanged; this only decides which height a collapsed pane takes.
- A clean workspace renders no change groups, so its pane keeps its share of the
  split; the clean text is content, not a collapsed section.
