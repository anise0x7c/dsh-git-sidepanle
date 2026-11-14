# dsh-git-graph

A VS Code-style Git source-control sidebar for the DeepSeek Harness Web GUI.
It adds a **Source control** tab to the right Sidebar: staged/unstaged/merge
changes as a folder tree, a commit box, unified diff tabs, a commit graph, and
branch switching.

- Host half (`index.js`): a guarded local JSON-RPC route that runs Git in the
  Session's working directory.
- Browser half (`client.js`): the right-Sidebar tab types, guide entry,
  shortcut, and the React panel.
- `test/`: Host route tests over a real loopback server, registration tests
  for the browser half, and rendered-panel behavior tests over a tiny React
  runtime (`npm test`).

Open it from the right Sidebar's guide, or with `Ctrl+Shift+G` (`Cmd+Shift+G`
on macOS). See [docs/DETAIL.md](docs/DETAIL.md) for usage and limitations,
[中文说明](docs/DETAIL.zh.md) included. Install the package directory through
**Plugins → Add plugin** in DSH, or `install_bundle` with this directory.
