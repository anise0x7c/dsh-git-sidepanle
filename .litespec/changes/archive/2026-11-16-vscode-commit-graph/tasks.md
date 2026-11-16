# Tasks

- [x] Write the proposal, design notes and spec delta for the VS Code graph
- [x] Host: list history in topological order with full decorations and report the current, upstream and base references; parser and end-to-end tests
- [x] Browser pure layer: port VS Code's swimlane view models, SVG geometry, node shapes, colors and badge grouping; parse full reference names; unit tests, including an equivalence test against a literal transcription of VS Code's algorithm on 200 random histories
- [x] Browser view: render rows with masked node gaps, VS Code badges and icons, palette variables and 22-pixel rows; wire the references through the history hook
- [x] Rendered-panel tests for rows, badges, nodes and tooltips
- [x] Update DETAIL (English and Chinese), ARCHITECTURE, CHANGELOG and the AGENTS theme contract
- [x] Build, run the check gate (types, Biome, 253 tests, artifact freshness) and `verify:contract`, and compare a rendered graph of the WhiteSur repository with the VS Code screenshot (same commit order, lanes, curves, nodes, colors and badges; the served `client.js` matches the build)
- [x] Run litespec validate and archive the change
