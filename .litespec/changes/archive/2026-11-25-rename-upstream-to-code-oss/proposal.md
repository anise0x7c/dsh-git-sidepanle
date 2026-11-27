# Refer to the upstream editor as Code OSS

## Why

The panel's graph, menus and change lists are ported from the open-source Code
OSS project, but the project called that upstream "VS Code" everywhere:
package and locale descriptions, source comments, the architecture notes, the
user guides, the behavior specification and the archived change records. That
naming suggests parity with a proprietary product and obscures which
implementation the geometry and action structure actually come from.

The rename already landed across the working tree; this change records it so
the specification's wording matches the implementation.

## What Changes

- The package description and both locale metadata dictionaries describe the
  sidebar as **Code OSS-style**.
- Source comments, the architecture guide, the user guides, the behavior
  specification and the archived change records refer to the upstream editor as
  Code OSS. The nine affected git-sidebar requirements keep their behavior and
  scenarios; only the upstream product's name changes.
- Identifiers that Git or the upstream project define keep their spelling:
  the per-branch `vscode-merge-base` configuration key, the `microsoft/vscode`
  repository path, the `.vscode/` directory rule and the
  `--vscode-sideBar-background` custom property.
- The graph equivalence oracle and the two archived change records that also
  carried the upstream name in their file system names are renamed from
  `vscode-*` to `code-oss-*`, so no path claims the old reference.
- The distribution artifacts are regenerated from the renamed source comments.

## Non-goals

- No graph geometry, layout rule, runtime contract or user-visible interaction
  changes. Colors, row metrics, menu structure and copy stay as they are.
- Requirements whose text did not mention the upstream product are untouched,
  and the upstream-defined identifiers listed above stay literally unchanged.
