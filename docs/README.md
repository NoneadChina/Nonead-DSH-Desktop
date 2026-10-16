# Nonead DSH Desktop 文档

[English documentation](README.en.md)

这里是 Nonead DSH Desktop 的产品与开发文档入口。根目录的 [`README.md`](../README.md) 适合第一次了解项目；本目录解释项目为什么存在、如何使用，以及如何为 Desktop 编写插件。想参与贡献？见[参与贡献](../CONTRIBUTING.md)。

## 按目标阅读

普通用户从[用户指南](user-guide.md)开始即可，不需要阅读开发者文档。

### 用户文档

| 文档 | 你会得到什么 |
| --- | --- |
| [用户指南](user-guide.md) | 安装、profile、模式、终端、插件命令和更新 |
| [常见问题](faq.md) | 支持平台、内置环境、官方边界、数据、插件和更新的直接回答 |
| [隐私政策](../PRIVACY.zh.md) | 官方更新、下载、本地数据、第三方服务与用户选择 |
| [为什么做 Nonead DSH Desktop](why-desktop.md) | Desktop 与官方 Harness 的边界，以及为什么坚持插件化 |

### 开发者与维护者文档

| 文档 | 你会得到什么 |
| --- | --- |
| [插件生态倡议书](plugin-ecosystem.md) | 开放、可组合、可持续的插件生态愿景与三条原则 |
| [插件开发](plugin-development.md) | 普通 DSH 插件、Desktop 服务、双面包（Host + 浏览器半边）、Profile 补丁与生命周期 |
| [Community Fabric Draft](../dsh-community-fabric/README.zh.md) | 从 Manifest/Capability 基础，到 Runtime/Presentation、service composition 和溯源诊断的社区互操作提案 |
| [Fabric 社区意见处置记录](../dsh-community-fabric/docs/research/community-issue-23-review.zh.md) | Issue #23 中哪些建议已采纳、拆成独立 RFC、延期或不进入可移植核心 |
| [Fabric 框架与插件需求调研](../dsh-community-fabric/docs/research/mature-plugin-frameworks.zh.md) | Koishi、Chrome、VS Code 的成熟模式，以及真实 DSH 插件的功能需求 |
| [VS Code 扩展模型调研](../dsh-community-fabric/docs/research/vscode-extension-model.zh.md) | VS Code 已实现的声明、Provider、UI、运行位置和生命周期模式，以及它们对 Fabric RFC 的具体约束 |
| [Community Market](../dsh-community-market/README.zh.md) | 内置插件市场的发现/可安装/已安装/来源四个视图、可扩展目录来源、安装确认和安全边界 |
| [Market 目录提供方合同](../dsh-community-market/docs/catalog-provider-contract.zh.md) | 面向实现团队的 Schema、query 参数、多来源和适配器规范 |
| [架构说明](architecture.md) | Electron、Host、Web carrier、profile 和打包之间的关系 |
| [Desktop service 参考](../dsh-plugin-desktop-beta/docs/plugin-services.md) | `desktopProfiles`、`desktopPnpm` 的稳定 contract 和 TypeScript 示例 |
| [Beta 包级参考](../dsh-plugin-desktop-beta/README.md) | Beta 工作区（`dsh-plugin-desktop-beta`）的构建、运行、发布和已知限制 |
| [Nonead 工作区说明](../nonead-dsh-desktop/README.zh.md) | Nonead DSH Desktop 工作区（`nonead-dsh-desktop`）的独立壳、Profiles 与恢复，以及 Agents Anywhere bridge 和 Community Market 适配 |
| [品牌皮肤插件](../dsh-nonead-client-skin/README.md) | 随安装包分发的 `dsh-nonead-client-skin`：由 Profile 组合为每个 Profile 默认加载 |

## README 文件怎么分工

目前外层仓库有两份正式的产品 README，另保留一个旧链接兼容入口：

- [`README.md`](../README.md)：中文产品入口。
- [`README.en.md`](../README.en.md)：英文产品入口，与中文 README 保持同一产品范围。
- [`README.zh.md`](../README.zh.md)：旧中文路径的兼容页，不维护独立内容。

`README.i18n.yaml` 只记录这两个正式入口的双语 hash，不是用户指南。`dsh-plugin-desktop-beta/README.md` 和 `dsh-plugin-desktop-beta/README.zh.md` 是 npm 包随包发布的包级参考；它们比根 README 更技术化。`nonead-dsh-desktop/README.md`（英文）与 `nonead-dsh-desktop/README.zh.md`（中文）介绍 Nonead DSH Desktop 工作区。`dsh-plugin-desktop-beta/docs/` 是稳定 API 合同，不是营销页。`.agents/notes/implemented/` 是日期化的维护者决策记录，适合追溯取舍，不替代用户文档。

`deepseek-harness/` 是固定版本的官方上游子模块：活动通道为 `beta`，当前 pin 为 DSH `0.2.1-alpha.4`，随附 vendored 运行时 `vendor/dsh-runtime/0.2.1-alpha.4/`，两个通道的记录都在根 `upstream.json`。它自己的 README 和 `docs/` 属于上游项目，不能当作 Desktop 文档，也不在本仓库的产品文档统计中。

## 状态约定

文档会明确区分已实现能力、平台限制和 roadmap。Desktop 的兼容模式在独立 Desktop frame 下保留上游默认 Web 客户端；扩展窗口安装自己独立注册的 Desktop layout/sidebar surface，并在倒 L 中承载官方 occupant；增强模式保留独立 root registration 与紧凑内部 caption。Desktop frame 会按系统能力提供原生材质。插件市场 [`dsh-community-market`](../dsh-community-market/README.zh.md) 已内置，可在 Profile 的 bundles 中选择，并与 `dsh-market` 互斥；手机远程控制仍是 roadmap，不代表当前安装包已经提供该产品入口。
