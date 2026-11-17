# Use DSH shared Toast for panel notices

## Why

The panel's private green notices duplicate DSH feedback and shift the change list and graph. Commit, ignore and menu-guard feedback should use the same host Toast presentation and lifetime as clipboard feedback instead of a second notification surface.

## What Changes

- Show the existing success feedback for commits (including stage-all-and-commit), ignore operations, detached checkout, branch creation/deletion and tag creation through localized DSH shared success Toasts.
- Show stale-target and busy menu feedback through the shared Toast without success styling.
- Remove the panel's private notice strip and dismissal timer; DSH owns Toast placement, replacement and dismissal.
- Preserve Git operations, message clearing, refreshes, inline failure feedback and confirmations. Missing or failing host notifications do not disable or interrupt these operations.

## Non-goals

- Adding success notifications to operations that do not already have them.
- Moving persistent Git errors or confirmation forms into Toasts.
- Importing DSH UI components, adding dependencies, changing the Host, bumping the version, or committing changes.
