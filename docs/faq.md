# Nonead DSH Desktop 常见问题

本页回答安装、平台、运行环境、插件、更新与网络相关的常见疑问，针对当前版本 2.2.2。功能范围以[最新 GitHub Release](https://github.com/anywhere-labs/deepseek-harness-desktop/releases/latest)和[用户指南](user-guide.md)为准；具体的界面操作与限制在用户指南里写得更细。

## Nonead DSH Desktop 是什么？

Nonead DSH Desktop 是面向 Windows 和 macOS 的开源 DeepSeek Harness 桌面客户端。它把官方 Harness 的本地 Web 界面、Host 服务和插件系统装进原生应用，并提供窗口、系统托盘、终端、更新、Profile 管理，以及内置的 DSH Community Market 插件市场。

## 这是 DeepSeek 官方产品吗？

不是。Nonead DSH Desktop 是社区维护的独立开源项目，不隶属于 DeepSeek，也未获得 DeepSeek 官方背书。项目名称仅用于说明它与官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的技术关系。

## 支持哪些操作系统？

正式安装包的发行脚本覆盖 Windows x64 与 universal macOS（Intel 与 Apple Silicon）；Linux x64 的 AppImage 与 Debian 包由 CI 的 `desktop-linux` 作业调用 Beta 工作区构建，只支持 x64。Linux 上应用内更新只检查版本、不下载安装包，升级需要重新下载 AppImage。

## 需要先安装 Node.js、pnpm 或 DSH 吗？

不需要。安装包已经包含 Electron、Node.js、pnpm 和固定版本的 DSH 运行时（当前为 DSH `0.2.2-alpha.2`）。下载安装后即可启动，Desktop 也不会修改系统全局 PATH 或用户的 shell 配置。

## 首次启动需要联网下载运行环境吗？

不需要。运行时与固定版本的依赖已经随安装包提供，安装包因此偏大，换来的是确定的首次启动与版本组合。首次启动会在本机准备默认 Profile 并启动本地 Web 界面；只有使用云端模型、检查更新、访问插件市场时才需要网络。

## 会修改官方 Harness 吗？

不会。仓库以一个固定的上游 commit 原样引入未修改的官方 Harness（Beta 通道 pin 为 `f3803c96974ad4a94195fb97e5c637e9c2a3afe3`，对应 DSH `0.2.2-alpha.2`，记录在根 `upstream.json`）。兼容模式在独立桌面框下运行上游默认 Web 客户端；扩展窗口与增强模式通过插件与 Profile 组合的边界安装桌面侧自己的根注册，并继续承载官方占用者。所有模式都不直接修改上游源码。

## 数据保存在本地吗？

Host、Profile 与 DSH home 都在本机。是否把内容发送到外部服务取决于你配置的模型或工具提供商；使用云端模型时，相应请求仍会发送给该提供商。窗口位置（`window-state.json`）、跳过的版本、更新缓存与日志保存在应用自己的用户数据目录。

## 怎么安装插件？

使用官方 Harness 的插件体系。从托盘打开 DSH 终端后运行 `dsh plugin add`、`dsh plugin remove` 与 `dsh plugin update`；命令默认作用于当前激活的 Profile，也可以用 `--profile <name>` 显式指定。插件变更后需要重启应用。

## 插件市场支持哪些操作？

内置的 DSH Community Market 可以浏览与安装插件，在 Profile 的 bundle 中与 `dsh-market` 二选一。市场支持预览非图片媒体（例如视频），也支持按名字安装插件。首次启动向导里选过的市场方案会被记住，包括“不启用市场”；重新进入向导不会再次追问。品牌皮肤插件 `dsh-nonead-client-skin` 随安装包分发，由 Profile 组合为每个 Profile 默认加载。

## Desktop profile 和已有 profile 会自动同步吗？

不会自动复制插件。每个 Profile 有自己的 bundle 与依赖组合，切换 Profile 后终端里的默认插件命令会作用于当前 Profile。官方 Profile 默认共用同一个 DSH home，因此会话、设置与存储通常无需迁移；某个 Profile 的补丁若主动改写持久化根目录，则以该 Profile 的配置为准。Profile 配置的读、改、写由单一写入者串行执行，同时保存多个设置不会互相覆盖。

## 可以在启动时直接打开某个文件夹吗？

可以，但只有 DSH Desktop Beta 支持：运行 `dsh-desktop-beta <文件夹>`，或把文件夹拖到 Beta 的快捷方式上。文件夹会被注册为工作区并打开，已经是工作区的只会再次打开；这是一次性行为，后续由设置触发的重启不会再打开它。Nonead DSH Desktop 目前只能在界面内选择目录。

## 关掉窗口为什么应用没退出？

托盘可用时，关闭窗口默认只是隐藏窗口，Host 与本地服务继续运行。要真正退出请使用托盘菜单里的退出操作，或先关闭“关闭到托盘”的偏好。托盘不可用时，关闭最后一个窗口即退出。

## 换了显示器后窗口位置会乱吗？

不会跑到屏幕外。应用会记住窗口的位置与尺寸（含最大化状态），恢复前校验保存的位置是否仍与已挂载的显示器相交：至少要有 160×80 像素可见，否则退回默认尺寸 1280×840；即使相交也会把窗口推回工作区内部，所以拔掉外接屏或改变缩放不会还原到屏外。

## 怎么让应用开机自启？

在设置里打开“开机自启”。这个开关读取的是操作系统记录的实际状态，而不是应用另存的一份副本；系统不允许登记时开关显示为关闭。安全模式与恢复模式下无法修改。也可以直接改操作系统自身的启动项，应用的开关会照实反映结果。

## 能从链接或脚本直接打开设置吗？

可以。应用注册了 `dsh-desktop://` 协议，`dsh-desktop://settings/general` 会打开设置页；链接的第一段是动作名，其余段作为路径转给界面。窗口尚未就绪时链接会排队等界面加载完成再投递，没有可识别动作的链接被忽略。

## 应用如何更新？

打包后的应用在后台检查版本（端点 `https://www.nonead.com/software/ndsh-desktop/version`），请求头携带安装版本、通道（`stable` 或 `beta`）与本机生成并持久保存的安装标识。后台检查失败是静默的，不会打断使用；发现新版本也只更新托盘状态，不会自行弹出下载确认。托盘的更新项按通道手动检查并给出结果。Nonead DSH Desktop 下载到应用缓存并校验后安装；DSH Desktop Beta 先打开原生保存对话框选择安装包位置，取消则不会开始下载。版本响应可以携带发行说明，设置里的更新卡片会显示“更新说明”，Beta 的下载确认对话框里也会带上。安装包下载地址固定为 `https://www.nonead.com/software/ndsh-desktop/downloads/mac` 与 `.../windows`，下载请求及其重定向不携带安装标识或当前版本。

## 不想装某个新版本怎么办？

在更新卡片里选择“跳过此版本”。选择会写入应用数据目录并持久保存，后台定时检查不会再提示这个版本，重启应用也依然有效；选择“不再跳过”可以清除记录让它重新参与提示。发布更新的版本后本来就会照常提示。

## 更新失败或新版本有问题怎么办？

下载或安装失败不会影响当前运行版本。安装失败时托盘与更新卡片提供“重试安装”，已下载并准备好的安装包会保留，重试不需要重新下载。已经装上新版本但发现问题时，可以在恢复助手里回滚到已保存的配置快照——可选的快照不只最近一次成功启动，还包括安装与插件变更、Profile 修复之前保存的快照；每次回滚前都会先备份当前配置，所以回滚本身也能再撤销。

## 安装包会校验签名吗？

当前 Windows 只比对 PE 版本资源里的 `ProductName` 与 `ProductVersion`，没有密码学校验，也不校验证书或发布者（2.1.15 撤销了此前引入的签名与发布者校验）。macOS 会校验磁盘映像内应用的身份、版本与签名团队。以上身份校验只存在于稳定壳；Beta 壳的下载侧只校验安装包魔数与大小，随后直接执行安装包。服务端发布 SHA-256 摘要后，下载路径会强制校验摘要。如果你需要更强的来源保证，请从官方下载页获取安装包，并核对发布页给出的校验信息。

## 应用会走我的系统代理吗？

会。启动时应用通过 Chromium 读取操作系统的代理配置——Windows 的 Internet 选项、macOS 的网络设置、Linux 的桌面设置，包含自动配置脚本（PAC/WPAD）——并把它应用到自己发出的请求上：模型对话、网页抓取、联网搜索、MCP 服务、插件安装，以及应用启动的终端命令。在 Clash、v2rayN 这类客户端里打开“系统代理”开关就够了。几条规则：

- **自己设的代理优先**：启动前设置了 `HTTPS_PROXY`、`HTTP_PROXY` 或 `ALL_PROXY`（包括写在 `.env` 里），应用就用你设的那个；`NO_PROXY` 同样生效。
- **改完代理要重启应用**：代理配置只在启动时读取一次，在代理客户端里开关系统代理或切换节点后，请退出应用再打开。
- **纯 SOCKS 的配置用不了**：应用的 HTTP 出口只认 `http://` 与 `https://` 代理；系统代理只配了 SOCKS 时，请在客户端里启用 HTTP 或混合端口。
- **本机地址不走代理**：`localhost`、`127.0.0.1` 与本机局域网地址会绕过代理。
- **macOS 与 Linux 从 Dock 或访达启动时不读 shell 配置里的代理变量**：这是刻意的，代理地址里可能带账号密码；请改用系统代理设置，或从终端启动应用。
- **怎么确认生效**：每次启动的日志里有一行 `outbound proxy = ...`，其中 `source` 为 `system`、`environment` 或 `none`；日志在应用数据目录的 `logs/` 下，也可以用“导出诊断”打包出来。

## `.env` 会覆盖我的系统环境变量吗？

不会。应用读取自身用户数据目录下的 `.env`（开发态还读仓库根目录的 `.env`），这一层只补齐 Host 子进程缺失的变量：已经存在的环境变量优先，文件不会覆盖真实环境，`process.env` 本身也不被改写。语法是严格的 `KEY=VALUE`，不支持变量展开、转义与行内注释；同名键取第一次赋值，每个被跳过的行都会在诊断日志里记一条警告。

## 右侧「文件」这类面板一直报 HTTP 4xx，怎么排查？

常见原因是某个已启用的插件在启动时缺少它依赖的服务，于是一直停在 pending 状态：它要注册的路由从未出现，界面上的请求就拿到 4xx。在数据目录的 `logs/` 里搜索 `pending (waiting for service:`（数据目录默认 `~/.dsh`，日志默认在 `~/.dsh/logs/`），命中行会给出插件名和它缺少的服务名：

```text
better-sidebar (dsh-better-sidebar): pending (waiting for service: webRuntime)
```

用“导出诊断”也能拿到同一批日志。停用该插件（或在 DSH 终端里执行 `dsh plugin remove`）并重启应用，官方面板即可恢复。

## 在哪里下载和报告问题？

从[项目下载页](https://www.dshdesktop.cn/)或[最新 GitHub Release](https://github.com/anywhere-labs/deepseek-harness-desktop/releases/latest)下载安装包。遇到问题先查看[用户指南](user-guide.md)的排查部分，仍无法解决再提交 [GitHub Issue](https://github.com/anywhere-labs/deepseek-harness-desktop/issues/new/choose)，并附上操作系统、应用版本、复现步骤和错误信息；涉及网络时请附上日志里的 `outbound proxy = ...` 那一行。

## 相关文档

- [用户指南](user-guide.md)
- [为什么做桌面版](why-desktop.md)
- [架构](architecture.md)
- [插件开发](plugin-development.md)
- [文档索引](README.md)
