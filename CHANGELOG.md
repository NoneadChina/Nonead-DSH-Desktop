<p align="center">
  <strong>Nonead DSH Desktop · 更新日志</strong><br>
  <sub>中文 · <a href="CHANGELOG.en.md">English</a> · <a href="CHANGELOG.ja.md">日本語</a> · <a href="CHANGELOG.es.md">Español</a> · <a href="CHANGELOG.fr.md">Français</a> · <a href="CHANGELOG.de.md">Deutsch</a> · <a href="CHANGELOG.ru.md">Русский</a> · <a href="CHANGELOG.pt.md">Português</a></sub>
</p>

# 更新日志

本文件记录 Nonead DSH Desktop 面向用户的版本变更。每个版本都对应两个桌面工作区（`nonead-dsh-desktop` 与 `dsh-plugin-desktop-beta`）同步提升的版本号；版本号同时出现在安装包文件名、更新端点的响应与裸下载地址的映射中，三者必须一致。

维护约定：

- 每次发布为每种语言各加一条（`CHANGELOG.md`、`CHANGELOG.en.md` 及 ja/es/fr/de/ru/pt 版本），并刷新 `CHANGELOG.i18n.yaml` 记录的 Git blob 哈希，否则 `corepack yarn check:bilingual-docs` 会失败。
- 条目只写"用户能感知的变化"与"维护者必须知道的边界变化"；纯重构不单独成条。
- 更早的历史见 Git 标签（`v1.7.3`、`v2.0.7`、`v2.0.8`、`v2.1.3`、`v2.1.4`、`v2.1.5`）与提交记录。

## 2.2.9 — 2026-11-10

运行时升到 DSH 0.2.2-rc.1，内置插件补到 36 个，开箱即用的引导页也换了讲法：

- 运行时：内置 DeepSeek Harness 从 0.2.2-alpha.3 升到 **0.2.2-rc.1**（上游 commit `66491b0`，cordis 家族转正到 4.1.0、schemastery 3.19.0）。`vendor/dsh-runtime/0.2.2-rc.1` 由本地上游源码重建为 373 个包，包集合与上一版完全一致；24 个桌面补丁全部重定基到新产物，根 `resolutions` 与两个桌面工作区的 DSH 依赖一并指向新版本，`yarn check:vendored-runtime` 双通道通过。
- 引导页：装机向导的「开箱即用」不再先列出全部插件，只按大类说明这批预装插件能做什么；点开始安装后，每个插件轮到时展示名称、版本、所属大类与完整说明，并致谢作者——「感谢 X 带来这个插件」。
- 内置插件：随包插件从 30 个补到 **36 个**，新增 `@changfenhuang/dsh-genui`、`@deepseek-ai/dsh-tool-subagent`、`@linxin666/dsh-client-ui-task-board`、`@weibaohui/skills-management`、`billion-context`、`dsh-client-auto-continue`、`dsh-cost-meter`、`dsh-markitdown`、`dsh-nonead-prompt-rewind`、`dsh-office-tools` 与 `dshmarket`；`dsh-api-client`、`dsh-design`、`dsh-doc-reader`、`dsh-rewind-plugin` 与 `@kenz1117/dsh-ui-usage-billing` 退出随包清单。
- 插件升级：`dsh-ppt-master` 1.0.8 → 6.1.0，`dsh-config-manager` 0.3.1 → 0.6.0，`@michengai/dsh-skills-manager` 1.2.28 → 1.4.0，`dsh-better-sidebar` 0.28.2 → 0.30.1，`dsh-context` 0.80.3 → 0.83.0，其余随 npm latest。
- 插件清单：`plugin/manifest.json` 升到 v4，每个条目带上分类与作者，安装向导据此分组与致谢。
- 版本号：产品 2.2.6 → **2.2.9**（两个桌面工作区同步）。
- 启动告警：未启用远程控制的 Profile 不再把桥接条目写进 cordis 覆盖层，`patch: entry "agents-anywhere-bridge-next" not found` 不再出现在每次启动的日志里；已启用该功能的 Profile 行为不变，仍写 `dshHome` 与打包安装的重定向路径。
- 内置插件：`dsh-nonead-ursim` 升到 **0.3.15**，描述改为离线仿真定位（此前与真机插件 `dsh-nonead-universal-robots` 逐字节相同，容易让人在真机场景误装）。

