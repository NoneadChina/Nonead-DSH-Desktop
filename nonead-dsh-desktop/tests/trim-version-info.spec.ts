import { Buffer } from 'node:buffer'
import { expect, it } from 'vitest'
import { trimVersionInfoBlock, trimVersionInfoStrings, type VersionInfoChange } from '../scripts/trim-version-info.ts'

/** Build one VS_VERSIONINFO node, padding keys, values and children the way the format requires. */
function node(key: string, value: Buffer, type: number, valueLength: number, children: Buffer[] = []): Buffer {
  const keyBytes = Buffer.from(`${key}\0`, 'utf16le')
  const valueOffset = (6 + keyBytes.length + 3) & ~3
  const childOffset = (valueOffset + value.length + 3) & ~3
  const childrenLength = children.reduce((total, child) => total + child.length, 0)
  const out = Buffer.alloc(childOffset + childrenLength)
  out.writeUInt16LE(out.length, 0)
  out.writeUInt16LE(valueLength, 2)
  out.writeUInt16LE(type, 4)
  keyBytes.copy(out, 6)
  value.copy(out, valueOffset)
  let at = childOffset
  for (const child of children) { child.copy(out, at); at += child.length }
  return out
}

/** A String node whose value is padded with spaces into a fixed-width buffer, as Inno Setup writes it. */
function string(key: string, text: string, width: number): Buffer {
  const padded = text.padEnd(width, ' ')
  return node(key, Buffer.from(`${padded}\0`, 'utf16le'), 1, padded.length + 1)
}

function versionInfo(version: string): Buffer {
  return node('VS_VERSION_INFO', Buffer.alloc(52), 0, 52, [
    node('StringFileInfo', Buffer.alloc(0), 1, 0, [
      node('040904B0', Buffer.alloc(0), 1, 0, [
        string('ProductName', 'Nonead DSH Desktop', 60),
        string('ProductVersion', version, 50),
        string('FileVersion', version, 20),
      ]),
    ]),
  ])
}

function valueOf(block: Buffer, key: string): string {
  const needle = Buffer.from(`${key}\0`, 'utf16le')
  const at = block.indexOf(needle)
  if (at < 0) throw new Error(`missing ${key}`)
  const valueOffset = (at + needle.length + 3) & ~3
  let end = valueOffset
  while (end + 1 < block.length && !(block[end] === 0 && block[end + 1] === 0)) end += 2
  return block.toString('utf16le', valueOffset, end)
}

it('trims the fixed-width space padding Inno Setup writes into version strings', () => {
  const block = versionInfo('2.2.12')
  const originalLength = block.length
  expect(valueOf(block, 'ProductVersion')).toBe('2.2.12'.padEnd(50))

  const changes: VersionInfoChange[] = trimVersionInfoBlock(block, 0, block.length)

  expect(valueOf(block, 'ProductVersion')).toBe('2.2.12')
  expect(valueOf(block, 'ProductName')).toBe('Nonead DSH Desktop')
  expect(valueOf(block, 'FileVersion')).toBe('2.2.12')
  expect(changes.map(change => change.key).sort()).toEqual(['FileVersion', 'ProductName', 'ProductVersion'])
  // Every node keeps its length, so resource offsets readers rely on stay valid.
  expect(block.length).toBe(originalLength)
  expect(block.readUInt16LE(0)).toBe(originalLength)
})

it('is idempotent and leaves already-trimmed strings alone', () => {
  const block = versionInfo('2.2.12')
  trimVersionInfoBlock(block, 0, block.length)
  const again = trimVersionInfoBlock(block, 0, block.length)
  expect(again).toEqual([])
  expect(valueOf(block, 'ProductVersion')).toBe('2.2.12')
})

it('refuses anything that is not a PE image instead of silently doing nothing', () => {
  expect(() => trimVersionInfoStrings(Buffer.from('not a pe image at all'))).toThrow('not a PE image')
})
