# Nonead DSH Desktop 文档

[English documentation](README.en.md)

这里是 Nonead DSH Desktop 的产品与开发文档入口，对应产品版本 **2.1.18**。根目录的 [`README.md`](../README.md) 负责"这是什么、能做什么、怎么装"；本目录解释项目为什么存在、怎么用得更顺，以及如何为 Desktop 编写插件。版本变更见[更新日志](../CHANGELOG.md)。

## 按目标阅读

普通用户从[用户指南](user-guide.md)开始即可，不需要阅读开发者文档。

### 用户文档

| 文档 | 你会得到什么 |
| --- | --- |
| [用户指南](user-guide.md) | 安装与首次启动、用文件夹启动、Profile、窗口模式与材质、本地端口、插件管理、终端、更新与排查 |
| [常见问题](faq.md) | 支持平台、内置运行时、与官方的关系、数据存放、插件、代理与更新通道的直接回答 |
| [为什么做 Nonead DSH Desktop](why-desktop.md) | 与官方 Harness 的边界、为什么坚持插件化、Desktop 自己提供什么、刻意不做什么 |
| [更新日志](../CHANGELOG.md) | 每个版本的用户可见变化、行为边界变化与已知问题 |

### 开发者与维护者文档

| 文档 | 你会得到什么 |
| --- | --- |
| [架构说明](architecture.md) | 壳、Host 子进程、Web carrier、Profile 与补丁层、打包与运行时闭包、发行通道协议 |
| [插件开发](plugin-development.md) | 两类插件、Desktop service 的真实形状、双面包（Host + 浏览器半边）、Profile 补丁、生命周期、测试与依赖分类 |
| [插件生态倡议书](plugin-ecosystem.md) | 开放、可组合、可持续的插件生态愿景与三条原则 |
| [Community Fabric Draft](../dsh-community-fabric/README.zh.md) | 从 Manifest/Capability 基础，到 Runtime/Presentation、service composition 和溯源诊断的社区互操作提案 |
| [Fabric 社区意见处置记录](../dsh-community-fabric/docs/research/community-issue-23-review.zh.md) | Issue #23 中哪些建议已采纳、拆成独立 RFC、延期或不进入可移植核心 |
| [Fabric 框架与插件需求调研](../dsh-community-fabric/docs/research/mature-plugin-frameworks.zh.md) | Koishi、Chrome、VS Code 的成熟模式，以及真实 DSH 插件的功能需求 |
| [VS Code 扩展模型调研](../dsh-community-fabric/docs/research/vscode-extension-model.zh.md) | VS Code 已实现的声明、Provider、UI、运行位置和生命周期模式，以及它们对 Fabric RFC 的具体约束 |
| [Community Market](../dsh-community-market/README.zh.md) | 内置插件市场的发现/可安装/已安装/来源四个视图、可扩展目录来源、安装确认和安全边界 |
| [Market 目录提供方合同](../dsh-community-market/docs/catalog-provider-contract.zh.md) | 面向实现团队的 Schema、query 参数、多来源和适配器规范 |
| [Desktop service 参考](../dsh-plugin-desktop-beta/docs/plugin-services.md) | `desktopProfiles`、`desktopPnpm` 的稳定 contract 和 TypeScript 示例 |
| [Beta 包级参考](../dsh-plugin-desktop-beta/README.md) | Beta 工作区（`dsh-plugin-desktop-beta`）的构建、运行、发布和已知限制 |
| [Nonead 工作区说明](../nonead-dsh-desktop/README.zh.md) | Nonead DSH Desktop 工作区（`nonead-dsh-desktop`）的独立壳、Profiles 与恢复，以及 Agents Anywhere bridge 和 Community Market 适配 |
| [品牌皮肤插件](../dsh-nonead-client-skin/README.md) | 随安装包分发的 `dsh-nonead-client-skin`：由 Profile 组合为每个 Profile 默认加载 |
| [实测证据存档](evidence/) | 发布与安装行为的日期化实测记录（Windows 安装器升级、NSIS A/B 方法），是历史证据，不随版本更新 |

