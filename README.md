<p align="center">
  <a href="https://www.nonead.com"><img src="https://www.nonead.com/assets/img/desktop-Nonead.jpg" alt="Nonead DSH Desktop：基于 DeepSeek Harness 构建的开源桌面客户端" width="100%"></a>
</p>

<h1 align="center">Nonead DSH Desktop</h1>

<p align="center">
  <strong>基于 DeepSeek Harness 构建的 Windows、macOS 与 Linux 开源桌面客户端。</strong>
</p>

<p align="center">
  产品版本 <code>2.1.16</code> · DSH 运行时 <code>0.2.1-rc.2</code> · Electron 44 · MIT License
</p>

<h3 align="center"><a href="https://www.nonead.com">一键下载，开箱即用。</a></h3>

<p align="center">
  万物皆「插件」，桌面本身也是「插件」。
</p>

<p align="center"><sub>独立的社区开源项目，与深度求索不存在隶属、合作、授权或背书关系。<br>本仓库目前无深度求索员工或 DeepSeek Harness 上游官方团队成员参与；GitHub Contributors 中显示的上游贡献者来自 fork 继承和同步的提交历史。<br>中文 · <a href="README.en.md">English</a></sub></p>

<a id="toc"></a>

## 目录

| 章节 | 内容 |
| --- | --- |
| [这是什么](#what) | 产品定位与进程模型 |
| [当前版本与运行时](#versions) | 版本、上游 pin、依赖基线 |
| [下载与安装](#download) | 三个平台的安装方式 |
| [核心能力](#features) | 桌面封装、Profile、市场、更新等 |
| [安全边界](#security) | 渲染器凭据、局域网、更新校验 |
| [文档](#docs) | 用户与开发者文档入口 |
| [仓库结构](#layout) | 目录与四个工作区的职责 |
| [从源码开发](#dev) | 环境、命令、门禁 |
| [发布与更新](#release) | 通道协议与发版流程 |
| [插件生态](#plugins) | 为什么一切皆插件 |
| [与上游的关系](#upstream) | 边界与分工 |
| [更新日志](#changelog) | 版本变更记录 |
| [已知限制](#limits) | 需要提前知道的行为 |
| [社区交流](#community) | 讨论渠道 |
| [友情链接](#links) | 生态项目 |
| [License](#license) | 许可与声明 |

<a id="what"></a>

## 这是什么

Nonead DSH Desktop 把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的本地 Web UI、Host 服务与插件系统集成进原生桌面应用。上游源码**原样运行**并固定在某个发布版本上；桌面壳负责窗口、托盘、终端、自动更新、多套工作配置（profile）与安装包分发，并且**自身也以 DSH 插件的形式接入**，与第三方插件使用同一套组合机制。

产品不是一个"重新实现的客户端"，而是一个薄的 Electron 宿主加一个完整的 DSH 运行时：

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 桌面壳 | Electron main 进程 | 单实例锁、窗口与材质、托盘与菜单、权限、终端、更新、数据目录、profile 状态 |
| Host | Node 模式子进程 | 加载 profile 补丁层、启动上游 profile boot、承载 Web carrier、承载第三方 Host 插件 |
| Web carrier | 回环地址 HTTP + WebSocket | 提供官方 Web UI（默认临时端口） |
| 渲染器 | 沙箱化 BrowserWindow | 加载官方 Web UI，凭原生凭据头区分身份 |

壳与 Host 之间只有一条子进程 IPC 通道；切换 profile 或模式会 dispose 整个 Host generation 并换一个新的子进程，跨 generation 的状态一律不缓存。渲染器不直接拿 Electron API，而是拿官方 Web UI 加上一个由壳生成的访问凭据。

<a id="versions"></a>

## 当前版本与运行时

| 项 | 值 |
| --- | --- |
| 产品版本 | `2.1.16`（`nonead-dsh-desktop` 与 `dsh-plugin-desktop-beta` 同步） |
| 稳定通道工作区 | `nonead-dsh-desktop`（根脚本 `:stable` 后缀） |
| Beta 通道工作区 | `dsh-plugin-desktop-beta`（根脚本 `:beta` 后缀） |
| DSH 运行时 | `0.2.1-rc.2`，所有 `@deepseek-ai/dsh*` 依赖精确 pin，运行时就地 vendored |
| 已 vendored 运行时 | `vendor/dsh-runtime/0.2.1-rc.2/`（另有若干历史版本目录保留） |
| 上游 pin | `687f282e8625c6b8d11ff58211a90524be2e4317`（`upstream.json` 的 `channels.beta`，同时记在 `nonead-dsh-desktop/upstream-reference.json`） |
| Electron / 打包器 | Electron `44.0.0` / electron-builder `26.15.7`（`app-builder-lib` 带补丁） |
| Node / Yarn | Node `^22.19.0` 或 `>=24.0.0`；Yarn `4.18.0`（经 Corepack，`nodeLinker: node-modules`） |
| 插件市场 | `dshmarket` `1.66.45`，另有本仓库的 `dsh-community-market` `0.1.0-dev.0` |
| 手机远控桥 | `@agents-anywhere/dsh-bridge-next` `2.1.0-desktop`（上游提交 `39b82d4`） |
| 品牌皮肤 | `dsh-nonead-client-skin`（随安装包分发，按 profile 组合加载） |

`upstream.json` 记录两条 vendored 运行时线：`stable` 对应上游 `0.2.0-rc.2`，`beta` 对应上游 `0.2.1-rc.2`；真正打进安装包的是工作区精确 pin 的那一条，当前两个桌面工作区都 pin 在 `0.2.1-rc.2`。**通道名描述的是"运行时线"，不是工作区查询的发布通道。**

<a id="download"></a>

## 下载与安装

正式安装包支持 Windows x64、macOS（Universal，含 Intel 与 Apple Silicon）与 Linux x64（AppImage）。无需额外环境，下载安装即可使用。Linux x64 的 AppImage 与 deb 由 Beta 通道构建；稳定通道在 Linux 上只产出可运行的目录产物，不提供安装包。

| 平台 | 下载 | 安装方式 |
| --- | --- | --- |
| Windows x64 | [下载安装程序](https://www.nonead.com/software/ndsh-desktop/downloads/windows) | 运行 NSIS 安装程序并按提示完成安装 |
| macOS Universal | [下载 DMG](https://www.nonead.com/software/ndsh-desktop/downloads/mac) | 打开 DMG，将 Nonead DSH Desktop 拖入 Applications |
| Linux x64 | [下载 AppImage](https://www.nonead.com/software/ndsh-desktop/downloads/linux) | 赋予执行权限后运行：`chmod +x Nonead-DSH-Desktop-*.AppImage && ./Nonead-DSH-Desktop-*.AppImage` |

Linux 说明：部分发行版需要先安装 FUSE，或改用 `--appimage-extract-and-run` 运行；应用内更新在 Linux 上**只检查版本、不下载安装包**，升级请重新下载 AppImage。需要 Linux 安装包时请使用 Beta 通道（稳定通道在 Linux 上只产出可运行的目录产物）。

详细步骤、profile 与插件命令见[用户指南](docs/user-guide.md)，平台与使用边界问题见[常见问题](docs/faq.md)。

<a id="features"></a>

## 核心能力

| 能力 | 说明 |
| --- | --- |
| 原生桌面封装 | 单实例锁、原生窗口与菜单、系统托盘、Dock 图标；窗口材质按平台能力收敛（macOS 支持 `off`/`transparent`（默认 `transparent`），Linux 接受两者但一律解析为 `off`，Windows 只接受 `off`） |
| 本地 Host 托管 | 壳自动以 Node 模式 spawn Host 子进程并托管其生命周期：先请求优雅退出，10 秒未退 `SIGTERM`，再 5 秒未退 `SIGKILL`；安装更新要求优雅退出成功，否则拒绝安装 |
| 官方 Web UI | 默认只绑定 `127.0.0.1`、端口由系统分配；壳为每个 Host generation 生成 32 字节随机凭据，经 `x-dsh-desktop-renderer` 头下发 |
| Profile 与首次设置 | profile 目录为 `$DSH_HOME/profiles/<name>`；未初始化的 profile 首次启动会先显示 Desktop 自带的 Setup Wizard（窗口模式与材质、插件市场、通知、是否用系统默认浏览器打开、Web 访问范围），完成或跳过后才启动 Host |
| 浏览器与局域网访问 | 「用浏览器打开」只影响是否自动唤起系统浏览器，不改变暴露范围；局域网访问是独立开关，开启后显示当前可用的局域网 URL |
| 内置插件市场 | DSH Community Market 提供发现 / 可安装 / 已安装 / 来源四个视图，支持可扩展的目录来源与受审 adapter |
| 品牌皮肤 | `dsh-nonead-client-skin` 随安装包分发，由 Profile 组合为每个 Profile 默认加载，不需要单独安装 |
| 自动更新 | 固定版本检查请求 `https://www.nonead.com/software/ndsh-desktop/version`，携带当前版本、通道与随机安装标识；Windows / macOS 下载并安装，Linux 仅检查 |
| 更新体验 | 更新卡片展示服务端下发的发行说明，Beta 通道的托盘菜单与原生对话框还会附「查看完整说明」入口；支持"跳过此版本"（决策持久化，无人值守的定时检查不会重复提示）；安装失败可重试，并可回滚到任一已保存快照 |
| 窗口与会话状态 | 记住窗口位置与尺寸；恢复时校验窗口仍与已挂载显示器相交，拔掉外接屏不会把窗口还原到屏外 |
| 深链接与开机自启 | 支持 `dsh-desktop://` 深链接，例如 `dsh-desktop://settings/general` 直接打开设置页；开机自启开关读取系统实际状态 |
| 环境变量文件 | 支持严格 `.env` 分层文件，只补齐 Host 子进程缺失的变量，不覆盖已有环境 |
| 市场增强 | 插件市场支持非图片媒体预览，并支持按名字安装插件 |
| 终端与工作目录 | 桌面壳提供终端能力与工作目录选择，并把它们以 Desktop 服务的形式暴露给插件 |
| 实验能力 | onboarding 默认启用插件市场与 Computer Use；语音、翻译、Agent Team、Ralph 等随运行时提供 |

<a id="security"></a>

## 安全边界

| 边界 | 实际行为 |
| --- | --- |
| 渲染器身份 | 只有携带当前 generation 凭据（`x-dsh-desktop-renderer`）的请求被当作 Electron 渲染器；关闭普通浏览器访问时，其余请求返回 403，已有浏览器 WebSocket 会被主动断开 |
| 渲染器凭据的传递 | 凭据只存在于主进程与 Host 进程内存；Host 启动时由它自己的**私有 stdin** 收下一行并立即关闭，不进子进程环境变量、argv 或任何文件（旧实现放环境变量，同用户进程可从进程环境或崩溃转储读到后冒充渲染器） |
| Web 访问门禁 | Host 拿不到凭据时**失败即拒绝**浏览器侧请求并记一条 warn，不再 fail-open 放行；`/connect` 登录交换与只读请求按代码内注释豁免，Market 路由读也要连接凭据 |
| 局域网访问 | **不提供鉴权**：同一局域网内任何人只要能连上端口，就可以打开 DSH 并操作这台电脑。仅在完全信任的网络中开启 |
| 更新安装包校验 | 下载路径支持服务端发布的 `installerSha256` 并按硬门禁执行，但当前版本端点尚未发布该字段；在此之前 Windows 只校验 PE 版本资源里的 `ProductName` 与 `ProductVersion`，macOS 则校验 bundle 标识、内嵌 manifest、代码签名与 Team Identifier；这套身份校验只存在于稳定壳，Beta 壳的下载侧只校验安装包魔数与大小，随后直接执行安装包 |
| 插件侧写错 | 补丁的 `id` 不匹配会记录 `entry not found` 并跳过；`name` 不符会记录 `name mismatch ... skipping`；但插件的 `inject` 服务名写错**不会报错**，该插件永远 pending，界面表现为莫名的 HTTP 4xx |

<a id="docs"></a>

## 文档

普通用户从[用户指南](docs/user-guide.md)开始即可；开发者文档只在需要扩展或维护时阅读。完整索引见[文档索引](docs/README.md)。

### 用户文档

| 目标 | 入口 |
| --- | --- |
| 安装、profile、模式、终端、插件命令与更新 | [用户指南](docs/user-guide.md) |
| 支持平台、内置环境、数据、插件与更新的直接回答 | [常见问题](docs/faq.md) |
| 了解项目为什么存在 | [为什么做 Nonead DSH Desktop](docs/why-desktop.md) |
| 查看版本变更记录 | [更新日志](CHANGELOG.md) |

### 开发者与维护者文档

| 目标 | 入口 |
| --- | --- |
| 桌面壳、Host 子进程、Web carrier 与打包关系 | [架构说明](docs/architecture.md) |
| 编写普通或 Desktop 插件 | [插件开发](docs/plugin-development.md) |
| 阅读插件生态倡议书 | [DSH 插件生态倡议书](docs/plugin-ecosystem.md) |
| 使用 `desktopProfiles` / `desktopPnpm` 等 Desktop 服务 | [桌面插件接口说明](dsh-plugin-desktop-beta/docs/plugin-services.zh.md) |
| 参与统一插件 contract 讨论 | [DSH Community Fabric Draft](dsh-community-fabric/README.zh.md) |
| 查看插件市场的产品与安全设计 | [DSH Community Market](dsh-community-market/README.zh.md) |
| 查阅包级构建、发布与已知限制 | [`dsh-plugin-desktop-beta/README.md`](dsh-plugin-desktop-beta/README.md) |
| 了解稳定通道工作区的独立壳 | [`nonead-dsh-desktop/README.zh.md`](nonead-dsh-desktop/README.zh.md) |
| 查看品牌皮肤插件 | [`dsh-nonead-client-skin/README.md`](dsh-nonead-client-skin/README.md) |

<a id="layout"></a>

## 仓库结构

根目录是一个 Yarn `4.18.0` workspace（`nodeLinker: node-modules`），成员与职责如下：

| 路径 | 职责 |
| --- | --- |
| `nonead-dsh-desktop/` | 稳定通道桌面工作区：独立壳（Profile 与恢复、window controls、onboarding）、Agents Anywhere bridge 与 Community Market 适配、Electron bootstrap 与打包 |
| `dsh-plugin-desktop-beta/` | Beta 通道桌面工作区：Cordis Host / Client 双面、Electron bootstrap、packaging 与发布测试 |
| `dsh-community-market/` | 内置插件市场的产品与安全设计、catalog provider contract、测试与构建 |
| `dsh-community-fabric/` | 社区互操作 RFC：Manifest/Capability、Runtime/Presentation、service composition 与溯源诊断提案 |
| `dsh-nonead-client-skin/` | 随包分发的品牌皮肤，通过 `file:` 依赖引入，不属于根 workspace 列表 |
| `vendor/dsh-runtime/<版本>/` | 按通道 vendored 的 DSH 运行时包与 `manifest.json` |
| `vendor/agents-anywhere/` | Agents Anywhere bridge 的 vendored 包 |
| `patches/` | Yarn patch：Electron 打包器、pnpm、`open`、`fs-ext`、DSH 子进程等 |
| `scripts/` | 根级门禁与发布脚本（双语文档、市场依赖方向、vendored runtime、图标、layout、AA 发布） |
| `docs/` | 产品文档；`docs/evidence/` 存放发布与安装器相关的实测记录 |
| `deepseek-harness/` | 上游只读子模块，pin 与 `upstream.json` 的 `channels.beta.commit` 一致 |

**子模块不是日常开发的必需品**：运行时已 vendored，`corepack yarn install`、`build`、`typecheck`、`test`、`dev:*`、`dist:*` 都不需要它；只有 `upstream:*` 脚本（重新构建并打包运行时）需要初始化的子模块。而 `corepack yarn check:layout` 会校验子模块的 commit 与工作树状态，因此在未初始化的克隆里它必然失败，这属预期。

<a id="dev"></a>

## 从源码开发

### 环境要求

- Node.js `^22.19.0` 或 `>=24.0.0`
- 根 Yarn `4.18.0`（经 Corepack，不要用 pnpm 或 npm 安装根依赖）
- Git；只有需要重新构建运行时时才初始化上游子模块

```sh
git clone https://github.com/NoneadChina/Nonead-DSH-Desktop.git
cd Nonead-DSH-Desktop
corepack yarn install
corepack yarn dev:beta     # Beta 工作区
# corepack yarn dev:stable # 稳定通道工作区（nonead-dsh-desktop）
```

需要上游源码时再执行：

```sh
git submodule update --init --recursive
```

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `corepack yarn dev:beta` / `dev:stable` | 启动对应工作区的开发流程（会先刷新 `dshmarket`、准备 AA 产物并构建市场） |
| `corepack yarn build` | 构建市场、Beta 与稳定通道工作区（同样会先刷新 `dshmarket`） |
| `corepack yarn typecheck` | 三个工作区的类型检查 |
| `corepack yarn test` | 三个工作区的单元测试 |
| `corepack yarn check` | 完整 headless 门禁：layout、架构方向、vendored runtime、双语文档、AA connector、各工作区 check |
| `corepack yarn check:ci` | CI 实际执行的链：与 `check` 相同，但 Beta 工作区走 `check:ci`（去掉上游尚未修复的 `verify:aa`），不再在 CI 里改写 manifest |
| `corepack yarn check:layout` | 工作区拓扑、精确 pin、子模块、vendored runtime 与图标/布局门禁 |
| `corepack yarn check:bilingual-docs` | 校验 `*.i18n.yaml` 记录的 Git blob 哈希与对应文档一致 |
| `corepack yarn check:vendored-runtime` | 校验 `vendor/dsh-runtime/` 与 `upstream.json` 一致 |
| `corepack yarn market:prepare` / `market:check` | 把 `dshmarket` 同步到 npm `latest`（只改两个桌面 workspace 的 `resolutions`/依赖与 `yarn.lock`），后者只校验不写入 |
| `corepack yarn aa:prepare-release` / `aa:check` | 构建或校验 Agents Anywhere 发布产物 |
| `corepack yarn package:dir:beta` | 生成未打包的应用目录 |
| `corepack yarn dist:win:beta` / `dist:mac:beta` / `dist:win-portable:beta` | 生成对应平台的发布产物 |

约定：

- 根 `build`、`dev:*`、`dist:*` 会先运行 `corepack yarn market:prepare`，因此 `dshmarket` 版本、lockfile 与兼容性补丁要一起提交。
- `nonead-dsh-desktop` 与 `dsh-plugin-desktop-beta` 是**两个独立工作区**：共享改动需要在两边分别落地，并保持各自声明的差异；发布前跑 `corepack yarn check` 与两边各自的 check。
- 修改 `README.md`、`README.en.md` 或 `CHANGELOG.md` 等双语文件后，必须同步 `*.i18n.yaml` 里的 Git blob 哈希（用 `git hash-object` 取），否则 `check:bilingual-docs` 会失败。
- `corepack yarn check:layout` 需要已初始化的子模块；纯 headless 环境里若只验证业务代码，可单独跑 `typecheck` / `test` / 工作区 `check`。
- **CI 不能由被审代码自己决定跑什么**：`changes` 作业先把 `scripts/` 恢复成 **PR 基线**那版再跑分类器与文档/市场门禁（文档仍取工作树），`workflow_dispatch` 没有基线时回退 head 并打一条 warning。CI 跑的是 `corepack yarn check:ci`（= 本地 `check` 去掉 `verify:aa`），不再在运行时改写 `dsh-plugin-desktop-beta/package.json`。
- **版本一致性是门禁的一部分**：`scripts/verify-layout.mjs` 要求两个工作区的 `version` 都等于 `CHANGELOG.md` 最新的 `## <版本> — <日期>` 标题，发版时漏改任一侧都会失败。

<a id="release"></a>

## 发布与更新

- **两种产物**：由两个桌面工作区分别产出，Beta 与稳定通道的安装包标识、产物前缀与更新通道不同，不能混用。
- **通道协议**：版本检查请求 `https://www.nonead.com/software/ndsh-desktop/version`，在 `X-DSH-Desktop-Version` 上报当前版本、`X-DSH-Desktop-Channel` 上报 `stable` / `beta`、`X-DSH-Desktop-Installation-Id` 上报本机生成并持久化的随机 UUID。安装包下载携带 `channel` 与 `X-DSH-Desktop-Target-Version`，但不携带安装标识或当前版本。
- **通道校验**：服务端响应必须回显通道；稳定通道只接受正式 SemVer，Beta 通道只接受 `-beta.N`，客户端不会静默跨通道下载。
- **版本一致性**：上传的产物、裸下载地址的"版本 → 文件"映射、版本端点上报的版本号三处必须同版本，否则表现为 404 而不是装错版本。
- **发布前置**：`corepack yarn aa:prepare-release` 与 `corepack yarn market:prepare` 需要先跑；Windows 分发命令还会用 `--verify-release` 校验 AA 产物。

<a id="plugins"></a>

## 插件生态

插件是给 DSH 添加能力的扩展包——模型、工具、界面、工作流都可以做成插件，像搭积木一样组合。Nonead DSH Desktop 没有修改上游源码，也不是一个写死的外壳：固定版本的上游原样运行，桌面壳本身作为 DSH 插件接入，并通过同一条"一切皆插件"的规则组合进同一个运行时。

对插件作者而言，关心三件事即可：

1. **普通 DSH 插件**与在任何 DSH 环境里一样开发，见[插件开发](docs/plugin-development.md)。
2. **Desktop 服务**（`desktopProfiles`、`desktopPnpm` 等）让插件查看/切换工作配置、安装/更新/移除插件，见[桌面插件接口说明](dsh-plugin-desktop-beta/docs/plugin-services.zh.md)。
3. **组合与补丁**：profile 的组合是补丁层叠加，`id` 按 row id 命中、`insert` 追加新行；注意上一节"[安全边界](#security)"里"写错静默失效"的三种表现。

生态共建的愿景与三条原则见[DSH 插件生态倡议书](docs/plugin-ecosystem.md)；统一插件 contract 的社区提案见 [Community Fabric](dsh-community-fabric/README.zh.md)。

<a id="upstream"></a>

## 与上游的关系

Nonead DSH Desktop 是基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 与 Cordis 插件思想构建的独立社区项目，由 **Nonead Corporation** 开发与维护。

上游提供核心的智能体能力、插件系统、Web UI 与运行时包；本仓库负责：

- 桌面应用封装（Electron 主进程、窗口、托盘、菜单、材质）
- 本地 Host 服务的启动、停止、恢复与崩溃兜底
- Profile 与补丁层、首次设置向导、浏览器/LAN 访问控制
- 插件市场与品牌皮肤的随包分发
- Windows / macOS / Linux 的构建、签名与发布流程，以及自动更新

若只想通过命令行使用 DeepSeek Harness 或参与其核心开发，请直接查看上游仓库。

<a id="changelog"></a>

## 更新日志

完整版本记录见[更新日志](CHANGELOG.md)（[English](CHANGELOG.en.md)）。最近三个版本摘要：

| 版本 | 日期 | 要点 |
| --- | --- | --- |
| `2.1.15` | 2026-10-22 | 更新卡片/托盘/原生对话框展示发行说明，可跳过版本、安装失败重试与快照回滚；记住窗口位置、`.env` 分层、`dsh-desktop://` 深链接与开机自启；市场支持非图片媒体预览与按名字安装；`dshmarket` `1.66.45` |
| `2.1.16` | 2026-10-22 | 安全与门禁修复：CI 门禁用 PR 基线侧脚本执行、Electron fuses 收紧（关 `NODE_OPTIONS`/`--inspect`，稳定壳改为只从 `app.asar` 加载，`runAsNode` 因 Host/CLI/pnpm shim 依赖而保留，验证脚本按布局逐项断言）、渲染器凭据改用私有管道注入、Web 门禁改为失败即拒绝、深链接动作白名单、密钥遮盖补 base64url；稳定壳 `asarUnpack` 与 `files[].from` 的耦合改由测试按前缀推导锁定（实测确认现有 pattern 正确）、补稳定壳打包 CI、版本一致性纳入 `verify-layout` |
| `2.1.13` | 2026-10-21 | 运行时切到 DSH `0.2.1-rc.2`，`dshmarket` `1.66.44`，AA bridge `39b82d4`，新的 boot 字标与 onboarding 取 API Key 引导，队列满时丢弃 AA 事件而非崩溃 |

<a id="limits"></a>

## 已知限制

- **Linux 应用内更新只检查版本**，不下载安装包；升级需重新下载 AppImage。
- **Windows 安装包尚未做密码学摘要校验**：下载路径支持服务端 `installerSha256`，但当前版本端点未发布该字段，在此之前只校验 PE 版本资源中的 `ProductName` / `ProductVersion`（仅稳定壳；Beta 壳只校验安装包魔数与大小，随后直接执行）。
- **局域网访问无鉴权**，等同于把本机 DSH 交给同网段所有人。
- **插件 `inject` 服务名写错会静默 pending**，不产生警告，只表现为相关接口 4xx。
- 本机 `yarn install` 可能改写 `yarn.lock` 中 `dsh-nonead-client-skin` 的内容指纹（跨机器不可复现），**不要提交这类本机产出的锁文件改动**。

<a id="community"></a>

## 社区交流

- Discord：[加入 Nonead DSH Desktop 社区](https://discord.gg/TJeGqKRNM)
- 企业微信与 QQ 群：加入后私信 @王博升Benson，或邮件索取入群方式
- 想加入技术团队：联系 [t4wefan@qq.com](mailto:t4wefan@qq.com)

<a id="links"></a>

## 友情链接

DeepSeek Harness 生态项目与开发者工具：

| 项目 | 简介 | 链接 |
| --- | --- | --- |
| dshfind | DeepSeek Harness（DSH）学习与分享社区。 | [GitHub](https://github.com/hikariming/dshfind) · [官网](https://dshfind.com) |
| DSH 1024Store | 面向 DSH 生态的社区插件目录，并开源了在线插件市场、目录流水线与公开查询 API。 | [GitHub](https://github.com/imsai-sh/awesome-deepseek-harness-plugins) |
| Awesome DSH Plugin | DeepSeek Harness（DSH）插件精选列表。 | [GitHub](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) |
| dsh-market | DSH 内的可视化插件市场，支持浏览、搜索与一键安装。 | [GitHub](https://github.com/dsh-market/dsh-market) |
| ModLens | 为 DSH 和纯文本 Coding Agent 提供 OCR、版面与语义识别能力。 | [GitHub](https://github.com/liustack/modlens) |
| DeepSeek Harness 橙皮书 | DeepSeek Harness 社区实测手册。 | [GitHub](https://github.com/alchaincyf/deepseek-harness-orange-book) |
| dsh-web-ui | DeepSeek Harness Web UI 插件与皮肤合集。 | [GitHub](https://github.com/zhu1090093659/dsh-web-ui) |
| dsh-TUI | DeepSeek Harness 全屏交互式终端界面。 | [GitHub](https://github.com/ccch1mneyyy/dsh-TUI) |
| dsh-context | DSH 上下文洞察面板：Context 仪表盘、`/context` 命令与浏览器。 | [GitHub](https://github.com/bowenliang123/dsh-context) |
| Agents-Anywhere | 从手机远程控制电脑上的 Coding Agent。 | [GitHub](https://github.com/anywhere-labs/Agents-Anywhere) |
| DSH-better-sidebar | DSH 侧边栏工作台，集成文件、终端、Git 和子代理。 | [GitHub](https://github.com/omdsh-dev/DSH-better-sidebar) |
| Awesome DeepSeek Harness | DSH 插件、工具与基础设施精选列表。 | [GitHub](https://github.com/0xsline/awesome-deepseek-harness) |

<a id="license"></a>

## License

版权所有 © 2026 **Nonead Corporation**。本项目遵循 [MIT License](LICENSE)。

> "DeepSeek Harness" 是深度求索公司的注册商标。本文仅为准确说明兼容性、技术来源及与上游软件的关系而使用该名称。

> 本项目完全开源免费。如果有人向您以任何形式出售此软件，请拒绝交易。

> Nonead DSH Desktop 是独立的社区项目，与深度求索不存在隶属、合作、授权或背书关系。
