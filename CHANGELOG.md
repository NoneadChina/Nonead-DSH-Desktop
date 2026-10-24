<p align="center">
  <strong>Nonead DSH Desktop · 更新日志</strong><br>
  <sub>中文 · <a href="CHANGELOG.en.md">English</a></sub>
</p>

# 更新日志

本文件记录 Nonead DSH Desktop 面向用户的版本变更。每个版本都对应两个桌面工作区（`nonead-dsh-desktop` 与 `dsh-plugin-desktop-beta`）同步提升的版本号；版本号同时出现在安装包文件名、更新端点的响应与裸下载地址的映射中，三者必须一致。

维护约定：

- 每次发布在两份文件里各加一条（`CHANGELOG.md`、`CHANGELOG.en.md`），并刷新 `CHANGELOG.i18n.yaml` 记录的 Git blob 哈希，否则 `corepack yarn check:bilingual-docs` 会失败。
- 条目只写"用户能感知的变化"与"维护者必须知道的边界变化"；纯重构不单独成条。
- 更早的历史见 Git 标签（`v1.7.3`、`v2.0.7`、`v2.0.8`、`v2.1.3`、`v2.1.4`、`v2.1.5`）与提交记录。

## 2.1.17 — 2026-10-24

审查修复批次（运行时与依赖口径不变，DSH runtime 仍是 `0.2.1-rc.2`）：

- 恢复助手：后台诊断导出与用户操作并发刷新同一文档时，前一次导航会以 `ERR_ABORTED` 失败；该失败在非用户动作路径上可能被 fail-loud 升级为整个应用退出。刷新现在串行化，窗口销毁导致的导航失败按正常结束处理，动作路径的异常只记为诊断。
- 检查点读取与降级：manifest 与备份文件改为打开后复核 inode（`O_NOFOLLOW` + `fstat`），在 `lstat` 与读取之间被替换的路径不再被信任；任一槽位损坏不再让快照列表整体失败，而是标记为“无法读取”，在恢复页可见但不可操作，轮转会把坏槽当作下一个覆盖目标。
- 设置写入：`settings.yaml` 与 Profile 的 `pnpm-workspace.yaml` 改为临时文件 + rename 发布，写入中断只会留下旧内容或新内容，不再产生半个 YAML 导致下次启动丢失设置。
- 更新：响应体在超限与解码失败路径统一释放；macOS 在安装阶段开始前就标记握手，退出时不会删除正在被本地 feed 读取的安装包；恢复助手里用户主动选择“退出”不再被当成启动失败（成功码），启动失败仍保持非零。
- 插件与状态存储：插件状态读取复核 inode；陈旧数据锁回收容忍并发 `ENOENT`；损坏状态的守卫改为检查它实际保护的文件；崩溃遗留的运行时 staging 目录在下次发布前清理。
- 稳定壳：托盘发起的更新检查结果对话框归属主窗口，不再可能被窗口遮住而丢失选择；Computer Use 开关把 `cancelled` 与 `failed` 同等视为失败；浏览器 guest 关闭有界化（1.5 s 后强制退场，再 0.5 s 兜底），lease 先释放，`browserRelease` 不再永久悬挂。
- 社区市场与皮肤：被打断的分页请求不再让“加载更多”永久停在 loading；市场浮层关闭后归还焦点；皮肤样式声明 `data-plugin`，避免被随后加载的插件认领并在其卸载时删除；插件包名文法与 Host 对齐。
- 门禁与 CI：`upstream-command-windows` 补 `yarn install`（`check:layout` 需要已安装依赖）；变更分类关闭改名检测，源码改名为文档不再绕过产品门禁；`inspector` 兼容测试改为以仓库根锚定。
- 打包链：稳定壳的 `verify:safe-cleanup` 改为把 Electron 子进程的 `TEMP` 指向工作区内可写目录（本机 Electron 44 在 `%TEMP%` 下建目录会被拒绝），预检不再在生成安装包之前中断。

## 2.1.16 — 2026-10-22

安全加固与门禁修复（一次完整审核的结果）：

