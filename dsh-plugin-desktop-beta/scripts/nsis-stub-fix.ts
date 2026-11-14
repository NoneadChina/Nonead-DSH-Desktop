/**
 * Make electron-builder's NSIS uninstaller step work on this repo's Windows build hosts.
 *
 * `app-builder-lib` builds the uninstaller by compiling a throwaway `BUILD_UNINSTALLER` stub
 * and then *running* it, expecting the stub to write `<installer>__uninstaller.exe` and exit 0.
 * Two things break that on a local Windows host:
 *
 * 1. The stub is executed through `WineVmManager`, which reports the child's exit code. Launched
 *    from the very path makensis just wrote, the NSIS bootloader fails to unpack itself and exits 2
 *    with the modal message "Error writing temporary file. Make sure your temp folder is valid."
 *    (TEMP is writable and the ACLs are fine; copying the same bytes to another path and running the
 *    copy succeeds.) See `docs/evidence/windows-nsis-uninstaller-stub-2026-11-14.md`.
 * 2. Even when it does run, this host's stub relaunches itself, so the parent sees exit code 2 and
 *    electron-builder aborts while the uninstaller has in fact been produced.
 *
 * The fix is to launch a throwaway copy of the stub and to wait for the artifact instead of the
 * exit code. It lives here rather than in `patches/app-builder-lib@26.15.7.patch` because changing
 * that patch rewrites its checksum in `yarn.lock`, which every other checkout would then have to
 * re-resolve; doing it at build time keeps a fresh `yarn install` sufficient.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'

const MARKER = 'DSH-LOCAL running uninstaller stub copy'

const STOCK = [
  '            const wineVm = new WineVm_1.WineVmManager((_a = packager.config.toolsets) === null || _a === void 0 ? void 0 : _a.wine);',
  '            await wineVm.exec(installerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });',
].join('\n')

const PATCHED = [
  '            // DSH-LOCAL(1): the stock path awaits the stub\'s exit code; on this host the stub',
  '            // relaunches itself and the parent gets exit code 2, so wait for the produced artifact instead.',
  '            // DSH-LOCAL(2): the stub must NOT be launched from the very path makensis just wrote:',
  '            // launching that path makes the NSIS bootloader fail with',
  '            // "Error writing temporary file. Make sure your temp folder is valid." and exit 2.',
  '            // Copying the stub to a throwaway path and launching the copy succeeds; the uninstaller',
  '            // is still written to the compiled-in absolute UNINSTALLER_OUT_FILE.',
  '            const childProcess = require("child_process");',
  '            const os = require("os");',
  '            const stubRunDir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-nsis-stub-"));',
  '            let produced = false;',
  '            let lastSize = -1;',
  '            for (let attempt = 1; attempt <= 2 && !produced; attempt += 1) {',
  '                const stubCopy = path.join(stubRunDir, `stub-${attempt}.exe`);',
  '                fs.copyFileSync(installerPath, stubCopy);',
  '                builder_util_1.log.info({ file: installerPath, copy: stubCopy, attempt }, "DSH-LOCAL running uninstaller stub copy");',
  '                const stub = childProcess.spawn(stubCopy, [], {',
  '                    cwd: this.outDir,',
  '                    detached: false,',
  '                    windowsHide: false,',
  '                    stdio: "ignore",',
  '                    env: Object.assign({}, process.env, { __COMPAT_LAYER: "RunAsInvoker" }),',
  '                });',
  '                stub.unref();',
  '                const deadline = Date.now() + 90000;',
  '                lastSize = -1;',
  '                while (Date.now() < deadline) {',
  '                    let size = -1;',
  '                    try {',
  '                        size = fs.statSync(uninstallerPath).size;',
  '                    }',
  '                    catch (_err) { }',
  '                    if (size > 4096 && size === lastSize) {',
  '                        produced = true;',
  '                        break;',
  '                    }',
  '                    lastSize = size;',
  '                    await new Promise((resolve) => setTimeout(resolve, 400));',
  '                }',
  '                try {',
  '                    childProcess.spawnSync("taskkill", ["/F", "/T", "/PID", String(stub.pid)], { stdio: "ignore" });',
  '                }',
  '                catch (_killErr) { }',
  '                if (!produced) {',
  '                    builder_util_1.log.warn({ attempt, file: installerPath }, "DSH-LOCAL uninstaller stub copy produced nothing, retrying");',
  '                }',
  '            }',
  '            try {',
  '                fs.rmSync(stubRunDir, { recursive: true, force: true });',
  '            }',
  '            catch (_cleanupErr) { }',
  '            if (!produced) {',
  '                throw new Error(`DSH-LOCAL: uninstaller stub did not produce ${uninstallerPath}`);',
  '            }',
  '            builder_util_1.log.info({ file: uninstallerPath, size: lastSize }, "DSH-LOCAL uninstaller stub produced the uninstaller");',
].join('\n')

const TARGET_FILE = join('app-builder-lib', 'out', 'targets', 'nsis', 'NsisTarget.js')

/** Find the `app-builder-lib` copy electron-builder will actually load from `builderCli`. */
function locateTarget(builderCli: string): string | undefined {
  let current = dirname(builderCli)
  for (;;) {
    const candidate = join(current, 'node_modules', TARGET_FILE)
    if (existsSync(candidate)) return candidate
    const parent = dirname(current)
    if (parent === current || current === parse(current).root) return undefined
    current = parent
  }
}

/**
 * Apply the stub-launch fix to the `app-builder-lib` that `builderCli` resolves.
 *
 * Returns `'already patched'` when the installed copy carries the fix (or a newer upstream that
 * no longer has the stock call), `'skipped'` when `app-builder-lib` cannot be located next to the
 * CLI at all (no log line: unit tests and unusual layouts use a synthetic CLI path), and throws
 * when the file is present but matches neither shape, so a silent regression cannot reach a
 * release build.
 */
export function ensureNsisStubFix(builderCli: string, log: (message: string) => void = console.log): string {
  const target = locateTarget(builderCli)
  if (target === undefined) return 'skipped'
  const source = readFileSync(target, 'utf8')
  if (source.includes(MARKER)) {
    log(`NSIS uninstaller stub fix already applied: ${target}`)
    return 'already patched'
  }
  if (!source.includes(STOCK)) {
    throw new Error(
      `DSH-LOCAL: ${target} neither carries the NSIS stub fix nor the stock call it replaces. `
        + 'Re-check the fix against the installed app-builder-lib version before packaging.',
    )
  }
  writeFileSync(target, source.replace(STOCK, PATCHED), 'utf8')
  log(`Applied the NSIS uninstaller stub fix to ${target}`)
  return 'patched'
}
