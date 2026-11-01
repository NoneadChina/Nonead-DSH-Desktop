/** Focused tests for the Linux artifact verifier: ELF identity, package metadata and the six-artifact gate. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, expect, it } from 'vitest'
import { linuxArtifactName, readDebArchitecture, readElfArch, readRpmArchitecture, verifyLinuxArtifacts } from '../scripts/verify-linux-artifacts.ts'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'linux-artifacts-'))
  roots.push(root)
  return root
}

/** ELF64 little-endian header of one CPU, as a shared object the verifier only inspects. */
function elf(arch: 'x64' | 'arm64'): Buffer {
  const header = Buffer.alloc(4096)
  header.writeUInt32BE(0x7f454c46, 0)
  header[4] = 2
  header[5] = 1
  header.writeUInt16LE(arch === 'x64' ? 62 : 183, 18)
  return header
}

/** One AppImage runtime: an ELF image with the AppImage type magic in `e_ident` padding. */
function appImage(arch: 'x64' | 'arm64'): Buffer {
  const image = Buffer.alloc(2 * 1024 * 1024)
  elf(arch).copy(image)
  image[8] = 0x41
  image[9] = 0x49
  image[10] = 0x02
  return image
}

/** One tar stream holding a single file. */
function tar(name: string, data: Buffer): Buffer {
  const header = Buffer.alloc(512)
  header.write(name, 0, 'utf8')
  header.write('0000644\0', 100, 'ascii')
  header.write('0000000\0', 108, 'ascii')
  header.write('0000000\0', 116, 'ascii')
  header.write(`${data.byteLength.toString(8).padStart(11, '0')}\0`, 124, 'ascii')
  header.write('00000000000\0', 136, 'ascii')
  header.write('        ', 148, 'ascii')
  header.write('0', 156, 'ascii')
  header.write('ustar\0', 257, 'ascii')
  let sum = 0
  for (const byte of header) sum += byte
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii')
  return Buffer.concat([header, data, Buffer.alloc((512 - (data.byteLength % 512)) % 512), Buffer.alloc(1024)])
}

/** One ar member. */
function arMember(name: string, data: Buffer): Buffer {
  const header = Buffer.alloc(60)
  header.write(`${name}/`.padEnd(16, ' '), 0, 'ascii')
  header.write('0'.padEnd(12, ' '), 16, 'ascii')
  header.write('0'.padEnd(6, ' '), 28, 'ascii')
  header.write('0'.padEnd(6, ' '), 34, 'ascii')
  header.write('100644'.padEnd(8, ' '), 40, 'ascii')
  header.write(String(data.byteLength).padEnd(10, ' '), 48, 'ascii')
  header.write('`\n', 58, 'ascii')
  return Buffer.concat([header, data, Buffer.alloc(data.byteLength % 2)])
}

/** One Debian package with the architecture its control file declares. */
function deb(arch: string): Buffer {
  const control = tar('control', Buffer.from(`Package: nonead-dsh-desktop\nVersion: 2.2.4\nArchitecture: ${arch}\n`, 'utf8'))
  // The verifier rejects implausibly small artifacts; a real package's data member is far larger
  // than its control member, so the fixture pads the (undecompressed) payload like one.
  const payload = Buffer.concat([gzipSync(Buffer.alloc(1024)), Buffer.alloc(2 * 1024 * 1024)])
  return Buffer.concat([
    Buffer.from('!<arch>\n', 'ascii'),
    arMember('debian-binary', Buffer.from('2.0\n', 'ascii')),
    arMember('control.tar.gz', gzipSync(control)),
    arMember('data.tar.gz', payload),
  ])
}

/** One rpm package whose leading header carries its `ARCH` tag string. */
function rpm(arch: string): Buffer {
  const packageFile = Buffer.alloc(2 * 1024 * 1024)
  packageFile.writeUInt32BE(0xedabeedb, 0)
  packageFile.write(arch, 4096, 'ascii')
  return packageFile
}

/** A complete dist tree for one product version. */
function dist(version: string, overrides: { appImage?: { arch: 'x64' | 'arm64'; bytes: Buffer }; deb?: { arch: string; bytes: Buffer } } = {}): string {
  const desktopRoot = workspace()
  const out = join(desktopRoot, 'dist')
  mkdirSync(out, { recursive: true })
  for (const arch of ['x64', 'arm64'] as const) {
    const image = overrides.appImage?.arch === arch ? overrides.appImage.bytes : appImage(arch)
    writeFileSync(join(out, linuxArtifactName(version, 'AppImage', arch)), image, { mode: 0o755 })
    const control = arch === 'x64' ? 'amd64' : 'arm64'
    const packageFile = overrides.deb?.arch === arch ? overrides.deb.bytes : deb(control)
    writeFileSync(join(out, linuxArtifactName(version, 'deb', arch)), packageFile)
    writeFileSync(join(out, linuxArtifactName(version, 'rpm', arch)), rpm(arch === 'x64' ? 'x86_64' : 'aarch64'))
  }
  for (const [directory, arch] of [['linux-unpacked', 'x64'], ['linux-arm64-unpacked', 'arm64']] as const) {
    mkdirSync(join(out, directory), { recursive: true })
    writeFileSync(join(out, directory, 'nonead-dsh-desktop'), elf(arch), { mode: 0o755 })
  }
  return desktopRoot
}

