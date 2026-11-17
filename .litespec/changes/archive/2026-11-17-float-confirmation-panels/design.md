# Design

## Surface and reuse

`FloatingPanel` is a presentational building block shared by the Git panel's simple confirmations and `CommitMenuDialog` reference forms. It accepts localized content, action labels, disabled/busy state and callbacks; it does not know repository types or call the command layer. Existing hooks continue to own all Git operations and values.

The card lives in an absolutely positioned layer inside the relatively positioned Git panel root, above its own content but not above the rest of the application. The layer does not consume flex space. Its unused area ignores pointer events, so this is a non-modal panel rather than an app-wide modal, and it must not advertise `aria-modal` or trap focus. Prompt-opening entry points explicitly replace any previous idle prompt.

## Native visual language

Runtime Theme inspection confirmed the host surface, border, label and state token families. The installed DSH 0.2.2-rc.3 timing-picker popover uses `--dsw-specific-menu`, `--dsw-menu-backdrop-filter`, `--dsw-elevation-prominent` and `--dsw-alias-border-l1`. The plugin reuses this visual vocabulary without importing a DSH Client component or adding a runtime dependency. The installed theme defines the menu fill with alpha (0.70 light / 0.64 dark), so the solid fallback uses `--dsw-alias-bg-layer-1`, not the menu token. Supported backdrop filtering enables the native translucent menu treatment.

## Layout and feedback

A height-bounded column separates a scrolling copy/form body from a non-shrinking wrapping action footer. The root and shrinking descendants have explicit minimum-size constraints. Long unbroken paths and translated labels wrap rather than forcing a wider sidebar. The card itself also permits vertical overflow scrolling as an extreme short-pane fallback when the wrapping footer alone is taller than the available height; under ordinary sizes only the content body scrolls. Existing action errors move into the open operation panel so a retained reference form cannot obscure the reason its submission failed.

## Interaction boundaries

Plain and destructive confirmations start on Cancel; reference creation keeps the name-input autofocus. Idle Escape cancels only the prompt and stops propagation to the surrounding dock. Busy guards protect callbacks without disabling the focused control. Existing graph hooks retain trigger-focus restoration and values on failure. Simple confirmations retain their existing close-on-confirm behavior; this change does not add a new submission state machine or change retry semantics.

## Verification limits

Use the project's existing Node-based rendered regression harness and CSS layout contracts, the portable check gate, installed context-menu contract check, served artifact bytes and Client Slot inspection. Browser control is unavailable; these are not substitutes for a final light/dark, narrow/short-pane click-through in the authenticated GUI. No replacement server or synthetic screenshot is used.
