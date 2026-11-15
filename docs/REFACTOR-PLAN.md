# 重构方案：把 Git 面板从单文件拆成可维护模块

- 编写日期：2026-11-15
- 基线提交：`7cac4e6`（工作区干净）
- 基线规模：`client.js` 1,969 行、`index.js` 769 行、测试 1,538 行，35 个用例全绿
- 目标：在不改变任何可观察行为、Host RPC 契约与 UI 表现的前提下，把单文件拆成边界清晰、可独立单测的模块，并建立"源码 → 产物"的构建契约

---

## 1. 结论与目标

问题不是"行数多"，而是 `client.js` 一个文件同时承担六类职责，且最热的 `GitPanel` 组件 673 行里塞了 17 个 `useState`、6 个 `useEffect`、5 个 `useCallback`、7 个 `useMemo`。真正的解法分两条腿：

1. **Host 半（`index.js`）直接拆文件**：它是普通 Node ESM，拆了就能 `import`，零工具链、零风险。
2. **浏览器半（`client.js`）加一个最小构建步骤**：DSH 的浏览器加载器要求"一个包一份客户端 artifact"，因此源码必须经打包器合成一份 `client.js`；这是官方文档所述的常规做法（"For compiled sources, use the deployment's Client build tooling to emit this format"）。

终态指标：

| 指标 | 现状 | 目标 |
|---|---:|---:|
| 生成产物 `client.js` | 1,969 行 | ≤ 150 行（只剩包装器） |
| 浏览器端最大源码文件 | 673 行（GitPanel） | ≤ 250 行 |
| `index.js` 入口 | 769 行 | ≤ 80 行 |
| 可脱离浏览器单测的模块 | 0 个 | ≥ 12 个（纯函数层） |
| 测试支撑重复代码 | ~300 行 | 0（抽到 `test/support/`） |
| 浏览器调试 | 断点落在 2,000 行单文件 | 断点落到 `src/` 源文件（source map） |

**非目标**：不拆包、不引入 React 以外的前端框架、不改菜单/交互设计、不改 Host RPC 形状与信任围栏、不重写组件结构以外的渲染逻辑。

---

## 2. 现状基线（实测）

### 2.1 `client.js` 内部分布

| 区块 | 行范围 | 行数 | 备注 |
|---|---|---:|---|
| 语言词典 `en` / `zh` | 30–238 | 209 | 纯数据；顶部 banner 却写着 "Copy"（错位） |
| `CSS` 模板字符串 | 239–386 | 148 | 无语法高亮 / 格式化 |
| 图标 SVG | 387–489 | 103 | 13 个图标组件 + `svgIcon` |
| 工具函数 | 490–639 | 150 | `createCaller`、状态字母、`buildTree`、`formatAgo`、`parseRefs` 等 |
| 上下文菜单 | 640–845 | 206 | 命令总线、触发器绑定、目标构造、动作解析、剪贴板 |
| 基础组件 | 846–1027 | 182 | `IconButton`、`Section`、`FolderRow`、`FileRow`、`renderTree`、`Banner`、`EmptyState` |
| `GitPanel` | 1028–1701 | **674** | 数据加载 + 轮询 + 命令处理 + 确认流程 + 三组变更树 + 历史 + 分支 + 提交 |
| `DiffPanel` + `renderDiff` | 1702–1835 | 134 | |
| Tab 标题 | 1836–1852 | 17 | |
| 插件装配 `apply` | 1853–1969 | 117 | slot / 快捷键 / 菜单注册 |

### 2.2 `index.js` 内部分布

| 职责 | 代表函数 | 行数（约） |
|---|---|---:|
| HTTP 响应/请求体 | `sendJson`、`readJsonBody` | 47 |
| 信任围栏 | `isLoopbackAddress`、`isTrustedRequest` | 53 |
| Git 执行与路径 | `runGit`、`findRepositoryRoot`、`resolveRepositoryPath(s)` | 130 |
| 解析与读取 | `parseStatus`、`parseUnifiedDiff`、`readStatus`、`readHistory`、`readDiff`、`readBranches` | 300 |
| 分发 | `dispatch` | 105 |
| 装配 | `apply` | 51 |

### 2.3 测试侧重复

