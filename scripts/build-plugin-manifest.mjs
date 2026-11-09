/**
 * Build `plugin/manifest.json` from the plugin archives shipped with the installer.
 *
 * Every entry in `plugin/` is a standard npm tarball whose payload lives under `package/`,
 * so the package identity is read straight out of `package/package.json` instead of trusting
 * the file name (scoped names contain dashes, which makes name/version splitting unreliable).
 *
 * The member is decoded in-process rather than through `tar`: Windows ships bsdtar, which
 * parses `-O` after the member name as another member name instead of stdout.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

const root = join(import.meta.dirname, '..')
const pluginDir = join(root, 'plugin')
const ARCHIVE = /\.(?:tgz|tar\.gz)$/u
const SCHEMA = 'nonead-dsh-desktop/plugin-bundle/v4'

/** Minimal ustar reader: returns the UTF-8 contents of one member, or undefined. */
function readTarMember(archive, target) {
  const buffer = gunzipSync(readFileSync(archive))
  let offset = 0
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512)
    // Two zero blocks end the archive; a zero name alone marks an unused block.
    if (header.every(byte => byte === 0)) break
    const name = header.subarray(0, 100).toString('utf8').replace(/\0[\s\S]*$/u, '')
    const sizeField = header.subarray(124, 136).toString('utf8').replace(/\0[\s\S]*$/u, '').trim()
    const size = Number.parseInt(sizeField, 8) || 0
    const type = header[156]
    const regular = type === 0 || type === 0x30
    if (regular && name === target) return buffer.subarray(offset + 512, offset + 512 + size).toString('utf8')
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return undefined
}

/**
 * Coarse groups the setup wizard uses to summarise the bundle instead of listing every
 * plugin one by one. Every archived package must appear here: a new archive without a
 * category aborts the build instead of silently producing an uncategorised entry.
 */
const CATEGORY_BY_NAME = {
  // 记忆与上下文
  '@a9i5k4/dsh-auto-memory': 'core',
  'billion-context': 'core',
  'dsh-context': 'core',
  '@yolk_vat-y/dsh-project-memory': 'core',
  // 界面与工作区
  'dshmarket': 'workspace',
  'dsh-better-sidebar': 'workspace',
  '@linxin666/dsh-client-ui-skill-explorer': 'workspace',
  '@linxin666/dsh-client-ui-task-board': 'workspace',
  '@changfenhuang/dsh-genui': 'workspace',
  'dsh-client-auto-continue': 'workspace',
  'dsh-cost-meter': 'workspace',
  'dsh-find-plugins': 'workspace',
  '@michengai/dsh-archive-manager': 'workspace',
  // 智能体与技能
  '@deepseek-ai/dsh-tool-subagent': 'agent',
  '@michengai/dsh-agency-agents': 'agent',
  'dsh-superagent': 'agent',
  '@michengai/dsh-skills-manager': 'agent',
  '@weibaohui/skills-management': 'agent',
  '@wenaixi/dsh-superpower': 'agent',
  'dsh-github-skills': 'agent',
  'dsh-ppt-master': 'agent',
  '@tt-a1i/archify-dsh': 'agent',
  // 文档与媒体
  'dsh-office-tools': 'docs',
  'dsh-excel-chat': 'docs',
  'dsh-univer-office': 'docs',
  'dsh-markitdown': 'docs',
  'dsh-image-gen': 'docs',
  'dsh-remotion': 'docs',
  // 代码与工程
  '@michengai/dsh-code-review': 'engineering',
  '@linxin666/dsh-client-ui-git-graph': 'engineering',
  // 机器人与仿真
  'dsh-nonead-universal-robots': 'robot',
  'dsh-nonead-ursim': 'robot',
  // 连接与自动化
  'dsh-mcp-connector': 'integration',
  'dsh-config-manager': 'integration',
  'dsh-nonead-prompt-recall': 'integration',
  'dsh-nonead-prompt-rewind': 'integration',
}

/** Curated display names; packages owned by 拓德科技 are matched by prefix below. */
const AUTHOR_BY_NAME = {
  'dsh-superagent': 'DeepSeek Harness Team',
  'dsh-univer-office': 'DreamNum',
  '@deepseek-ai/dsh-tool-subagent': 'DeepSeek Harness Team',
}
const NONEAD_AUTHOR = '拓德科技'
const FALLBACK_AUTHOR = '社区贡献者'

