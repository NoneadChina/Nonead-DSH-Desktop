# Nonead DSH Desktop 用户指南

## 安装与首次启动

从产品下载入口获取 macOS 或 Windows 安装包。安装后的 Nonead DSH Desktop 自带运行所需的 Electron、Node 和 DSH 依赖，普通用户不需要另行安装 Node.js 或 pnpm。

首次启动时，应用会准备默认 profile，并在本机启动官方 DSH Web surface。关闭窗口通常只会隐藏窗口；可以从托盘重新打开，选择 **退出** 才会结束应用和 Host 进程。

## 用文件夹启动

用文件夹启动属于 DSH Desktop Beta（工作区 `dsh-plugin-desktop-beta`）；Nonead DSH Desktop 目前只能在界面里选择目录。

除了在界面里选择目录，还可以在启动时直接指定一个文件夹。该文件夹会被注册为工作区并自动打开；如果它已经是工作区，则直接打开，不会重复创建。

- **Windows 拖放**：把文件夹拖到桌面快捷方式或开始菜单里的 **DSH Desktop Beta** 图标上。应用没运行时会先启动，已经在运行时会抬到前台并打开这个工作区。
- **命令行**：运行 `dsh-desktop-beta <文件夹>`；`dsh-plugin-desktop-beta` 是同一个 npm 启动器的另一个命令名。相对路径按当前目录解析。安装后的 EXE 同样接受一个文件夹参数。

路径不存在、指向的是文件，或者位于 exFAT、FAT32、网络盘等不受支持的存储上时，应用会弹出原生提示并且不注册该工作区。用文件夹启动是一次性的：之后由设置触发的重启不会再次打开它。

已知限制：Windows 任务栏上固定的图标暂不接受拖放（需要注册文件夹关联）；Linux 只支持命令行；macOS 暂不支持这两种方式。

## Profile

Profile 是一组 DSH bundle、依赖和 patch 的组合。托盘中的 **Profile** 菜单会列出现有 profile，以及可按需创建的 `desktop` 和 `web` 默认 profile。

选择 profile 后应用会有序重启。DSH Desktop Beta 会在 Host、窗口和浏览器客户端都成功启动后，才把新 profile 记录为最近一次可用选择，启动失败会回到上一次可用选择；Nonead DSH Desktop 在启动失败时进入恢复流程，可以从托盘的 **恢复助手…** 回退到最近一次成功启动的配置（当前配置会先备份）。官方 profile 默认使用同一个 DSH home，所以 sessions、settings 和 storage 通常不需要迁移。自定义配置（patch）如果主动改写持久化路径，则以该 profile 自己的设置为准。

切换 profile 不会把旧 profile 的插件偷偷复制到新 profile。要管理目标 profile，请在终端中显式写出 profile，或者在切换后使用终端里的默认命令。

## 窗口模式与材质

窗口模式在代码里的标识是 `compatibility`、`extended` 和 `advanced`。DSH Desktop Beta 的托盘提供 **模式：兼容模式 / 模式：扩展窗口 / 模式：增强模式** 子菜单切换这三种模式；Nonead DSH Desktop 固定使用兼容模式（`compatibility`），不提供切换。

- **兼容模式（`compatibility`）**：保持 profile 的官方 layout/sidebar/conversation 组合完整，并把它放在独立的 36 像素 Desktop frame 下方。frame 可以拖动，图标操作仍可点击，官方 dialog 只会占用与 frame 无关的下方内容 viewport。
- **扩展窗口（`extended`）**：安装 Desktop 自有 layout 与 sidebar surface，并在其中承载官方 sidebar、conversation 和 details occupant。36 像素顶部 frame 与左侧 sidebar surface 组成一个带圆角内拐角的倒 L 材质区域。
- **增强模式（`advanced`）**：保留独立 root registration 与紧凑内部 caption；macOS 使用 20 像素内容 inset 和 32 像素拖动区域，Windows 使用 32 像素 caption row，不复用扩展窗口的独立 frame。

macOS 可以打开或关闭透明材质（`macosMaterial`）。Windows 不提供材质选项，始终使用不透明窗口。旧版 Windows 亚克力和 Mica 偏好都会安全地按关闭处理，其中亚克力还会在设置文件可写时自动迁移。切换模式或材质都会重启应用，不会在正在运行的 renderer 中热替换 root slot 或窗口材质。Linux 只提供兼容模式。

