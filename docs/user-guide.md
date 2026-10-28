# Nonead DSH Desktop 用户指南

本指南面向安装并使用 Nonead DSH Desktop 的普通用户，覆盖安装与首次启动、窗口与托盘、Profile、插件、终端、更新与排查。稳定版 Nonead DSH Desktop 的行为是本文基准；涉及 Beta 版（DSH Desktop Beta，另一个安装包与产品标识）的差异会单独标出。当前产品版本为 2.1.15。

## 安装与首次启动

从产品下载页获取 macOS 或 Windows 安装包。安装包已内置 Electron、Node.js、pnpm 与固定版本的 DSH 运行时（当前为 DSH `0.2.2-alpha.2`，随包提供，无需联网下载），普通用户不必单独安装 Node.js 或 pnpm。

首次启动会准备默认 Profile，并在本机启动官方 DSH Web 界面。首次启动向导依次介绍欢迎、插件市场、远程控制、Computer Use 与恢复模式；向导里选择的市场方案会被记住（选择“不启用市场”同样会被记住），重新进入向导不会重复询问。托盘可用时，关闭窗口默认只是隐藏窗口，退出请使用托盘菜单中的退出操作。

## 用文件夹启动（Beta）

只有 DSH Desktop Beta 支持启动时带文件夹：文件夹会被注册为工作区并打开，已经是工作区的文件夹只是再次打开，不会重复注册。Nonead DSH Desktop 只能在界面内选择目录。

```sh
dsh-desktop-beta <folder>
```

`dsh-plugin-desktop-beta` 是同一个 npm 启动器的另一个命令名，相对路径按当前目录解析；已安装的 EXE 也接受一个文件夹参数。路径不存在、指向文件，或位于 exFAT、FAT32、网络盘等不受支持的存储上时，应用给出原生提示并且不注册任何内容。带文件夹启动只生效一次，从设置里触发的重启不会再次打开该文件夹。

已知限制：固定到 Windows 任务栏的 Beta 图标尚不接受拖放；Linux 只支持命令行方式；macOS 暂不支持这两种入口。

## 窗口、托盘与开机自启

应用记住主窗口的位置与尺寸（含最大化状态），下次启动尽量还原。还原前会校验保存的位置是否仍与已挂载的显示器相交：至少要有 160×80 像素可见，否则退回默认尺寸 1280×840；即使相交，窗口也会被推回工作区内部，因此拔掉外接屏或改变缩放后不会还原到屏幕外。位置保存在应用数据目录的 `window-state.json`。

托盘菜单集中了打开设置、检查更新、切换 Profile、恢复助手、打开 DSH 终端与退出等入口；Beta 另有窗口模式子菜单和安装稳定版的入口。托盘不可用时，关闭最后一个窗口即退出应用。

设置里提供“开机自启”开关。它读取的是操作系统记录的实际状态，而不是应用另存的一份副本；写入后会回读确认，系统不允许登记时开关显示为关闭。安全模式与恢复模式下该开关不可修改。

应用的确认、警告与操作结果以独立原生对话框（或原生设置的独立窗口）呈现，不占用官方页面内部的浮层。

## Profile 与恢复

Profile 是 DSH bundle、依赖与补丁的组合。托盘的 Profile 菜单列出已有 Profile，以及按需创建的 `desktop`、`web` 两个默认项。选中某个 Profile 会执行一次有序重启；Beta 只有在 Host、窗口与浏览器客户端都成功启动后，才把新 Profile 记为可用选择，启动失败则回到之前的可用选择；Nonead DSH Desktop 启动失败时进入恢复流程，托盘中的恢复助手可以回滚到最近一次成功启动的配置（回滚前先备份当前配置）。

可回滚的快照不止“最近一次成功启动”：安装与插件变更、Profile 修复之前保存的快照同样可用，恢复界面默认列出最近的健康快照，也接受指定任意一条已存快照。每次恢复前都会先为当前状态留一份快照并逐个校验快照内容，因此这次回滚本身也可以再回滚。

