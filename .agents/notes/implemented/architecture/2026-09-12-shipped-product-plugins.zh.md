# Agent Note: 随产品内置的插件由 launcher 代次承载

Status: implemented

[English](2026-09-12-shipped-product-plugins.md) | 中文

> **更新（2026-09-21）：** `dsh-nonead-universal-robots` 已退出随产品内置集合。launcher 不再插入它的 loader 行，两个桌面发行版都不再依赖或打包它，`desktopBundleList()` 也不再把它从 Profile bundle 列表中剔除。只有 [`dsh-nonead-client-skin/`](../../../../dsh-nonead-client-skin/) 仍按下文所述随 launcher 代次承载。
>
> **更新（2026-09-26）：** `dsh-nonead-universal-robots` 随后被整体移出本仓库：其源码已删除，根 Yarn 工作区也不再声明该成员。下文凡仍将其称为工作区成员或 production dependency 之处，均应读作本次更新之前的状态；皮肤现在是唯一由产品所有的插件工作区成员。

## Problem

Nonead DSH Desktop 必须在启动时就已装好并生效 Universal Robots 工具集与 Nonead 品牌皮肤：任何机器、任何 Profile、开发态与打包安装版都要如此，且不需要操作者先执行 `dsh plugin add`。这两个插件原本是各自独立的私有仓库，而桌面 launcher 只组合官方 Web bundle 加上 Profile 自己安装过的第三方 bundle。

用 Profile bundle 无法满足该要求。`dsh.profile.bundles` 是按 Profile 保存的用户状态，launcher 除安装方拥有的前缀外刻意不改写它；它还要求依赖规范可解析（皮肤是 `private` 且未发布，UR 包同样不在 npm registry 上）；并且每个 direct bundle 都会在 Desktop 插件清单里保持用户可禁用。

## Decision

[`dsh-nonead-universal-robots/`](../../../../dsh-nonead-universal-robots/) 与 [`dsh-nonead-client-skin/`](../../../../dsh-nonead-client-skin/) 是外层 Yarn 工作区中由产品拥有的成员，也是两个桌面发行版的 production dependency，按精确版本引用，做法与 [`dsh-community-market`](../../../../dsh-community-market/) 完全一致。

两个包都不进入任何 Profile。launcher 自有的 patch 层（[`dsh-plugin-desktop/cordis.patch.yml`](../../../../dsh-plugin-desktop/cordis.patch.yml) 与 Beta 对应文件）各插入一条 loader 行，因此每个 Profile 的每一代都会组合它们，不改写任何 Profile 文件，Desktop 插件清单也从不列出它们——不存在可禁用的 bundle。解析沿用常规的安装锚点路径：行是以密封安装为锚的 bare specifier，插件自身的 bare import（`@deepseek-ai/dsh-tools`、`@deepseek-ai/schemastery`）在 [`module-resolution.ts`](../../../../dsh-plugin-desktop/src/module-resolution.ts) 中会从 Node 常规查找回退到 Profile 锚点、再回退到安装锚点。插件本身不需要 `node_modules`。

若某个 Profile 仍然列出这两个包之一（例如在本功能发布前已手工安装过的机器），它会以该 bundle 自带的 loader 行 id 再组合一份副本。因此 [`desktopBundleList()`](../../../../dsh-plugin-desktop/src/profile.ts) 会把这两个名字从持久化 bundle 列表中剔除，处理方式与已退休的 `@deepseek-ai/dsh-desktop-app` bundle 完全一致；launcher 会在该代组合之前重写一次 manifest。用户自有的依赖列表保持不变，残留的 `link:` 条目只是不再被组合。

皮肤在浏览器侧无需额外接线：`dsh-client-modules` 会扫描 Host Loader 的 entries 以寻找声明 `dsh.client` 的包，而该包声明了 `platform: web` 与 `immediately: true`，于是它预构建的 `lib/client.js` 直接进入 renderer 启动图。

