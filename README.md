# dsh-git-graph

A VS Code-style Git source-control sidebar for the DeepSeek Harness Web GUI.
It adds a **Source control** tab to the right Sidebar: staged/unstaged/merge
changes as flat, path-sorted lists, a commit box, unified diff tabs, a commit graph
whose commits expand inline to list the files they changed (with a details view
one menu item away), branch switching, local/remote branch checkout, fetch,
pull, push, sync, publish, remote configuration, and right-click menus for every
row.

- Host source: `src/host-entry.ts` + `src/host/**`, a guarded local Git RPC route.
- Browser source: `src/client-entry.ts` + `src/client/**`, the React panel and
  right-Sidebar registrations. React is supplied by DSH, never bundled.
- Shared wire types: `src/shared/git.ts`, erased from runtime output.
- Tests: checked TypeScript on Node's built-in test runner, with real Git and
  loopback fixtures, pure unit tests, loader tests and a tiny React renderer.
- Zero runtime dependencies. TypeScript, tsx, esbuild and Biome are development-only.

## Development

For development, use Node ≥ 22.13 and the pnpm version pinned in
`packageManager` (12.21.0). The generated plugin's runtime requirement remains
Node ≥ 22; the newer development minimum comes from pnpm itself. If the machine
has no pnpm yet, install the pinned version once with `npm i -g pnpm@12.21.0`;
the `packageManager` pin keeps every later command on 12.21.0.

```bash
pnpm install --frozen-lockfile  # install exactly the committed dependency graph
pnpm build                     # generate both Host and browser artifacts
pnpm test                      # build, then run every regression test
pnpm check                     # read-only quality gate: types, Biome, tests, freshness
pnpm lint:fix                  # apply safe Biome lint/import/format fixes
pnpm format                    # formatting only
pnpm dev                       # watch both halves; Host changes still need restart
pnpm verify:contract           # extra integration gate against a real DSH installation
```

On Linux under DSH's `workspace-write` sandbox the install is rejected with
`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`: pnpm 12 keeps its store lock in
`$XDG_RUNTIME_DIR`, outside the workspace. Run it as

```bash
mkdir -p .cache/runtime
XDG_RUNTIME_DIR="$PWD/.cache/runtime" pnpm install --frozen-lockfile
```

instead; pnpm then keeps its store under `node_modules/`. This workaround is
Linux-only — a normal terminal, or macOS/Windows, needs the plain command.

`pnpm check` deliberately does **not** build first: stale committed artifacts
must fail rather than silently repair themselves. CI runs the same gate on Node
22 and 24 after a frozen installation. `pnpm verify:contract` is separate because
CI does not ship DSH; override its installation with `--dsh-root <directory>` or
`DSH_ROOT`. The same gate checks unused declarations and the runtime import graph:
Host/browser isolation, shared type-only contracts, pure-module boundaries,
cycles and unreachable executable production modules. Architecture tests include
intentional violations so these rules cannot silently become no-ops.

`index.js`, `index.js.map`, `client.js` and `client.js.map` are generated and
committed. Never hand-edit them. Installing a prepared directory needs no build,
TypeScript loader or development dependencies. Development dependencies do not
run install scripts; platform binary packages provide esbuild and Biome directly.

See [Architecture](<docs/ARCHITECTURE.md>) for module boundaries and loader
contracts, [Refactor record](<docs/REFACTOR-PLAN.md>) for migration decisions,
[Maintenance audit](<docs/MAINTENANCE-AUDIT.md>) for findings and remaining trust boundaries,
[Usage](<docs/DETAIL.md>) / [中文说明](<docs/DETAIL.zh.md>) for features and limitations,
and [Changelog](<CHANGELOG.md>) for released changes.

## Install and open

Clone this repository, then install that directory through **Plugins → Add
plugin** in DSH, or `install_bundle` with the directory. The bundle needs DSH
`>=0.2.2-rc.1 <0.3.0-0`; installing a prepared checkout uses the committed
artifacts, so no build step is required. Open it from the right Sidebar's guide,
or with `Ctrl+Shift+G` (`Cmd+Shift+G` on macOS) in the desktop app and the
Windows/macOS Web interface; Linux Web browsers have no default shortcut, so
assign one in DSH's keyboard settings.

After changing sources, rebuild the artifacts. Host changes take effect only
after a Host restart; browser update behavior depends on the running DSH Web
development/reload setup. If the open page does not update, refresh it and verify
the served artifact rather than starting another server.

## License

MIT — see [LICENSE](<LICENSE>).
