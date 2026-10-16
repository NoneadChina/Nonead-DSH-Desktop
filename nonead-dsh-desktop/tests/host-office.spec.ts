import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { sep, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { expect, it } from 'vitest'
import * as desktopOffice from '../src/host/office.ts'
import { PRIMARY_RUNTIME_INSTALL_NAME, resolveOfficeConfig } from '../src/host/office.ts'

const require = createRequire(import.meta.url)
const officeAssets = join(dirname(require.resolve('@deepseek-ai/dsh-skill-office/package.json')), 'assets')
const nodeName = process.platform === 'win32' ? 'node.exe' : 'node'

it('loads Office skills with the bundled Node and the installed CLI, and removes them on disposal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'next-office-'))
  const ctx = new Context()
  try {
    const source = join(root, 'runtime', 'arm64', 'primary-runtime')
    const assets = join(root, 'runtime', 'arm64', 'office-skills')
    await cp(officeAssets, assets, { recursive: true })
    const nodeDirectory = join(source, 'dependencies', 'node', 'bin')
    await mkdir(nodeDirectory, { recursive: true })
    await cp(process.execPath, join(nodeDirectory, nodeName))
    ctx.baseUrl = pathToFileURL(root).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    expect('default' in desktopOffice).toBe(false)
    expect(ctx.loader.unwrapExports(desktopOffice)).toBe(desktopOffice)
    const modules = new Map<string, unknown>([
      ['agents', AgentRegistry], ['systemPrompt', SystemPrompt], ['tools', ToolRuntime],
      ['skills', SkillRegistry], ['office', desktopOffice],
    ])
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected plugin ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof ctx.loader.internal>
    const config = join(root, 'cordis.yml')
    await writeFile(config, [
      '- name: agents', '- name: systemPrompt', '- name: tools', '- name: skills', '- name: office',
      '  config:', `    source: ${JSON.stringify(source)}`,
      `    root: ${JSON.stringify(join(root, 'installed'))}`, '',
    ].join('\n'))
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(config).href } })
    await ctx.loader.await()
    for (const entry of ctx.loader.entries()) await entry.fiber?.await()
    expect((await ctx.skills.list()).map(skill => skill.name)).toEqual(['office', 'office-docx', 'office-export-pdf', 'office-pptx', 'office-recalculate', 'office-render', 'office-xlsx'])
    expect((await ctx.skills.get('office-pptx'))?.resourceBase).toEqual({ kind: 'directory', path: join(assets, 'office-pptx').split(sep).join('/') })
    const content = (await ctx.skills.get('office-pptx'))?.content ?? ''
    expect(content).toContain('office-render')
    expect(content).not.toContain(nodeDirectory)
    expect(ctx.tools.schemas().map(tool => tool.name)).toEqual(['load_workspace_dependencies'])
    const entry = [...ctx.loader.entries()].find(entry => entry.options.name === 'office')
    expect(entry).toBeDefined()
    await entry?.fiber?.dispose()
    expect(await ctx.skills.list()).toEqual([])
    expect(ctx.tools.schemas()).toEqual([])
  } finally {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

it('mounts Office only for a prepared development payload and always for a packaged Host', async () => {
  const root = await mkdtemp(join(tmpdir(), 'next-office-config-'))
  try {
    const home = join(root, 'home')
    const source = join(root, '.desktop-build', 'runtime', 'arm64', 'primary-runtime')
    expect(resolveOfficeConfig(root, undefined, home)).toBeUndefined()
    expect(resolveOfficeConfig(root, source, home)).toBeUndefined()
    await mkdir(source, { recursive: true })
    await writeFile(join(source, 'runtime.json'), '{}')
    expect(resolveOfficeConfig(root, source, home)).toEqual({ source, root: join(home, 'dsh-runtimes', PRIMARY_RUNTIME_INSTALL_NAME) })
    const archive = join(root, 'Resources', 'app.asar')
    const packaged = join(root, 'Resources', 'runtime', 'x64', 'primary-runtime')
    expect(() => resolveOfficeConfig(archive, undefined, home)).toThrow('requires the bundled primary runtime path')
    expect(resolveOfficeConfig(archive, packaged, home)).toEqual({ source: packaged, root: join(home, 'dsh-runtimes', PRIMARY_RUNTIME_INSTALL_NAME) })
    expect(PRIMARY_RUNTIME_INSTALL_NAME).not.toBe('dsh-primary-runtime')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
