# git-sidebar delta

## MODIFIED Requirements

### Requirement: Change overview

The panel SHALL list the repository's changes as three groups in Code OSS's
order: merge conflicts, staged changes, and changes not yet staged. Within a
group, every changed file SHALL appear as one row in a single-layer list with
no folder rows, sorted by its repository-relative path. Every row SHALL show
the Web application's own file-type icon for that file's path before the file
name, drawn as the application's workspace explorer draws it, the file's
repository-relative path, and the status letter identifying added, modified,
deleted, renamed, untracked, or conflicted state at the row's end in that
status's color, matching the files listed under an expanded commit. When the
application provides no file-type icon set, the row SHALL show the plugin's
plain document icon instead. A file with both staged and unstaged
modifications SHALL appear in both the staged and the unstaged group. A file
that Git reports as conflicted SHALL appear under merge conflicts with the
conflicted status letter and SHALL remain listed until the conflict is
resolved.

#### Scenario: Partially staged file

- **WHEN** a tracked file has staged edits and further unstaged edits
- **THEN** the file appears under staged changes and again under changes not yet staged

#### Scenario: File type icons

- **GIVEN** a repository changed a JavaScript file, a stylesheet and an image
- **WHEN** the change lists are shown
- **THEN** every row shows the application's glyph for its path before the file
  name, its status letter stays at the row's end, and the stage, unstage and
  discard controls keep their positions

#### Scenario: Status letter at the row's end

- **WHEN** the change groups are shown
- **THEN** every row shows its status letter after the file name and dimmed
  directory and in that status's color, as the last element of the row

#### Scenario: The application provides no file-type icons

- **GIVEN** the application does not provide its file-type icon set
- **WHEN** the change lists are shown
- **THEN** every row shows the plugin's plain document icon, and staging,
  unstaging, discarding and opening a diff keep working

#### Scenario: Nested files

- **WHEN** changed files live in several nested directories
- **THEN** every file is listed directly in its group's single-layer list in path order, with no collapsible folder rows

#### Scenario: Merge conflict

- **WHEN** a merge leaves a tracked file conflicted
- **THEN** the file appears under merge conflicts with the conflicted status letter and its repository-relative path

#### Scenario: Conflict in a nested folder

- **WHEN** a conflicted file lives in a nested directory
- **THEN** merge conflicts lists the file directly, showing its directory with its name, like the other groups

### Requirement: Host execution and presentation

Git commands SHALL run on the Host in the Session's working directory, and the
panel SHALL only transmit structured status and results between the browser and
the Host. The panel SHALL present itself in the host application's visual
language: colors, borders, surfaces, and focus rings SHALL come from the host
theme tokens, divider lines SHALL use the host's standard divider color, and
metadata and controls SHALL use the host's text sizes and weights, spacing, and
corner radii. Section header titles SHALL use one text size step above rows and
a heavier weight than their surrounding metadata. Every row listed in the change
groups, the commit graph and the commit-details tree SHALL use one compact
22-pixel row style: the same height, horizontal padding, gap, corner radius,
hover surface and focus ring. A commit row SHALL keep its graph cell, subject
and reference badges inside that shared row, and the commit graph's line, node
and reference badge colors SHALL follow Code OSS's Source Control Graph as the
commit graph requirements describe. The panel's visible text SHALL follow the
user's language, providing English and Chinese copy.

#### Scenario: Theme follows the application

- **WHEN** the application switches between light and dark themes
- **THEN** the panel's surfaces, text, diff colors, and graph badge text update with the host theme without reloading the tab

#### Scenario: Matches the host sidebar

- **WHEN** the panel is shown beside the sidebar's own sections and rows
- **THEN** its section headers, metadata, controls, menus and divider lines
  share the host's text scale, spacing, corner radii and standard divider color,
  and its list rows use one shared compact height and spacing instead of two row
  scales

#### Scenario: One row style across sections

- **WHEN** the change groups and the commit graph are visible together
- **THEN** changed-file rows, folder rows in the commit-details tree and commit
  rows share the same height, padding, hover surface and focus ring, while
  commit rows still show their graph cell, subject and reference badges

#### Scenario: Chinese interface

- **WHEN** the application language is Chinese
- **THEN** the panel's controls, messages, and empty states are shown in Chinese

### Requirement: Commit graph swimlanes

The panel SHALL show the most recent commits reachable from the repository's
local branches, tags, and remote-tracking branches in topological order, with
every commit after all of its children, as a commit graph laid out with Code OSS's Source Control Graph swimlane rules. Every row SHALL carry an ordered
set of incoming lines from the row above and outgoing lines toward the row
below, each line heading for one commit:

