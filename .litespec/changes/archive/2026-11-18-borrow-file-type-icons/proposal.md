# Borrow the host's file-type icons

## Why

The files listed under an expanded commit all carry the same hand-drawn document
outline, while the Web application beside the panel already draws a per-type
icon for every file in its workspace explorer. A file row that answers a
different visual question than the explorer next to it looks like a foreign
surface, and files are harder to scan: a directory of TypeScript, Markdown,
JSON and images reads as one anonymous column of documents.

The application's own icon set is not only artwork but classification: it
already decides that `src/app.ts` is a language glyph and `docs/README.md` is a
Markdown sheet, and it keeps that mapping current for the whole product. Reusing
it means the graph inherits both the look and the decision, instead of the
plugin growing a second, thinner classifier of its own.

## What Changes

- Each file listed under an expanded commit shows the Web application's own
  file-type icon for that file's path, with the per-type color the application
  uses in its workspace explorer, instead of the plugin's single document
  outline.
- The icon still occupies the same 16-pixel slot before the file name; row
  height, the file name, the dimmed directory, the status letter, the copy-only
  context menu, keyboard behavior and the graph drawing are unchanged.
- When the application does not provide its file-type icon set, the rows fall
  back to the plugin's plain document icon and keep working, so a host change
  cannot blank the panel or the file list.
- Rows that name no file, such as a loading, empty, failed or capped row, keep
  their existing text-only presentation.

## Non-goals

- Replacing the plugin's remaining icons (diff-tab title, empty-state
  illustration, branches, tags, references, controls): this change covers the
  file rows under an expanded commit, the surface that names individual files.
- Adding an icon to the changes list or to the commit-details file rows, which
  show none today.
- Changing the application's classification or its per-type colors, or
  extending the set with plugin-defined file types.
- Version bumps or commits.