/** Package-json author → display string: `<email>` removed, trailing whitespace trimmed. */
function authorFromPackage(pkg) {
  const raw = typeof pkg.author === 'string'
    ? pkg.author
    : typeof pkg.author === 'object' && pkg.author !== null && typeof pkg.author.name === 'string'
      ? pkg.author.name
      : undefined
  if (raw === undefined) return undefined
  const display = raw.replace(/<[^>]*>/gu, '').replace(/\s+$/u, '')
  return display.length > 0 ? display : undefined
}

/** Author shown by the wizard: curated map, package.json, scope, then a generic fallback. */
function resolveAuthor(name, pkg) {
  if (name.startsWith('dsh-nonead-')) return NONEAD_AUTHOR
  const curated = AUTHOR_BY_NAME[name]
  if (curated !== undefined) return curated
  const declared = authorFromPackage(pkg)
  if (declared !== undefined) return declared
  const scope = name.startsWith('@') ? name.slice(1).split('/')[0] : undefined
  if (scope !== undefined && scope.length > 0) return scope
  return FALLBACK_AUTHOR
}

/**
 * Simplified-Chinese intros for the setup wizard. The published `description` fields are
 * mostly English, and the wizard is a Chinese-first surface, so these take precedence; a
 * package without an entry falls back to its own description. Each line stays factual:
 * what the plugin does, plus the one or two things it is actually used for.
 */
