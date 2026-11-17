# git-sidebar delta

## ADDED Requirements

### Requirement: Floating operation panels

The panel SHALL present discard confirmations, stage-all-and-commit confirmation, reference naming and branch deletion in a consistent rounded bottom-anchored floating surface within the Git panel, without changing the change-list or graph pane geometry or split ratio. The surface SHALL use the host theme's colors, typography, borders, controls and focus treatment, with translucency and backdrop blur where supported and a readable solid fallback otherwise. Only one operation prompt SHALL be visible at a time; requesting another idle prompt SHALL replace the previous one without executing it.

#### Scenario: Confirm without resizing the lists
- **GIVEN** the change list and graph are visible at a user-selected split ratio
- **WHEN** the user opens a discard confirmation
- **THEN** a rounded frosted card appears above the bottom of the panel while the panes and their split ratio retain their geometry

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

### Requirement: Adaptive operation-panel content

The floating surface SHALL separate its copy and optional form fields from its action footer. Long text and translated action labels SHALL wrap within the available width. Content exceeding the available panel height SHALL scroll while the actions remain reachable, and reference-operation failures SHALL remain visible with the retained form values.

#### Scenario: Long text in a narrow sidebar
- **WHEN** a confirmation contains a long unbroken filename or branch name in a narrow sidebar
- **THEN** its copy wraps without horizontal overflow and the action labels remain readable on wrapping controls below the content

#### Scenario: Tag annotation in a short panel
- **WHEN** a tag form and its annotation exceed the panel height
- **THEN** the content area scrolls within the floating surface and the action footer remains reachable

#### Scenario: Reference creation fails
- **WHEN** Git rejects a submitted branch or tag name
- **THEN** the floating form displays the failure and retains the name and annotation for correction or cancellation

### Requirement: Safe floating-panel interaction

The floating surface SHALL expose a named dialog and associate a non-empty description for assistive technology. Plain confirmations SHALL initially focus Cancel, while reference creation SHALL retain initial focus on the name field. Escape SHALL cancel an idle prompt without running Git, and a prompt that remains open while an operation is busy SHALL reject cancellation and duplicate submission. Ordinary Enter in a tag annotation SHALL remain a newline rather than submitting it.

#### Scenario: Cancel a discard with Escape
- **WHEN** the user opens a discard confirmation and presses Escape while idle
- **THEN** the dialog closes and no discard command runs

#### Scenario: Confirmation without a description
- **WHEN** the stage-all-and-commit confirmation has no additional description
- **THEN** the dialog is named and contains no dangling description reference or empty description block

#### Scenario: Operation in flight
- **WHEN** a reference operation is pending and the user presses Escape or activates a submit or cancel control again
- **THEN** the original request remains the only operation and the prompt stays visible with its progress feedback
