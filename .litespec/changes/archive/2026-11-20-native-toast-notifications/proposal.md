# Route every notification through DSH's native Toast with type icons

## Why

Success notices already use DSH's shared Toast, but failures still render a
private inline banner. That banner has no type icon, so a failure and a success
do not read differently at a glance, and every failure inserts or removes a
block inside the panel, shifting the change list or graph. The banner also
duplicates a notification surface the host already owns.

## What Changes

Every success and failure notice will render through DSH's native Toast
component instead of the plugin's inline banner:

- Successful operations keep the Toast's native success presentation and its
  check icon.
- Failures use the Toast's warning icon and a longer hold, so the message type
  is distinguishable at a glance.
- A failure that a user can retry (status load, history load, commit details,
  diff read) carries one localized retry action on the Toast; choosing it
  dismisses the notice before the read runs again.
- The inline `Banner` component and its styles are removed. Operation forms
  keep their entered values and logical focus while the failure appears as a
  Toast, and the graph, commit-details and diff panes keep a compact
  retry-capable failed state when their read fails, so the retry remains
  reachable after the Toast fades.
- When the host's native Toast component is unavailable, delivery falls back to
  the existing shared `contextMenus.notify` service without an icon; if neither
  is available, operations still complete and no private notice is recreated.

## Non-goals

- No change to which Git operations run, to the guarded Host route, or to the
  success wording that already exists.
- Loading, empty and failed *states* (the empty-state and retry rows) stay;
  only the notification surface moves to the Toast.