## 本地 Web 端口

两个产品的本地 Web 端口都可以在设置里固定；未固定时，Nonead DSH Desktop 的偏好默认 `port: 0`（由系统分配），DSH Desktop Beta 则从默认端口 43120 开始，该端口被占用时会依次尝试后续端口（最多 32 次）。依赖浏览器 `localStorage` 的界面插件按 origin 隔离数据；如果这类插件需要在 Desktop 重启后继续读取设置，请指定一个固定端口：

- **Nonead DSH Desktop**：在“桌面设置”里填写端口，值保存在数据目录（默认 `~/.dsh`）下的 `desktop-preferences.json`。
- **DSH Desktop Beta**：端口是 DSH 设置文档里 Desktop shell 配置节的 `port`；该配置节名是 Loader entry id `desktop-shell`（0.1.6 时代的旧节名 `dsh-desktop` 会被自动迁移）：

```yaml
desktop-shell:
  port: 43189
```

端口必须是 `0` 到 `65535` 之间的整数（`0` 表示由系统分配）。修改后应用会有序重启。服务默认只监听 `127.0.0.1`；只有在“桌面设置”中确认危险提示并明确允许局域网访问后，才会改为监听所有网络接口。固定端口如果已被其他程序占用，Nonead DSH Desktop 将无法启动，此时需要释放该端口，或把设置改回 `0` 或另一个空闲端口；DSH Desktop Beta 会自动改用后续端口，不会因此启动失败。

## 插件管理

插件是给 DSH 添加能力的扩展包，例如模型、工具、界面和工作流。Nonead DSH Desktop 使用的就是官方 Harness 的插件体系，官方插件可以直接安装使用；多个插件遵循统一的约定，可以一起安装、一起工作。

普通 DSH 插件仍使用官方 CLI 语义：

```sh
dsh plugin --profile desktop add <plugin>
dsh plugin --profile desktop remove <plugin>
dsh plugin --profile desktop update
```

在 Desktop 托盘打开的终端中，裸 `dsh` 和不带 `--profile` 的 plugin 命令默认使用当前激活 profile：

```sh
dsh plugin add <plugin>
dsh plugin remove <plugin>
dsh plugin update
```

显式 `--profile <name>` 始终优先。插件变更后需要重启应用，才能让新的 bundle 进入 Loader 组合。

## 打开终端

可以从托盘或“桌面设置”选择 **打开 DSH 终端**（`Open DSH Terminal`）；DSH Desktop Beta 的 Desktop frame 也提供这个入口。设置中的旁边提供重启下拉菜单，可以普通重启或 **重启到恢复模式**，两种操作都必须确认。macOS 会打开 Terminal；Windows 会优先使用 Windows Terminal，找不到时依次回退到 PowerShell 7、Windows PowerShell 或命令提示符。

欢迎信息会显示：应用版本、当前 profile、profile 目录和 DSH home。Desktop 会在自己的 user-data 目录生成 `dsh`、`pnpm` 和 `node` 私有 shim，只对这个终端进程设置 PATH，不会修改系统 PATH 或用户 shell 配置。

## 更新

打包后的 macOS/Windows 应用会在后台检查 `https://www.nonead.com/software/ndsh-desktop/version`。请求头会带上当前安装版本（`X-DSH-Desktop-Version`）、发行通道（`X-DSH-Desktop-Channel`，取 `stable` 或 `beta`）和本机生成并持久保存的随机安装标识（`X-DSH-Desktop-Installation-Id`）。后台检查不阻塞启动；网络错误、非 200、非法版本或服务端版本不新时保持静默。发现新版本时，应用会更新托盘，不会自动弹出下载确认；DSH Desktop Beta 还会为每个版本发送一次非阻塞系统通知，点击通知会显示 Desktop。

托盘的更新项是当前发行通道的手动检查：Nonead DSH Desktop 走 `stable` 通道，只接收稳定更新；DSH Desktop Beta 走 `beta` 通道，只接收 Beta 更新。即使已经是当前版本，也会显示结果；检查失败会提示稍后重试。DSH Desktop Beta 还提供 **安装稳定版…**（`Install Stable Edition…`），它会在保留 Beta 的同时安装稳定版。用户取消不会访问计数下载入口。

确认下载后的行为按产品不同：