`test/client.test.mjs`（448 行）与 `test/ui.test.mjs`（751 行）各自构造一套 fake ctx、`contextMenus` 替身与菜单 mock；`test/host.test.mjs`（339 行）自带 fixture 仓库构造。三处合计约 300 行可共享。

---

## 3. 不可违反的约束（已从运行中的 DSH 安装核实）

1. **浏览器半 = 每包一个入口**：产物必须以 `window.__ModuleLoader__.load({ id, factory })` 注册，`factory(require)` 返回 `{ inject, apply }`；不能用原生 `import` 引同包另一个源文件。
2. **模块表规则**：`require('react')` 来自平台种子表；其余依赖只能来自已注册的包（`dsh.client.external`，需有对应激活插件行）或包内 chunk（`require.async('./client.<name>.js')`）。
3. **CSS 不能走资源路由**：`./assets/*` 只服务 svg/png/webp/jpg，样式必须内联进 artifact（构建时 `--loader:.css=text`）。
4. **source map 受支持**：加载器会读取、校验（Source Map v3）并重定位 `<clientPath>.map` 的 `sources` 后提供，因此产物可以附带 `client.js.map`。
5. **HMR 盯 artifact 的 mtime**：watch 构建产出 `client.js` 后，页面自动热替换，无需额外接线。
6. **Host 半无构建**：`index.js` 是普通 Node ESM；拆分生效需重启宿主（Host 端默认不热重载）。
7. **构建工具未随应用发布**：应用只带 `@swc/helpers`；npm registry 可达（实测 200），可自行引入 `esbuild` 作为 devDependency。

---

## 4. 目标架构

### 4.1 目录树

```text
client.js                      # 生成的 artifact（勿手改，文件头标注）
client.js.map                  # 生成的 source map
index.js                       # Host 入口：注入 + 路由 + 错误映射
src/
  host/
    http/respond.js               sendJson、readJsonBody
    http/trust.js                 loopback/信任围栏判定
    git/exec.js                   runGit、gitOrThrow、仓库根解析、路径校验
    git/status.js                 parseStatus、readStatus
    git/history.js                readHistory
    git/branches.js               readBranches、branchExists
    git/diff.js                   readDiff、parseUnifiedDiff
    session.js                    resolveSessionDirectory
    errors.js                     normalizeFailure
    rpc.js                        dispatch + 路由装配
  client/
    constants.js                  PACKAGE_ID、NS、GIT_ID/KIND、MENU_TARGET、轮询与上限常量
    locale/en.js                  en 词典
    locale/zh.js                  zh 词典
    styles.css                    CSS（构建内联）
    icons.js                      svgIcon + 13 个图标
    data/caller.js                makeFailure、createCaller
    git/format.js                 statusLetter、statusKey、isStaged、isUnstaged、baseName、formatAgo、parseRefs、errorText
    git/tree.js                   buildTree、collectTreePaths
    menu/bus.js                   createCommandBus
    menu/trigger.js               bindMenuTrigger、menuTarget
    menu/clipboard.js             absolutePath、copyToClipboard、copyAndReport
    menu/actions.js               menuAction、resolveMenuActions
    panel/controls.js             IconButton
    panel/Section.js              Section
    panel/rows.js                 FolderRow、FileRow、renderTree
    panel/feedback.js             Banner、EmptyState
    panel/BranchMenu.js           分支下拉
    panel/confirm.js              confirmTitle/Description/ActionLabel、ConfirmDialog
    panel/hooks/useRepoStatus.js  状态读取 + 轮询 + 刷新
    panel/hooks/useHistory.js     提交历史
    panel/hooks/useBranches.js    分支列表与切换
    panel/hooks/useChangeActions.js 暂存/取消暂存/丢弃/提交 + busy + 确认
    panel/hooks/useMenuCommands.js 命令总线订阅、panelId 归属、stale/busy 提示
    panel/views/BranchHeader.js   分支头
    panel/views/CommitBox.js      提交框
    panel/views/ChangeGroups.js   三组变更 + 树
    panel/views/GraphSection.js   graphRows + GraphRow
    panel/GitPanel.js             组件装配（≈130 行）
    panel/menu.js                 面板的菜单 wiring（trigger/target/panelId/refs）
    diff/DiffPanel.js             差异 Tab
    diff/render.js                renderDiff
    titles.js                     Tab 标题
    plugin.js                     apply：slot、快捷键、菜单、词典注册
  client-entry.js              # artifact 包装入口（供构建使用）
scripts/
  build-client.mjs             # esbuild 构建脚本（支持 --watch / --check）
  verify-contract.mjs          # 用宿主安装的真实注册表验证菜单契约（人工/阶段验收）
```