const DESCRIPTION_ZH = {
  '@a9i5k4/dsh-auto-memory': '主动联想记忆：开工前自动唤回相关历史并注入上下文，无需手动提示。内置三层自动沉淀与技能固化，还提供交接账本、PLAN 白板与上下文水位感知，适合让长任务跨会话接着做。',
  'billion-context': '上下文压缩插件：把长会话折叠成摘要，用更小的上下文窗口和更少的 token 跑完。官方称可支撑数月长的单次会话、累计数十亿 token，适合长时间连续作业。',
  '@changfenhuang/dsh-genui': '生成式 UI：模型可在回复里用 dsh-ui 围栏渲染布局、图表、表单、测验、mermaid 与 3D 场景，交互事件还能回传给模型。适合把说明变成可点的面板。',
  '@deepseek-ai/dsh-tool-subagent': '子 Agent 委派工具：给模型一个命名工具，把任务交给指定的子 Agent 后端执行。每次调用返回子 id，完成通知与清理由运行时负责，适合把独立工作拆出去跑。',
  'dsh-better-sidebar': '增强侧边栏：把文件树、编辑器、改动、任务与侧边聊天收进同一列，并且每个会话独立。还向其他插件开放侧栏标签与文件查看器注册服务，适合边聊边改文件。',
  'dsh-client-auto-continue': '自动续跑：请求被网络错误等非人为原因中断时，自动补发一条本地化的继续提示；也可开启成功后循环继续。适合长时间无人值守的任务。',
  'dsh-config-manager': '配置管理：一键备份、恢复、导出、导入、迁移与同步 DSH 配置，覆盖设置、插件、MCP、技能与工作区。适合换机器时把整套环境搬过去，也支持定时备份。',
  'dsh-context': '上下文洞察与管理：用仪表板查看上下文由什么组成、怎么增长，并在需要时压缩。提供 /context 命令与侧边栏面板，适合排查上下文被谁占满。',
  'dsh-cost-meter': '费用与额度看板：统计本会话、当日与历史的 token 和成本，内置 170+ 模型价格目录并自动匹配。还能查 16 家 Coding Plan 订阅额度与自定义 Provider 余额，并在峰谷计价切换前提醒。',
  'dsh-excel-chat': 'Excel 对话：用自然语言读取、编辑、清洗表格并生成报表，每次编辑后自动复查公式、修复静默错误。核心操作不依赖本机安装 Excel，适合批量改表。',
  'dsh-find-plugins': '插件发现：聚合五个社区目录并实时搜 GitHub 与 npm，按相关度、可信度、新鲜度与热度排序，而不是只看 star。适合快速判断某个能力有没有现成插件。',
  'dsh-github-skills': 'GitHub 工作流技能：以 OpenAI Codex 的 GitHub 工作流语义为上游基线，针对 DSH 的多 provider、审批机制与技能按需加载做适配。适合让 Agent 更规范地处理 issue、PR 与 Actions 流程。',
  'dsh-image-gen': '图片生成：在 DSH 里用说话的方式画图，支持 Gemini、OpenAI、Seedream、DashScope 与本地 ComfyUI 等渠道，也支持订阅账号免 Key 使用。适合出配图、改图或批量生成素材。',
  'dsh-markitdown': '文档转 Markdown：调用微软 MarkItDown，把 PDF、Word、Excel、PPT、HTML、CSV、EPUB 或网址统一转成模型可读的 Markdown。适合在读取任何非文本文件之前先转换，让模型能真正读懂内容。',
  'dsh-mcp-connector': 'MCP 连接器：内置上百个连接器的数据市场，统一管理授权、跨连接搜索工具并排查连接问题。支持 OAuth、API Key 与 HTTP/stdio，适合接入企业数据。',
  'dsh-nonead-prompt-recall': '输入历史：空输入框按 ↑ 召回上一条指令，再按 ↑ 往前翻、↓ 往回走，按工作区保存且重启不丢。模型选择器旁还有改写按钮，可在保留 @ 引用的前提下优化草稿。',
  'dsh-nonead-prompt-rewind': '对话回退：一键就地回退到任意更早的用户消息，目标消息自动回填输入框。还能一并还原写类工具改过的文件，不依赖 git，适合走错路时重来。',
  'dsh-nonead-universal-robots': 'UR 机械臂控制：用自然语言直接驱动 Universal Robots 协作臂，支持读取位姿、关节运动、画图与 I/O 等操作。适合不写脚本就完成示教与调试。',
  'dsh-nonead-ursim': 'UR 离线仿真：在仿真里编排与验证 Universal Robots 机械臂动作，不用连真机。适合先把轨迹与逻辑跑通，再上真机执行。',
  'dsh-office-tools': 'Office 文件工具：用 8 个工具创建、读取和追加 Word、Excel、PowerPoint 文件，全部经官方文件服务读写。适合在会话里直接产出 docx、xlsx、pptx 交付物。',
  'dsh-ppt-master': 'PPT 生成工作流：按内容生成可编辑的 PPTX，也能输出 SVG 快照、填充原生模板并做 PPTX 增强。适合把大纲或文章快速变成演示文稿。',
  'dsh-remotion': '视频工作台：把 React 工程做成视频，内置官方 Remotion 技能、工程检索、模板、素材排序、Studio 预览与 MP4 导出。适合用代码生成带动画的视频。',
  'dsh-superagent': '主动式智能体原型：监听一个 GitHub 仓库（可选飞书），按 Policy 评估请求，把被授权的请求转成工单并在独立会话中执行。Web 面板汇总待人工处理项；属 DeepSeek 研究原型，非官方产品。',
  'dsh-univer-office': 'Office 集成：把电子表格、文档、演示、画布与多维表接进 DSH，改动可在对话里预览、批准或丢弃。适合围绕 Excel、Word、PPT 做协作编辑与审阅。',
  'dshmarket': '可视化插件市场：在 DSH 里浏览、搜索社区插件并一键安装，不用命令行。适合快速试装主题与扩展，装错了也能在插件页里停用。',
  '@linxin666/dsh-client-ui-git-graph': 'Git 图谱：在空白会话里切换分支，并查看可视化提交图与 worktree 隔离。Git 操作在宿主进程中执行并带安全守卫，适合多 Agent 并行开发。',
  '@linxin666/dsh-client-ui-skill-explorer': '技能中心：按来源（内置、项目、用户、自定义、运行时）浏览已加载技能，可开关模型调用、新建或删除技能。适合在一个面板里看清本机装了哪些技能。',
  '@linxin666/dsh-client-ui-task-board': '任务看板：卡片由 Host 托管并真实开 DSH 会话执行，支持 cron 定时与跨平台休眠抑制。适合让审查、巡检与定时流水线无人值守地跑。',
  '@michengai/dsh-agency-agents': '专家库：内置 331 位可召唤的专业智能体与 5 个专家团，按能力分工处理各类任务。也支持自定义协作方式，适合需要专业视角时直接点名。',
  '@michengai/dsh-archive-manager': '会话归档管理：归档、恢复、收藏与永久删除会话，还能诊断损坏的会话日志。适合清理历史记录，或找回误归档的对话。',
  '@michengai/dsh-code-review': '代码审查：在当前会话发起审查，由独立子 Agent 检查 Git、源码、调用方与测试，再把报告带回主会话。可按范围或要求审查，报告支持中英文。',
  '@michengai/dsh-skills-manager': '技能管理：统一加载并安全管理本机 Agent 技能，支持从 GitHub 安装、预览更新与备份回退。适合把散落的技能收拢到一处维护。',
  '@tt-a1i/archify-dsh': '架构图技能：以纯技能包的形式把 Archify 架构图能力接入 DSH，让模型能按描述生成架构图。适合梳理系统结构或表达技术方案。',
  '@weibaohui/skills-management': '技能市场：一个页面管理本机各类 coding agent 的技能，可一键收编进 DSH 用户库供 skill 工具调用。内置 6600+ 技能市场，并统计每个技能的注入开销。',
  '@wenaixi/dsh-superpower': '工程技能包：移植 obra/superpowers 的 15 个工程纪律技能，技能描述中英双语可切换、每个都能单独开关。适合给日常开发加上成体系的方法约束。',
  '@yolk_vat-y/dsh-project-memory': '项目持久记忆：把 PDF、Markdown 等文档与代码符号索引进工作区本地库，检索时带 path:line 出处。还会把任务、读过的文件与踩坑经验存下来，方便换会话后接着做。',
}