### 内置插件清单（36 个）

以下 36 个插件随安装包一起分发，首次启动后可在「插件」页随时启用、停用或卸载；名称后的数字是随包版本。

- `@a9i5k4/dsh-auto-memory` 3.3.17 — 自动记忆。开工前唤回相关历史与已定决策，并把日志自动沉淀成笔记、账本与白板；长任务可以跨会话接着做。
- `@changfenhuang/dsh-genui` 0.16.0 — 生成式 UI。模型可用围栏在回复里渲染布局、图表、表单与流程图，面板上的点击还能回传给模型。
- `@deepseek-ai/dsh-tool-subagent` 0.2.2-rc.1 — 子 Agent 委派。给模型一个命名工具，把独立任务交给指定后端执行，完成通知与清理由运行时负责。
- `@linxin666/dsh-client-ui-git-graph` 0.4.14 — Git 图谱。在空白会话里切换分支，查看提交图与 worktree 隔离，分支操作带安全守卫。
- `@linxin666/dsh-client-ui-skill-explorer` 0.4.16 — 技能中心。按来源浏览已加载的技能，可开关模型调用，也能新建或删除技能。
- `@linxin666/dsh-client-ui-task-board` 0.4.16 — 任务看板。卡片由宿主托管并真实开会话执行，支持 cron 定时与休眠抑制，适合无人值守的巡检。
- `@michengai/dsh-agency-agents` 1.2.27 — 专家库。内置 331 位可召唤的专业智能体与 5 个专家团，需要专业视角时直接点名。
- `@michengai/dsh-archive-manager` 1.3.0 — 会话归档。归档、恢复、收藏与永久删除会话，并能诊断损坏的会话日志。
- `@michengai/dsh-code-review` 1.0.9 — 代码审查。由独立子 Agent 检查 Git、源码、调用方与测试，再把报告带回主会话，报告支持中英文。
- `@michengai/dsh-skills-manager` 1.4.0 — 技能管理。统一加载并安全管理本机技能，支持从 GitHub 安装、预览更新与备份回退。
- `@tt-a1i/archify-dsh` 1.1.0 — 架构图。以纯技能包接入 Archify，按描述生成架构图，用来梳理系统结构或表达技术方案。
- `@weibaohui/skills-management` 0.9.3 — 技能市场。一个页面管理本机各类 coding agent 的技能，内置 6600+ 技能市场，并统计每个技能的注入开销。
- `@wenaixi/dsh-superpower` 8.0.0 — 工程技能包。移植 obra/superpowers 的 15 个工程纪律技能，中英双语描述，每个都能单独开关。
- `@yolk_vat-y/dsh-project-memory` 0.6.12 — 项目记忆。把文档与代码符号索引进本地库，检索带 path:line 出处；任务、读过的文件与踩坑经验也会留下。
- `billion-context` 0.1.213 — 上下文压缩。把长会话折叠成摘要，用更小的窗口和更少的 token 跑完，官方称可支撑数月的单次会话。
- `dsh-better-sidebar` 0.30.1 — 增强侧边栏。把文件树、编辑器、改动、任务与侧边聊天收进同一列，每个会话独立，并向其他插件开放侧栏注册服务。
- `dsh-client-auto-continue` 0.17.4 — 自动续跑。请求被网络错误等非人为原因中断时自动补一条继续提示，也可开启成功后循环继续。
- `dsh-config-manager` 0.6.0 — 配置管理。备份、恢复、导出、导入、迁移与同步 DSH 配置，覆盖设置、插件、MCP、技能与工作区。
- `dsh-context` 0.83.0 — 上下文洞察。用仪表板看清上下文由什么组成、怎么增长，需要时压缩，也可用 /context 命令。
- `dsh-cost-meter` 1.9.62 — 费用看板。统计本会话、当日与历史的 token 与成本，内置 170+ 模型价格目录，还能查订阅额度与 Provider 余额。
- `dsh-excel-chat` 0.43.0 — 表格对话。用自然语言读取、编辑与清洗表格，每次编辑后自动复查公式，核心操作不依赖本机装 Excel。
- `dsh-find-plugins` 0.3.0 — 插件发现。聚合五个社区目录并实时搜 GitHub 与 npm，按相关度、可信度、新鲜度与热度排序。
- `dsh-github-skills` 0.2.1 — GitHub 工作流技能。以 OpenAI Codex 的语义为上游基线，适配 DSH 的多 provider、审批与按需加载。
- `dsh-image-gen` 0.11.1 — 图片生成。用说话的方式画图与改图，支持 Gemini、OpenAI、Seedream、DashScope 与本地 ComfyUI，也能用订阅账号免 Key。
- `dsh-markitdown` 0.2.2 — 文档转 Markdown。调用微软 MarkItDown，把 PDF、Word、Excel、PPT、HTML、CSV、EPUB 或网址转成模型可读的正文。
- `dsh-mcp-connector` 0.2.97 — MCP 连接器。内置上百个连接器的数据市场，统一管理授权、跨连接搜索工具并排查连接问题。
- `dsh-nonead-prompt-recall` 0.8.7 — 输入历史。空输入框按 ↑ 召回上一条指令，按工作区保存且重启不丢；改写按钮可在保留 @ 引用时优化草稿。
- `dsh-nonead-prompt-rewind` 0.5.4 — 对话回退。一键就地回退到任意更早的用户消息并回填输入框，写类工具改过的文件也能一并还原。
- `dsh-nonead-universal-robots` 0.8.6 — UR 机械臂。用自然语言驱动 Universal Robots 协作臂，读位姿、关节运动、画图与 I/O 都能做。
- `dsh-nonead-ursim` 0.3.14 — UR 仿真。在离线仿真里编排并验证机械臂动作，先把轨迹与逻辑跑通再上真机。
- `dsh-office-tools` 1.0.8 — Office 文件。用 8 个工具创建、读取与追加 Word、Excel、PowerPoint 文件，全部经官方文件服务读写。
- `dsh-ppt-master` 6.1.0 — PPT 生成。按内容产出可编辑 PPTX，也能输出 SVG 快照、填充原生模板并做 PPTX 增强。
- `dsh-remotion` 0.10.5 — 视频工作台。把 React 工程做成视频，内置官方技能、模板、素材排序、Studio 预览与 MP4 导出。
- `dsh-superagent` 0.1.0 — 主动式智能体原型。监听一个 GitHub 仓库（可选飞书），按 Policy 把被授权的请求转成工单并在独立会话执行（DeepSeek 研究原型，非官方产品）。
- `dsh-univer-office` 0.4.0 — Office 集成。把表格、文档、演示、画布与多维表接进 DSH，改动可在对话里预览、批准或丢弃。
- `dshmarket` 1.73.16 — 可视化插件市场。在 DSH 里浏览、搜索社区插件并一键安装，装错了也能在插件页停用。

