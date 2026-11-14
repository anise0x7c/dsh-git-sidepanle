# dsh-git-graph

A VS Code-style Git source-control sidebar for the DeepSeek Harness Web GUI.
It adds a **Source control** tab to the right Sidebar: staged/unstaged/merge
changes as a folder tree, a commit box, unified diff tabs, a commit graph, and
branch switching.

- Host half (`index.js`): guarded local JSON-RPC route that runs Git in the
  Session's working directory.
- Browser half (`client.js`): right-Sidebar tab types, guide entry, shortcut,
  and the React panel.

See [docs/DETAIL.md](docs/DETAIL.md) for usage and limitations. Install the
package directory through **Plugins → Add plugin** in DSH.
