# Tasks

- [x] Add the per-group view and folder-collapse rules, plus the panel hook
      that owns them.
- [x] Add the Workspace header's view menu component: an ellipsis trigger and a
      two-item radio dropdown with its own dismissal, focus return and stacking
      rule.
- [x] Render every change group as the selected flat list or folder tree,
      reusing the commit-details tree builder and row renderers.
- [x] Add the English and Chinese labels for the two views.
- [x] Cover the folder-state rules with unit tests.
- [x] Cover the header menu, its dismissal, its busy-panel behavior, per-group
      folder isolation, view persistence and the absence of Git work with
      rendered-UI tests.
- [x] Update both user guides, the architecture guide and the changelog.
- [x] Run the build, the portable gate and the real installed-DSH contract
      check; the live-page check stayed blocked by the Host pairing auth.