- A commit's node SHALL sit on the leftmost incoming line heading for it; a
  commit that no line expects SHALL place its node in a new position after
  every incoming line.
- The commit's first parent SHALL continue in the node's position, and every
  other incoming line heading for the same commit SHALL join the node on that
  row and end there.
- Every additional parent of a merge SHALL open a new outgoing line at the right
  end of the row, even when another line already heads for that parent.
- Lines to the right of an ended line SHALL move left on the same row to close
  the gap, keeping their order.
- A commit without parents SHALL end only its own lines; every other line SHALL
  continue.
- A line heading for a commit outside the listed window SHALL continue to the
  bottom of the graph.

#### Scenario: Linear history

- **WHEN** every listed commit has the next listed commit as its only parent
- **THEN** every node sits in the first position and one uninterrupted vertical
  line joins them

#### Scenario: Merged branch topology

- **WHEN** a merge commit's second parent is a branch that diverged from its
  first parent's line
- **THEN** the merge opens a second line on its right, the branch's commits sit
  on that line, and the line joins its fork point's node on the fork point's row

#### Scenario: Several branch tips

- **WHEN** a branch tip is listed after commits of another branch and no
  earlier line expects it
- **THEN** its node starts a new line to the right of the active lines, and the
  line joins the shared ancestor's node on that ancestor's row

#### Scenario: A merge parent that is already expected

- **GIVEN** a line already heads for a merge commit's second parent
- **WHEN** the merge commit's row is drawn
- **THEN** the merge still opens a new line at the right end for that parent,
  and both lines join the parent's node on its row

#### Scenario: Lanes close up after a join

- **WHEN** a line ends by joining a node while other lines run to its right
- **THEN** those lines move one position left on that row and continue
  vertically below it

#### Scenario: A root commit does not end other branches

- **WHEN** a commit without parents is listed while other lines are still
  active
- **THEN** only the root commit's own lines end and every other line continues
  to its next commit

#### Scenario: Parent outside the window

- **WHEN** the oldest listed commit's parent is not listed
- **THEN** its line continues to the bottom edge of the graph

### Requirement: Commit graph drawing

The graph SHALL reproduce Code OSS's Source Control Graph geometry: rows 22
pixels high, line positions 11 pixels apart with the first position 11 pixels
from the graph's left edge, nodes centered vertically in their row, and lines
drawn one pixel wide with round caps. A continuing line SHALL be vertical. A
line that moves left on a row SHALL descend briefly, turn with a 5-pixel radius
into a horizontal run at the row's middle, and turn with the same radius down
into its new position. A line joining a node from the right SHALL turn with an
11-pixel quarter curve from its position into the row's middle and run
horizontally into the node. A merge's additional parent line SHALL leave the
node horizontally and turn with an 11-pixel quarter curve down into its own
position at the row's bottom edge. Each row's graph cell SHALL be one position
wider than the larger of its incoming and outgoing line counts, and the row's
text SHALL begin right after that cell. A line that enters a row from above
SHALL join the line the row above leaves at its bottom edge without a break,
including when the rows' edges fall between device pixels.

#### Scenario: A join turns into the node

- **WHEN** a second line heading for a commit arrives at the commit's row from
  a position to the right of the node
- **THEN** the line curves from that position at the row's top edge into the
  row's middle and runs horizontally into the node

#### Scenario: A merge launches its parent line

- **WHEN** a merge commit opens a line for its second parent
- **THEN** the line leaves the node horizontally at the row's middle and curves
  down into the new position at the row's bottom edge

#### Scenario: A shifted line keeps continuity

- **WHEN** a line moves one or more positions left on a row
- **THEN** it leaves the row's top edge in its old position and reaches the
  row's bottom edge in its new position through two 5-pixel turns joined by a
  horizontal run

#### Scenario: A line crosses a row boundary

- **GIVEN** the row edges do not line up with whole device pixels, as they do
  not at a zoom of 125%
- **WHEN** a lane continues from one row into the row below
- **THEN** the stroke reads as one unbroken line, with no lighter pixel row
  where the two rows meet

#### Scenario: Text follows each row's own graph width

- **WHEN** one row has a single active line and another row has four
- **THEN** the first row's text begins after a two-position graph cell and the
  second row's text begins after a five-position graph cell

### Requirement: Commit graph nodes

