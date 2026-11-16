# Polish panel layout and section chrome

## Why
The change groups and the commit graph share one scroll container. On a long
change list the graph starts below the fold, and scrolling either area moves
both together, so history is awkward to consult while reviewing changes. The
panel's detail chrome also drifts from the host: the clean-workspace mark keeps
a redundant green check icon, divider hairlines are lighter than the host's
dividers, and the section titles are smaller and lighter than the surrounding
sidebar headers. The user asked for four specific refinements.

## What Changes
- The change groups and the commit graph become two vertically stacked,
  independently scrolling panes: changes above, graph below. Each pane keeps
  its own scroll position.
- A divider between the panes can be dragged to change their relative heights.
  It is also a keyboard focus stop adjustable with ArrowUp/ArrowDown,
  PageUp/PageDown, Home and End. Both panes keep a usable minimum height, and
  the chosen ratio survives opening a commit's details and returning.
- Divider lines use the host's standard divider color (`--dsw-alias-border-l3`)
  instead of the lighter `--dsw-alias-border-l1` hairline.
- Section header titles move up one step of the host type scale to the 14-pixel
  strong style and take a heavier weight.
- A clean workspace keeps its localized title and description but no longer
  shows the green check icon.

## Non-goals
- No horizontal split, pane persistence across closing and reopening the tab,
  or independent pane widths.
- No change to staging, committing, diffs, menus, branch switching, the commit
  graph's VS Code geometry or palette, or the RPC/Host contracts.
- The diff tab and the single-scroll loading, empty, error and commit-detail
  states keep their current layout.
