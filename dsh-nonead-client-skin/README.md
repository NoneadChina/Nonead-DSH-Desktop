# dsh-nonead-client-skin — 拓德皮肤插件（Nonead 侧边栏 logo）

给 DeepSeek Harness Web GUI 换品牌 logo 的最小示例：**不改动页面任何其它外观**
（保持当前默认主题），只替换侧边栏导航的两个 logo，加载即生效：

| 侧边栏状态 | 原元素 | 替换为 |
|---|---|---|
| 展开（wide） | 导航栏上部品牌区（mark + wordmark 两个 slot） | `NONEAD_ai.png`（1790×200，按 24px 高渲染） |
| 收起（rail） | 导航栏顶部 toggle 按钮里的鲸鱼 SVG（FishLogo） | `nonead.ai_Logo.png`（486×486，按 24px 渲染） |

## 工作原理

- 侧边栏的品牌区是 `ui-sidebar` 的 `SidebarRoot` 通过 slot 渲染的（`sidebar.brand.mark` /
  `sidebar.brand.name`），每个 slot 出口都带一个稳定的 `[data-slot="<key>"]` 包装元素
  （ui-renderer 的 scoped-slots 约定：动态样式的「可寻址接缝」）。插件向 `<head>` 注入
  一段 CSS：按 slot 键精确命中两个按钮，隐藏原内容，用 `background-image` 画上新 PNG。
- 两张 PNG 以 **base64 data URL** 内嵌（`src/client/assets.ts`，由 `scripts/make-assets.ps1`
  之类的脚本生成），不依赖任何静态文件路由；插件卸载时移除注入的样式，页面完整还原。
- 收起态 hover 时保持原交互：露出展开面板图标、隐藏 logo 背景图。
- `:has()` 选择器需要现代浏览器（Chrome/Edge 105+、Safari 15.4+、Firefox 121+）。

## 安装形态：产品内置插件

本目录是外层 Yarn workspace 的成员，并作为**两个桌面版**（`dsh-plugin-desktop`、
`dsh-plugin-desktop-beta`）的生产依赖随安装包一起分发。它**不进任何 Profile**，
由 launcher 自己的 patch 层挂载：

1. 根 `package.json` 的 `workspaces` 已纳入 `dsh-nonead-client-skin`；
2. 两个桌面版的 `package.json` 按精确版本声明依赖（与 `dsh-community-market` 同形）；
3. 两个桌面版的 `cordis.patch.yml` 各插入一行 launcher 行：
   `- id: nonead-client-skin` / `name: dsh-nonead-client-skin`。

于是**每个 Profile、每一次生成、开发态与安装包都自带该皮肤**：默认启动即生效，
用户不需要安装插件，也不需要 `--patch`；反过来，若某个 Profile 里残留着早期手工
安装的同名 bundle，`desktopBundleList()` 会把它从 `dsh.profile.bundles` 中剔除，
避免组合出第二份。

浏览器半边无需额外接线：`dsh-client-modules` 会扫描 Host Loader 条目里声明了
`dsh.client` 的包，本包声明 `platform: web` + `immediately: true`，因此预构建的
`lib/client.js` 自动进入渲染进程启动图。

## 构建与运行

```sh
corepack yarn install   # 注册 workspace 成员（lib/ 已预构建，本仓库不重新编译皮肤）
corepack yarn dev       # 稳定版；Beta 版为 corepack yarn dev:beta
```

窗口打开后侧边栏即显示 NONEAD logo，无需其它操作。

## 校验

```sh
corepack yarn check:desktop-variants                        # 两个桌面版的 src/ 变体对齐
corepack yarn workspace dsh-plugin-desktop test             # 皮肤接线断言
```

## 目录结构

| 文件 | 作用 |
|---|---|
| `package.json` | `dsh.client` 声明、`exports["./client"]`、版本与根一致 |
| `tsconfig.json` | extends `tsconfig.base.client.json` |
| `tsdown.config.ts` | 共享 preset：node 半 + 浏览器 client bundle |
| `src/index.ts` | Host（Node）半：空 apply 占位 |
| `src/client/index.ts` | 浏览器半：注入 logo 替换样式（皮肤核心） |
| `src/client/assets.ts` | 生成文件：两张 logo 的 base64 data URL（由 `scripts/make-assets.ps1` 生成） |
| `src/invariant.ts` | 包 invariant 伴生（无运行时 invariant，理由见文件） |
| `NONEAD_ai.png` / `nonead.ai_Logo.png` | 品牌 logo 源图（构建后无需再携带） |

> `tsconfig.json`、`tsdown.config.ts` 与 `scripts/` 是皮肤在自身 corporate 检出里的编译入口，
> 其中的相对路径指向它原来的 monorepo 布局；本仓库只消费已提交的 `lib/`，不重新编译皮肤，
> 因此皮肤也不需要在这里参与 `build` / `typecheck`。

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
- **PNG 变更需重新生成 assets.ts** — 源图更新后运行 `scripts/make-assets.ps1`，
  否则页面仍使用旧 base64 数据。

## License

版权所有 © 2026 **Nonead Corporation**。本插件遵循 [MIT License](LICENSE)。