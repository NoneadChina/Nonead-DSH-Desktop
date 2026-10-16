import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertPortableExecutable } from '../../dsh-plugin-desktop-beta/scripts/verify-win-installer.ts'
const root = fileURLToPath(new URL('..', import.meta.url))
const { version: sourceVersion } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
// `DSH_NONEAD_BUILD_VERSION` lets a drill build a release whose version differs
// from the source tree (see scripts/package.ts); electron-builder names the
// artifact after that override, so the verifier must follow it too.
const version = process.env.DSH_NONEAD_BUILD_VERSION ?? process.env.DSH_NEXT_BUILD_VERSION ?? sourceVersion
assertPortableExecutable(join(root, 'dist', `Nonead-DSH-Desktop-${version}-x64-Setup.exe`), 'Next NSIS installer')
assertPortableExecutable(join(root, 'dist', 'win-unpacked', 'Nonead DSH Desktop.exe'), 'Next application')
