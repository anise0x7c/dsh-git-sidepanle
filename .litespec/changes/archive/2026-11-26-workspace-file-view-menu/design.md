# Design

## Where the state lives
`GitPanel` owns the selected view and the per-group collapsed folders through a
new `useChangeView` hook. `GitPanel` stays mounted while the details card
overlays the split and while sections collapse, so the state survives both; it
unmounts when the tab closes, which gives the flat list back on reopen.

Collapsed folders are stored per change group (`merge`, `staged`, `changes`), so
the same folder path in two groups toggles independently as the spec requires.
The folder state is kept while the flat list shows, which restores it when the
user returns to the tree.

## Menu plumbing
The trigger and its dropdown live in one view component,
`panel/views/ChangeViewMenu.ts`, which the Workspace section renders in the
section header's action slot, the place that already holds the commit graph
header's remote controls. The component owns its open state and dismisses itself
on `Escape`, an outside pointerdown and a chosen view, the rules the branch
picker and the remote menu follow; it hands the chosen view to `onChange` and
returns focus to its trigger. This keeps the panel, the Host context-menu
resolver and the command bus out of the flow: the switch needs no captured
target, no new panel command and no Host facility.

The menu is a small radio group of `menuitemradio` buttons, so the checked view
is exposed to assistive technology as well as drawn with a check glyph. Both
views stay selectable, including while a Git operation runs, because neither
changes repository state; choosing the view in effect only closes the menu.

Because every section header is its own sticky stacking context at the same
level, a dropdown dropped from an earlier header would paint under the next
one; the stylesheet raises the header that holds an open menu.

## Rendering
`ChangeGroups` reuses the commit-details pieces: `buildFileTree` from
`git/tree.ts` and `renderFileTree` from `panel/rows.ts`, with the group's
collapsed-folder set and the same nesting indent the flat rows take. Folder rows
already share the section row style, so the only new CSS is the trigger wrapper
the remote menu already uses and the stacking rule for an open header.

## Pure rules
The folder-state updates live in `panel/change-view.ts` so Node unit tests can
cover group isolation and toggling without React.