const plugins = []
const skipped = []
const uncategorised = []
for (const entry of readdirSync(pluginDir).filter(name => ARCHIVE.test(name)).sort()) {
  let decoded
  try {
    const raw = readTarMember(join(pluginDir, entry), 'package/package.json')
    if (raw === undefined) throw new Error('archive has no package/package.json')
    decoded = JSON.parse(raw)
    if (typeof decoded.name !== 'string' || decoded.name.length === 0) throw new Error('package.json has no name')
    if (typeof decoded.version !== 'string' || decoded.version.length === 0) throw new Error('package.json has no version')
  } catch (error) {
    skipped.push(`${entry}: ${error instanceof Error ? error.message : String(error)}`)
    continue
  }

  // A missing category is a hard build error: the wizard groups the bundle by category, and a
  // silent fallback would ship an entry it cannot place after a future archive update.
  const category = CATEGORY_BY_NAME[decoded.name]
  if (category === undefined) {
    uncategorised.push(`${entry}: ${decoded.name}`)
    continue
  }

  // English description is the package's own text, verbatim (trimmed, never truncated).
  const descriptionEn = typeof decoded.description === 'string' ? decoded.description.trim() : ''
  if (descriptionEn.length === 0) {
    skipped.push(`${entry}: package.json has no description`)
    continue
  }
  // The setup wizard shows this while installing: a curated Chinese intro first, then the
  // package's own description when none is curated.
  const description = DESCRIPTION_ZH[decoded.name] ?? descriptionEn
  plugins.push({
    name: decoded.name,
    version: decoded.version,
    file: entry,
    category,
    author: resolveAuthor(decoded.name, decoded),
    description,
    descriptionEn,
  })
}

if (uncategorised.length > 0) {
  console.error('错误：以下归档在 CATEGORY_BY_NAME 中没有分类，已停止写入 plugin/manifest.json：')
  for (const line of uncategorised) console.error(`  ${line}`)
  console.error('请在 scripts/build-plugin-manifest.mjs 的 CATEGORY_BY_NAME 中补齐分类后重新运行。')
  process.exitCode = 1
} else {
  plugins.sort((a, b) => a.name.localeCompare(b.name))
  writeFileSync(join(pluginDir, 'manifest.json'), `${JSON.stringify({
    schema: SCHEMA,
    count: plugins.length,
    plugins,
  }, null, 2)}\n`)

  console.log(`plugin/manifest.json: ${plugins.length} 个插件（${SCHEMA}）`)
  for (const plugin of plugins) console.log(`  ${plugin.category.padEnd(11)} ${plugin.name.padEnd(44)} ${plugin.version.padEnd(20)} ${plugin.file}`)
  if (skipped.length > 0) {
    console.error(`\n跳过 ${skipped.length} 个：`)
    for (const line of skipped) console.error(`  ${line}`)
    process.exitCode = 1
  }
}