### 4.2 依赖方向（评审规则）

```text
client-entry → plugin → { titles, panel/GitPanel, diff/DiffPanel, menu/*, locale/* }
GitPanel → hooks/* → data/* , menu/actions , git/*
views/* → panel/controls , icons , git/format
纯函数层（git/*、menu/actions、locale/*、icons）不得 import React 或任何 ctx 服务
host/* 之间只允许：http → 无依赖；git/* → exec；rpc → 全部
```

规则：**纯函数模块不得依赖 React 与插件上下文**，这样它们能直接 `import` 单测；视图模块不直接调用 `fetch`。

### 4.3 浏览器端模块清单（搬运映射）

| 目标文件 | 从 `client.js` 搬什么 | 预估行数 |
|---|---|---:|
| `locale/en.js`、`locale/zh.js` | 两个词典对象（30–238） | 2 × 105 |
| `styles.css` | `CSS` 常量（239–386） | 148 |
| `icons.js` | `svgIcon` + 13 个图标（387–489） | 103 |
| `data/caller.js` | `makeFailure`、`createCaller`（490–541） | 50 |
| `git/format.js` | 状态字母、`isStaged/isUnstaged`、`baseName`、`formatAgo`、`parseRefs`、`errorText`（543–639） | 80 |
| `git/tree.js` | `buildTree`、`collectTreePaths` | 50 |
| `menu/bus.js` | `createCommandBus` | 20 |
| `menu/trigger.js` | `bindMenuTrigger`、`menuTarget` | 30 |
| `menu/clipboard.js` | `absolutePath`、`copyToClipboard`、`copyAndReport` | 55 |
| `menu/actions.js` | `menuAction`、`resolveMenuActions` | 105 |
| `panel/controls.js` | `IconButton` | 15 |
| `panel/Section.js` | `Section` | 22 |
| `panel/rows.js` | `FolderRow`、`FileRow`、`renderTree` | 120 |
| `panel/feedback.js` | `Banner`、`EmptyState` | 25 |
| `panel/BranchMenu.js` | `BranchMenu` | 45 |
| `panel/confirm.js` | `confirmTitle` 等三个 + 确认弹窗 | 60 |
| `panel/hooks/*.js` | `GitPanel` 的加载/历史/分支/动作/命令五块状态机 | 5 × 60–170 |
| `panel/views/*.js` | 头部、提交框、三组变更树、历史区 | 4 × 55–110 |
| `panel/menu.js` | 面板菜单 wiring | 50 |
| `panel/GitPanel.js` | 组装 hooks 与视图 | 130 |
| `diff/*` | `DiffPanel`、`renderDiff` | 95 + 55 |
| `titles.js` | 两个 Tab 标题组件 | 25 |
| `plugin.js` | `apply` 与三类注册（1853–1969） | 120 |
| `client-entry.js` | artifact 包装（新增） | 12 |

> 合计 ≈ 原文件 1,969 行 + 约 120 行 import/export 开销。

### 4.4 Host 端模块清单

| 目标文件 | 搬运内容 | 预估行数 |
|---|---|---:|
| `host/http/respond.js` | `sendJson`、`readJsonBody`（48–95） | 50 |
| `host/http/trust.js` | `isLoopbackAddress`、`isLoopbackHostname`、`isTrustedRequest`（97–152） | 60 |
| `host/git/exec.js` | `runGit`、`gitOrThrow`、`findRepositoryRoot`、`resolveRepositoryPath(s)`、`changeEntry`（153–314） | 135 |
| `host/git/status.js` | `parseStatus`、`readStatus`（316–397） | 80 |
| `host/git/history.js` | `readHistory`（398–438） | 45 |
| `host/git/branches.js` | `readBranches`、`branchExists`（439–460、602–612） | 40 |
| `host/git/diff.js` | `readDiff`、`parseUnifiedDiff`（461–589） | 130 |
| `host/errors.js` | `normalizeFailure`（590–601） | 15 |
| `host/session.js` | `resolveSessionDirectory`（220–251） | 35 |
| `host/rpc.js` | `dispatch` + 路由装配（613–718） | 155 |
| `index.js` | `inject` + `apply`（15–47、719–769） | 80 |