两个包都以普通内容形式并入本仓库。内层 `.git` 目录被移动到已忽略的 `.build/nonead-source-git/`，因此文件由外层仓库拥有；由于这两个目录不再自带历史，来源记录在此：`git@git.corp.nonead.com:tonyke/dsh-nonead-client-skin.git` 的 `c8461da5c0cdd51f8552ce8266fd95476d57e267`（master，2026-09-08）与 `git@git.corp.nonead.com:tonyke/dsh-nonead-universal-robots.git` 的 `a2474aa775cc61e6558e596d8546ed7f3514774c`（main，2026-09-09）。

两者的 peer 范围被收紧到内置运行时 family（DSH 各包为 `0.1.7-rc.1`，Cordis 为 `4.0.4`），使外层安装解析到 `vendor/dsh-runtime` 而不是 registry，也不会触发 release-age 门禁。皮肤的 `@deepseek-ai/dsh-client-runtime` peer 保持 optional：本仓库只消费预构建的浏览器产物、从不编译该皮肤，因此这个仅用于类型的依赖绝不能在这里被解析。

## Verification

`verify:profile` 对两个发行版都无界面启动完整的已发布 Desktop profile（含新增行），并新增断言：Host tools 服务上已注册 `ur_connect` 与 `ur_ping`，且真实 renderer 启动图中包含 `dsh-nonead-client-skin`。还跑了一次反向对照（把期望的 client id 改名）以确认该图断言在缺行时确实失败。同时通过：`verify:closure`（247 个第一方节点保持闭包）、`verify:licenses`、`verify:loader`、`vitest run tests/profile.spec.ts tests/desktop-plugins.spec.ts tests/plugin.spec.ts tests/profiles.spec.ts`（86 个测试）、`check:desktop-variants`，以及 `yarn install --immutable`。

`check:layout` 在未初始化上游子模块时无法运行，因此其“自有成员”预期已在 [`scripts/verify-layout.mjs`](../../../../scripts/verify-layout.mjs) 中扩展（工作区列表与协议边界扫描），并用等价检查验证。`THIRD_PARTY_NOTICES.md` 按发布主机生成：这两个包应出现在其中，但本机 Windows 重新生成还会改写平台相关的可选依赖行并回退 Agents Anywhere 桥接包版本，因此发布用 notices 需在发布主机上重新生成，而不是从开发机提交。

## Alternatives considered

**把插件声明为 Profile bundle。** 否决：会改写用户 Profile 状态、只能覆盖恰好安装过它的那个 Profile、保持用户可禁用，并且需要一个两个包都无法提供的可解析规范。

**从 npm registry 依赖这两个插件。** 否决：`dsh-nonead-universal-robots` 从未发布（`registry.npmjs.org` 返回 404），皮肤是 `private`，而已发布的桌面清单本身就不可解析——它包含 `file:../vendor/...` 与仅工作区存在的版本。

**把插件仓库作为 Git 子模块跟踪。** 否决：两个远端都是公司内网 SSH 地址，外层仓库在公司外将无法 clone；同时未初始化的子模块会让 workspace 成员缺失，`yarn install` 会直接失败。

**像 Agents Anywhere 桥接包那样只内置打包 tarball 到 `vendor/`。** 此处否决（桥接包保留该形态）：审查者需要能在仓库内直接阅读和修改插件源码，而且每次升版都要多一个准备步骤。

## Consequences

两个发行版的每一次构建——开发态与打包版——现在都自带机器人工具与品牌皮肤，因此皮肤也成为社区版的默认外观；这是明确的产品决策。移除某个插件只需改 launcher 层一行，且立即在全网生效。发包体积增加了皮肤内嵌的 logo data URL 与机器人插件的 Python 载荷；Python 解释器与 `numpy`/`paramiko` 仍是操作者前提，由 `ur_ping` 自检报告，任何安装包都不提供。插件源码现在在本仓库与公司仓库之间各有一份，因此上游插件变更需要在本仓库提交一次同步。
