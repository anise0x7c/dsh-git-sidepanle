# Design: remote management and remote-branch checkout

This change builds on `add-remote-sync`. It records the technical choices;
behavior stays in the delta spec.

## Wire contract (`src/shared/git.ts`)

Add:

```ts
/** One remote-tracking branch. */
export interface RemoteBranchInfo {
  /** Display name, `<remote>/<branch>`. */
  name: string
  /** Configured remote name. */
  remote: string
  /** Branch name within that remote, without the remote prefix. */
  branch: string
}

export interface BranchesResult {
  /** Local branches in Git's ref order. */
  branches: BranchInfo[]
  /** Remote-tracking branches, excluding symbolic remote HEAD pointers. */
  remoteBranches: RemoteBranchInfo[]
}
```

New operations:

| Operation | Payload | Value |
| --- | --- | --- |
| `add-remote` | `{ name: string; url: string }` | `OkResult` |
| `remove-remote` | `{ name: string }` | `OkResult` |
| `checkout-remote` | `{ remote: string; branch: string }` | `CheckoutResult` |

Add them to `GitGraphRpcValues` and `GitGraphPayloads`, and re-export
`RemoteBranchInfo` from `src/client/types/domain.ts`. Update the fixtures:
`createBranches` gains an optional remote-branch argument and returns
`remoteBranches`, and every fixture branch result includes the field.

## Host

### Remotes (`src/host/git/remotes.ts`)

- `addRemote(root, name, url)` runs `git remote add -- <name> <url>`. An
  existing name maps to `remote-exists` (409); Git's other errors map to
  `git-command-failed` (409).
- `removeRemote(root, name)` reads the configured remotes, maps a missing name
  to `unknown-remote` (404), then runs `git remote remove -- <name>`.
- Validation helpers in `src/host/validation.ts`:
  - `remoteUrlOf(value)`: string, 1..4096 characters, not starting with `-`,
    no NUL/control characters or newlines. Do not restrict the scheme.
  - `remoteNameOf` already exists from `add-remote-sync`.

### Branches (`src/host/git/branches.ts`)

- `parseRemoteBranches(stdout, remotes)` is pure. Input is
  `git for-each-ref --format=%(refname)%09%(symref) refs/remotes`; output is
  `RemoteBranchInfo[]`. Skip records with a non-empty symref (remote `HEAD`)
  and a branch part of `HEAD`. Match the longest configured remote prefix so a
  remote name containing `/` stays unambiguous.
- `readRemoteBranches(root, remotes)` reads that command.
- The `branches` operation runs `readBranches`, `readRemotes`, and
  `readRemoteBranches` (the last after the remote names are known) and returns
  both lists.

### Checkout (`src/host/git/mutations.ts`)

`checkoutRemoteBranch(root, remote, branch)`:

1. Reject a missing `refs/remotes/<remote>/<branch>` with
   `unknown-remote-branch` (404).
2. When `refs/heads/<branch>` exists, run the existing `checkoutBranch` and do
   not change its upstream.
3. Otherwise run `git switch -c <branch> --track <remote>/<branch>`.
4. Return the checked-out local branch name.

`src/host/validation.ts` adds `remoteBranchNameOf(root, remote, value)`:
string, non-empty, not starting with `-`, no control characters, and accepted
by `git check-ref-format refs/remotes/<remote>/<value>`. The dispatcher rejects
an unknown remote with `unknown-remote` (404) before validating the branch.

## Client

- `panel/hooks/useRemoteActions.ts` gains the `add` and `remove` dialog kinds,
  a remote-name and URL field state, and `addRemote`/`removeRemote` handlers.
  They use `perform` with `graph: true`, a localized success notice, reload the
  remotes list on success, and keep the form open with its values on failure.
- `panel/views/RemoteMenu.ts` gains a Remote disclosure below a separator with
  Add Remote and Remove Remote. Add is available while remotes are loading;
  Remove is disabled until the list is non-empty. Keep the existing Fetch,
  Pull, Pull (Rebase), Push/Publish, Sync items and busy rules.
- `panel/views/RemoteDialog.ts` gains the add form (name and URL fields, URL
  prefilled with a sensible placeholder) and the remove form (remote select,
  destructive description, Cancel focused). Use the existing dialog field,
  hint, progress and feedback presentation.
- `panel/hooks/useBranches.ts` stores `remoteBranches` from the `branches`
  answer and adds `checkoutRemote(remote, branch)`, which closes the picker and
  runs `perform('checkout', () => call('checkout-remote', { remote, branch }), {
  graph: true, after: resetBranches })`.
- `panel/BranchMenu.ts` renders local branches first, then a heading and the
  remote branches (using `CloudIcon` before each), each calling
  `onPickRemote(remote, branch)`. Keep the loading, failure/retry and empty
  notes; an empty local group does not hide the remote group.
- `panel/views/BranchHeader.ts` passes the remote group and handler through to
  the picker.
- Locale: add both dictionaries for the Remote group, Add/Remove dialogs,
  field labels, progress, success/failure and the remote-branch heading.

## Tests

- `test/unit/host-remotes.test.ts`: `parseRemoteBranches` with nested remote
  names, symbolic HEAD, malformed records and ordering.
- `test/host.test.ts`: `add-remote` (valid, duplicate, invalid name/URL),
  `remove-remote` (valid, unknown, confirmation is client behavior), `branches`
  remote listing excluding `origin/HEAD`, `checkout-remote` creating a tracking
  branch, switching an existing local branch without changing its upstream, and
  unknown remote/branch failures. Use real local bare remotes and the HTTP RPC
  helper.
- `test/ui.test.ts`: opening the Remote group, adding a remote (form values,
  RPC payload, success close and notice), invalid/failed add keeps the form,
  removing a remote after confirmation, branch picker remote group, and
  checkout-remote payload/refresh. Extend fixtures for remote branches.
- `test/types/rpc.type-test.ts`: valid `add-remote`, `remove-remote`,
  `checkout-remote` calls and negative shape assertions.

## Acceptance

`pnpm typecheck`, `pnpm lint`, the focused tests, then `pnpm build` and
`pnpm check` after integration. Never hand-edit generated artifacts.