it('names every artifact the way Electron Builder spells the CPU', () => {
  expect(linuxArtifactName('2.2.4', 'AppImage', 'x64')).toBe('Nonead-DSH-Desktop-2.2.4-x86_64.AppImage')
  expect(linuxArtifactName('2.2.4', 'AppImage', 'arm64')).toBe('Nonead-DSH-Desktop-2.2.4-arm64.AppImage')
  expect(linuxArtifactName('2.2.4', 'deb', 'x64')).toBe('Nonead-DSH-Desktop-2.2.4-amd64.deb')
  expect(linuxArtifactName('2.2.4', 'deb', 'arm64')).toBe('Nonead-DSH-Desktop-2.2.4-arm64.deb')
  expect(linuxArtifactName('2.2.4', 'rpm', 'x64')).toBe('Nonead-DSH-Desktop-2.2.4-x86_64.rpm')
  expect(linuxArtifactName('2.2.4', 'rpm', 'arm64')).toBe('Nonead-DSH-Desktop-2.2.4-aarch64.rpm')
})

it('reads the CPU out of an ELF header and rejects everything else', () => {
  const root = workspace()
  writeFileSync(join(root, 'x64'), elf('x64'))
  writeFileSync(join(root, 'arm64'), elf('arm64'))
  writeFileSync(join(root, 'script'), `#!/bin/sh\n${'#'.repeat(64)}\n`)
  expect(readElfArch(join(root, 'x64'), 'x64 fixture')).toBe('x64')
  expect(readElfArch(join(root, 'arm64'), 'arm64 fixture')).toBe('arm64')
  expect(() => readElfArch(join(root, 'script'), 'script fixture')).toThrow(/ELF header/u)
})

it('reads the architecture a Debian package and an rpm declare', () => {
  const root = workspace()
  writeFileSync(join(root, 'arm64.deb'), deb('arm64'))
  writeFileSync(join(root, 'x64.rpm'), rpm('x86_64'))
  expect(readDebArchitecture(join(root, 'arm64.deb'))).toBe('arm64')
  expect(readRpmArchitecture(join(root, 'x64.rpm')).arch).toBe('x86_64')
})

it('accepts a complete six-artifact tree for both CPUs', () => {
  const desktopRoot = dist('2.2.4')
  const verified = verifyLinuxArtifacts({ desktopRoot, version: '2.2.4', executableName: 'nonead-dsh-desktop' })
  expect(verified).toHaveLength(6)
  expect(verified.map(artifact => `${artifact.target}:${artifact.arch}:${artifact.declaredArch}`)).toEqual([
    'AppImage:x64:x64', 'AppImage:arm64:arm64',
    'deb:x64:amd64', 'deb:arm64:arm64',
    'rpm:x64:x86_64', 'rpm:arm64:aarch64',
  ])
})

it('rejects an artifact that declares another CPU than its name', () => {
  const desktopRoot = dist('2.2.4', { deb: { arch: 'arm64', bytes: deb('amd64') } })
  expect(() => verifyLinuxArtifacts({ desktopRoot, version: '2.2.4', executableName: 'nonead-dsh-desktop' })).toThrow(/declares architecture amd64, expected arm64/u)
})

it('rejects an AppImage whose runtime is the other CPU', () => {
  const desktopRoot = dist('2.2.4', { appImage: { arch: 'arm64', bytes: appImage('x64') } })
  expect(() => verifyLinuxArtifacts({ desktopRoot, version: '2.2.4', executableName: 'nonead-dsh-desktop' })).toThrow(/arm64 AppImage runs an x64 runtime/u)
})

it('reports a missing artifact instead of accepting an incomplete release', () => {
  const desktopRoot = dist('2.2.4')
  rmSync(join(desktopRoot, 'dist', linuxArtifactName('2.2.4', 'rpm', 'arm64')))
  expect(() => verifyLinuxArtifacts({ desktopRoot, version: '2.2.4', executableName: 'nonead-dsh-desktop' })).toThrow(/arm64 rpm is missing/u)
})