## 2.2.6 — 2026-11-03

运行时升级到 DSH 0.2.2-alpha.3，并把内置插件补到 30 个：

- 运行时：内置 DeepSeek Harness 从 0.2.2-alpha.2 升到 **0.2.2-alpha.3**（上游 commit `05b1cae`，含 cordis 4.0.6-alpha.2、cosmokit 1.8.7-alpha.2 等 vendor 更新）。`vendor/dsh-runtime/0.2.2-alpha.3` 由本地上游源码重建为 373 个包，根 `resolutions` 与两个桌面工作区的 DSH 依赖一并指向新版本，`yarn check:vendored-runtime` 双通道通过。
- 新增插件：`dsh-superagent` 0.1.0（DeepSeek 研究原型：监听 GitHub 与飞书，把被授权的请求转成工单并在独立会话中执行，Web 面板汇总待人工处理项；由 `deepseek-ai/dsh-superagent-prototype` 的官方构建链产出）。
- 插件刷新：`dsh-remotion` 升到 0.10.4；未发布的 `dsh-design-skills` 由 `dsh-design` 取代；其余 `@michengai/dsh-agency-agents` 1.2.23、`@michengai/dsh-archive-manager` 1.2.0、`@michengai/dsh-code-review` 1.0.7、`@michengai/dsh-skills-manager` 1.2.28、`dsh-config-manager` 0.3.1、`dsh-context` 0.80.3、`dsh-rewind-plugin` 0.19.2 跟随 npm latest。
- 内置市场：`dshmarket` 升到 1.73.9。
- 工具：新增 `yarn plugins:update`，把 `plugin/` 下全部插件刷新到 npm latest 并重建清单。
- 版本号：产品 2.2.5 → **2.2.6**（两个桌面工作区同步）。

