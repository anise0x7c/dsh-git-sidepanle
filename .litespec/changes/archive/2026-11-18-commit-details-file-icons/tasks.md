# Tasks

- [x] Write the spec delta (requirements and scenarios)
- [x] Add an explicit row option to the shared file-row renderer, and render the
      host file-type icon for the row's path when it is set
- [x] Turn the option on in the commit-details view only; the merge, staged and
      changes lists keep their current rows
- [x] Style the icon slot between the status letter and the name without letting
      it squeeze or reflow the path text
- [x] UI tests: the details rows draw the host glyph for each path, the fallback
      keeps the plain icon, and the change lists still draw none
- [x] Docs: `docs/DETAIL.md` and `docs/DETAIL.zh.md`, `CHANGELOG.md` Unreleased,
      and the commit-details wording in the spec
- [x] Run the gates: `pnpm build`, `pnpm check`, `pnpm verify:contract`,
      `litespec_validate`, then archive the change
- [x] Ask the user for the light- and dark-theme click-through on the details
      view