Profile 配置的读取、修改与写回由单一写入者串行执行，多个设置项同时保存不会互相覆盖或写出半截文件。切换 Profile 不会把旧 Profile 的插件静默复制到新 Profile：需要另一套插件时，在终端里显式指定 Profile 准备。官方 Profile 通常共用同一个 DSH home，会话、设置与存储无需迁移；若某个 Profile 的补丁刻意改写持久化根目录，则以该 Profile 的配置为准。

## 窗口模式与材质

三种窗口模式分别标识为 `compatibility`、`extended` 与 `advanced`。Beta 通过托盘的窗口模式子菜单切换；Nonead DSH Desktop 固定使用兼容模式（`compatibility`），不提供切换。

- **兼容模式**：在独立的 36 像素桌面框下完整保留所选 Profile 的官方布局、侧边栏与会话组合。框可拖动、框上图标可点击，官方对话框仍留在下方的内容视口内。
- **扩展窗口**：安装桌面侧自己的布局与侧边栏界面，再把官方侧边栏、会话与详情占用者托管进去；36 像素顶框与左侧边栏形成带内圆角的倒 L 材质区域。
- **增强模式**：保留独立的根注册与紧凑的内部标题：macOS 为 20 像素内容内缩加 32 像素拖动区，Windows 为 32 像素标题行，不复用扩展窗口的独立框。

macOS 可以开关透明材质；Windows 没有材质选项，始终使用不透明窗口，历史上的 Acrylic / Mica 偏好一律按关闭处理。切换模式或材质会重启应用，不会在运行中的渲染器里热替换根插槽或原生材质。Linux 只提供兼容模式。

## 本地 Web 端口

两个产品都允许在设置里固定本地 Web 端口。不指定时，Nonead DSH Desktop 默认 `port: 0`（由操作系统分配），Beta 从默认端口 43120 开始，被占用时依次尝试后续端口（最多 32 次）。浏览器 `localStorage` 按 origin 隔离，把设置存在 `localStorage` 里的界面插件需要固定端口，才能在桌面端重启后读到同一份设置。

- **Nonead DSH Desktop**：在桌面设置里填端口，值保存在数据目录（默认 `~/.dsh`）下的 `desktop-preferences.json`。
- **DSH Desktop Beta**：端口是 DSH 设置文档中桌面壳分节的 `port`，该分节以 Loader 条目 id `desktop-shell` 为键（0.1.6 的旧名 `dsh-desktop` 会自动迁移）：

```yaml
desktop-shell:
  port: 43189
```

端口必须是 `0` 到 `65535` 之间的整数（`0` 表示由系统分配）。修改端口会执行一次有序重启。服务默认只绑定 `127.0.0.1`，只有在桌面设置里确认危险提示并显式允许后才会监听所有网络接口。固定端口已被别的程序占用时，Nonead DSH Desktop 无法启动，需要释放该端口或把设置改回 `0` 或其它可用端口；Beta 则顺延到下一个端口而不是启动失败。

## 插件管理与插件市场

插件用于给 DSH 增加模型、工具、界面与工作流等能力。Nonead DSH Desktop 使用与官方 Harness 相同的插件体系，官方插件可以直接安装使用，多个插件遵循同一套约定，可以一起安装。

```sh
dsh plugin --profile desktop add <plugin>
dsh plugin --profile desktop remove <plugin>
dsh plugin --profile desktop update
```

在托盘打开的终端里，不带 `--profile` 的 `dsh plugin` 命令默认作用于当前激活的 Profile；显式给出 `--profile <name>` 时始终以显式值为准。插件变更后需要重启应用，新的 bundle 才会进入 Loader 组合。

内置的 DSH 社区市场提供插件浏览与安装，它和 `dsh-market` 在同一 Profile 的 bundle 中互斥；品牌皮肤插件 `dsh-nonead-client-skin` 随安装包分发，由 Profile 组合为每个 Profile 默认加载。市场支持预览非图片媒体（例如视频），也可以直接按名字安装插件；市场数据与安装记录随 Profile 保存。