- CI 的变更分类与文档/市场门禁改为**用 PR 基线侧的脚本**执行，被审代码无法再通过修改自己的分类器让产品门禁整批跳过。
- Electron fuses 收紧：两侧都关闭 `NODE_OPTIONS` 与 `--inspect` 注入面；稳定壳（`asar: true`）改为只从 `app.asar` 加载，Beta 通道按物理目录分发（`asar: false`）故该位保持关闭。`runAsNode` 必须保持开启——Windows 上的 Host、CLI 与 pnpm shim 都以 Electron 二进制加 `ELECTRON_RUN_AS_NODE` 启动。两侧 `verify-fuses` 现在按实际布局推导并逐项断言这套取值，被放宽即失败；稳定壳原先调用 `verifyElectronExecutableFuses(path, undefined, false)`，等于从不校验归档位。
- 渲染器凭据不再通过 Host 子进程的环境变量传递，改为启动时经私有管道一次性注入，避免同用户进程从进程环境或崩溃转储里读取后冒充渲染器。
- Web 访问门禁在缺少凭据时**失败即拒绝**（此前 fail-open），浏览器侧请求不再静默放行。
- `dsh-desktop://` 深链接按动作白名单分发，未知动作丢弃并记一条日志。
- 诊断导出与日志的密钥遮盖补齐 base64url 形态，渲染器凭据不会再被带出。
- 目录选择路由与设置路由统一走同一套 loopback 同源判定，不再信任客户端自填的 `Origin`。

打包与发布：

- 稳定壳 `asarUnpack` 的口径用 app-builder-lib 26.15.7 实测确认：因为匹配的是**打包工程相对路径**，三条 pattern 必须带着 `files[].from` 的 `.desktop-build/payload/` 前缀才命中（`scripts/node-bin`、`assets`、`build` 确实落在 `app.asar` 之外）。pattern 维持原样，改为新增测试按 `files[].from` 推导前缀并断言，任一侧错位即失败——此前这个耦合没有任何断言覆盖。
- CI 增加稳定壳打包覆盖；版本一致性纳入 `verify-layout`——两个工作区的 `version` 与 `CHANGELOG` 最新标题必须一致。
- CI 不再就地改写 `dsh-plugin-desktop-beta/package.json` 来跳过 AA smoke，改用显式的 `check:ci` 脚本，CI 与本地执行口径一致。

仓库卫生与供应链：

- CI 引用的第三方 Actions 全部固定到 commit SHA（`actions/checkout`、`actions/setup-node`、`actions/cache`），tag 只作为尾注保留可读性，防止上游 tag 被移动后门禁行为悄悄改变。
- 变更分类器不再把 `docs/` 下的任意文件当作文档：`docs/` 里非文档扩展名（`.js`/`.mjs`/`.json`/`.ts` 等）现在触发产品门禁，只有真正的文档格式与 `docs/schemas/*.schema.json` 例外。
- 删除 `vendor/agents-anywhere/` 中 6 个零引用的历史 tgz（约 1.7 MB），只保留当前 pinned 的那一份；同目录 README 不再教已被移除的 `DSH_AA_SOURCE_REF=pinned`，改为按 `provenance.pinnedCommit` 固定。
- 子包 `nonead-dsh-desktop/README.md` 与 `README.zh.md` 不再写死产品版本号（此前写 `2.1.3`），改为指向 `package.json` 的 `version` 与根 `CHANGELOG` 的最新条目。
- 文档明确：Linux x64 的 AppImage 与 deb 只由 Beta 通道构建，稳定通道在 Linux 只产出可运行的目录产物；fuses 与 `onlyLoadAppFromAsar` 的首次真实校验点是 CI 的 `desktop-windows-stable` 作业（`package:dir:stable`），本地只有单元测试覆盖。

### 2026-10-23 补充（版本号不变，此后的构建包含）

打包链：

- 修复 Windows 打包链上三处与实际产品行为脱节的门禁：Profile 里 pnpm 生成的 junction 无法被递归删除；`verify:host` 没有传入渲染器凭据（必须是 32 字节 base64url，且要与 Host 收到的那一份一致）；同一脚本曾用固定字符串冒充渲染器，被失败即拒绝的 Web 门禁挡下。
- `dsh-plugin-desktop-beta` 补声明 `@deepseek-ai/dsh-plugin-manager`（`dsh-plugin-market` 的必需 peer），运行时闭包恢复 318 节点闭环。

## 2.1.15 — 2026-10-22

版本号从 `2.1.13` 直接提升到 `2.1.15`，提交历史中没有单独的 `2.1.14` 发布提交。

运行时与依赖：

- DSH 运行时保持 **`0.2.1-rc.2`**，`upstream.json` 的 `channels.beta.commit` 仍是 `687f282e`；Agents Anywhere bridge 仍是 `39b82d4`。
- 插件市场 `dshmarket` 升到 `1.66.45`，桌面侧补丁重新基于该版本重建。
- 品牌补丁从 `.yarn/patches/dsh-web-frontend-nonead-wordmark.patch` 迁移为 `patches/dsh-web-frontend@0.2.1-rc.2.patch`，与其它运行时补丁统一目录。
- AA connector 的 httpx 补丁扩大，覆盖新的连接路径。

更新与恢复：

