import { expect, it } from 'vitest'
import { encodeVersionBlock, parseVersionBlock, readVersionStrings, trimVersionBlock, type VersionInfoNode } from '../scripts/inno/version-info.ts'

const padded = (text: string, width: number): Buffer => Buffer.from(`${text.padEnd(width, ' ')}\u0000`, 'utf16le')

// The same shape Inno Setup 7 writes: ProductName padded to 60 code units, ProductVersion to 50,
// FileVersion to 20 (measured on a 2.2.13 installer).
const block = encodeVersionBlock({
  key: 'VS_VERSION_INFO',
  type: 0,
  value: Buffer.alloc(52),
  children: [{
    key: 'StringFileInfo',
    type: 1,
    children: [{
      key: '000004b0',
      type: 1,
      children: [
        { key: 'ProductName', type: 1, value: padded('Nonead DSH Desktop', 60), valueInWords: true, children: [] },
        { key: 'ProductVersion', type: 1, value: padded('2.2.13', 50), valueInWords: true, children: [] },
        { key: 'FileVersion', type: 1, value: padded('2.2.13', 20), valueInWords: true, children: [] },
      ],
    }],
  }],
})

it('reads the padded strings verbatim', () => {
  expect(readVersionStrings(parseVersionBlock(block)).ProductVersion).toBe('2.2.13'.padEnd(50, ' '))
})

it('trims trailing padding so the in-app updater can compare the release version', () => {
  const trimmed = trimVersionBlock(block)
  expect(trimmed.savedBytes).toBeGreaterThan(0)
  expect(trimmed.block.length).toBe(block.length - trimmed.savedBytes)
  expect(readVersionStrings(parseVersionBlock(trimmed.block))).toMatchObject({
    ProductName: 'Nonead DSH Desktop',
    ProductVersion: '2.2.13',
    FileVersion: '2.2.13',
  })
})

it('keeps the rebuilt block 4-byte aligned and re-parseable', () => {
  const node: VersionInfoNode = parseVersionBlock(trimVersionBlock(block).block)
  expect(node.key).toBe('VS_VERSION_INFO')
  expect(trimVersionBlock(block).block.length % 4).toBe(0)
})
