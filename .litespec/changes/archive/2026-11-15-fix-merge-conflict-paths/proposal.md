# Report merge-conflict rows with their paths

## Why
A repository in the middle of a merge cannot use the panel's merge-conflict
group. The Host reports the status of every active repository, but for a
conflicted record it returns the entry without its repository-relative path, so
the browser half builds the change tree from a missing path: the merge group
comes back empty or broken, and the row cannot be opened, staged or cleared.

The defect has been present since the first release and was preserved verbatim
by the module split in 0.3.0. Any merge, rebase or cherry-pick that leaves
conflicts exposes it.

## What Changes
The Host status read now returns the repository-relative path for conflicted
entries, exactly as it already does for modified, untracked and renamed ones.
With the path present, the panel lists each conflicted file under **merge
changes** with the conflicted status letter (`!`) inside its folder tree, and the
row's existing actions (open, stage) work like they do for other groups.

No new group, action or copy is introduced: the change fixes the data the
panel already needed to render a group it already had.

## Non-goals
- No merge editor or combined-diff rendering; a conflicted file's diff tab
  keeps its current content (Git's `--cc` output is not rendered as a special
  merge view).
- No new conflict-resolution command (conflicts are still staged to mark them
  resolved).
- No change to how conflicts are detected, grouped or labelled.
