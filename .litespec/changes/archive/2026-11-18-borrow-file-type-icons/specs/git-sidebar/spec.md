# git-sidebar delta

## MODIFIED Requirements

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