Every listed commit SHALL be drawn as a node in Code OSS's shapes: a filled dot
for a commit with at most one parent, a ring with a filled center dot for a
merge commit, and a hollow ring for the checked-out commit, which takes
precedence over the merge shape. Each node SHALL be separated by a clear gap
from the lines that touch it, and the gap outside the node's outer edge SHALL
close while the pointer hovers the row.

#### Scenario: Checked-out commit

- **WHEN** the history contains the commit HEAD points at
- **THEN** that commit's node is a hollow ring in its line's color

#### Scenario: Merge commit

- **WHEN** a listed commit has two or more parents and is not checked out
- **THEN** its node is a ring around a smaller filled dot

#### Scenario: Ordinary commit

- **WHEN** a listed commit has one parent or none and is not checked out
- **THEN** its node is a filled dot in its line's color

### Requirement: Commit graph colors

Graph lines SHALL use a restyled palette that is clearly distinct from Code OSS's
Source Control Graph while keeping the same hue families and readable contrast: a
new line SHALL take the next color of the five-color rotation `#D6A700` (gold),
`#E0065B` (crimson), `#A66200` (copper), `#3EAD76` (emerald), `#9362F4`
(violet), in the order lines are created from the top of the graph and
restarting after the fifth. A first parent SHALL continue its child's line
color. A commit that carries the checked-out branch SHALL color the line it
continues blue, a commit that carries that branch's upstream SHALL color it
purple, and a commit that carries the branch's base branch SHALL color it
orange, in that priority; a new line toward such a commit SHALL take that color
instead of a rotation color. The blue SHALL be `#0088CD` in the light theme and
`#00A8FB` in the dark theme, the purple `#81359C` in the light theme and
`#C27FDD` in the dark theme, and the orange `#F66140` in both. The blue and
purple SHALL switch between their light and dark variants with the host theme.
Every color SHALL keep at least a 2:1 contrast ratio against the panel
background in both themes. The base branch SHALL be the remote branch configured
as the branch's Code OSS merge base, otherwise the default branch of the default
remote, and SHALL only apply when it differs from the upstream. A node SHALL
take the color of the line its first parent continues, or of its incoming line
when it has no parents, and a joining line SHALL keep its own color until it
reaches the node.

#### Scenario: Colors rotate per new line

- **WHEN** six branch lines are opened one after another without special
  references
- **THEN** they take the five rotation colors in order and the sixth line
  repeats the first color

#### Scenario: Checked-out branch is blue

- **WHEN** the checked-out branch points at a listed commit
- **THEN** that commit's node and the line toward its first parent are blue and
  the line keeps that color down to the next commit that changes it

#### Scenario: Upstream and base branches

- **WHEN** the checked-out branch's upstream and its base branch point at other
  listed commits
- **THEN** the upstream commit's line is purple and the base branch commit's
  line is orange

#### Scenario: Theme follows the application

- **WHEN** the application switches between light and dark themes
- **THEN** the checked-out and upstream colors switch to their matching variant
  without reloading the tab, while the rotation colors and the base color stay
  the same

#### Scenario: Colors stay legible in both themes

- **WHEN** the panel renders in the light theme or in the dark theme
- **THEN** every line, node and badge color keeps at least a 2:1 contrast ratio
  against the panel background

### Requirement: Commit rows and reference badges

Each commit row SHALL show, on one line beside its graph cell, the commit's
subject followed by its dimmed author, truncated together with an ellipsis,
and then the commit's reference badges, which keep their size. The checked-out
commit's subject and author SHALL be bold. Badges SHALL follow Code OSS's rules:
references are ordered by the checked-out branch, its upstream, its base
branch, then local branches, remote branches and tags by name; the first
reference is a badge with its icon and its name, truncated beyond 100 pixels;
the remaining references are grouped by color and then by kind into icon
badges that show a count when they stand for more than one reference. Every
badge SHALL be a capsule whose leading and trailing ends are half circles as
tall as the badge, instead of a rounded rectangle. A badge
SHALL use the reference's color as its background and the panel background as
its text color, where the checked-out branch, its upstream and its base branch
keep their own colors and every other reference takes its node's color. The
checked-out branch SHALL use a target icon, local branches a branch icon,
remote branches a cloud icon and tags a tag icon. A remote's default-branch
pointer and a detached HEAD marker SHALL NOT be shown as badges. The row's
tooltip SHALL list every reference, the short identifier, subject, author and
relative time.

#### Scenario: Checked-out branch with its upstream

- **WHEN** the checked-out commit carries the checked-out branch and its
  upstream remote branch
- **THEN** the row shows a blue badge with a target icon and the branch name,
  followed by a purple cloud badge without a name

