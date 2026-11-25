import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertPortableExecutable } from '../../dsh-plugin-desktop-beta/scripts/verify-win-installer.ts'
const root = fileURLToPath(new URL('..', import.meta.url))
const { version: sourceVersion } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
// `DSH_NONEAD_BUILD_VERSION` lets a drill build a release whose version differs
// from the source tree (see scripts/package.ts); electron-builder names the
// artifact after that override, so the verifier must follow it too.
const version = process.env.DSH_NONEAD_BUILD_VERSION ?? process.env.DSH_NEXT_BUILD_VERSION ?? sourceVersion
// A cross-arch build writes its own output directory and unpacked folder, and names the artifact
// after the requested CPU; the verifier always reads what electron-builder actually produced.
const arch = process.env.DSH_PACKAGE_ARCH ?? 'x64'
const output = process.env.DSH_PACKAGE_OUTPUT_DIR ?? 'dist'
// `DSH_PACKAGE_OUTPUT_DIR` may be absolute (a fresh directory outside the
// project, e.g. when the default dist is still mapped by a running install).
// `join()` would paste the drive letter under the project root, so resolve the
// output directory first and join only the artifact names after it.
const outputRoot = resolve(root, output)
const unpacked = arch === 'x64' ? 'win-unpacked' : `win-${arch}-unpacked`
const mib = 1024 * 1024
// The prepared payload is ~700 MB and compresses to ~300 MB, so anything under
// this bound is not the real package: it is the 541 KB `BUILD_UNINSTALLER` stub
// electron-builder writes when the intermediate installer could not be executed.
const minimumPayloadBytes = 100 * mib
const installerPath = join(outputRoot, `Nonead-DSH-Desktop-${version}-${arch}-Setup.exe`)
const applicationPath = join(outputRoot, unpacked, 'Nonead DSH Desktop.exe')
assertPortableExecutable(installerPath, 'Next NSIS installer')
assertPortableExecutable(applicationPath, 'Next application')
// The installer embeds the whole `.nsis.7z` payload, and electron-builder removes
// that intermediate archive once the installer exists. The archive is therefore
// evidence only while it is still on disk: when it is, the installer must be
// larger than it. The size bound below is the check that always runs — it is what
// separates a real package from the 541 KB `BUILD_UNINSTALLER` stub.
const archives = readdirSync(outputRoot).filter((name) => name.endsWith(`-${version}-${arch}.nsis.7z`))
if (archives.length > 1) {
  throw new Error(
    `expected at most one NSIS payload archive for ${version}/${arch} in ${outputRoot}, found ${archives.length}: ${archives.join(', ')}`,
  )
}
const installerBytes = statSync(installerPath).size
if (installerBytes < minimumPayloadBytes) {
  throw new Error(
    `Next NSIS installer is too small to carry the payload (${installerBytes} bytes < ${minimumPayloadBytes}): ${installerPath}`,
  )
}
const archiveBytes = archives.length === 1 ? statSync(join(outputRoot, archives[0]!)).size : undefined
if (archiveBytes !== undefined && installerBytes <= archiveBytes) {
  throw new Error(
    `Next NSIS installer does not embed its payload (installer ${installerBytes} bytes <= archive ${archiveBytes} bytes): ${installerPath}`,
  )
}
const asarPath = join(outputRoot, unpacked, 'resources', 'app.asar')
const asarBytes = statSync(asarPath).size
if (asarBytes < minimumPayloadBytes) {
  throw new Error(`packaged application archive is too small to be the real package: ${asarPath} (${asarBytes} bytes)`)
}
console.log(
  `Windows installer verification passed: ${installerPath} (${installerBytes} bytes, ` +
    `payload archive ${archiveBytes === undefined ? 'embedded (intermediate removed)' : `${archiveBytes} bytes`}, ` +
    `app.asar ${asarBytes} bytes)`,
)
