# git-sidebar delta

## MODIFIED Requirements

### Requirement: Host execution and presentation

Git commands SHALL run on the Host in the Session's working directory, and the
panel SHALL only transmit structured status and results between the browser and
the Host. The panel SHALL present itself in the host application's visual
language: colors, borders, surfaces, and focus rings SHALL come from the host
theme tokens, divider lines SHALL use the host's standard divider color, and
metadata and controls SHALL use the host's text sizes and weights, spacing, and
corner radii. Section header titles SHALL use one text size step above rows and
a heavier weight than their surrounding metadata. Every row listed in the change
groups, the commit graph and the commit-details tree SHALL use one compact
22-pixel row style: the same height, horizontal padding, gap, corner radius,
hover surface and focus ring. A commit row SHALL keep its graph cell, subject
and reference badges inside that shared row, and the commit graph's line, node
and reference badge colors SHALL follow VS Code's Source Control Graph as the
commit graph requirements describe. The panel's visible text SHALL follow the
user's language, providing English and Chinese copy.

#### Scenario: Theme follows the application

- **WHEN** the application switches between light and dark themes
- **THEN** the panel's surfaces, text, diff colors, and graph badge text update with the host theme without reloading the tab

#### Scenario: Matches the host sidebar

- **WHEN** the panel is shown beside the sidebar's own sections and rows
- **THEN** its section headers, metadata, controls, menus and divider lines
  share the host's text scale, spacing, corner radii and standard divider color,
  and its list rows use one shared compact height and spacing instead of two row
  scales

#### Scenario: One row style across sections

- **WHEN** the change groups and the commit graph are visible together
- **THEN** changed-file rows, folder rows in the commit-details tree and commit
  rows share the same height, padding, hover surface and focus ring, while
  commit rows still show their graph cell, subject and reference badges

#### Scenario: Chinese interface

- **WHEN** the application language is Chinese
- **THEN** the panel's controls, messages, and empty states are shown in Chinese
