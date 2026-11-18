# Right-align change status letters

## Why

The three change groups and the commit-details file list render each status
letter at the start of the row, before the file-type icon, while the files
listed under an expanded commit render it at the row's end. The same
information therefore jumps between the left and right edges depending on
which view the user is reading, and the change lists do not match VS Code's
source-control list, which keeps the decoration at the row's end.

## What Changes

- Every file row in the merge-conflicts, staged and changes groups shows its
  status letter at the end of the row, after the file name and dimmed
  directory, in that status's color, exactly like the files under an expanded
  commit.
- Every file row in the commit-details card shows its status letter at the end
  of the row in the same position and color, so all flat file lists agree.
- File-type icons, file names, dimmed directories, rename arrows and the
  hover stage/unstage/discard actions keep their current order and behavior;
  the letter becomes the last element of the row.
- The document order stays readable for assistive technology: the row's
  accessible label still names the status and path.

## Non-goals

- No change to the diff tab's stage/commit pill badge, which labels the tab's
  context rather than a row's change status.
- No change to the expanded-commit rows, which already place the letter at the
  row's end.
- No change to row heights, status letters, status colors, sorting, grouping,
  or any action, menu, or Git behavior.
