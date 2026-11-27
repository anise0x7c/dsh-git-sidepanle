# Design: resizable change and graph panes

## Layout

The panel body becomes a column flex container, `.dshgg-split`, placed directly
under the root's fixed chrome (branch header, commit box, banners, notice):

- The change pane is a `.dshgg-scroll` with `flex: 0 0 auto` and an inline
  `flex-basis` percentage. The graph pane is a `.dshgg-scroll` with
  `flex: 1 1 0`, so it takes the remainder.
- Both panes keep `min-height: 0`, `overflow-y: auto` and
  `overscroll-behavior: contain`, so each has its own scroll position.
- A 9px divider sits between them. Its hairline uses
  `--dsw-alias-border-l3`, the host's standard divider color; the surrounding
  hit area is transparent and shows the host hover background.

## Ratio state

`GitPanel` owns the ratio because the split unmounts while commit details are
open; keeping the number in the panel restores the user's choice on return.
The initial value is 50%. The usable range is clamped to 20%–80% in the pure
helpers so neither pane can disappear at the extremes.

`src/client/panel/split.ts` holds the pure rules: clamping, pointer-to-ratio
mapping and keyboard steps. `SplitView` only translates pointer and keyboard
events into those rules. No React or context service leaks into the pure layer.

## Divider interaction

- Pointer dragging uses pointer capture on the divider. The drag stores the
  starting pointer Y and ratio, then applies the Y delta over the split
  container's height, which avoids a jump when the grab starts slightly off the
  hairline and keeps working when the pointer leaves the panel.
- The divider is a focusable `role="separator"` with `aria-orientation`,
  `aria-valuemin`, `aria-valuemax` and `aria-valuenow`. ArrowUp/ArrowDown move
  by 5%, PageUp/PageDown by 10%, and Home/End jump to the limits.
- Both the label and the tooltip come from the plugin locale dictionaries.

## Tests

- `test/unit/client-split.test.ts` covers clamp, pointer mapping, and keyboard
  adjustments without React or a DOM.
- `test/support/mini-react.ts` gains a `pointer` helper so the rendered-panel
  test can drive pointerdown/move/up with a mocked container rectangle.
- `test/ui.test.ts` checks the two scroll containers, their section ownership,
  keyboard and pointer resizing, the minimum clamp, the commit-detail round
  trip, and the text-only clean state.
- Style expectations live in `test/client.test.ts` beside the existing theme
  assertions.

## Visual verification

Static preview pages are rendered from the mini React tree with the installed
DSH theme CSS, then captured with headless Firefox for light/dark inspection.
The real page still needs the user's click-through after a browser refresh.
