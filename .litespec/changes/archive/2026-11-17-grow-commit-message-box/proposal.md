# Grow the commit message box with its content

## Why

The commit message box is a fixed three-row textarea with a visible drag handle.
That is the wrong shape for how messages are actually written: a one-line subject
still occupies three rows of the most valuable space in the panel — the top of
the change list — while a wrapped message scrolls inside a box whose height has
nothing to do with its text, and a manually dragged height is lost on the next
edit because the box is re-created when the panel returns from a commit's
details.

## What Changes

- The commit message input starts one line high, so the change list and graph
  keep their space until the message actually needs more.
- Typing a message that wraps grows the input by whole lines, so the message
  stays fully visible while it is being written.
- The input stops growing at ten lines. A longer message scrolls inside the box
  instead of pushing the change list out of the panel.
- Deleting text shrinks the input back, down to a single line.
- Resizing the panel so the message wraps differently resizes the input to the
  new content height, without waiting for the next keystroke.
- The manual drag handle goes away: the height follows the text, and a
  user-chosen height would contradict the ten-line limit.

## Non-goals

- Remembering a chosen height across panel re-mounts: the content decides.
- A minimum number of rows above one, or a "message length" counter/warning.
- Sizing the multi-line inputs elsewhere in the panel (there are none today) or
  in the diff view.
- Changing what the box sends to the Host: commit messages, staged-only
  commits, `Ctrl`/`Cmd+Enter`, and post-commit clearing stay as they are.
