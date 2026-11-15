# dsh-git-graph

A VS Code-style Git source-control sidebar for the DeepSeek Harness Web GUI.
It adds a **Source control** tab to the right Sidebar: staged/unstaged/merge
changes as a folder tree, a commit box, unified diff tabs, a commit graph
whose commits open a details view of the files they changed, branch switching,
and right-click menus for every row.

- Host half (`index.js` + `src/host/**`): a guarded local JSON-RPC route that
  runs Git in the Session's working directory.
- Browser half (`src/client/**`): the right-Sidebar tab types, guide entry,
  shortcut, and the React panel — bundled into the single client artifact
  `client.js` by `scripts/build-client.mjs`.
- `test/`: Host route tests over a real loopback server, pure-function unit
  tests, registration tests for the browser half, and rendered-panel behavior
  tests over a tiny React runtime.

```bash
npm install      # once: esbuild, the only dev dependency
npm test         # builds client.js, then runs all 178 tests
```

`client.js` and `client.js.map` are generated and committed; edit `src/` and run
`npm run build` (or `npm run dev` to watch) rather than touching the artifact.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module layout and build
contract, and [docs/DETAIL.md](docs/DETAIL.md) for usage and limitations
([中文说明](docs/DETAIL.zh.md) included).

Open it from the right Sidebar's guide, or with `Ctrl+Shift+G` (`Cmd+Shift+G`
on macOS). Install the package directory through **Plugins → Add plugin** in
DSH, or `install_bundle` with this directory.
