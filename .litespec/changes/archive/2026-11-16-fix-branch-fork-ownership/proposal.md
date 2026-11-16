# Fix branch fork ownership

## Why
A child's first parent currently joins a lane that already expects the same ancestor immediately below the child. This creates a bend at an intermediate commit when the two lines should remain distinct until their shared parent. In the reported history, `Update to upstream` therefore turns even though the divergence belongs at the later `doc: sync` commit.

## What Changes
Keep ordinary first-parent connections vertical in their child's lane, even when another lane already expects that parent. Retain every lane expecting a listed commit until that commit's row, where additional incoming lines turn into the shared node. Preserve display order, real parent relationships, branch colors, grid geometry, and the existing secondary-parent lane constraints.

## Non-goals
- Do not reorder commits or change the Host history query.
- Do not redesign row information, menus, keyboard activation, or theme behavior.
- Do not change the public graph result or connector shape contracts.
