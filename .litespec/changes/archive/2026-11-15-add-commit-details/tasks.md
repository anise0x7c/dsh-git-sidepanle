# Tasks

- [x] Write the spec delta (requirements and scenarios)
- [x] Host: read one commit's metadata and changed files by full identifier, with a bounded file list
- [x] Host: serve a file diff scoped to a commit (first parent, or the empty tree for a root commit)
- [x] Browser: make graph rows activatable and add the commit-details state hook
- [x] Browser: render the commit-details view and its file tree, with loading, empty and failure states
- [x] Browser: open commit-scoped diffs from the details view and label them in the diff tab
- [x] Browser: copy-only context menus for files and folders inside the details view
- [x] Locale: add English and Chinese copy for every new string
- [x] Tests: Host end-to-end commit details and commit diffs (normal, root, rename, merge), pure parser units
- [x] Tests: pure menu actions for past-commit files, rendered-panel click-through, diff-tab commit scope
- [x] Rebuild `client.js`, run the full suite and `npm run check:build`
- [x] Update README, detail documents (EN + zh), architecture, changelog and version
- [x] Run `litespec_validate` and archive the change