### 内置插件清单（30 个）

以下 30 个插件随安装包一起分发，首次启动后可在「插件」页随时启用、停用或卸载；名称后的数字是随包版本。

- `@a9i5k4/dsh-auto-memory` 3.3.17 — 自动记忆。开工前自动注入相关的历史工作记录与已定决策，不必手动提示；跨会话累积的上下文留在本机，随时可检索。
- `@kenz1117/dsh-ui-usage-billing` 1.8.1 — 用量与费用看板。在侧边栏集中展示调用用量指标与开销明细，便于随时核对成本。
- `@linxin666/dsh-client-ui-git-graph` 0.4.14 — Git 分支图谱。以图形展示提交历史与分支走向，并可在空白会话中直接切换分支，不必回到终端执行 git 命令。
- `@linxin666/dsh-client-ui-skill-explorer` 0.4.14 — 技能中心。按来源浏览当前已加载的技能，查看每个技能的用途，判断某个能力由谁提供。
- `@michengai/dsh-agency-agents` 1.2.23 — 专家库。内置 331 位可召唤的专业智能体，覆盖工程、设计、市场、法务等多个职能；需要某一领域的判断时直接召唤对应专家执行，而不是让主会话代为分析。
- `@michengai/dsh-archive-manager` 1.2.0 — 会话归档。归档、恢复、收藏与永久删除会话，并能诊断损坏的会话日志；日常清理不必删掉还想留着的记录。
- `@michengai/dsh-code-review` 1.0.7 — 代码审查。采用 Codex 风格的审查流程，由原生独立子 Agent 执行，审查范围可灵活选定（改动、提交区间或整个仓库）。
- `@michengai/dsh-skills-manager` 1.2.28 — 技能管理。统一加载并安全管理本机的 Agent 技能，启停与来源一目了然。
- `@tt-a1i/archify-dsh` 1.0.0 — 架构图。把系统结构或业务流程转成可交互的架构图、流程图、时序图、数据流图与状态图。
- `@wenaixi/dsh-superpower` 8.0.0 — 工程技能包。包含 15 个 superpowers 工程技能，中英双语可用。
- `@yolk_vat-y/dsh-project-memory` 0.6.9 — 项目记忆。为文档（PDF、Markdown）与代码符号建立索引，之后用检索代替反复通读。
- `dsh-api-client` 0.2.0 — API 调试。在编辑器内发起 HTTP 请求并查看响应，用于接口联调。
- `dsh-better-sidebar` 0.28.2 — 更好用的侧边栏。把文件树、编辑器、改动、任务与侧边聊天合成一栏，每个会话相互独立；同时向其他插件开放侧栏标签与文件查看器的注册服务。
- `dsh-config-manager` 0.3.1 — 配置管理。备份、恢复、导出、导入、迁移与同步 DSH 配置，换机或重装后可整体搬回。
- `dsh-context` 0.80.3 — 上下文洞察与管理。查看当前上下文占用，并在接近上限时进行压缩。
- `dsh-design` 0.2.0 — 设计系统技能。约束设计选择，并用 `design_audit` 实测渲染页面的字阶、对比度、间距与配色漂移。
- `dsh-doc-reader` 0.2.0 — 文档读取。解析 PDF、Word 等文件的正文内容，让模型直接读到文档文字，而不是只有文件名。
- `dsh-excel-chat` 0.43.0 — 表格对话。用自然语言操作 Excel 工作表，不必记忆函数与单元格坐标。
- `dsh-find-plugins` 0.3.0 — 插件搜索。跨五个社区目录检索插件，同时用 GitHub 与 npm 做实时搜索。
- `dsh-github-skills` 0.2.1 — GitHub 工作流技能。改编自 OpenAI Codex 的 GitHub 相关技能。
- `dsh-image-gen` 0.10.2 — 图片生成。接入 Gemini、OpenAI 等渠道，完成画图与改图。
- `dsh-mcp-connector` 0.2.93 — MCP 连接器。连接 MCP 服务，并在多个服务之间统一搜索与调用工具。
- `dsh-nonead-prompt-recall` 0.8.4 — 输入历史。输入框为空时按 ↑ 召回上一条指令。
- `dsh-nonead-universal-robots` 0.8.5 — UR 机械臂。用自然语言直接控制 Universal Robots 机械臂，省去手写脚本。
- `dsh-nonead-ursim` 0.3.13 — UR 仿真。在离线仿真中编排机械臂动作，不接真机也能先验证轨迹。
- `dsh-ppt-master` 1.0.8 — PPT 生成。根据给定内容生成演示文稿。
- `dsh-remotion` 0.10.4 — 视频制作。在 DSH 里用 React 工程渲染视频。
- `dsh-rewind-plugin` 0.19.2 — 对话回退。在同一窗口内回退对话，并同步恢复工作区文件。
- `dsh-superagent` 0.1.0 — 超级智能体原型。监听 GitHub 与飞书，把被授权的请求转成工单并在独立会话中执行，Web 面板汇总待人工处理项（DeepSeek 研究原型，非官方产品）。
- `dsh-univer-office` 0.4.0 — Office 文档。DSH 与 Univer 集成，支持表格、文档与演示。

