# git-sidebar delta

## MODIFIED Requirements

### Requirement: Floating operation panels

The panel SHALL present discard confirmations, stage-all-and-commit
confirmation, reference naming and branch deletion in a consistent rounded
bottom-anchored floating surface within the Git panel, without changing the
change-list or graph pane geometry or split ratio. The surface SHALL use the
host theme's colors, typography, borders, controls and focus treatment, with
translucency and backdrop blur where supported and a readable solid fallback
otherwise. The surface SHALL rise into place from the panel's bottom edge when
it opens and SHALL lower out of the panel before it is removed when it is
dismissed, and it SHALL accept no input while it leaves. Its motion SHALL NOT
scroll the pane or shift its content: the pane keeps its scroll position and
its header and lists stay where they are while the card rises or lowers. Only
one operation prompt SHALL be visible at a time; requesting another idle prompt
SHALL replace the previous one without executing it. When the system asks for
reduced motion the surface SHALL appear and disappear at its final position
without moving.

#### Scenario: Confirm without resizing the lists

- **GIVEN** the change list and graph are visible at a user-selected split ratio
- **WHEN** the user opens a discard confirmation
- **THEN** a rounded frosted card rises from the pane's bottom edge and settles
  above the bottom of the panel while the panes and their split ratio retain
  their geometry

#### Scenario: The moving prompt leaves the pane still

- **GIVEN** the change list or graph is scrolled within its pane
- **WHEN** the user opens a confirmation and then dismisses it
- **THEN** the pane keeps that scroll position and neither the branch header,
  the lists nor the graph jump while the card rises or lowers

#### Scenario: Reuse for reference forms

- **WHEN** the user creates a branch or tag, deletes a branch, or confirms staging all changes before committing
- **THEN** the same floating surface and content/action hierarchy are used with the appropriate fields and controls

#### Scenario: Replace an idle prompt

- **GIVEN** an operation prompt is open but has not been submitted
- **WHEN** the user requests a different operation prompt
- **THEN** only the new prompt remains and no repository command runs for the replaced prompt

#### Scenario: Backdrop filtering unavailable

- **WHEN** the browser cannot filter the background behind the floating surface
- **THEN** the surface remains readable on a solid theme-derived background

#### Scenario: A dismissed prompt leaves the pane

- **WHEN** the user cancels an idle prompt
- **THEN** the card moves down out of the pane before it is removed, it accepts
  no further input on the way out, and no Git command runs

#### Scenario: Reduced motion keeps the prompt in place

- **WHEN** the system asks for reduced motion and the user opens and dismisses an
  operation prompt
- **THEN** the card appears and disappears at its final position without moving
