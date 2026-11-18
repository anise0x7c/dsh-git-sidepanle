# Tasks

- [x] Write the spec delta (requirements and scenarios)
- [x] Remove the per-list icon option and render the host file-type icon for
      every flat file row, so the change lists, details view and graph agree
- [x] Drop the now-unused option from the details view call site
- [x] UI tests: the merge, staged and changes rows draw the host glyph for their
      paths, the fallback keeps the plain icon in those lists, and the details
      rows stay covered
- [x] Docs: `docs/DETAIL.md` and `docs/DETAIL.zh.md`, `CHANGELOG.md` Unreleased
- [x] Run the gates: `pnpm build`, `pnpm check`, `pnpm verify:contract`,
      `litespec_validate`, then archive the change
- [x] Ask the user for the light- and dark-theme click-through on the change
      lists
