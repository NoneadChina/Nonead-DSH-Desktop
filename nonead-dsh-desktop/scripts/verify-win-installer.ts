import { readFileSync } from 'node:fs'
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
assertPortableExecutable(join(outputRoot, `Nonead-DSH-Desktop-${version}-${arch}-Setup.exe`), 'Next NSIS installer')
assertPortableExecutable(join(outputRoot, unpacked, 'Nonead DSH Desktop.exe'), 'Next application')
