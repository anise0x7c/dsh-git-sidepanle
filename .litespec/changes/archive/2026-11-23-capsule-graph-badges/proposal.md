# Capsule-shaped graph reference badges

## Why

The reference badges beside a commit row's subject read as small rounded
squares rather than the pills the Source Control Graph shows. Their corner
radius is clamped to half the badge height, and the application's superellipse
corner shape rounds that clamp into a squircle, so the leading and trailing ends
never close into half circles. The badges keep their colors, icons and grouping;
only their silhouette is wrong.

## What Changes

Every reference badge in a commit row becomes a capsule: the leading and
trailing ends are half circles as tall as the badge, on light and dark themes
alike. Badge heights, widths, colors, icons, counts and the truncation of a
badge's name stay exactly as they are, and badge counts sitting inside a capsule
keep their position.

## Non-goals

- The shape of graph nodes, lines or buttons elsewhere in the panel is
  unchanged.
- The badge palette, its contrast-checked colors and the reference ordering
  stay VS Code's; this change touches only the badge silhouette.
- Rounded corners on rows, sections, menus and dialogs keep the application's
  corner shape.
