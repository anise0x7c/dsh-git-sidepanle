# git-sidebar delta

## ADDED Requirements

### Requirement: Independent change and graph panes

The panel SHALL present the change groups above the commit graph in two
vertically stacked panes that scroll independently, separated by a divider.
The user SHALL be able to move the divider by dragging it, and both panes SHALL
keep a usable minimum height. Scrolling one pane SHALL NOT move the other or
change its scroll position. The divider SHALL be reachable by keyboard and
SHALL change the split with the arrow keys. Opening a commit's details SHALL
replace the split, and returning SHALL restore the ratio the user chose.

#### Scenario: Change list scrolls on its own

- **WHEN** the change list is taller than its pane and the user scrolls it
- **THEN** only the change list moves while the graph keeps its own scroll position

#### Scenario: Dragging the divider

- **WHEN** the user drags the divider upward
- **THEN** the change pane becomes shorter and the graph pane becomes taller

#### Scenario: Keyboard adjustment

- **WHEN** the divider has keyboard focus and the user presses ArrowDown
- **THEN** the change pane grows and the graph pane shrinks

#### Scenario: Minimum pane heights

- **WHEN** the user drags the divider to either extreme
- **THEN** both panes remain at least a usable minimum height

#### Scenario: Returning from commit details

- **WHEN** the user opens a commit's details and then returns to the split
- **THEN** the change list and graph return with the ratio they had before

### Requirement: Clean workspace state

When the repository exists and has no changes, the panel SHALL state that the
working tree is clean using localized text only, without an icon and without
empty change groups.

#### Scenario: Clean repository

- **WHEN** the repository has no merge, staged, or unstaged changes
- **THEN** the panel shows the clean-workspace title and description and no check icon

## MODIFIED Requirements

### Requirement: Host execution and presentation

Git commands SHALL run on the Host in the Session's working directory, and the
panel SHALL only transmit structured status and results between the browser and
the Host. The panel SHALL present itself in the host application's visual
language: colors, borders, surfaces, and focus rings SHALL come from the host
theme tokens, divider lines SHALL use the host's standard divider color, and
rows, metadata, and controls SHALL use the host's text sizes and weights, row
heights, spacing, and corner radii. Section header titles SHALL use one text
size step above file rows and a heavier weight than their surrounding metadata.
The commit graph is the one exception: its line, node and reference badge colors
and its compact row height SHALL follow VS Code's Source Control Graph as the
commit graph requirements describe. The panel's visible text SHALL follow the
user's language, providing English and Chinese copy.

#### Scenario: Theme follows the application

- **WHEN** the application switches between light and dark themes
- **THEN** the panel's surfaces, text, diff colors, and graph badge text update with the host theme without reloading the tab

#### Scenario: Matches the host sidebar

- **WHEN** the panel is shown beside the sidebar's own sections and rows
- **THEN** its section headers, file rows, metadata, controls, menus and divider
  lines share the host's text scale, row heights, spacing, corner radii and
  standard divider color instead of introducing a separate scale, while commit
  graph rows keep VS Code's graph dimensions

#### Scenario: Chinese interface

- **WHEN** the application language is Chinese
- **THEN** the panel's controls, messages, and empty states are shown in Chinese