- **DSH Desktop Beta**：应用会先打开原生的“保存更新安装包”对话框，默认建议保存到 Downloads；你可以改用其他目录和文件名，取消对话框则不会开始下载。保存后应用才会请求当前平台的固定下载地址，并记录安装包位置。macOS 会打开 DMG，由用户把应用替换到 Applications；Windows 会准备 NSIS 安装器，再询问是否退出并启动安装。升级完成并重新启动后，应用会询问是否删除安装包以释放磁盘空间，也可以选择保留。
- **Nonead DSH Desktop**：应用不打开保存对话框，安装包直接下载到自己的 user-data 缓存目录，并在安装前校验它（macOS 校验磁盘映像里应用的身份、版本和签名团队；Windows 只校验 PE 版本资源里的 `ProductName` 与 `ProductVersion`）。随后 macOS 交给系统更新器安装并重启，Windows 直接运行下载到的 NSIS 安装器。

两个产品使用的下载地址都是固定的：`https://www.nonead.com/software/ndsh-desktop/downloads/mac` 与 `https://www.nonead.com/software/ndsh-desktop/downloads/windows`。下载和安装失败不会破坏当前版本，托盘仍可重试。已知限制：服务端发布 SHA-256 摘要后，下载路径会强制校验摘要；在摘要发布之前，Windows 更新安装包只校验 PE 版本资源中的 `ProductName` 与 `ProductVersion`。

## 排查

Desktop 的确认、警告与操作结果会打开独立、基于 shadcn 的桌面级模态窗口，而不是侵入官方页面的 overlay。DSH Desktop Beta 的恢复窗口会先展示进入原因，再提供 **插件管理**、**回滚**、**切换配置** 与 **诊断** 四个 Tab；它与新增 Profile 窗口顶部的 utility frame 都不会重复显示标题。Nonead DSH Desktop 的 **恢复助手…** 打开的是桌面设置里的恢复页。

- **应用能够进入托盘**：右键托盘图标，选择 **导出诊断信息…**。确认隐私提示后，DSH Desktop Beta 会生成 `diagnostics-*.zip` 并在文件管理器中显示它；Nonead DSH Desktop 会让你选择保存位置，导出一个 `nonead-dsh-desktop-diagnostics-*.json`。
- **应用持续闪退，无法进入托盘**：在 PowerShell 中直接运行安装后的程序并加上恢复参数，把下面的 EXE 路径换成你机器上的实际路径（可以在开始菜单快捷方式的“属性 → 目标”里看到；修改过安装目录时同样需要替换）。

  ```powershell
  & "<实际安装目录>\DSH Desktop Beta.exe" --export-diagnostics
  ```

  `--export-diagnostics` 由 DSH Desktop Beta 提供；通过 npm 安装时还可以运行 `dsh-desktop-beta --export-diagnostics`。这个命令不会启动 Host、profile、插件或窗口；完成后会在终端输出诊断 ZIP 的绝对路径。
- **诊断包内容（DSH Desktop Beta）**：包含最近的应用日志、本地 Crashpad `.dmp`、当前运行标记和 `system-info.txt`。系统信息会记录 Desktop、Electron、Node、平台和架构版本。日志会对可识别的认证凭据脱敏，但本地路径、工作区 ID、会话 ID 和崩溃时的内存片段仍可能存在。公开上传前必须检查；不适合公开的 dump 应通过可信渠道提供。
- **窗口消失了**：先检查系统托盘，关闭窗口不是退出。
- **插件没有出现**：确认命令作用于目标 profile，并重启应用。
- **终端命令找不到**：从托盘重新打开 Desktop 终端；系统 shell 的全局 PATH 不会被 Desktop 修改。
- **右侧“文件”这类面板一直报 HTTP 4xx**：常见原因是某个已启用的插件缺少它依赖的服务，于是一直停在 pending 状态——它要注册的路由从未出现，界面上的请求就拿到 4xx。在数据目录的 `logs/` 文件夹里搜索 `pending (waiting for service:`（数据目录默认 `~/.dsh`，所以日志默认在 `~/.dsh/logs/`）；命中行会给出插件名和它缺少的服务名，例如 `better-sidebar (dsh-better-sidebar): pending (waiting for service: webRuntime)`。停用该插件并重启应用，官方面板即可恢复。
- **更新没有提示**：后台错误会静默；使用托盘手动检查查看结果。

更底层的生命周期、打包和平台限制属于开发者文档，见[文档索引](README.md)。
