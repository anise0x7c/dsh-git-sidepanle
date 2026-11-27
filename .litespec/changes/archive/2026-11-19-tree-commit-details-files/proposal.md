# Show commit details files as a folder tree

## Why

The commit details view lists every changed file as a flat path-sorted list, so
a commit that touches several files under one directory repeats that directory
in every row and gives no sense of the changed structure. Deeply nested paths
also compete for the row's width with the file name, icon and status letter.

## What Changes

- The details view groups the commit's changed files into a folder tree. Each
  folder appears once, above the files and folders it contains, and each nested
  level is indented one step further than its parent.
- A folder whose subtree is a single unbranched chain of folders collapses into
  one row that joins the chain's names with `/`, such as `aa/bb/cc`. The chain
  costs one indentation level rather than one per folder, and branching or a
  file in the middle of the chain ends the collapse there.
- Within a folder, subfolders come before files, and both are ordered by name
  case-insensitively with numeric runs compared as numbers, so the details list
  stays deterministic and path-ordered.
- File rows keep their file-type icon, name, rename arrow and right-aligned
  status letter, and still open the commit-scoped diff; the per-row context menu
  and tooltip keep working. Folder rows are labels: they open nothing and carry
  no menu.
- The header's file count keeps counting changed files, not folder rows. The
  empty, loading, failure/retry and truncated states are unchanged.

## Non-goals

- No change to the three working-tree change groups or to the files listed
  under an expanded graph commit; those stay flat, path-sorted lists.
- Folders are not collapsible or selectable; there is no persisted expansion
  state.
- No Host, wire, diff, or repository behavior changes, and no new locale copy.
