# Design: borrowing the host's file-type icons

Technical choices behind the behavior in `proposal.md`. Verified against the
installed DeepSeek Harness `0.2.2-rc.3` (`/opt/DeepSeek Harness/resources/app/dsh`).

## What the host offers

- The Web shell seeds one frozen module table for every client bundle. In the
  installed `@deepseek-ai/dsh-web-frontend` shell bundle the seed is
  `{ react, react/jsx-runtime, react-dom, react-dom/client, @deepseek-ai/cordis,
  zod, @tanstack/react-virtual, @deepseek-ai/dsh-client-store,
  @deepseek-ai/dsh-client-ui-slots, @deepseek-ai/dsh-client-ui-primitives,
  @deepseek-ai/dsh-client-ui-dockkit }`, passed to
  `window.__ModuleLoader__.create` as `staticModules`.
- `@deepseek-ai/dsh-client-modules` (`src/client/system.ts`, `makeRequire`)
  resolves a bundle's `require(spec)` from that seed first, then from materialized
  package factories, and only then throws. A baseline seed entry therefore needs
  no `dsh.client.external` declaration and no `inject` edge; those exist for
  non-baseline package rows.
- The same shell bundle exports the primitives' `FileTypeIcon`: it takes
  `{ kind }` or `{ path }` plus `size` and `className`, classifies the path with
  its own `classifyFileType`, and draws either one of 48 full-color language
  glyphs (20×20 artwork) or one of the paper glyphs for documents, images, media,
  folders and the generic fallback, colored through the host's `--dsw-static-*`
  tokens and the shell's own stylesheet. Those classes are loaded page-wide, so
  the panel needs no additional CSS for the artwork.
- The seed's React is the same object this bundle receives from
  `require('react')`, so the borrowed component shares the host's React instance;
  no duplicate React is involved.

## Decision: resolve through the module table, with a local fallback

The icon is decoration, so the worst acceptable outcome is "the old plain
document icon", never "the panel is blank". One module,
`src/client/host-file-icon.ts`, owns the coupling:

- It calls `require('@deepseek-ai/dsh-client-ui-primitives')` inside a
  `try`/`catch`, accepts the export only when `FileTypeIcon` is a function, and
  otherwise renders the plugin's existing `FileIcon` from `src/client/icons.ts`.
- Rendering the borrowed component is a plain `h(Borrowed, { path, size })`, so a
  later prop change degrades one glyph instead of throwing during resolution.
- Because the module resolves lazily inside the bundle factory, the artifact
  keeps working in unit or host environments where that specifier resolves to
  nothing.

This deliberately deviates from DSH's plugin guide, which says plugins should not
`require` Harness Client packages: they change without notice, and a throwing
component blanks the slot entry. The fallback removes that failure mode; the
remaining cost is visual drift when the host redesigns the set, which the plugin
can absorb with one module change. The same coupling is already shipped by
third-party plugins: `dsh-better-sidebar` 0.30.1 imports
`{ FileTypeIcon }` and pins the package as
`peerDependencies: "@deepseek-ai/dsh-client-ui-primitives": "^0.2.2-rc.1"`.

## Build, gates and contracts

- `scripts/build.ts`: add the specifier to the client target's `external` list
  next to `react`, and let `validateResult` accept exactly those two runtime
  dependencies in `client.js`; any other runtime import stays a build failure.
  The bundle is still compiler-free and carries no code from the module.
- `test/support/architecture.ts`: keep the client half's external-import ban,
  but allow this specifier only from `src/client/host-file-icon.ts`. An invalid
  fixture asserts that any other module still violates the rule, so the
  exception cannot spread.
- Tests: the existing bundle require stubs may keep throwing for unknown
  specifiers, which now exercises the fallback; a dedicated UI test supplies a
  stub `FileTypeIcon` that records `{ path, size }` and asserts the row passes
  the changed file's repository-relative path at 16 pixels, and another stub
  that exports no component (or a non-function) asserts the plain icon. Both
  outcomes run through the bundle's factory `require`, which is the same
  resolution the page performs, so no separate unit module is needed.
- The plugin keeps zero runtime dependencies and no new devDependency: the
  source never imports the module statically, so no package types are needed.
  The version contract is the existing `engines.dsh` range
  (`>=0.2.2-rc.1 <0.3.0-0`), whose releases seed the module.
- Documentation: `AGENTS.md` contract 1 records the borrowed entry as the one
  second allowed runtime request and contract 3 records the single module
  allowed to reach it; `docs/ARCHITECTURE.md` records the new client module and
  its single allowed external import; `docs/DETAIL.md` and `docs/DETAIL.zh.md`
  describe the visible behavior, and `CHANGELOG.md` gets an Unreleased bullet.

## Risks and open verification

- If a future release renames the seed entry or changes `FileTypeIcon`'s props,
  the icons degrade to the plain document; the panel and the file list stay
  usable. Nothing detects that at build time.
- Real-page rendering (light/dark, 22-pixel rows, 16-pixel glyph) is verified by
  the user's click-through; this environment has no browser control.
