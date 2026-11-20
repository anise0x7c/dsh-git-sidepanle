# Refine the commit graph remote header

## Why

The first header pass leaves the remote icons too small to tell apart at a
glance, draws Fetch almost like Pull, and highlights the whole header row so
the pointer's control is never obvious. The toolbar's cloud control also
duplicates the header's Sync and Publish entries, adding a second place to
maintain for the same actions.

## What Changes

- The commit graph section header highlights each control on hover — the
  section toggle, Fetch, Pull, Push and the overflow ellipsis — instead of the
  whole header surface. The other section headers keep their whole-surface
  hover.
- The Fetch control is labelled "Fetch from every remote" (from all remotes)
  and draws a dashed twin-tail arrow into the repository node, so it reads as
  fetching rather than pulling. Pull keeps its solid arrow.
- The graph header's action icons grow from 13 to 16 pixels.
- The branch toolbar drops its remote status (cloud) control. The toolbar keeps
  the branch chip and the refresh control; Sync stays in the graph header's
  overflow menu, and Publish Branch stays there when the branch has no upstream.

## Non-goals

- No change to the Host, RPC, Git transport or remote validation; the same
  operations run with the same feedback and refresh behavior.
- No new auto-refresh or "go to current history item" controls from the
  reference screenshot, and no change to the branch chip or refresh control.
- No keyboard-shortcut changes.
