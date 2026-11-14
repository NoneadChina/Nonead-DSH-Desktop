/**
 * Inno Setup 分支：把 electron-builder 产出的 unpacked 树打成单个可执行安装包（x64 / arm64）。
 *
 * 与 `package.ts win` 的区别只在最后一步：那条线走 electron-builder 自带的 NSIS，
 * 这条线走 Inno Setup 7 的 ISCC（`scripts/inno/desktop.iss`），产物同为单文件 Setup.exe，
 * 安装前/卸载前主动结束正在运行的 Nonead DSH Desktop，界面支持 8 种语言。
 *
 * 用法（仓库根执行，或直接用 `yarn workspace nonead-dsh-desktop dist:inno`）：
 *   $env:DSH_PACKAGE_ARCH='x64';   $env:DSH_PACKAGE_OUTPUT_DIR='dist';         node nonead-dsh-desktop/scripts/package.ts inno
 *   $env:DSH_PACKAGE_ARCH='arm64'; $env:NONEAD_TARGET_ARCH='arm64'; $env:DSH_PACKAGE_OUTPUT_DIR='dist-arm64';
 *   $env:DSH_PACKAGE_CHECK_ALREADY_RAN='1'; node nonead-dsh-desktop/scripts/package.ts inno
 *
 * 可选环境变量：
 *   DSH_PACKAGE_CHECK_ALREADY_RAN 1 = 跳过 check:win-package（一次打两架构时第二遍用）
 *   DSH_PACKAGE_SKIP_PAYLOAD      1 = 复用已有 unpacked 目录，只重编安装包
 *   DSH_PACKAGE_PAYLOAD_DIR       复用载荷的绝对/相对路径（缺省为 <output>/win-unpacked）
 *   DSH_PACKAGE_SMOKE             1 = 冒烟构建（/DSMOKE）：不收尾宿主进程、不需要管理员权限
 *   INNO_SETUP_ISCC               ISCC.exe 路径（默认 C:\Program Files\Inno Setup 7\ISCC.exe）
 */
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { windowsTargetArch, type WindowsTargetArch } from '../../dsh-plugin-desktop-beta/scripts/package-win.ts'
import { expectedNextVersion } from './prepare-runtime.ts'

const require = createRequire(import.meta.url)
const DEFAULT_ISCC = 'C:\\Program Files\\Inno Setup 7\\ISCC.exe'
/** payload 约 1.4 GB；压缩后正常在 250 MB 以上，低于此值视为失败。 */
const MIN_INSTALLER_BYTES = 250 * 1024 * 1024

const PE_MACHINES = new Map<number, WindowsTargetArch>([
  [0x8664, 'x64'],
  [0xaa64, 'arm64'],
])

/** 一次 Inno 打包需要的协作方：均由 `package.ts` 传入，保持与其它打包模式同一套环境与日志边界。 */
export interface InnoPackageOptions {
  readonly desktopRoot: string
  readonly workspaceRoot: string
  readonly run: (command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv) => void
  readonly log: (message: string) => void
  /** 与 `package.ts` 的 win 模式同一个 hook：校验解释器树、封载荷、准备 host bundle 投影。 */
  readonly prepareRuntime: () => void
  readonly env?: NodeJS.ProcessEnv
}

/** 安装包输出目录：x64 用 dist、arm64 用 dist-arm64，可用 DSH_PACKAGE_OUTPUT_DIR 覆盖。 */
export function innoOutputDirectory(arch: WindowsTargetArch, env: NodeJS.ProcessEnv = process.env): string {
  return env.DSH_PACKAGE_OUTPUT_DIR ?? (arch === 'x64' ? 'dist' : 'dist-arm64')
}

/** unpacked 目录名与 electron-builder 一致：x64 是 win-unpacked，其余是 win-<arch>-unpacked。 */
export function innoUnpackedDirectory(root: string, arch: WindowsTargetArch): string {
  return join(root, arch === 'x64' ? 'win-unpacked' : `win-${arch}-unpacked`)
}

function peMachine(path: string): number {
  const buffer = readFileSync(path)
  return buffer.readUInt16LE(buffer.readUInt32LE(0x3c) + 4)
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
}

function countFiles(root: string): number {
  let count = 0
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name)
    if (entry.isFile()) count += 1
    else if (entry.isDirectory()) count += countFiles(full)
  }
  return count
}

