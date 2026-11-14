/**
 * 用 Inno Setup 产出 Nonead DSH Desktop 的单文件安装包（x64 / arm64）。
 *
 * 链路：`check:win-package`（可跳过）→ prepareRuntime（解释器 + 归档 payload）
 *      → electron-builder `--win dir`（只产出 unpacked 目录，不走 NSIS）
 *      → ISCC 编译 → 静态校验（体积 / SHA256 / PE machine）。
 *
 * 用法（在仓库根执行）：
 *   $env:DSH_PACKAGE_ARCH='x64';   $env:DSH_PACKAGE_OUTPUT_DIR='dist';        node nonead-dsh-desktop/scripts/package-inno.ts
 *   $env:DSH_PACKAGE_ARCH='arm64'; $env:DSH_PACKAGE_OUTPUT_DIR='dist-arm64'; node nonead-dsh-desktop/scripts/package-inno.ts
 *
 * 可选环境变量：
 *   DSH_PACKAGE_CHECK_ALREADY_RAN 1 = 跳过 check:win-package（一次打包两架构时第二遍用）
 *   DSH_PACKAGE_SKIP_PAYLOAD      1 = 复用已有 unpacked 目录，只重编安装包
 *   INNO_SETUP_ISCC               ISCC.exe 路径（默认 C:\Program Files\Inno Setup 7\ISCC.exe）
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { electronBuilderEnvironment } from '../../dsh-plugin-desktop-beta/scripts/electron-builder-environment.ts'
import { withoutWindowsSigningSecrets } from '../../dsh-plugin-desktop-beta/scripts/package-win.ts'
import { prepareNextMacRuntime } from './mac-runtime.ts'
import { runNextPackagingCommand } from './packaging-command.ts'
import {
  expectedNextVersion,
  prepareNextRuntime,
  smokeNextRuntime,
  verifyNextRuntimeTree,
} from './prepare-runtime.ts'

const desktopRoot = fileURLToPath(new URL('..', import.meta.url))
const workspaceRoot = resolve(desktopRoot, '..')
const require = createRequire(import.meta.url)
const ISCC = process.env.INNO_SETUP_ISCC ?? 'C:\\Program Files\\Inno Setup 7\\ISCC.exe'
const ISS_TEMPLATE = join(desktopRoot, 'scripts', 'inno', 'desktop.iss')
const ICON_FILE = join(desktopRoot, 'build', 'app-icon.ico')
/** payload 约 1.4 GB；压缩后正常在 250 MB 以上，低于此值视为失败。 */
const MIN_INSTALLER_BYTES = 250 * 1024 * 1024

type TargetArch = 'x64' | 'arm64'

const targetArch: TargetArch = process.env.DSH_PACKAGE_ARCH === 'arm64' ? 'arm64' : 'x64'
const buildVersion = expectedNextVersion(desktopRoot)
const outputDirectory = process.env.DSH_PACKAGE_OUTPUT_DIR ?? (targetArch === 'x64' ? 'dist' : 'dist-arm64')

const PE_MACHINES = new Map<number, TargetArch>([
  [0x8664, 'x64'],
  [0xaa64, 'arm64'],
])

function run(command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv): void {
  runNextPackagingCommand(command, args, cwd, env, workspaceRoot)
}

function preparePayload(platform: NodeJS.Platform): void {
  const result = spawnSync(
    process.execPath,
    [join(desktopRoot, 'scripts', 'prepare-payload.ts'), '--platform', platform, '--arch', targetArch],
    { cwd: desktopRoot, env: process.env, stdio: 'inherit' },
  )
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`payload 准备失败，退出码 ${String(result.status)}`)
}

/**
 * 制备解释器运行时与归档 payload。与 package.ts 的 prepareInterpreters + prepareRuntime 等价：
 * 先按目标架构重建 `.desktop-build/runtime/<arch>` 并校验（跨架构的 smoke 会自行跳过），
 * 再让 prepare-payload.ts 把它封成 electron-builder 要归档的树。
 */
async function prepareRuntime(platform: NodeJS.Platform = process.platform): Promise<void> {
  if (platform === 'darwin') prepareNextMacRuntime(desktopRoot)
  const root = await prepareNextRuntime({ desktopRoot, platform, version: buildVersion, targetArch })
  verifyNextRuntimeTree(root, platform, buildVersion, targetArch)
  smokeNextRuntime(root, platform, console.log, targetArch)
  preparePayload(platform)
}

