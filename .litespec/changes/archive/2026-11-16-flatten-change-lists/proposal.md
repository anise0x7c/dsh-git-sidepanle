# List changed files in one flat layer

## Why

The change groups and a commit's details view draw their changed files as a
folder tree. Every directory level adds a row and a click, and a user who only
wants to scan which files changed has to open folders first; a deep single-file
path also spends several rows on its directories. These lists are short-lived
working sets, not a repository browser, so the hierarchy costs more than it
explains.

## What Changes

- The three change groups — merge conflicts, staged changes, and changes not
  yet staged — render every changed file as one row in a flat, path-sorted
  list. There are no folder rows and no collapse state.
- Each file row keeps its status letter and shows the file name with its
  repository-relative parent directory on the same line, so two files with the
  same name remain distinguishable; the full path stays in the row tooltip.
- A commit's changed-files list in the details view uses the same flat,
  path-sorted list, with status letters, rename sources, and the commit-scoped
  diff activation unchanged.
- Folder context menus and the `folder`/`commitFolder` menu targets disappear
  with the folder rows. File rows and group headers keep their existing menus,
  and copy actions remain available for changed files and commit files.
- Section headers, counts, stage/unstage/discard controls, empty states,
  refreshes, and the no-repository explanation are unchanged.

## Non-goals

- No change to Host queries, status parsing, staging, discarding, committing,
  diffing, or history.
- No grouping back by directory, no sort-order control, and no filtering or
  searching inside the lists.
- No replacement path for the removed folder-level stage, unstage, and discard
  commands; the existing group-header actions already act on every file in a
  group.
