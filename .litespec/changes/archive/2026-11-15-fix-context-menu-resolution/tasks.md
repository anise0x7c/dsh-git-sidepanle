# Tasks

- [x] Write the spec delta (requirements and scenarios)
- [x] Record the host registration contract beside the menu contribution: a
      contribution resolves actions from the captured target's value, not from
      the `{ kind, value }` wrapper
- [x] Resolve menu commands from that captured value in the browser bundle
- [x] Make the unit-test stand-in call the contribution the way the host registry
      does, and assert a row target yields a non-empty command list
- [x] Make the UI-test stand-in unwrap trigger-bound targets the same way, and
      add a regression test covering file, folder, group header, and commit rows
- [x] Prove the regression tests fail against the previous bundle and pass after
      the fix (13 failing before, 35 passing after)
- [x] Verify the fix in the running installation: the served bundle carries the
      fixed registration, the Host pushed a rebuild event to open pages, and the
      plugin's own bundle resolves its commands through the host's installed
      context-menu registry (5 commands for a changed file, 2 for a commit)
- [x] Run `npm test` and `litespec_validate`
