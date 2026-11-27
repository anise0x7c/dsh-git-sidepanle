# git-sidebar delta

## ADDED Requirements

### Requirement: Toolbar loading progress

The panel SHALL show an indeterminate progress bar along the bottom edge of its
toolbar while it is loading the repository on open, refreshing, loading earlier
history, or running a Git operation. The bar SHALL NOT change the toolbar's
layout height or accept pointer input, and it SHALL be gone once that work
finishes. When the user prefers reduced motion, the panel SHALL show the same
activity indicator without the sweeping animation.

#### Scenario: Opening the panel

- **WHEN** the panel opens and the repository status and history are still being read
- **THEN** an indeterminate progress bar is visible along the toolbar's bottom edge and leaves when both reads answer

#### Scenario: Running an operation

- **WHEN** the user starts a Git operation such as staging a file or refreshing and the operation is still running
- **THEN** the progress bar is visible until the operation and its follow-up refresh finish

#### Scenario: Idle panel

- **WHEN** no repository read or Git operation is running
- **THEN** the toolbar shows no progress bar

#### Scenario: Reduced motion

- **GIVEN** the user prefers reduced motion
- **WHEN** the panel is loading or running a Git operation
- **THEN** the toolbar still shows the activity indicator, held still instead of sweeping
