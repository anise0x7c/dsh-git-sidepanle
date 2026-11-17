# Tasks

- [x] Design the change signal: one watch registry per repository, debounce
      and burst coalescing, change classification (worktree/index versus
      HEAD/refs), and how an open panel consumes it without a full status read
      (push over the existing route family or a cheap revision poll)
- [x] Host: watch the working tree and `.git` metadata with Node filesystem
      watching, start on first use, share across panels, and release on last
      panel close, Session repository change and plugin unload; fall back
      silently when watching is unavailable
- [x] Host: classify a change as worktree/index or HEAD/refs and provide a
      references-only read so loaded graph rows can re-color without refetching
      commits
- [x] Browser: subscribe to the change signal, apply the scoped refresh, keep
      graph pages, scroll position and selection for worktree/index changes,
      and reload the newest page only when the checked-out commit is outside
      the loaded rows
- [x] Tests: unit tests for debounce/coalescing, classification, reference-only
      reads and watcher lifecycle; Host tests with real fixture repositories
      for external edit, `git add`, commit, switch, detached checkout, fetch and
      fallback; rendered-panel tests for in-place re-coloring, preserved graph
      state and the fallback path
- [x] Docs: update DETAIL (English and Chinese), ARCHITECTURE and CHANGELOG;
      bump the minor version
- [x] Run `pnpm check` and `pnpm verify:contract`, then validate and archive
      the change
