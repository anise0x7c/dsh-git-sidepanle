# git-sidebar delta

## MODIFIED Requirements

### Requirement: Adaptive operation-panel content

The floating surface SHALL separate its copy and optional form fields from its action footer. Long text and translated action labels SHALL wrap within the available width. Content exceeding the available panel height SHALL scroll while the actions remain reachable, and reference-operation failures SHALL remain visible with the retained form values. The surface SHALL use compact horizontal spacing: 4px minimum side gutters and 8px horizontal insets for its content and footer, without reducing vertical spacing or button hit areas.

#### Scenario: Long text in a narrow sidebar

- **WHEN** a confirmation contains a long unbroken filename or branch name in a narrow sidebar
- **THEN** its copy wraps without horizontal overflow and the action labels remain readable on wrapping controls below the content

#### Scenario: Tag annotation in a short panel

- **WHEN** a tag form and its annotation exceed the panel height
- **THEN** the content area scrolls within the floating surface and the action footer remains reachable

#### Scenario: Reference creation fails

- **WHEN** Git rejects a submitted branch or tag name
- **THEN** the floating form displays the failure and retains the name and annotation for correction or cancellation

#### Scenario: Compact horizontal spacing

- **WHEN** an operation prompt opens in a sidebar too narrow to reach the card's maximum width
- **THEN** the card leaves 4px on each side and its content and footer each retain 8px horizontal insets, while vertical spacing and button hit areas remain unchanged