## 2.2.4 — 2026-10-31

版本号推进，无功能变更：

- 版本号：产品 2.2.3 → **2.2.4**（两个桌面工作区同步）。

## 2.2.3 — 2026-10-29

桌面外壳完成八种语言本地化（简体中文、英文、日语、西班牙语、法语、德语、俄语、巴西葡萄牙语）：

- 外壳文案：新增西班牙语、法语、德语、俄语与巴西葡萄牙语字典，六种非中英文语言各 209 条；原生对话框、权限面板、Computer Use、设置页、插件控制与终端模式标注统一走 `desktopText`，原生菜单与界面语言存储同步八语言。
- 设置页：新增六种语言的设置字典（各 125 条），插件市场、远程控制、窗口、浏览器与局域网、通知等共享设置区块不再回退英文。
- 插值文案：Profile 删除/切换、插件启用/禁用/卸载、数据目录与更新状态等 11 处插值对话框改为 `{name}` 模板查表，六种语言下不再回退英文。
- 渲染进程：恢复反馈文案移出带 Node 依赖的模块，native-ui 构建不再出现 `node:fs`/`node:path`/`node:crypto` 外部化警告。
- 边界：恢复助手与 Profile 选择页来自共享工作区 `dsh-plugin-desktop-beta`，仍只有中英双语。
- 版本号：产品 2.2.2 → **2.2.3**（两个桌面工作区同步）。
- 文档：README 与 CHANGELOG 新增日语、西班牙语、法语、德语、俄语与巴西葡萄牙语版本；双语门禁扩展为多语言记录（每条记录至少两份文档）。