同一批函数里，`parseStatus`、`parseUnifiedDiff`、`resolveRepositoryPath` 是纯函数，拆出后应补直接单测（不再依赖真实 Git 仓库），能显著加快测试。

---

## 5. 构建契约（浏览器半）

### 5.1 产物形状

与官方客户端包一致：

```js
window.__ModuleLoader__.load({
  id: '@local/dsh-git-graph',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    /* …打包后的 CJS 代码… */
    return module.exports
  },
})
//# sourceMappingURL=client.js.map
```

`src/client-entry.js` 只做：

```js
export { inject, apply } from './client/plugin.js'
```

### 5.2 esbuild 配置（`scripts/build-client.mjs`）

| 选项 | 值 | 理由 |
|---|---|---|
| `entryPoints` | `src/client-entry.js` | 唯一入口 |
| `bundle` | `true` | 合成单 artifact |
| `format` | `cjs` | 产物需要 `require("react")`，由加载器提供 |
| `platform` | `neutral` | 不注入 Node/浏览器内建 |
| `target` | `es2022` | 与运行时（现代浏览器）一致 |
| `external` | `['react']` | **必须**，否则会把 React 打进产物 |
| `loader` | `{ '.css': 'text', '.json': 'json' }` | 样式内联为字符串、词典可走 JSON |
| `sourcemap` | `true` | 调试与 DevTools 断点 |
| `banner.js` | `window.__ModuleLoader__.load({ id, factory: (require) => { var module = { exports: {} }; var exports = module.exports;` | 用 banner/footer 而不是事后字符串拼接，让 source map 的偏移正确 |
| `footer.js` | `return module.exports } })` | 同上 |

> 若 banner/footer 与 source map 的配合实测有问题，退路是手工包装并让构建脚本用同一份 mapping 重新生成 map；该点在阶段 1 验收项中显式验证。

### 5.3 产物策略

- **提交 `client.js` 与 `client.js.map`**：插件按目录安装/软链到 profile，宿主直接读该文件；不提交就必须在安装前构建，反而更脆弱。
- 产物文件头写入：`/* generated by scripts/build-client.mjs — edit src/ instead */`，避免被手改。
- **新鲜度守护**：`npm run check:build` = 重新构建后 `git diff --exit-code -- client.js client.js.map`；CI/提交前跑一次。

### 5.4 npm scripts

```json
{
  "scripts": {
    "build": "node scripts/build-client.mjs",
    "dev": "node scripts/build-client.mjs --watch",
    "pretest": "node scripts/build-client.mjs",
    "test": "node --test test/*.test.mjs",
    "check:build": "node scripts/build-client.mjs && git diff --exit-code -- client.js client.js.map"
  }
}
```

开发循环：终端 A `npm run dev`（watch）→ 保存 `src/` → `client.js` 更新 → 页面 HMR（500 ms 轮询）自动热替换。

---

## 6. 分阶段实施计划

每个阶段独立可交付、可回滚；阶段 0 不引入任何依赖。

### 阶段 0 — 无风险整理（预计 2–3 小时，4 个提交）

1. **测试支撑去重**：新建 `test/support/fake-ctx.js`（fake ctx + `contextMenus` 替身）、`test/support/fake-menu.js`（与真实注册表同契约的菜单替身）、`test/support/fixtures.js`（STATUS/HISTORY/BRANCHES/仓库构造），两个测试文件改为引用；`mini-react.mjs` 不动。
2. **Host 半拆分**：按 §4.4 搬文件，`index.js` 只剩 `inject` + `apply`；`parseStatus` / `parseUnifiedDiff` / `resolveRepositoryPath` 补 3 组直接单测（纯函数，不起 Git 进程）。
3. **浏览器半内部治理**（不拆文件）：修正错位的 "Copy" banner；文件头加"四层结构"目录（契约层/纯函数层/视图层/装配层）；`GitPanel` 顶部注释按 hook 用途分区。
4. **文档**：新增 `docs/ARCHITECTURE.md`（模块图、数据流、两个契约：菜单注册表契约与 artifact 契约）。