## 打开终端

从托盘或桌面设置选择“打开 DSH 终端”即可；Beta 还额外提供桌面框上的入口。设置里的这一项旁边带有重启菜单，可执行普通重启或“以恢复模式重启”，两者都需要确认。macOS 打开终端应用；Windows 依次优先 Windows Terminal、PowerShell 7、Windows PowerShell，最后回退到命令提示符。

终端欢迎信息显示应用版本、当前 Profile、Profile 目录与 DSH home。桌面端在自身的用户数据目录里创建私有的 `dsh`、`pnpm`、`node` shim，并把该目录只前置到新终端进程的环境中，不修改系统 PATH，也不改动用户的 shell 配置文件。

## 设置入口与深链接

设置页包含通用、Profile（含新建 Profile）、工具、恢复与权限等区域，更新卡片位于通用区域。应用注册了 `dsh-desktop://` 协议，可以直接从浏览器、快捷方式或脚本打开指定页面：

```text
dsh-desktop://settings/general
```

链接的第一段是动作名，其余段作为路径转给界面（例如上面这条打开设置）。也接受 `dsh-desktop:open` 这类单段形式。窗口尚未就绪时会先排队，等界面加载完成再投递；应用没有可识别的动作时链接被忽略。macOS 通过系统 `open-url` 事件接收，Windows 与 Linux 通过协议启动参数接收。

## 更新

安装版 macOS 与 Windows 应用会在后台请求 `https://www.nonead.com/software/ndsh-desktop/version`，请求头携带已安装版本（`X-DSH-Desktop-Version`）、发布通道（`X-DSH-Desktop-Channel`，取 `stable` 或 `beta`）以及本地随机生成并持久保存的安装标识（`X-DSH-Desktop-Installation-Id`）。检查不阻塞启动；网络错误、非 200 响应、非法版本号、服务端版本不比当前新都不打扰用户。发现新版本只更新托盘状态，不会自行弹出下载确认；Beta 会额外发一条不阻塞的系统通知，点击通知可让桌面端现身。

托盘的更新项按当前发布通道手动检查：Nonead DSH Desktop 跟随 `stable` 通道，只收到稳定更新；Beta 跟随 `beta` 通道。即使已是最新版本也会给出结果，检查失败会提示可重试。Beta 还提供“安装稳定版”，把稳定版与 Beta 并排安装；取消任何一步都不会请求计数下载端点。

版本响应可以携带发行说明与说明链接。设置里的更新卡片会显示“更新说明”，并可打开完整说明；Beta 在下载确认的原生对话框里也会带上发行说明。确认下载后的流程按产品不同：

- **DSH Desktop Beta**：先打开原生的“保存更新安装包”对话框，默认指向下载目录，可改目录与文件名，取消对话框不会开始下载。确认目标后才请求固定平台下载地址并记住安装包位置。macOS 打开 DMG 让用户替换“应用程序”里的副本；Windows 准备 NSIS 安装包，然后询问是否退出并开始安装。升级完成并重新启动后，会询问删除安装包释放磁盘还是保留。
- **Nonead DSH Desktop**：不弹保存对话框，安装包下载到应用自己的用户数据缓存并校验后再安装。macOS 交由系统更新器完成安装与重启，Windows 直接运行下载的 NSIS 安装包。

两个产品使用相同的固定下载地址：`https://www.nonead.com/software/ndsh-desktop/downloads/mac` 与 `https://www.nonead.com/software/ndsh-desktop/downloads/windows`。下载或安装失败不会影响当前版本，托盘操作可以重试；已下载的安装包会保留，重试安装无需重新下载。安装失败后也可以回滚到已保存的配置快照（见“Profile 与恢复”）。

更新检查还提供跳过与恢复：

| 操作 | 行为 |
| --- | --- |
| 跳过此版本 | 该版本不再参与后台提示，选择写入应用数据目录，重启后依然有效 |
| 不再跳过 | 清除跳过记录，该版本重新参与提示；后续发布的新版本本来就会照常提示 |
| 重试安装 | 复用已下载并准备好的安装包，不重新下载 |
| 安装并重启 | 在已准备就绪时执行安装 |

