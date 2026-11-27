## MODIFIED Requirements

### Requirement: Hover highlights a surface and its controls

When the pointer rests on a row of the change lists, the commit graph or the
commit-details tree, or on a collapsible section header, the panel SHALL show
the host's hover highlight over that whole surface, inside that surface's
rounded corners. While the pointer rests on a control inside such a surface —
a header action, a file-row action or a control in the commit graph header —
that control SHALL add its own rounded hover highlight above the surface
highlight, so the control reads both as part of the highlighted row and as the
target under the pointer. A section's toggle SHALL keep only the surface
highlight instead of a second layer of its own, because it spans most of the
header. Every nested control SHALL fill the surface's height, and its highlight
SHALL sit 2px inside the control's box on every side: the control is flush with
the surface, so the layer keeps 2px from the surface's top and bottom, and a
header's trailing control keeps the same 2px from the header's trailing edge.
The highlight's corners SHALL take the surface's corner radius reduced by that
inset, so the two rounded shapes nest, and adjacent control highlights SHALL
leave 4px between them. The control's whole box SHALL stay the pointer target.
A disabled control SHALL NOT show a control highlight, and a row that takes no
pointer input SHALL show neither layer.

#### Scenario: The toggle keeps only the header highlight

- **GIVEN** the pointer rests on a section header's toggle
- **WHEN** the toggle covers the title and count of that header
- **THEN** only the header shows the hover highlight, without a second highlight
  under the pointer inside it

#### Scenario: A control inside a hovered header

- **GIVEN** the staged group shows its unstage-all control and the unstaged
  group shows its stage-all and discard-all controls
- **WHEN** the pointer moves over one of those controls
- **THEN** the whole header shows the hover highlight and that control adds its
  own highlight above it, while the header's other controls show only the
  header highlight

#### Scenario: A control inside a hovered row

- **GIVEN** a file row reveals its stage, unstage or discard control while the
  row is hovered
- **WHEN** the pointer moves onto that control
- **THEN** the row keeps its hover highlight and the control adds its own
  highlight above it

#### Scenario: The graph header highlights like the other headers

- **WHEN** the pointer moves from a change-group header to the commit graph
  header
- **THEN** the graph header shows the same whole-header highlight, and a graph
  header control that the pointer rests on adds its own highlight above it

#### Scenario: A nested highlight nests inside its surface

- **GIVEN** the pointer rests on a file row's action control or a header's
  action control
- **WHEN** the control's hover highlight is shown
- **THEN** the highlight keeps a 2px inset inside the control — 2px from the
  surface's top and bottom, and from a header's trailing edge — its corners
  follow the surface's corners at that inset, and the control keeps its full hit
  box

#### Scenario: Both layers leave with the pointer

- **WHEN** the pointer leaves the header, the row or the control
- **THEN** the control highlight and the surface highlight are gone

#### Scenario: A disabled control stays flat

- **GIVEN** an action is running so a header's action control is disabled
- **WHEN** the pointer rests on that disabled control
- **THEN** the header shows its hover highlight and the disabled control adds no
  highlight of its own

#### Scenario: A status row takes no hover

- **WHEN** the pointer rests on a note row that reports a loading, empty or
  failed list, away from any control it may contain
- **THEN** the row shows no hover highlight, while an inline retry control keeps
  its own highlight
