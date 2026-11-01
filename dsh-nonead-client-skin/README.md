# dsh-nonead-client-skin — 拓德皮肤插件（Nonead 品牌标识）

给 Nonead DSH Desktop（DeepSeek Harness Web GUI）换品牌标识的最小示例：**不改动页面
任何其它外观**（保持当前默认主题），只替换侧边栏与首页 Hero 的品牌 logo，并把首页 Hero
标题改成中文品牌语，加载即生效：

| 位置 | 原元素 | 替换为 |
|---|---|---|
| 侧边栏展开（wide） | 导航栏上部品牌区（mark + wordmark 两个 slot） | `NONEAD_ai.png`（1790×200，按 24px 高渲染） |
| 侧边栏收起（rail） | 导航栏顶部 toggle 按钮里的鲸鱼 SVG（FishLogo） | `nonead.ai_Logo.png`（486×486，按 24px 渲染） |
| 首页 Hero | 输入框上方的品牌 mark（`conversation.hero.brand.mark`） | `nonead.ai_Logo.png`（按 34×34 渲染） |

此外首页 Hero 的标题文案会由 `探索未至之境` / `Into the Unknown` 改写成 `创新改变世界`（常量 `HEADLINE_TO`，见 `src/client/index.ts`）。

## 工作原理

- 侧边栏的品牌区与首页 Hero 的品牌 mark 都是上游通过 slot 渲染的（`sidebar.brand.mark` /
  `sidebar.brand.name` / `conversation.hero.brand.mark`），每个 slot 出口都带一个稳定的
  `[data-slot="<key>"]` 包装元素（ui-renderer 的 scoped-slots 约定：动态样式的「可寻址接缝」）。
  插件向 `<head>` 注入一段 CSS：按 slot 键精确命中这些元素，隐藏原内容，用
  `background-image` 画上新 PNG。
- 两张 PNG 以 **base64 data URL** 内嵌（`src/client/assets.ts`，由 `scripts/make-assets.ps1`
  生成），不依赖任何静态文件路由；插件卸载时移除注入的样式，页面完整还原。
- 收起态 hover 时保持原交互：露出展开面板图标、隐藏 logo 背景图。
- `:has()` 选择器需要现代浏览器（Chrome/Edge 105+、Safari 15.4+、Firefox 121+）。

## 接入仓库

本目录就是仓库根的 `dsh-nonead-client-skin/`，**不是** Yarn workspace 成员。它由实验壳
`nonead-dsh-desktop/` 以 `file:` 依赖引入：

1. `nonead-dsh-desktop/package.json` 的 `dependencies` 声明 `"dsh-nonead-client-skin": "file:../dsh-nonead-client-skin"`。
   根 Yarn 使用 `nodeLinker: node-modules`，因此该依赖会被**硬拷贝**进 `node_modules`
   （lockfile 记为 `linkType: hard`）。
2. `nonead-dsh-desktop/cordis.patch.yml` 用一行 loader entry（`id: nonead-client-skin`、
   `name: dsh-nonead-client-skin`）把它插入**每个 Profile**，皮肤随安装包一起分发。
3. 皮肤自身也带 `cordis.patch.yml`（由 `package.json` 的 `dsh.bundle.patch` 指向），
   内容同样是插入一行 loader entry（`id`/`name` 均为 `dsh-nonead-client-skin`）；
   当该包被当作 bundle 挂载时由 Loader 读取。

浏览器半不需要单独注册：`package.json` 的 `dsh.client` 声明 `platform: "web"` 与
`immediately: true`，`dsh-client-modules` 会像内置 `ui-*` 包一样发现 `exports["./client"]`。

## 构建与运行

```sh
corepack yarn install            # 重新计算 file: 依赖的内容 hash 并硬拷贝到 node_modules
corepack yarn dev:stable         # 启动 Nonead DSH Desktop，皮肤按上述 patch 行挂载
```

改了皮肤源码后**必须重跑 `corepack yarn install`**，否则 `node_modules` 里仍是上一份硬拷贝。
仅有 `tsdown` 产物变化时同样如此，因为消费方读取的是拷贝而不是本目录。

## 校验

本包没有自己的 `test`/`typecheck` 脚本；改动后请在仓库根执行：

```sh
corepack yarn workspace nonead-dsh-desktop test   # 含对 dsh-nonead-client-skin/** 的载荷文件策略断言
corepack yarn check                               # 完整 headless gate
```

## 打包与依赖约束

- `package.json` 的 `files` 只能写字面名或 `目录/**`（打包器不支持其它 glob）；当前列出
  `lib/index.js`、`lib/invariant.js`、`lib/client.js`、`lib/types`、`cordis.patch.yml`。
  新增产物时必须同步这一列表，否则不会被硬拷贝、也就不会进入安装包。
- 仅用于 `import type` 的依赖不要声明为必需 peer：应放进 `devDependencies`，或声明为
  **可选 peer**。本包三个 `lib/*.js` 产物都不含任何运行时 import，因此
  `@deepseek-ai/dsh-client-runtime` 与 `@deepseek-ai/dsh-invariants` 以
  `devDependencies` + `peerDependenciesMeta.optional` 声明。
- `lib/` 是消费方实际读取的产物；`src/` 只在本地构建时参与。

## 目录结构

| 文件 | 作用 |
|---|---|
| `package.json` | `dsh.client` / `dsh.bundle` 声明、`exports["./client"]`、`files` 白名单 |
| `tsconfig.json` | extends `tsconfig.base.client.json` |
| `tsdown.config.ts` | node 半 + 浏览器 client bundle（调用 `clientBundle` helper） |
| `src/index.ts` | Host（Node）半：空 apply 占位 |
| `src/client/index.ts` | 浏览器半：注入 logo 替换样式与 hero 文案改写（皮肤核心） |
| `src/client/assets.ts` | 生成文件：两张 logo 的 base64 data URL（由 `scripts/make-assets.ps1` 生成） |
| `src/invariant.ts` | 包 invariant 伴生（无运行时 invariant，理由见文件） |
| `cordis.patch.yml` | 本包作为 bundle 挂载时插入的那一行 loader entry |
| `NONEAD_ai.png` / `nonead.ai_Logo.png` | 品牌 logo 源图（构建后无需再携带） |

## Model Experience

None, as the skin is a browser-side CSS/DOM injection; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **`:has()` 依赖现代浏览器** — Chrome/Edge 105+、Safari 15.4+、Firefox 121+；
  旧浏览器中品牌替换样式不生效，页面保持默认外观。
- **hero 文案替换按精确文本匹配** — `探索未至之境` / `Into the Unknown` 硬编码，
  上游 locale 文案变更后需同步更新本插件（`HEADLINE_FROM_ZH` / `HEADLINE_FROM_EN`）。
- **仅覆盖侧边栏与首页 hero** — 其它品牌触点（如设置页、空会话 EmptyHero 之外的
  FishLogo 位置）不在替换范围内，保持默认 DeepSeek Harness 品牌。
- **PNG 变更需重新生成 assets.ts** — 源图更新后在本目录运行
  `pwsh -File scripts/make-assets.ps1`，否则页面仍使用旧 base64 数据；重新生成后还需
  重跑 `corepack yarn install` 刷新硬拷贝。