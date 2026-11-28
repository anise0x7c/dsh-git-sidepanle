# Third-party notices

`dsh-git-sidepanel` is released under the MIT license in
[LICENSE](<LICENSE>). This file records the third-party material the plugin
contains, or is derived from, together with each component's license and
copyright holder. It ships with the plugin so an installed copy always carries
the notices.

## Code OSS (microsoft/vscode)

- Upstream: <https://github.com/microsoft/vscode>
- License: MIT
- Copyright (c) Microsoft Corporation

The commit graph is a port of Code OSS's Source Control Graph. Its layout,
SVG paths, node shapes, badge grouping and the graph-placeholder lanes come
from these upstream files:

- `src/vs/workbench/contrib/scm/browser/scmHistory.ts`
  (`toISCMHistoryItemViewModelArray`, `renderSCMHistoryItemGraph`,
  `renderSCMHistoryGraphPlaceholder`, `compareHistoryItemRefs`,
  `getLabelColorIdentifier`)
- `src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts`
  (`HistoryItemRenderer._renderBadges`, `HistoryItemChangeRenderer`)

The port lives in `src/client/git/graph.ts` and is adapted, not copied: it is a
data-only module with no DOM or editor services, the whole graph's lines are one
layer, node gaps are a mask, an expanded commit widens its own node lane, and
the palette is restyled within the original hue families. The deviations are
listed in the module header and in the change record's design notes.

`test/support/code-oss-scm-history.ts` is a literal, DOM-free transcription of
the same upstream model and renderer. It is used only as an equivalence-test
oracle and is not part of the distributed plugin.

The reference badges, action structure, status letters and merge-base
resolution follow Code OSS's Git and Source Control Graph behavior as
observable behavior, without copying further source files.

```text
MIT License

Copyright (c) Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Codicons (microsoft/vscode-codicons)

- Upstream: <https://github.com/microsoft/vscode-codicons>
- License: CC-BY-4.0 for the icon designs and font, MIT for the build scripts

No codicon font, image or other asset file is distributed with the plugin. The
branch, remote-branch, tag, target, ellipsis and other glyphs in
`src/client/icons.ts` are original inline SVG drawn after the codicon designs,
with sizes and badge layout adapted to the host's row metrics. Attribution:
"Codicons by Microsoft, licensed under CC-BY-4.0 (icons and font) and MIT
(build scripts)." Changes made: the glyphs were redrawn as inline SVG rather
than used as the upstream font or assets.

## Not distributed

- **React** and **`@deepseek-ai/dsh-client-ui-primitives`** are loaded from the
  DSH host at runtime and are declared externals; the browser artifact bundles
  neither.
- **esbuild**, **Biome**, **tsx**, **TypeScript**, **`@types/node`** and
  **`@types/react`** are development dependencies used to build and check the
  plugin; they are not part of the distributed files.
- **DeepSeek Harness** is the host the plugin runs in. Its APIs are consumed
  through documented contracts; no DSH source code is bundled.

## Keeping this file current

When code is ported or copied from another project, keep that project's
copyright line in the derived file, add the component to this file with its
license and holder, and include the license text when the license requires it.
A change that adds a distributed dependency or asset updates this file in the
same change.
