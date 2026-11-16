# git-sidebar delta

## ADDED Requirements

### Requirement: Commit message sizing

The panel SHALL size the commit message input to its content: one line while the message fits on one line, one additional line for every line the message wraps onto, and at most ten lines, after which the message scrolls inside the input instead of growing it. The input SHALL follow both a change to the message and a change to the width available for it, and it SHALL offer no manual resize handle.

#### Scenario: Empty message box

- **WHEN** the panel shows an empty commit message input
- **THEN** the input is one line high and needs no scrolling

#### Scenario: A wrapped message grows the input

- **WHEN** the user types a message that wraps onto four lines
- **THEN** the input is four lines high and shows the whole message without scrolling

#### Scenario: A long message stops at ten lines

- **WHEN** the message needs more than ten lines
- **THEN** the input stays ten lines high and the message scrolls inside it

#### Scenario: Deleting text shrinks the input

- **WHEN** the user deletes the message back to a single line
- **THEN** the input shrinks back to one line high

#### Scenario: Narrowing the panel rewraps the message

- **WHEN** the Sidebar becomes narrow enough that the same message needs more lines
- **THEN** the input grows to the new height of the same message without further typing

#### Scenario: Input disabled while committing

- **WHEN** a commit is running and the input is disabled
- **THEN** its height still matches the message it holds
