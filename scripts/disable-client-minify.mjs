#!/usr/bin/env node
/**
 * Keep upstream client bundles multi-line so `patches/*@<runtime>.patch` stay
 * line-addressable.
 *
 * deepseek-harness 0.2.2-rc.2 enables whitespace-only minification for browser
 * bundles (`minify: { compress: false, mangle: false }` in
 * packages/client/tsdown.client.ts). That collapses every bundle onto a couple
 * of very long lines, so the desktop patches — which edit readable, multi-line
 * artifacts — can no longer apply. Disabling the option only changes whitespace
 * in the emitted bundles; identifiers, semantics and sourcemaps are unchanged.
 *
 * The upstream release tarballs we vendor are built with this step applied, so
 * `yarn upstream:prepare-runtime` must reproduce it. Older upstream pins have
 * no such option and are left untouched.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const configPath = join(root, 'deepseek-harness', 'packages', 'client', 'tsdown.client.ts')
const option = '    minify: { compress: false, mangle: false },\n'
const marker = '    // dsh-desktop: keep bundles multi-line so desktop patches stay line-addressable.\n'
const replacement = `${marker}    // minify: { compress: false, mangle: false },\n`

if (!existsSync(configPath)) {
  throw new Error(`disable-client-minify: missing ${configPath}`)
}
const source = readFileSync(configPath, 'utf8')
if (source.includes(marker)) {
  process.stdout.write('disable-client-minify: already disabled\n')
} else if (source.includes(option)) {
  writeFileSync(configPath, source.replace(option, replacement))
  process.stdout.write('disable-client-minify: disabled whitespace-only client minification\n')
} else {
  process.stdout.write('disable-client-minify: upstream has no client minify option; nothing to do\n')
}