**验收**：35 个测试全绿；新增纯函数测试全绿；`client.js` 仅注释变化；宿主重启后真实页面功能正常（右键菜单、暂存、提交、差异）。
**回滚**：逐个提交 revert 即可；无产物、无依赖。

### 阶段 1 — 引入构建（预计 1–2 小时，2 个提交）

1. 加 `esbuild` devDependency；新增 `scripts/build-client.mjs`（支持 `--watch` / `--check`）。
2. 把现有 `client.js` **原样**搬进 `src/client/`（先不拆分：一个 `src/client/all.js` 或按现有 banner 粗切两三个文件），`src/client-entry.js` 导出 `{ inject, apply }`；构建产物替换 `client.js`。
3. 加 `pretest`、`check:build`；提交产物与 source map。

**验收**：
- `npm run build` 幂等，`check:build` 无 diff；
- 35 个测试全绿（集成测试仍加载构建产物）；
- 真实页面：served rev 变化、HMR 推 `rebuilt` 事件、面板与菜单功能正常；
- DevTools 断点落到 `src/client/…`（source map 生效）。

**回滚**：`git revert` 构建提交，回到手写单文件；`client.js` 内容仍在提交历史里。

### 阶段 2 — 按块迁移浏览器源码（预计 4–6 小时，6–8 个提交）

顺序按依赖由少到多，每一步只搬代码、不改行为，一步一提交：

| 步骤 | 迁移内容 | 额外产出 |
|---|---|---|
| 2.1 | 词典、CSS、图标 | 词典 completeness 测试、CSS 由构建内联 |
| 2.2 | 纯函数层：`git/format`、`git/tree`、`menu/*`（actions/clipboard/bus/trigger） | 新增纯函数单测（状态字母、树构建、路径、动作解析） |
| 2.3 | 视图层：`panel/rows`、`Section`、`controls`、`feedback`、`titles` | 快照式标记断言（现有 UI 测试保底） |
| 2.4 | `GitPanel` 状态机：五个 hook 依次抽出 | 每个 hook 的行为由现有 UI 测试锚定 |
| 2.5 | `GitPanel` 视图：头部、提交框、变更组、历史区 | `GitPanel` 降到 ≈130 行 |
| 2.6 | `DiffPanel`、`renderDiff` | |
| 2.7 | `plugin.js` 装配 + `client-entry.js` | `client.js` 只剩包装器 |

**每步验收**：`npm test` 全绿；`check:build` 干净；真实页面手动冒烟（右键菜单 5 项、暂存/取消暂存/丢弃确认、提交、差异 Tab、分支切换）；注册表契约脚本通过。
**回滚**：单步 `git revert`；任何一步都不改变产物对外的 `{ inject, apply }`。

### 阶段 3 — 质量门（预计 2 小时）

1. `scripts/verify-contract.mjs`：把上一轮"用宿主真实注册表解析菜单动作"的校验固化为脚本，阶段验收与 DSH 升级后人工执行。
2. 可选 `tsc --noEmit` + `// @ts-check`（先只覆盖纯函数层）；可选 `node --test --experimental-test-coverage` 报告。
3. `CHANGELOG.md`：记录 0.2.1 → 0.3.0（内部重构，无行为变化）。
4. 版本号 0.3.0；`docs/DETAIL*.md` 无需改动（用户可观察行为未变）。

---

## 7. 测试策略

| 层 | 位置 | 内容 | 现状/目标 |
|---|---|---|---|
| 单元（纯函数） | `test/unit/*.test.mjs` | 状态字母映射、树构建、路径换算、菜单动作解析、porcelain/diff 解析 | 新增 ≈15–20 个用例 |
| 集成（浏览器 artifact） | 现有 `test/client.test.mjs`、`test/ui.test.mjs` | 保留全部 35 个行为断言，继续加载构建产物 | 用例数不减 |
| 集成（Host） | 现有 `test/host.test.mjs` | 保留真实 Git fixture 的端到端用例 | 不变 |
| 契约 | `scripts/verify-contract.mjs` | 用宿主安装的真实注册表解析动作（镜像宿主契约，而非实现假设） | 固化脚本 |
| 构建新鲜度 | `npm run check:build` + CI | 产物与源码一致 | 新增 |
| 支撑 | `test/support/*` | fake ctx、菜单替身、fixtures、mini-react | 去重 ≈300 行 |

