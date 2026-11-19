# Design: remote synchronization and publish

This file records the technical choices for the change. Behavior stays in the
delta spec.

## Wire contract (`src/shared/git.ts`)

```ts
/** One configured remote. */
export interface RemoteInfo {
  /** Configured name such as `origin`. */
  name: string
  /** Fetch URL. */
  fetchUrl: string
  /** Push URL, which may differ from the fetch URL. */
  pushUrl: string
}

/** Value of the `remotes` operation. */
export interface RemotesResult {
  /** Remotes in Git's configured order. */
  remotes: RemoteInfo[]
}
```

New operations, all values `OkResult` except `remotes`:

| Operation | Payload | Value |
| --- | --- | --- |
| `remotes` | none | `RemotesResult` |
| `fetch` | none | `OkResult` |
| `pull` | `{ rebase?: boolean }` | `OkResult` |
| `push` | none | `OkResult` |
| `publish` | `{ remote?: string }` | `OkResult` |
| `sync` | none | `OkResult` |

Add these keys to `GitGraphRpcValues` and `GitGraphPayloads`. Add `RemoteInfo`
and `RemotesResult` to the type re-exports in `src/client/types/domain.ts`.
Update `test/types/rpc.type-test.ts`: `call('push')` is now valid, and an
actually unknown operation remains the negative case.

## Host module (`src/host/git/remotes.ts`)

- `parseRemoteVerbose(stdout)` is pure and parses `git remote -v` lines of the
  form `<name>\t<url> (fetch|push)`, first occurrence wins, missing push URL
  falls back to the fetch URL, and empty records are skipped.
- `readRemotes(root)` runs `git remote -v`.
- `currentBranch(root)` returns `git symbolic-ref --quiet --short HEAD` trimmed,
  or null when detached.
- `headExists(root)` uses `git rev-parse --verify --quiet HEAD`.
- `upstreamOf(root)` uses
  `git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}'`.
- `fetchAll(root)` runs `git fetch --all --prune`.
- `pullBranch(root, rebase)` requires an upstream and runs
  `git pull --no-rebase --no-edit` or `git pull --rebase --no-edit`.
- `pushBranch(root)` requires an upstream and runs `git push`.
- `publishBranch(root, remote?)` requires a born current branch, chooses the
  given remote, else `origin`, else the first configured remote, rejects an
  unknown remote with `unknown-remote` (404), reports `no-remotes` (409) when
  none exist, and runs `git push --set-upstream <remote> <branch>`.
- `syncBranch(root)` requires an upstream, pulls by merging, then pushes.
- `runRemote` wraps `runGit` with a 120 s timeout and maps an empty-detail
  non-zero result to `remote-timeout` (504). All Git failures otherwise remain
  `git-command-failed` (409) with Git's message.
- Add `GIT_MERGE_AUTOEDIT: 'no'` to the shared Git environment in
  `src/host/git/exec.ts` so a pull merge never opens an editor. Keep the
  existing `GIT_TERMINAL_PROMPT: '0'`.

Stable failure codes: `no-upstream` (409), `no-current-branch` (409),
`unborn-branch` (409), `unknown-remote` (404), `no-remotes` (409),
`remote-timeout` (504), `git-command-failed` (409), `bad-request` (400).

## Validation (`src/host/validation.ts`)

- `remoteNameOf(value)`: string, 1..200 characters, not starting with `-`, no
  whitespace/control characters, no `..`, and not ending in `/`, `.`, or
  `.lock`. Git still validates the final name.
- `optionalRemoteNameOf(value)`: undefined when absent, otherwise
  `remoteNameOf`.

## Dispatch (`src/host/rpc.ts`)

Add imports and cases. `branches` stays unchanged in this change. All operations
run after repository discovery, using `root`. `publish` passes
`optionalRemoteNameOf(payload.remote)`.

## Client

### Hook (`src/client/panel/hooks/useRemoteActions.ts`)

Inputs: `call`, `t`, `refs`, `repo`, `perform`, `notify`, `setActionFailure`.

State: overflow menu open, remotes (null until read), loading, failure, and one
dialog:

```ts
type RemoteDialog =
  | { kind: 'add'; name: string; url: string }
  | { kind: 'remove'; name: string }
  | { kind: 'publish'; name: string }
```

Actions:

- Opening the menu loads remotes when they are still null.
- `fetch`, `pull(rebase)`, `push`, `sync` close the menu and call `perform` with
  `graph: true`, `refreshOnFailure: true`, and a localized success notice.
- `publish` closes the menu/dialog on success; it loads remotes first, reports
  `no-remotes` when empty, publishes immediately when exactly one exists, and
  otherwise opens the publish dialog with `origin` preferred.
- Outside pointer-down and Escape close the menu, like the branch picker.
- The menu and branch picker never stay open together, and the remote dialog is
  mutually exclusive with the existing confirmation and reference dialogs.

`useChangeActions` gains `refreshOnFailure?: boolean` on `PerformOptions`; the
catch path refreshes status silently after recording the failure.

### Views

- `panel/views/RemoteMenu.ts`: overflow menu rendered under the toolbar button.
  Items: Fetch, Pull, Pull (Rebase), Push (or Publish Branch when there is no
  upstream), and Sync. Disable items while busy or without a usable branch;
  show a loading note and a failure note with Retry for the remote list used by
  publish. Reproduce the branch-menu look; the disclosure keeps the menu
  compact and keyboard reachable.
- `panel/views/RemoteDialog.ts`: one `FloatingPanel` for publish (remote
  select). Show progress from the busy name and feedback inside the panel.
- `panel/views/BranchHeader.ts`: add the remote status `IconButton`
  (`CloudIcon`) and the ellipsis (`MoreIcon`) button with `aria-haspopup`,
  `aria-expanded`, and a wrapper ref. Keep refresh and the branch chip.
- `panel/menu.ts`: add `remoteWrap` to `PanelRefs`.
- `panel/GitPanel.ts`: wire the hook, pass the controls, render the dialog in
  the same prompt slot as the existing dialogs, and close the other surfaces at
  the same points the existing prompts do.
- `icons.ts`: add `MoreIcon`; reuse `CloudIcon` for the status control.

### Locale and styles

Add both English and Chinese keys for every menu item, dialog title,
description, field label, progress, success and failure message. Reuse
`.dshgg-menu` for the overflow menu, add only the classes the disclosure and
right alignment need to `branch-menu.css`, and use the existing dialog field
styles. No new stylesheet file is required.

## Tests

- `test/unit/host-remotes.test.ts`: `remote -v` parsing, push URL fallback,
  malformed lines, and remote-name validation.
- `test/host.test.ts`: real local bare remotes for fetch (with prune), pull,
  pull rebase, push, publish with one/multiple remotes, sync pull-then-push,
  and failed-pull-stops-sync. Failure cases: no upstream, detached HEAD, unborn
  branch, unknown publish remote, no remotes, and option-like remote names.
  Exercises through the HTTP RPC helper and asserts error codes/status.
- `test/ui.test.ts`: overflow menu opens and Fetch calls the RPC; Pull/Push/
  Sync labels and availability follow the upstream; publish with no upstream
  opens the remote form, submits the chosen remote and closes on success;
  failure keeps the form; remote list failure shows retry; Escape/outside click
  close the menu; success notices are emitted.
- Extend `test/support/fixtures.ts` with a default remotes response.
- `test/types/rpc.type-test.ts`: the new requests and the remaining negative
  operation.

## Acceptance

`pnpm typecheck`, `pnpm lint`, the focused tests above, then `pnpm build` and
`pnpm check` after integration. Never hand-edit `index.js`, `client.js` or the
maps.