## 2.2.2 — 2026-10-28

上游运行时跨到 DSH `0.2.2-alpha.2`，市场升到 1.73.1：

- 上游运行时升级：beta 通道从 dsh `0.2.1-rc.3` 升到 **`0.2.2-alpha.2`**（子模块 pin `1f81c047` → `f3803c96`，上游提交 "release(dsh): 0.2.2-alpha.2"）——运行时重新打包并 vendored（370 个包，上一版 344 个），24 个版本补丁全部重定基。其中 7 个包的上游产物结构变了、必须按语义重新落点：`dsh`、`dsh-sandbox-windows-acl`、`dsh-web-frontend` 的 bundle 文件名哈希改变；`dsh-client-ui-plugin-manager` 的上游重构把 `listed` 拆出 `available` 却没有定义它（本补丁在恢复桌面插槽的同时补齐该定义）；`dsh-client-ui-settings-account` 的 onboarding 返回图标改为模块变量；`dsh-client-ui-directory-picker-browse` 的语言字典扩到 9 种语言；`dsh-client-ui-primitives` 的宽表格滚动条改为悬停显示，桌面补丁改回常显细条。rc.3 运行时快照与补丁保留为历史。
- 依赖面同步：`@deepseek-ai/cordis` 抬到 4.0.6-alpha.1、`schemastery` 抬到 3.18.6-alpha.1、三个 cordis 插件包各抬一个小版本，否则上游 0.2.2-alpha.2 的 peer 检查不通过；`nonead-dsh-desktop` 的 DSH 依赖与 beta 通道对齐（它属于 stable 通道，不在自动同步的工作区列表里，需手工跟随）。
- 市场：`dshmarket` 1.70.1 → **1.73.1**，桌面补丁（自更新入口、宿主版本注入、试运行基线对比）按 1.73.1 重定基；上游把更新缓存改为 `recheckAt` 语义，`checkUpdates` 对应 hunk 按新结构重写。
- Agents Anywhere bridge：按新 peer 范围重建（产物 `rd9c47cbc`，pin 仍为 `39b82d4`），connector 补丁不变。
- 版本号：产品 2.1.18 → **2.2.2**（两个桌面工作区同步）。

## 2.1.18 — 2026-10-24

上游运行时升级、Agents Anywhere 源码构建与 Windows ARM64 实验性构建（包含 2.1.17 的审查修复批次）：

- 上游运行时升级：beta 通道从 dsh `0.2.1-rc.2` 升到 **`0.2.1-rc.3`**（子模块 pin `687f282e` → `1f81c047`）——24 个版本补丁重定基到 rc.3，`vendor/dsh-runtime/0.2.1-rc.3/` 重新 vendored（344 个包），根清单、两个桌面工作区与 Agents Anywhere bridge 的 peer 范围同步；被取代的 rc.2 运行时快照与补丁退出跟踪。
- Agents Anywhere bridge：改为**从源码构建**（`39b82d4`，此前为复用既有产物），connector 补丁重定基到新产物——保留健康上报不阻塞通知发布、`NO_PROXY` 裸 IPv6 转换与运行时就绪上报，删除已被上游 `interactionPeer(connection)` 重构取代的 answer-provider 改动；构建产物内 Python 文件统一为 LF，补丁可复现套用。
- Windows ARM64（实验性）：新增 `DSH_PACKAGE_ARCH=arm64` 构建路径——主程序为原生 arm64，内置 Python / Node / Office 运行时复用 x64 载荷（Windows 仿真执行），跨架构打包会跳过只能在本机执行的冒烟测试；x64 构建与校验不受影响，该产物暂不进入下载链接与更新通道。
- 设置页更新卡片：服务不可用时提示改为「暂时无法获取 Nonead-DSH-Desktop 更新，请稍后重试。」，不再出现产品名 `Next`；下载进度条移到「正在下载更新 x%」与更新说明之间。

## 2.1.17 — 2026-10-24

审查修复批次（26 处修复，逐项见下）：

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
