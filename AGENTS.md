# AGENTS.md

`@local/dsh-git-graph` adds a Code OSS-style Git source-control sidebar to
the DeepSeek Harness (DSH) Web GUI. This file covers the contributor workflow;
use the linked docs for behavior and implementation details.

## Where to look

- **User-visible behavior:** [English guide](docs/DETAIL.md) / [中文说明](docs/DETAIL.zh.md).
  Check the relevant section before changing an interaction or its failure states.
- **Module ownership:** use the [directory map](docs/ARCHITECTURE.md#directory-map)
  to find the owner, then check [dependency direction](docs/ARCHITECTURE.md#dependency-direction)
  before introducing an import or moving logic between modules.
- **Host RPC and file operations:** read [Host execution and trust](docs/DETAIL.md#host-execution-and-trust)
  alongside the [runtime contracts](docs/ARCHITECTURE.md#runtime-contracts).
  For remote operations, also check [Remote data flow](docs/ARCHITECTURE.md#remote-data-flow).
- **Browser integration:** use the [runtime contracts](docs/ARCHITECTURE.md#runtime-contracts)
  for loader exports, Slot props, and host primitives. For the context-menu
  resolver's callback payload, see item 7 under [Data flow](docs/ARCHITECTURE.md#data-flow).

## Development workflow

1. Follow the [README setup](README.md#development) for Node, pinned pnpm, and
   frozen installation. Use its Linux sandbox workaround only when the pnpm
   store lock is blocked. For bundle installation, see [Install and open](README.md#install-and-open).
2. Make changes in the owning source module. Follow the architecture guide's
   [Adding code](docs/ARCHITECTURE.md#adding-code) checklist for new hooks,
   views, pure rules, and RPC operations.
3. Use the [build and quality gates](docs/ARCHITECTURE.md#build-and-quality-gates)
   for the source-to-artifact workflow. If investigating stale output, check it
   before rebuilding so the rebuild does not erase the evidence.
4. For registration or context-menu changes, run the real installed-DSH
   contract check in addition to the portable gate. Report any check you could
   not run as unverified, not as a pass.

- Never hand-edit generated artifacts or rename package entry points such as
  `./client`. Regenerate the bundles and source maps from source.
- Keep runtime dependencies at zero. Before adding a client external, check
  `engines.dsh` in [package.json](package.json) and the module-table limits in
  the runtime contracts. Do not use release-age exclusions to bypass pnpm's
  24-hour window or upgrade to a patch on its release day.
- Keep scratch output under ignored `.temp/`: caches, logs and browser profiles
  under `.temp/cache/`; screenshots and probe HTML under `.temp/preview/`.
  Don't create another root-level scratch directory or hand-edit `node_modules/`
  or tool-managed files. Tests use OS temp directories (`mkdtemp`) unless they
  specifically need a path inside the workspace.

## Verify in the running GUI

- Use the existing Web GUI, not a second server. Verify its Web build/watch setup
  before promising HMR. If a page refresh still shows old behavior, inspect
  `/plugins/events`, locate this bundle in `graph.entries`, and check the served
  artifact using its `url` and `rev` rather than relying on the local build alone.
- Smoke-test the changed interaction and the closest neighboring interaction.
  For example, a context-menu change should cover both pointer and keyboard
  invocation, the action on the selected row, and focus after dismissal.
- If you cannot interact with the live page, report the evidence you do have
  (served artifact, Slot state, or contract test) and give the user a short
  click-through for whatever remains unverified.
- Do not log repository contents or send them outside the local loopback route.

## Code conventions

- Use two-space indentation, single quotes, no semicolons or tabs, and English
  comments. Keep functions small and give exported helpers concise JSDoc.
- Bind visible strings through `ctx.locale.bind('gitGraph')`; keep keys and
  interpolation placeholders in sync across both UI dictionaries.
- Use `--dsw-*` for Host theme tokens. Keep the shared `.dshgg-row` responsible
  for height, padding, hover surface and focus ring; row-specific styles add
  content or graph geometry, not a second row layout. Refer to the runtime
  contracts for the commit graph palette exception.
- Keep menu triggers keyboard-accessible (`tabIndex` and `aria-haspopup="menu"`
  where appropriate). Preserve the Host's dismissal and focus behavior.

## Tests

- Use `node:test` only; do not introduce third-party test or DOM libraries.
  Keep pure unit tests runnable without a build, DOM, or Git process. Use real
  Git fixtures for Host behavior; clean them up with module-level `after()` hooks.
- Extend [mini-react](test/support/mini-react.ts) for UI coverage rather than
  reaching into component internals. Loader and UI integration tests should
  exercise the built bundle, not just its source entry points.
- Have doubles mirror the real Host's payloads and call ordering; use the
  existing [fake context](test/support/fake-ctx.ts) as a starting point.
  Prefer a failing regression test first. Do not weaken behavioral assertions
  or replace the architecture gate's intentional violations with passing cases.

## Docs and releases

- Update the English and Chinese guides together when behavior changes. Describe
  what users see and do there; put changes to module boundaries and runtime
  contracts in the architecture guide.
- Record notable changes in [CHANGELOG.md](CHANGELOG.md). Do not commit, push,
  or bump versions unless explicitly asked. When requested, use Conventional
  Commits with an imperative subject, and use SemVer for version bumps. Update
  the changelog in the same change as the version bump.
- Keep [LICENSE](LICENSE) and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)
  current. A file derived from another project keeps that project's copyright
  line and is named there with its license and holder; a newly distributed
  dependency or asset updates the notice in the same change.