- 更新卡片可以展示服务端下发的**发行说明**；Beta 通道的托盘菜单与原生对话框还会附「查看完整说明」入口（托盘标签与通知正文按平台规则截断），稳定通道的原生更新对话框仍只带固定说明。
- 新增**跳过此版本**：决策写入磁盘，无人值守的定时检查不会再把被跳过的版本推到眼前。
- 安装失败可重试；恢复到**任一已保存快照**而不只是最近一次。
- 启动原生安装器改为**先于退出流程**开始，避免退出把安装进程一起带走。
- 曾引入 Windows 安装包签名与发布者校验，随后在 `c5896ac` **整条撤销**；当前 Windows 安装包仍只比对 PE 版本资源里的 `ProductName` / `ProductVersion`。

桌面壳：

- 记住窗口位置与尺寸；恢复前校验窗口仍与已挂载显示器相交，拔掉外接屏不会把窗口还原到屏外。
- 支持严格的 `.env` 分层文件：只补齐 Host 子进程缺失的变量，不覆盖已有环境。
- 支持 `dsh-desktop://` 深链接（如 `dsh-desktop://settings/general`）。
- 新增开机自启开关，读取系统实际状态。
- Profile 配置的读改写改为单写者锁，避免与 Host 的 profile manager 互相覆盖、静默丢更新。
- 单实例与 disposable 清理的重试预算固定为三次；渲染器未处理的错误显示在通知区。
- 内置浏览器 guest 的 `.env` 与运行时环境随包正确传递。

插件市场与皮肤：

- 市场支持**非图片媒体预览**，并支持**按名字安装插件**。
- onboarding 跳过插件市场后仍记住该选择；向导重新打开时保留已存的市场设置。
- 品牌皮肤的 hero 标题替换限定在 hero 子树内，不再影响其它文案。

修复：

- AA 交互流保持存活的 peer；历史同步期间 DSH 运行时保持可用。
- 修复跨平台断言，并把市场 bundle 随包发布。
- CI 在运行时 JSON Schema 变化时也运行产品门禁。
- 发布流程改为从 manifests 推导随包版本号。

## 2.1.13 — 2026-10-21

运行时与依赖：

- DSH 运行时从 `0.2.1-alpha.5` 切到 **`0.2.1-rc.2`**：`@deepseek-ai/dsh*` 全部精确 pin 到该版本，`vendor/dsh-runtime/0.2.1-rc.2/` 随包 vendored，旧的 `alpha.5` 运行时目录移除。`upstream.json` 的 `channels.beta.commit` 为 `687f282e`。
- 插件市场 `dshmarket` 升到 `1.66.44`。
- Agents Anywhere bridge 升到 `2.1.0-desktop`（上游 `39b82d4`），并带 `agents-anywhere-connector-httpx` 补丁。

界面与体验：

- 启动界面（boot）启用新的 NONEAD / DEEPSEEK HARNESS 字标。
- onboarding 完成页改为引导填写 API Key，并给出 NONEAD 入口。
- onboarding 默认启用插件市场与 Computer Use（随 2.1.12 一并生效）。

稳定性：

- AA bridge 队列满时**丢弃事件**而不是抛出崩溃。
- 修正 rc.2 上游重构导致的 PTC 断言失败。
- CI 触发分支从 `master` 改为 `main`。
- 移除根目录的 `AGENTS.md`、`CLAUDE.md`、`PRIVACY*`、`CONTRIBUTING*`、`CODE_OF_CONDUCT*`；仓库规则入口收敛到 `README.md` 与 `docs/`。

## 2.1.12 — 2026-10-19

- onboarding 默认启用插件市场（`dsh-market`）与 Computer Use，新用户开箱就带这两项能力。

## 2.1.11 — 2026-10-18

- 两个桌面工作区版本统一到 `2.1.11`，用例与文档随版本同步。
- 根清单与文档同步到 DSH `0.2.1-rc.2`（先经过 `0.2.1-rc.1`）。
- `aa:prepare-release` 支持用本地源码树替代 GitHub 打包产物，便于离线或受限网络发版。

## 2.1.6 — 2026-10-17

- 为 Profile 插件打兼容补丁，修复后续运行时下 Profile 相关插件加载异常。
- 更新下载端点迁移到 `nonead.com`，README 补充 Linux AppImage 的安装与运行说明。

## 2.0.8 — 2026-10-11

- 三个通道版本统一到 `2.0.8`，刷新图标资源与 `dshmarket`，更新发布文档。
- 上游运行时此前已升到 `0.2.0-rc.2`。

## 已知问题

- Linux 应用内更新只检查版本、不下载安装包；升级需重新下载 AppImage。
- Windows 安装包尚未做密码学摘要校验：下载路径支持服务端 `installerSha256`，但版本端点尚未发布该字段，当前只比对 PE 版本资源中的 `ProductName` 与 `ProductVersion`。
- 未初始化的 `deepseek-harness` 子模块会让 `corepack yarn check:layout` 失败；常规构建、类型检查与测试不受影响。
