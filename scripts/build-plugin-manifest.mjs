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
 * Simplified-Chinese one-liners for the setup wizard. The published `description` fields are
 * mostly English, and the wizard is a Chinese-first surface, so these take precedence; a
 * package without an entry falls back to its own description.
 */
const DESCRIPTION_ZH = {
  '@a9i5k4/dsh-auto-memory': '自动记忆：无需提示即可在开工前注入相关历史，跨会话积累上下文。',
  '@feng0531/dsh-code-review': 'Git/SVN 只读代码审查：按范围挑选改动并给出意见。',
  '@kenz1117/dsh-ui-usage-billing': '用量与费用看板：侧边栏展示开销指标与用量明细。',
  '@linxin666/dsh-client-ui-git-graph': 'Git 分支图谱：在空白会话中切换分支、查看提交图。',
  '@linxin666/dsh-client-ui-skill-explorer': '技能中心：按来源浏览已加载的技能。',
  '@michengai/dsh-agency-agents': '专家库：331 位可召唤的专业智能体。',
  '@michengai/dsh-archive-manager': '会话归档：归档、恢复、收藏、永久删除，并诊断损坏的会话日志。',
  '@michengai/dsh-code-review': '代码审查：Codex 风格，原生独立子 Agent，可灵活选择审查范围。',
  '@michengai/dsh-skills-manager': '技能管理：统一加载并安全管理本机的 Agent 技能。',
  '@tt-a1i/archify-dsh': '架构图：生成可交互的架构、流程、时序、数据流与状态图。',
  '@wenaixi/dsh-superpower': '工程技能包：15 个 superpowers 工程技能，中英双语。',
  '@yolk_vat-y/dsh-project-memory': '项目记忆：索引文档（PDF/Markdown）与代码符号，支持检索。',
  'dsh-config-manager': '配置管理：备份、恢复、导出、导入、迁移与同步 DSH 配置。',
  'dsh-context': '上下文洞察与管理：查看上下文占用并进行压缩。',
  'dsh-design-skills': '设计风格技能包：内置 6 种设计风格。',
  'dsh-find-plugins': '插件搜索：跨五个社区目录以及 GitHub、npm 实时搜索插件。',
  'dsh-github-skills': 'GitHub 工作流技能：改编自 OpenAI Codex。',
  'dsh-image-gen': '图片生成：接入 Gemini、OpenAI 等渠道画图与改图。',
  'dsh-mcp-connector': 'MCP 连接器：连接 MCP 服务并跨服务搜索工具。',
  'dsh-nonead-prompt-recall': '输入历史：空输入框按 ↑ 召回上一条指令。',
  'dsh-ppt-master': 'PPT 生成：根据内容生成演示文稿。',
  'dsh-remotion': '视频制作：在 DSH 里用 React 工程渲染视频。',
  'dsh-rewind-plugin': '对话回退：在同一窗口内回退对话并恢复工作区文件。',
  'dsh-univer-office': 'Office 文档：DSH 与 Univer 集成，支持表格、文档与演示。',
  'dsh-api-client': 'API 调试：发起 HTTP 请求并查看响应。',
  'dsh-better-sidebar': '更好用的侧边栏：文件树、编辑器、改动、任务与侧边聊天合成一栏，每个会话独立；并向其他插件开放侧栏标签与文件查看器注册服务。',
  'dsh-doc-reader': '文档读取：解析 PDF、Word 等文件的正文内容。',
  'dsh-excel-chat': '表格对话：用自然语言操作 Excel 工作表。',
  'dsh-db-connector': '数据库连接：连接数据库并执行查询。',
  'dsh-nonead-universal-robots': 'UR 机械臂：用自然语言直接控制 Universal Robots 机械臂。',
  'dsh-nonead-ursim': 'UR 仿真：在离线仿真中编排机械臂动作。',
}

const plugins = []
const skipped = []
for (const entry of readdirSync(pluginDir).filter(name => ARCHIVE.test(name)).sort()) {
  try {
    const raw = readTarMember(join(pluginDir, entry), 'package/package.json')
    if (raw === undefined) throw new Error('archive has no package/package.json')
    const decoded = JSON.parse(raw)
    if (typeof decoded.name !== 'string' || decoded.name.length === 0) throw new Error('package.json has no name')
    if (typeof decoded.version !== 'string' || decoded.version.length === 0) throw new Error('package.json has no version')
    // The setup wizard shows this while installing: a curated Chinese line first, then the
    // package's own description when none is curated.
    const curated = DESCRIPTION_ZH[decoded.name]
    const description = curated
      ?? (typeof decoded.description === 'string' && decoded.description.trim().length > 0
        ? decoded.description.trim()
        : undefined)
    plugins.push({
      name: decoded.name,
      version: decoded.version,
      file: entry,
      ...(description === undefined ? {} : { description }),
    })
  } catch (error) {
    skipped.push(`${entry}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

plugins.sort((a, b) => a.name.localeCompare(b.name))
writeFileSync(join(pluginDir, 'manifest.json'), `${JSON.stringify({
  schema: 'nonead-dsh-desktop/plugin-bundle/v3',
  count: plugins.length,
  plugins,
}, null, 2)}\n`)

console.log(`plugin/manifest.json: ${plugins.length} 个插件`)
for (const plugin of plugins) console.log(`  ${plugin.name.padEnd(44)} ${plugin.version.padEnd(20)} ${plugin.file}`)
if (skipped.length > 0) {
  console.error(`\n跳过 ${skipped.length} 个：`)
  for (const line of skipped) console.error(`  ${line}`)
  process.exitCode = 1
}
