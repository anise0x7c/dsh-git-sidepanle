# Publish the license and third-party notices

## Why

The plugin ports Code OSS's graph layout and renderer and keeps a literal
transcription of it as a test oracle, but that provenance lived in two comment
lines inside the derived files. A consumer installing the prepared directory
could not see which third-party material the plugin contains, which licenses
apply to it, or which dependencies are instead provided by the host or only
used at build time.

The plugin's own MIT license already existed in `LICENSE`; this change adds the
matching global third-party notice and ships both documents with the plugin.

## What Changes

- A root `THIRD-PARTY-NOTICES.md` names every third-party component:
  - **Code OSS (microsoft/vscode), MIT**: the commit-graph port in
    `src/client/git/graph.ts` and the test-only transcription in
    `test/support/code-oss-scm-history.ts`, with the full MIT text and
    Microsoft's copyright line, plus the documented adaptations.
  - **Codicons (microsoft/vscode-codicons), CC-BY-4.0 icons and MIT scripts**:
    no font or asset is distributed; the inline SVG icons are redrawn after the
    designs, with the attribution and the changes stated.
  - **Not distributed**: React and the DSH UI primitives as host runtime
    externals, and the development dependencies used to build and check.
- The two derived source files keep Microsoft's copyright line and point at the
  notice.
- The README links the notice next to the license, and the package file set
  includes `LICENSE` and `THIRD-PARTY-NOTICES.md`.
- `AGENTS.md` gains the rule that derived files keep their copyright line and
  that newly distributed material updates the notice in the same change.

## Non-goals

- No runtime behavior or Git operation changes; the rebuilt artifacts only
  carry the updated source comments.
- No version bump and no change to the plugin's own MIT license terms.
- No audit of the host application's dependencies or of packages the plugin
  never distributes.
