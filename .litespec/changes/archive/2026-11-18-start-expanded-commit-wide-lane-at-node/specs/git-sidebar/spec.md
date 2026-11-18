# git-sidebar delta

## MODIFIED Requirements

### Requirement: Expanded commit drawing

The rows listed under an expanded commit SHALL continue the commit graph as VS
Code draws an expanded history item's changes: every line that leaves the
commit's row at its bottom edge SHALL continue vertically in its own position
and color through each listed row, the line in the commit node's position SHALL
be drawn three pixels wide and the others one pixel wide, and the next commit
row's lines SHALL join them at its top edge without a break. The expanded
commit's own row SHALL draw the line in its node's position three pixels wide
only from the node down to the row's bottom edge, so the wide line begins at the
node and continues unbroken into the listed rows, while the segment arriving
from the commit above the node SHALL stay one pixel wide; a collapsed commit row
SHALL keep one-pixel lines, and a lane the commit is not on SHALL keep one pixel
in both cases. A listed row's icon SHALL begin just after a graph area one
position wider than the number of lines leaving the commit. Expanded rows SHALL
NOT move the nodes, curves or colors of any commit row.

#### Scenario: Lanes run through the expanded rows

- **GIVEN** three lines leave an expanded commit's row and the commit's node
  sits in the second position
- **WHEN** its file rows are shown
- **THEN** three vertical lines in their own colors run through every file
  row, the second one three pixels wide, and the file icons begin after a
  four-position graph area

#### Scenario: The wide line starts at the expanded node

- **WHEN** the user expands a commit row
- **THEN** the line below its node is three pixels wide and runs unbroken into
  its file rows, while the line above the node and the commit rows above and
  below keep one-pixel lines

#### Scenario: A collapsed row keeps one-pixel lines

- **WHEN** the user collapses an expanded commit row
- **THEN** the line through that row is one pixel wide again and only its node
  still marks it

#### Scenario: The next commit keeps its geometry

- **WHEN** a commit above another is expanded
- **THEN** the lower commit's node, curves and colors are drawn exactly as when
  nothing is expanded, only lower by the height of the inserted rows