#### Scenario: Badge ends are capsules

- **WHEN** a commit row shows its reference badges
- **THEN** each badge's leading and trailing ends are half circles as tall as
  the badge, so a badge reads as a capsule rather than a rounded square on
  both themes

#### Scenario: Branch and its remote on another line

- **WHEN** a commit on a yellow line carries a local branch and its
  remote-tracking branch
- **THEN** the row shows a yellow badge with a branch icon and the branch name,
  followed by a yellow cloud badge without a name

#### Scenario: Several references of one kind

- **WHEN** a commit carries one named badge and two further tags of the same
  color
- **THEN** the tags appear as one tag badge showing the count two

#### Scenario: A narrow row keeps its badges

- **WHEN** the row is too narrow for the subject, author and badges
- **THEN** the subject and author are truncated with an ellipsis while the
  badges keep their size

### Requirement: Inline commit changes

Activating a commit row in the graph, by pointer or by Enter or Space while
the row has keyboard focus, SHALL toggle a list of the files that commit
changed relative to its first parent directly below the row, as Code OSS's
Source Control Graph expands a history item. The row SHALL expose whether it is
expanded to assistive technology. Several commits SHALL be able to stay
expanded at the same time, and activating an expanded row SHALL collapse its list. Each listed file
SHALL take one 22-pixel row showing the Web application's own file-type icon
for that file's path, drawn as the application's workspace explorer draws it,
the file name, its dimmed repository-relative directory when it has one, and
its status letter at the row's end in that status's color; the files SHALL be
sorted by path, and a renamed file's tooltip SHALL name its original path. When
the application provides no file-type icon set, the row SHALL show the plugin's
plain document icon instead and SHALL otherwise stay unchanged. Activating a
listed file, by pointer or keyboard, SHALL open that file's diff for the
commit. While the file list is read the commit SHALL show one loading row; a
commit without file changes SHALL show one row saying so; a failed read SHALL
show one row with the failure and a retry control; a capped list SHALL end with
a row saying that only the first files are shown. Listed files SHALL keep the
copy-only context menu of past-commit files. Expanding or collapsing SHALL NOT
change the repository and SHALL NOT replace the change list or the graph.

#### Scenario: Expand a commit

- **WHEN** the user activates a collapsed commit row
- **THEN** the commit's changed files appear directly below it in path order,
  each with its icon, name, dimmed directory and status letter, while the change
  list, the rest of the graph and the commit box stay in place

#### Scenario: Collapse a commit

- **WHEN** the user activates a commit row whose files are listed
- **THEN** its file rows disappear and the next commit row follows it directly

#### Scenario: File type icons

- **GIVEN** a commit changed `src/app.ts`, `assets/logo.png` and a file with no
  recognized type
- **WHEN** the user expands that commit
- **THEN** the rows show the application's glyphs for those paths, a TypeScript
  glyph, an image glyph and its generic document glyph, while the row height,
  name, dimmed directory and status letter stay unchanged

#### Scenario: The application provides no file-type icons

- **GIVEN** the application does not provide its file-type icon set
- **WHEN** the user expands a commit
- **THEN** every file row shows the plugin's plain document icon, the list opens
  as usual, and its rows still open their diffs

#### Scenario: Keyboard toggle

- **WHEN** a commit row has keyboard focus and the user presses Enter or Space
- **THEN** its file list expands, or collapses when it is already expanded,
  without changing the repository

#### Scenario: Several commits expanded

- **GIVEN** one commit's file list is expanded
- **WHEN** the user activates another commit row
- **THEN** both commits list their files below their own rows

#### Scenario: Open a file from an expanded commit

- **WHEN** the user activates a file row under an expanded commit
- **THEN** a diff tab shows the change that commit made to the file relative to
  its first parent and identifies the commit

#### Scenario: Expanded commit without file changes

- **WHEN** the user expands a commit that changed no files relative to its
  first parent
- **THEN** one row under the commit says that it has no file changes

#### Scenario: Expanded commit cannot be read

- **WHEN** reading an expanded commit's file list fails
- **THEN** one row under the commit reports the failure, and activating its
  retry control reads the list again

#### Scenario: Context menu of an expanded file

- **WHEN** the user invokes the context menu on a file row under an expanded
  commit
- **THEN** it offers only the relative-path and absolute-path copy actions

### Requirement: Expanded commit drawing

The rows listed under an expanded commit SHALL continue the commit graph as Code OSS draws an expanded history item's changes: every line that leaves the
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
