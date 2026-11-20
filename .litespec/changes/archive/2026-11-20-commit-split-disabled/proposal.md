# Disable the whole split commit button together

## Why

The split commit button currently greys only its main half when the message is
empty, while the trailing expand control stays bright and clickable. The two
halves then read as unrelated controls instead of one disabled action, and the
menu can open just to show every entry unavailable.

## What Changes

- The expand control shares the commit button's disabled state: with an empty
  or whitespace-only message, or while an action is running, both halves are
  unavailable.
- The whole split button takes one uniform disabled appearance, including the
  divider, instead of dimming only the main half.
- While the message is empty the action menu cannot open; the upstream rule for
  Commit and Push and Commit and Sync still applies whenever it does open.

## Non-goals

- No change to the menu entries, their order, or what each action performs.
- No change to the empty-message guard that already stops the commit call.
