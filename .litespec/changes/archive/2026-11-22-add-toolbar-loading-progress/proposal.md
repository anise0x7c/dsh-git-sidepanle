# Show a sliding loading bar in the panel toolbar

## Why

Opening and refreshing the panel currently signal work only through the loading
text, the refresh control's spinner, or per-surface placeholders, so the panel's
overall activity is easy to miss. A panel-wide indicator makes it clear that the
panel is still working, especially while a slower Git operation runs and the
change list and graph keep their last content on screen.

## What Changes

The branch toolbar gains a thin indeterminate progress bar along its bottom
edge while the panel loads repository data or runs a Git operation. The bar
takes no layout height and accepts no pointer input, so it cannot shift the
branch chip or the refresh control. It leaves when that work finishes, and it
rests still as a static line when the user prefers reduced motion.

## Non-goals

- No percentage or remaining-time estimate: Git calls do not report progress, so
  the bar stays indeterminate.
- The existing per-surface loading states (the loading text, the refresh
  spinner, per-row and per-dialog placeholders) stay unchanged.
- Silent background refreshes triggered by repository watching stay silent; the
  bar reports work the user started or that replaces visible content, not every
  background read.
