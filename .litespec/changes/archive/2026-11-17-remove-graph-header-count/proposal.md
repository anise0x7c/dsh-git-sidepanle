# Remove the commit graph header count

## Why
The commit graph header shows the number of commits loaded so far. That count
is a paging detail, not the repository's history size: it starts at the first
page and grows only when earlier pages load, so beside the title it reads like
a total it is not. The change-group headers use their counts as file totals,
which the graph count cannot match, so the Graph header should carry only its
title.

## What Changes
- The commit graph's collapsible header no longer shows a count chip. It keeps
  its title, toggle and context menu.
- The change-group headers keep their counts, and the commit-details header
  keeps its changed-file count.
- A pinned header keeps its controls usable; a count is required only where the
  header shows one.

## Non-goals
- No change to paging, the load-earlier control, or the commit rows.
- No change to change-group counts, the commit-details file count, or their
  refresh.
- No locale copy, Host or RPC work; this is a browser-only change.
