# git-sidebar delta

## MODIFIED Requirements

### Requirement: Adaptive operation-panel content

The floating surface SHALL separate its copy and optional form fields from its action footer. Long text and translated action labels SHALL wrap within the available width. Content exceeding the available panel height SHALL scroll while the actions remain reachable, and reference-operation failures SHALL remain visible with the retained form values. The surface SHALL dynamically span the Git pane's width with equal 4px left, right and bottom gutters, without a fixed maximum width, overlaying the underlying content rather than resizing it. Its content and footer SHALL retain 8px horizontal insets without reducing vertical content spacing or button hit areas.

#### Scenario: Long text in a narrow sidebar

- **WHEN** a confirmation contains a long unbroken filename or branch name in a narrow sidebar
- **THEN** its copy wraps without horizontal overflow and the action labels remain readable on wrapping controls below the content

#### Scenario: Tag annotation in a short panel

- **WHEN** a tag form and its annotation exceed the panel height
- **THEN** the content area scrolls within the floating surface and the action footer remains reachable

#### Scenario: Reference creation fails

- **WHEN** Git rejects a submitted branch or tag name
- **THEN** the floating form displays the failure and retains the name and annotation for correction or cancellation

#### Scenario: Full-width floating surface with equal gutters

- **WHEN** an operation prompt opens in a narrow or wide Git pane, or the pane is resized while the prompt is open
- **THEN** the card fills the pane width except for equal 4px left and right gutters, sits 4px above the pane bottom, and overlays the underlying graph without changing its geometry
- **THEN** its content and footer retain 8px horizontal insets, with unchanged vertical content spacing and button hit areas