## 文档命名与双语约定

- 本目录的成对文档是 `X.md`（中文）与 `X.en.md`（英文），两侧内容等价，改动必须成对进行。
- `*.i18n.yaml` 记录成对文件的 Git blob 哈希。`docs/` 的七对文档、根 `README`/`CHANGELOG` 与各子包 README 都已记录（当前 57 条记录，覆盖 114 个文档）。校验器只遍历 `git ls-files` 命中的记录，新增的 `*.i18n.yaml` 必须先 `git add` 才会被检查；`corepack yarn check:bilingual-docs` 会校验哈希一致，改文档后必须按 [`README.md` 的"从源码开发"](../README.md#从源码开发) 一节重算哈希。
- 仓库根的 `README.md` 是中文、`README.en.md` 是英文；子包的口径相反（`README.md` 英文、`README.zh.md` 中文），引用时按目录判断。

## README 文件怎么分工

外层仓库有两份正式的产品 README，另保留一个旧链接兼容入口：

- [`README.md`](../README.md)：中文产品入口。
- [`README.en.md`](../README.en.md)：英文产品入口，与中文 README 保持同一产品范围。
- [`README.zh.md`](../README.zh.md)：旧中文路径的兼容页，不维护独立内容。
- [`CHANGELOG.md`](../CHANGELOG.md) / [`CHANGELOG.en.md`](../CHANGELOG.en.md)：版本更新日志（中英成对）。

`dsh-plugin-desktop-beta/README.md` 与 `dsh-plugin-desktop-beta/README.zh.md` 是 npm 包随包发布的包级参考，比根 README 更技术化；`nonead-dsh-desktop/README.md`（英文）与 `nonead-dsh-desktop/README.zh.md`（中文）介绍 Nonead DSH Desktop 工作区；`dsh-plugin-desktop-beta/docs/` 是稳定 API 合同，不是营销页；`.agents/notes/implemented/` 是日期化的维护者决策记录，适合追溯取舍，不替代用户文档。

`deepseek-harness/` 是固定版本的官方上游子模块：活动通道为 `beta`，当前 pin 为 DSH `0.2.1-rc.3`（`1f81c047`），随附 vendored 运行时 `vendor/dsh-runtime/0.2.1-rc.3/`；另一个通道 `stable` 记录为 DSH `0.2.0-rc.2`（`639ed015`）。两个通道的记录都在根 `upstream.json`。常规构建、类型检查与测试**不需要**该子模块，只有 `corepack yarn upstream:*` 需要上游源码。它自己的 README 与 `docs/` 属于上游项目，不能当作 Desktop 文档。

## 状态约定

文档会明确区分**已实现能力**、**平台限制**与**未实现项**，三类都用直白措辞写出，不用"即将支持"含糊带过：

- 窗口有三种模式：`compatibility`（兼容模式，在 Desktop 独立窗口框架里运行未修改的上游默认 Web 客户端）、`extended`（扩展模式，额外安装 Desktop 自己的 layout/sidebar surface，并在倒 L 布局里承载官方 occupant）、`advanced`（保留独立 root registration 与紧凑的内部 caption）。历史配置里的其他取值都按 `compatibility` 处理。
- 原生材质按平台能力提供：macOS/Linux 接受 `off`/`transparent`，Windows 只接受 `off`（历史 `acrylic`/`mica` 一律读作 `off`）。
- 插件市场 [`dsh-community-market`](../dsh-community-market/README.zh.md) 已内置，可在 Profile 的 bundles 中选择，并与 `dsh-market` 互斥。
- 手机远程控制（Agents Anywhere bridge）随包分发，但仍按可选能力对待：它是桥接通道，不代表当前安装包已经提供完整的远程控制产品入口。
- 具体的实现缺口（`Resources/runtime` 解释器树未纳入封印、`runtime.json` 的 `payloadDigest` 只写不校验、Windows 安装包尚无密码学校验、Linux 不自动下载安装包等）集中写在[架构说明的"已知限制"](architecture.md#已知限制)与[更新日志的"已知问题"](../CHANGELOG.md#已知问题)里。