function peMachine(path: string): number {
  const buffer = readFileSync(path)
  return buffer.readUInt16LE(buffer.readUInt32LE(0x3c) + 4)
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
}

function findFile(root: string, name: string): string | undefined {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name)
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) return full
    if (entry.isDirectory()) {
      const nested = findFile(full, name)
      if (nested !== undefined) return nested
    }
  }
  return undefined
}

async function main(): Promise<void> {
  console.log(`Inno Setup 打包：${targetArch}，版本 ${buildVersion}，输出 ${outputDirectory}`)
  if (process.platform !== 'win32') throw new Error('Inno Setup 安装包必须在 Windows 上构建')
  if (!existsSync(ISCC)) throw new Error(`找不到 Inno Setup 编译器：${ISCC}`)
  if (!existsSync(ICON_FILE)) throw new Error(`找不到安装包图标：${ICON_FILE}`)

  const cleanEnvironment = withoutWindowsSigningSecrets(process.env)
  const unpacked = join(desktopRoot, outputDirectory, targetArch === 'x64' ? 'win-unpacked' : 'win-arm64-unpacked')
  const installer = join(desktopRoot, outputDirectory, `Nonead-DSH-Desktop-${buildVersion}-${targetArch}-Setup.exe`)

  if (process.env.DSH_PACKAGE_SKIP_PAYLOAD === '1') {
    console.log(`复用已有 payload：${unpacked}`)
  } else {
    if (process.env.DSH_PACKAGE_CHECK_ALREADY_RAN !== '1') {
      run(
        process.env.SystemRoot === undefined ? 'cmd.exe' : join(process.env.SystemRoot, 'System32', 'cmd.exe'),
        ['/d', '/s', '/c', 'corepack yarn workspace dsh-plugin-desktop-beta check:win-package'],
        workspaceRoot,
        cleanEnvironment,
      )
    } else {
      console.log('跳过 Windows 打包预检（check:win-package 已通过）。')
    }
    await prepareRuntime()
    run(
      process.execPath,
      [
        require.resolve('electron-builder/cli.js'),
        '--win',
        'dir',
        `--${targetArch}`,
        '--publish',
        'never',
        '--config.win.signExecutable=false',
        `--config.directories.output=${outputDirectory}`,
      ],
      desktopRoot,
      electronBuilderEnvironment({ ...cleanEnvironment, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }),
    )
  }

  const appExe = join(unpacked, 'Nonead DSH Desktop.exe')
  if (!existsSync(appExe)) throw new Error(`payload 缺少主程序：${appExe}`)
  const payloadMachine = PE_MACHINES.get(peMachine(appExe))
  if (payloadMachine !== targetArch) {
    throw new Error(`payload 架构不符：期望 ${targetArch}，实际 ${String(payloadMachine)}`)
  }

  run(
    ISCC,
    [
      `/DAppVersion=${buildVersion}`,
      `/DAppArch=${targetArch}`,
      `/DSourceDir=${unpacked}`,
      `/DOutputDir=${join(desktopRoot, outputDirectory)}`,
      `/DIconFile=${ICON_FILE}`,
      ISS_TEMPLATE,
    ],
    desktopRoot,
    cleanEnvironment,
  )

  if (!existsSync(installer)) throw new Error(`ISCC 未产出安装包：${installer}`)
  const size = statSync(installer).size
  if (size < MIN_INSTALLER_BYTES) throw new Error(`安装包体积异常：${size} 字节`)
  const runtimeNode = findFile(join(unpacked, 'resources'), 'node.exe')
  console.log(`安装包：${installer}`)
  console.log(`  体积：${(size / 1024 / 1024).toFixed(1)} MB（${size} 字节）`)
  console.log(`  SHA256：${sha256(installer)}`)
  console.log(`  主程序架构：${targetArch}`)
  if (runtimeNode !== undefined) {
    const runtimeMachine = PE_MACHINES.get(peMachine(runtimeNode)) ?? 'unknown'
    console.log(`  运行时 node.exe 架构：${runtimeMachine}（${runtimeNode}）`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
