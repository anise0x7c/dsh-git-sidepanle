# Tasks

- [x] Write the spec delta (requirements and scenarios)
- [x] Scaffold the bundle: manifest, loader patch, locales, icon, detail document
- [x] Implement the Host half: repository discovery, Git operations, guarded RPC route in the Session working directory
- [x] Register the `git` and `git-diff` right-Sidebar tab types, the guide entry, and the toggle shortcut
- [x] Implement the source-control panel: header, branches, commit box, change sections, file tree, actions
- [x] Implement the unified diff tab with navigation parameters
- [x] Implement the commit graph and branch switching
- [x] Add theme-token styling for light and dark, plus English and Chinese copy
- [x] Install the bundle into the desktop profile and verify the Host routes against a real repository
- [x] Verify slot registration and the rendered panel; review the user experience
  - Host route tests, browser-half registration tests, and rendered-panel behavior tests pass (19 tests).
  - Live slot inspection shows both tab bodies and both tab titles registered in the running page; the Host route answered a real Session over loopback and refused an untrusted request.
  - Pixel-level appearance and pointer interaction in the real page still need the owner's eyes; this session has no browser control.
- [x] Run litespec validate and archive the change