当前校验口径如下。macOS 会校验磁盘映像内应用的身份、版本与签名团队；Windows 当前只比对 PE 版本资源中的 `ProductName` 与 `ProductVersion`，**没有密码学校验，也不校验证书或发布者**（2.1.15 撤销了此前引入的签名与发布者校验）。以上身份校验只存在于稳定壳；Beta 壳的下载侧只校验安装包魔数与大小（Windows `MZ`/`PE\0\0`，macOS 磁盘映像尾标 `koly`），随后直接执行安装包。下载路径在服务端发布 SHA-256 摘要后才会强制校验摘要。Linux 上的应用内更新只检查版本，不下载也不安装安装包，升级请重新下载 AppImage。

## 配置文件与环境变量

应用会读取自身用户数据目录下的 `.env`，开发态额外读取仓库根目录的 `.env`。这一层只用于补齐 Host 子进程缺失的变量：已经存在的环境变量（包括更具体的 `.env` 层）优先，文件永远不会覆盖真实环境，`process.env` 本身也不会被改写。

`.env` 的语法是严格的 `KEY=VALUE`，不支持变量展开、转义或行内注释：

- 整行以 `#` 开头的是注释，空行忽略；
- 一个键只取第一次赋值，后面的重复赋值不生效；
- 值两端若有一对匹配的引号会被去掉，引号不配对则整行忽略；
- 每个被跳过的行都会在诊断日志里记一条警告；
- Windows 上变量名大小写不敏感，同名变量只保留一个。

## 排查

- **应用还能进托盘**：右键托盘图标导出诊断。Beta 生成 `diagnostics-*.zip` 并在文件管理器中定位；Nonead DSH Desktop 会先询问保存位置，导出 `nonead-dsh-desktop-diagnostics-*.json`。诊断包含最近的日志，Beta 还包含 Crashpad `.dmp` 与 `system-info.txt`；日志中的可识别凭据会被打码，但本地路径、工作区与会话 ID、崩溃时的内存片段可能残留，公开上传前请先检查。
- **托盘出现前就反复崩溃**（Beta）：直接运行已安装的可执行文件并加上恢复参数，路径替换为本机真实路径。

  ```powershell
  & "<实际安装目录>\DSH Desktop Beta.exe" --export-diagnostics
  ```

  该命令不启动 Host、Profile、插件或窗口，完成后打印诊断 ZIP 的绝对路径；npm 安装也可以用 `dsh-desktop-beta --export-diagnostics`。
- **界面里某个操作报错**：原生页面的未处理错误与 Promise 拒绝会显示在提示区，而不是只写进开发者工具控制台。
- **右侧“文件”等面板持续返回 HTTP 4xx**：常见原因是启用的插件缺少它依赖的服务而长期处于 pending，它要注册的路由没有出现。在数据目录的 `logs/` 里搜索 `pending (waiting for service:`（数据目录默认 `~/.dsh`，即 `~/.dsh/logs/`），命中的行会写出插件名与缺失的服务，例如 `better-sidebar (dsh-better-sidebar): pending (waiting for service: webRuntime)`。禁用该插件并重启即可恢复官方面板。
- **窗口不见了**：检查系统托盘，关闭窗口不是退出应用。
- **插件没生效**：确认命令作用在预期的 Profile 上，并重启应用。
- **终端里找不到命令**：从托盘重新打开一个桌面终端；桌面端不修改全局 PATH。
- **没有收到更新提醒**：后台检查失败是静默的，用托盘或设置里的手动检查查看结果。

更底层的生命周期、打包与平台限制属于开发文档，见 [文档索引](README.md)。

## 相关文档

- [常见问题](faq.md)
- [为什么做桌面版](why-desktop.md)
- [架构](architecture.md)
- [插件开发](plugin-development.md)
- [插件生态](plugin-ecosystem.md)
- [文档索引](README.md)
