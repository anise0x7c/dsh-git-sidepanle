# Tasks

- [x] Write the spec delta (requirements and scenarios)
- [x] Collect every row's lines into one layer with one path per color, offset
      into the graph's coordinates, and keep a one-pixel overlap per lane for
      color changes at a row edge (`src/client/git/graph.ts`)
- [x] Draw the layer above the rows, keep the node in the row's cell, and drive
      the hovered row's node gap from the section
      (`src/client/panel/views/GraphSection.ts`, `src/client/styles.css`)
- [x] Unit test the layer's per-color paths, offsets and node gaps
- [x] UI test the single layer, the node-only cells and the hovered node gap
- [x] Update `docs/DETAIL.md`, `docs/DETAIL.zh.md`, `docs/ARCHITECTURE.md`,
      `CHANGELOG.md` and the version
- [x] Rebuild the artifacts, run the suite and `litespec validate`
