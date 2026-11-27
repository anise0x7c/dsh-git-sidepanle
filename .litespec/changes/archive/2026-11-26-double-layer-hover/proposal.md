# Double-layer hover for rows and section headers

## Why

A hovered row or section header highlights only its whole surface, so a pointer
over one of the controls inside it — the unstage-all, stage-all and discard-all
controls in a change-group header, the stage, unstage and discard controls on a
file row — gives no feedback that the pointer is on a target rather than on the
row. The commit graph header avoided that gap by highlighting its controls
instead of the header, but that drops the row highlight every other header
keeps, so the graph section reads differently from the change groups above it.

## What Changes

- A hovered section header and a hovered row keep the host hover highlight over
  their whole surface. The commit graph header takes part in that rule again
  instead of highlighting its controls alone.
- A control inside a hovered header or row — a section toggle, a header action,
  a file-row action or the graph header's remote control — adds its own rounded
  hover highlight above the surface highlight while the pointer is over it, so
  the control reads both as part of the row and as the target under the pointer.
- The shared icon button carries that hover highlight itself, so every icon
  control in the panel shows one where it sits, including the toolbar's refresh
  control and the controls inside the commit-details and diff headers.
- The header component no longer offers a controls-only hover mode; the change
  group headers, the graph header and any future section highlight the same way.

## Non-goals

- No change to click targets, keyboard focus, menu behavior, row metrics or
  section pinning.
- No new theme token or hard-coded color: both layers use the host's
  interactive hover token, so the deeper tone comes from the two layers
  stacking.
- The graph row keeps its single-layer highlight and its node-gap hover: it
  carries reference badges that are not controls, so it has nothing to
  highlight on top.
