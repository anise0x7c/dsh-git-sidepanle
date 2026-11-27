# Verification

## Automated gates

- `pnpm build`: passed; rebuilt the committed artifacts from TypeScript and CSS.
- `pnpm check`: passed with 376 tests, 0 failures, 0 skipped; types, Biome and the read-only artifact freshness gate also passed.
- `pnpm verify:contract`: passed against the installed DSH context-menu registry, resolving 5 target kinds and 23 commands.
- Regression-first evidence: 11 selected checks over the old browser artifact failed as expected before the new build, including stacked prompts and IME-triggered submission. The rebuilt full suite passed.
- CSS contracts cover panel-local absolute placement, pointer handling, native frosted enhancement, a genuinely solid fallback, scrollable content, wrapping labels and whole-card overflow fallback for an oversized footer.

## Running installation

The existing GUI at `http://127.0.0.1:44725` served the rebuilt plugin at revision `1adb870f1791`. After removing only the Host's terminal semicolon and rewritten source-map comment, served executable code matched the local build with SHA-256 `f1ed70eea450c6b90dda07cdd676fe5ef35a65424afdbcbcd4637e7110ad6e38`. Direct byte hashes differ because the Host applies those two transformations.

Live Client Slot inspection confirmed active Git and diff occupants in `sidebar.right.pane.tab` after rebuilding. No replacement server or profile mutation was used. An active same-checkout `dev:web` watcher was not verified, so automatic HMR is not promised; refresh the existing page to load the build.

## UI/UX review

An independent subagent reviewed the implementation for the main flow, feedback, keyboard safety and visual consistency. Its substantiated short-pane issue was fixed: an unusually tall wrapping action footer can no longer be permanently clipped by the card. A separate regression protects this fallback. Replacement also skips restoring the previous reference form's trigger, preventing it from stealing the new confirmation's focus.

## Remaining manual verification

Browser control and screenshots were unavailable. An unauthenticated HTTP request to the GUI root returned 401; no authentication state was searched for or changed. Automated tree and CSS checks do not measure actual browser layout. In the authenticated page, refresh and check light/dark appearance, long filenames and branch names, narrow/short panes, tag annotations, Escape, pending controls and operation failures. Simple-confirmation trigger-focus restoration remains a non-blocking future refinement; existing reference-operation focus restoration is preserved.