原则：**测试替身镜像宿主契约，不镜像实现假设**（上一轮"空菜单"缺陷正是两者的替身共同误判导致的）。

---

## 8. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 产物是生成文件，diff/blame 噪声大 | review 与追溯变难 | 文件头标注 generated；review 只看 `src/`；重构提交按块批量进行；必要时 `git blame --ignore-rev` |
| 忘记构建 → "改了没生效" | 开发体感差 | `pretest` 自动构建；`npm run dev` watch + 页面 HMR；`check:build` 进 CI |
| source map 与 banner 包装偏移错位 | 断点落不准 | 阶段 1 显式验收；异常时退回手工包装 + 重建 map |
| 引入工具链依赖（esbuild，平台二进制） | 离线环境装不上 | registry 已确认可达；若需完全离线，可退化为"只做阶段 0 + 内部治理"（不拆浏览器源码） |
| 过度拆分（一函数一文件） | 阅读成本反升 | 按"变更频率"切分；单文件目标 60–250 行；纯函数层与视图层分离；评审依赖方向规则 |
| Host 拆分后忘记重启宿主 | 以为改动没生效 | 阶段 0 验收包含一次宿主重启后的冒烟 |
| 迁移期双份代码（旧文件未删） | 混乱 | 每步迁移即删除旧块；以 `git diff` 正负行数平衡作为检查项 |

---

## 9. 度量目标（完成后）

| 指标 | 基线 | 目标 |
|---|---:|---:|
| 浏览器端源码文件数 | 1 | ≈ 30 |
| 浏览器端最大文件 | 674 行 | ≤ 250 行 |
| 生成 `client.js` | 1,969 行 | ≤ 150 行 |
| `index.js` | 769 行 | ≤ 80 行 |
| 可直接单测的模块 | 0 | ≥ 12 |
| 测试支撑重复 | ≈300 行 | 0 |
| 测试用例 | 35 | ≥ 55（35 集成 + ≈20 单元） |
| 浏览器调试 | 单文件 | 源文件断点 |

---

## 10. 需要拍板的决策

1. **是否引入 esbuild（含提交产物）**：推荐"是"。若要求零依赖，则只执行阶段 0（Host 拆分 + 测试去重 + 内部治理），浏览器端保持单文件。
2. **是否引入类型检查**：推荐先只给纯函数层加 JSDoc + `// @ts-check`，不引入 `typescript` 依赖；若接受 devDependency 再加 `tsc --noEmit`。
3. **LiteSpec 记录方式**：内部重构不改可观察行为，按规则无需行为 delta；如需留痕，开一个 change，只写 `proposal.md` + `design.md`（模块边界与构建契约），delta 留空。（执行结论：`litespec_validate` 要求 change 必须带 spec delta，delta 留空会报错，所以本轮没有建 change；留痕落在本文档 §12 与 `CHANGELOG.md`，AGENTS.md 已同步该约定。）
4. **执行范围**：建议按"阶段 0 → 1 → 2 → 3"全做；也可停在阶段 0（约半天，收益一半、风险为零）。
5. **产物是否提交**：推荐提交 `client.js` + `client.js.map`（插件按目录安装，宿主直接读文件）。

---

## 11. 执行清单