/**
 * 跑一遍 Inno 打包：可选地重建 unpacked 树，然后用 ISCC 编译安装包并静态校验。
 * @param options - package.ts 提供的运行边界。
 * @returns 安装包绝对路径。
 */
export function packageInnoInstaller(options: InnoPackageOptions): string {
  const env = options.env ?? process.env
  const arch = windowsTargetArch(env)
  const version = expectedNextVersion(options.desktopRoot, env)
  const iscc = env.INNO_SETUP_ISCC ?? DEFAULT_ISCC
  const smoke = env.DSH_PACKAGE_SMOKE === '1'
  const outputDirectory = innoOutputDirectory(arch, env)
  const outputRoot = resolve(options.desktopRoot, outputDirectory)
  // 复用已产出的 unpacked 树（例如刚跑过 NSIS 打包）时，载荷可以驻留在别处，只把安装包写到 outputRoot。
  const payloadDir = env.DSH_PACKAGE_PAYLOAD_DIR
  const unpacked = payloadDir === undefined ? innoUnpackedDirectory(outputRoot, arch) : resolve(payloadDir)
  const installer = join(outputRoot, `Nonead-DSH-Desktop-${version}-${arch}-Setup.exe`)
  const iss = join(options.desktopRoot, 'scripts', 'inno', 'desktop.iss')
  const icon = join(options.desktopRoot, 'build', 'app-icon.ico')
  const wizard = join(options.desktopRoot, 'build', 'inno-wizard-image.bmp')
  const wizardSmall = join(options.desktopRoot, 'build', 'inno-wizard-small.bmp')

  options.log(`Inno Setup packaging: ${arch}, version ${version}, output ${outputDirectory}${smoke ? ' (smoke build)' : ''}`)
  if (process.platform !== 'win32') throw new Error('The Inno Setup installer must be built on Windows')
  if (!existsSync(iscc)) throw new Error(`Inno Setup compiler not found: ${iscc}`)
  if (!existsSync(iss)) throw new Error(`Installer script not found: ${iss}`)
  if (!existsSync(icon)) throw new Error(`Installer icon not found: ${icon}`)
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/u.test(version)) {
    // Inno 的 VersionInfoVersion 只接受数字版本；测试版本（x.y.z-next）不适合出正式安装包。
    throw new Error(`Inno Setup needs a numeric x.y.z version for VersionInfoVersion; received ${version}`)
  }

  if (env.DSH_PACKAGE_SKIP_PAYLOAD === '1') {
    options.log(`Reusing the prepared payload: ${unpacked}`)
  } else {
    options.prepareRuntime()
    options.run(
      process.execPath,
      [
        require.resolve('electron-builder/cli.js'),
        '--win',
        'dir',
        `--${arch}`,
        '--publish',
        'never',
        '--config.win.signExecutable=false',
        `--config.directories.output=${outputRoot}`,
      ],
      options.desktopRoot,
      { ...env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
    )
  }

  const appExe = join(unpacked, 'Nonead DSH Desktop.exe')
  if (!existsSync(appExe)) throw new Error(`The payload has no application executable: ${appExe}`)
  const payloadMachine = PE_MACHINES.get(peMachine(appExe))
  if (payloadMachine !== arch) {
    throw new Error(`Payload architecture mismatch: expected ${arch}, found ${String(payloadMachine)}`)
  }

  const defines = [
    `/DAppVersion=${version}`,
    `/DAppArch=${arch}`,
    `/DSourceDir=${unpacked}`,
    `/DOutputDir=${outputRoot}`,
    `/DIconFile=${icon}`,
    ...(existsSync(wizard) ? [`/DWizardImage=${wizard}`] : []),
    ...(existsSync(wizardSmall) ? [`/DWizardSmallImage=${wizardSmall}`] : []),
    ...(smoke ? ['/DSMOKE=1'] : []),
  ]
  options.run(iscc, [...defines, iss], options.desktopRoot, env)

  if (!existsSync(installer)) throw new Error(`ISCC produced no installer: ${installer}`)
  const size = statSync(installer).size
  if (size < MIN_INSTALLER_BYTES) throw new Error(`Installer is suspiciously small: ${size} bytes`)
  options.log(`Installer: ${installer}`)
  options.log(`  Size: ${(size / 1024 / 1024).toFixed(1)} MB (${String(size)} bytes)`)
  options.log(`  SHA256: ${sha256(installer)}`)
  options.log(`  Payload: ${String(countFiles(unpacked))} files, application ${arch}`)
  return installer
}
