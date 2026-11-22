# Hold the toolbar loading bar for a minimum time

## Why

The toolbar's loading bar is useful only if it is seen. A status read, a graph
page or a quick stage can answer in a few milliseconds, so the bar appears and
vanishes before the sliding segment completes even one frame of movement. That
reads as a flicker rather than as activity, and it makes the panel look unstable.

## What Changes

Once the bar appears, it stays visible for at least 500 milliseconds even when
the work that showed it finishes sooner. Work that starts while the bar is still
being held keeps it on without a gap or a restart, so several quick operations
read as one continuous activity period. After the minimum has passed and no work
remains, the bar leaves as before.

## Non-goals

- No extra delay before showing the bar: it still appears immediately, so slow
  work is not hidden behind a debounce.
- The bar stays indeterminate; this only changes how long it is shown.