- [x] 阶段 0.1：抽 `test/support/{fake-ctx,fake-menu,fixtures}.js`，两个测试文件改为引用
- [x] 阶段 0.2：Host 拆分为 `src/host/**`，`index.js` 只剩注入与装配
- [x] 阶段 0.3：补 `parseStatus` / `parseUnifiedDiff` / `resolveRepositoryPath` 纯函数单测
- [x] 阶段 0.4：`client.js` 内部治理（banner、四层分区、GitPanel 分区注释）
- [x] 阶段 0.5：新增 `docs/ARCHITECTURE.md`
- [x] 阶段 0 验收：35 + 新增用例全绿；宿主拆分另以「旧/新实现差分对比 + 真实回环服务 212 项响应对比」验证等价（真实页面冒烟待宿主重启后由用户确认）
- [x] 阶段 1.1：加 esbuild 与 `scripts/build-client.mjs`
- [x] 阶段 1.2：源码迁入 `src/`，产物替换 `client.js`，提交 `client.js.map`
- [x] 阶段 1.3：`pretest` / `check:build` / `dev` 脚本
- [x] 阶段 1 验收：构建幂等、测试全绿；运行中的宿主已服务新产物与 source map，且 artifact 变更触发 `rebuilt` 事件（HMR 通道实测）
- [x] 阶段 2.1–2.7：按依赖顺序迁移并逐步删除旧块（每步一提交）
- [x] 阶段 2 验收：`GitPanel` 248 行，产物为生成 bundle（见 §12 偏差），冒烟项通过
- [x] 阶段 3.1：固化 `scripts/verify-contract.mjs`
- [x] 阶段 3.2：版本 0.3.0 + `CHANGELOG.md`

---

## 12. 执行结果（2026-11-15 完成，版本 0.3.0）

基线 `7cac4e6` → 重构后。全部阶段 0→3 落地，行为与契约不变；35 个行为断言原样保留并全部通过。

| 指标 | 基线 | 计划目标 | 实际 |
|---|---:|---:|---:|
| 生成产物 `client.js` | 1,969 行（手写） | ≤ 150 行 | **2,082 行**（生成，96 KiB，见偏差 1） |
| 浏览器端最大源码文件 | 674 行（`GitPanel`） | ≤ 250 行 | **248 行**（`panel/GitPanel.js`） |
| 浏览器端源码文件数 | 1 | ≈ 30 | **34** |
| `index.js` 入口 | 769 行 | ≤ 80 行 | **77 行** |
| 宿主端源码文件数 | 1 | — | **12**（`index.js` + `src/host/**` 11 个模块） |
| 可直接单测的模块 | 0 | ≥ 12 | **14**（宿主 4 + 浏览器 10） |
| 测试支撑重复代码 | ≈ 300 行 | 0 | **0**（`test/support/` 4 个文件，689 行） |
| 测试用例 | 35 | ≥ 55 | **159**（35 行为 + 124 单元，其中 94 个新增于本轮） |
| 浏览器调试 | 单文件断点 | 源文件断点 | `client.js.map` → `src/client/**`，宿主实测可服务 |
| `esbuild` 依赖 | 无 | devDependency | `esbuild ^0.28.2`（dev-only，产物已提交） |

新增质量门：`npm run check:build`（产物新鲜度）、`npm run verify:contract`（用宿主真实菜单注册表解析 5 类目标，16 条命令）、`npm run build` / `dev`、`pretest` 自动构建。

### 偏差与决定（均已在 AGENTS.md / CHANGELOG.md 记录）

1. **产物行数目标未成立。** §1 的「≤ 150 行（只剩包装器）」隐含把浏览器代码拆成 `require.async` 包内 chunk；但 §5.2 选定的构建配置是 `bundle: true` + `cjs`，输出必然是整包未压缩代码（约 2,100 行）。压缩可到个位数行数，但会放大生成 diff 噪声、且不在 §5.2 配置内，故保留可读产物 + source map，评审只读 `src/`。
2. **`GitPanel` 248 行而非 ≈130 行。** 确认弹窗、两条 banner、notice、四个空状态按"不改标记与结构"原则保留在 `GitPanel.js` 内，未为凑行数新增计划外的 view 模块；仍在 ≤250 行硬线内。
3. **阶段 2.6 并入 2.1–2.3。** `DiffPanel` 与 `renderDiff` 在同一批机械迁移中完成，单独提交没有额外价值。
4. **类型检查保持"标记 + JSDoc"**（§10 决策 2 的推荐项）：纯函数层加 `// @ts-check`，不引入 `typescript`。

### 已知问题（本轮范围外，未修复）

- `src/host/git/status.js` 的 `parseStatus` 在 `unmerged`（冲突）记录上读 `match[11]`，而记录只有 10 个捕获组，导致冲突行 `path` 为 `undefined`；客户端树构建会对该行调用 `path.split('/')`。这是 0.1.0 起就存在的缺陷，本轮重构按"零行为变化"原样保留并有差分测试锚定；建议另开一个 LiteSpec 变更修复并补冲突夹具。
