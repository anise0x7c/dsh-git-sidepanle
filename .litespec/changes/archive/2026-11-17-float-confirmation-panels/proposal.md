# Reusable native-style floating confirmation panels

## Why
Bottom confirmations currently participate in the sidebar flex layout, shrinking the change list and graph. A horizontal row also crowds long confirmation copy, branch names, tag annotations and action labels in narrow panes.

## What Changes
- Show discard, stage-all-and-commit, branch/tag creation and branch deletion in one consistent bottom-anchored floating surface inside the Git panel, without resizing the underlying panes.
- Use a rounded, translucent frosted surface, native theme colors, hairlines, typography, focus treatment and controls; retain an opaque readable fallback when backdrop filtering is unavailable.
- Separate the scrollable copy/form area from a persistent wrapping action footer. Keep long paths, reference names and translated labels within the panel bounds.
- Share the presentation and idle Escape/busy guards through a reusable component. Keep safe initial focus, existing reference-dialog focus restoration, and visible operation failures.
- Replace an open idle prompt when another prompt is requested, instead of stacking confirmations.

## Non-goals
- No changes to Git commands, discard semantics, routes, dependencies, version numbers or the host context-menu registry.
- No app-wide modal, global backdrop, shell replacement, new server or changes outside this plugin.
