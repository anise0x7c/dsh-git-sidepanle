# Tasks

- [x] Write the spec delta (requirements and scenarios)
- [x] Host: page the history read by offset, report whether earlier commits
      remain, and reject an invalid offset; add an end-to-end paging test over a
      real repository with more than one page of commits
- [x] Browser state: append pages in the history hook, keep the loaded rows on a
      failed page, and reset to the first page on refresh
- [x] Browser pure layer: a DOM-free near-end predicate for the graph pane, with
      unit tests
- [x] Browser view: trigger the next page at the end of the graph pane, add the
      load-earlier control, the loading note and the failure-with-retry note, in
      both locale dictionaries
- [x] Styles: the paging footer keeps the host's visual language
- [x] Tests: rendered-panel checks for end-of-pane loading, the manual control,
      end of history, the offset each request carries, a failed page's retry and
      a refresh back to the first page
- [x] Docs and changelog: DETAIL (English and Chinese), ARCHITECTURE, CHANGELOG
      and the requirement count in AGENTS.md
- [x] Build, run `pnpm check` (272 tests, artifact freshness) and
      `pnpm verify:contract`, and confirm the served `client.js` carries the new
      copy (the rev-tagged combo URL from `/plugins/events`)
- [x] Verify real paging against a multi-branch repository: pages concatenate to
      exactly the one-shot `git log --topo-order` output, with no gaps or
      duplicates
- [x] Run litespec validate and archive the change
