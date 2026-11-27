# Tasks: commit-split-disabled

- [x] Write the spec delta (requirements and scenarios).
- [x] Disable the expand control on the same condition as the commit button.
- [x] Give the split wrapper one uniform disabled appearance, including the divider, and keep the menu closed while the commit action is unavailable.
- [x] Update UI tests: empty message disables both halves and opens no menu; a typed message enables both; a running commit disables both; the existing menu, amend, combined-action and upstream tests type a message first.
- [x] Update `docs/DETAIL.md`, `docs/DETAIL.zh.md` and `docs/ARCHITECTURE.md`.
- [x] `pnpm check` (types, Biome, 551 tests, artifact freshness).
- [x] `litespec_validate`, then `litespec_archive`.
