# git-sidebar delta

## MODIFIED Requirements

### Requirement: Toolbar loading progress

The panel SHALL show an indeterminate progress bar along the bottom edge of its
toolbar while it is loading the repository on open, refreshing, loading earlier
history, or running a Git operation. The bar SHALL NOT change the toolbar's
layout height or accept pointer input. Once shown, the bar SHALL remain visible
for at least 500 milliseconds even when that work finishes sooner, and it SHALL
be gone once the work has finished and that minimum has passed. Work that starts
while the bar is still being held SHALL keep it continuously visible without a
gap. When the user prefers reduced motion, the panel SHALL show the same
activity indicator without the sweeping animation.

#### Scenario: Opening the panel

- **WHEN** the panel opens and the repository status and history are still being read
- **THEN** an indeterminate progress bar is visible along the toolbar's bottom edge and leaves after both reads answer

#### Scenario: Running an operation

- **WHEN** the user starts a Git operation such as staging a file or refreshing and the operation is still running
- **THEN** the progress bar is visible until the operation and its follow-up refresh finish

#### Scenario: Brief work

- **WHEN** a repository read or Git operation finishes before the progress bar has been visible for 500 milliseconds
- **THEN** the bar stays visible until that minimum has passed and then leaves

#### Scenario: Activity resumes during the hold

- **GIVEN** the progress bar is still within its minimum visible time
- **WHEN** another repository read or Git operation starts
- **THEN** the bar stays continuously visible and leaves only after that work finishes and the minimum has passed

#### Scenario: Idle panel

- **WHEN** no repository read or Git operation is running
- **THEN** the toolbar shows no progress bar

#### Scenario: Reduced motion

- **GIVEN** the user prefers reduced motion
- **WHEN** the panel is loading or running a Git operation
- **THEN** the toolbar still shows the activity indicator, held still instead of sweeping
