# Tasks

- [x] Write the spec delta (requirements and scenarios)
- [x] Add `src/client/host-file-icon.ts`: resolve `FileTypeIcon` from the host
      module table inside a `try`/`catch`, accept only a function export, render
      the borrowed component with the file's path and size, otherwise render the
      plugin's `FileIcon`
- [x] Render that component in the expanded commit file rows, passing the
      changed file's repository-relative path at 16 pixels
- [x] Mark the specifier external in the client esbuild target and allow exactly
      it (beside `react`) in the artifact validation; rebuild `client.js`
- [x] Allow the specifier only from the new module in the architecture gate, and
      add an invalid fixture proving any other module still violates the rule
- [x] UI tests: the borrowed component receives the row's path and 16 pixels; a
      throwing or component-less module falls back to the plain icon; existing
      row, layout and graph assertions stay green
- [x] Docs: `AGENTS.md` contracts 1 and 3, `docs/ARCHITECTURE.md` client modules,
      `docs/DETAIL.md` and `docs/DETAIL.zh.md`, `CHANGELOG.md` Unreleased
- [x] Run the gates: `pnpm build`, `pnpm check`, `pnpm verify:contract`,
      `litespec_validate`
- [x] Ask the user for the light- and dark-theme click-through once the served
      artifact carries the change
