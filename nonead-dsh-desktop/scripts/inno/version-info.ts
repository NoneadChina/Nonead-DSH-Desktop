/**
 * Inno Setup 7 写版本资源时会把 `ProductName` / `ProductVersion` / `FileVersion` 按固定宽度
 * 用空格补齐（实测 60 / 50 / 20 个 UTF-16 码元），换 `VersionInfo*` 写法也消不掉。
 *
 * 应用内的更新器要按 `ProductVersion` 与发布版本做**精确**比较，带尾随空格就永远不相等，
 * 于是「下载到最后提示更新未完成」。所以安装包产出后必须把填充去掉。
 *
 * 不能用 Win32 的 `BeginUpdateResourceW` / `UpdateResourceW`：Inno 把压缩后的安装数据
 * **追加在 PE 映像之后**，那条 API 只重写映像、把尾部的数据整块丢掉（实测 2,096,828 B →
 * 889,344 B，版本资源也读空了）。这里改为就地点补丁：解析 PE 资源目录找到 RT_VERSION，
 * 解析 → 裁剪 → 重新序列化 → 写回**同一偏移**，块变短时补零到原长度。文件总尺寸、
 * 各节偏移与尾部载荷一个字节都不动。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const RT_VERSION = 16
const FILE_VERSION_LANGUAGE = 1033

export interface VersionInfoNode {
  /** `szKey`：根为 `VS_VERSION_INFO`，字符串项为值名（如 `ProductVersion`）。 */
  key: string
  /** 0 = 二进制值（VS_FIXEDFILEINFO），1 = 文本。 */
  type: number
  /** 原始值字节；字符串值含结尾 NUL。 */
  value?: Buffer
  /** 字符串块（String / StringTable 的父级）的 wValueLength 以 UTF-16 码元计，不是字节。 */
  valueInWords?: boolean
  children: VersionInfoNode[]
}

export interface VersionInfoSummary {
  productName: string
  productVersion: string
  fileVersion: string
  /** 版本资源块被裁掉的字节数（补零填充后仍占原位）。 */
  savedBytes: number
}

interface Section {
  virtualSize: number
  virtualAddress: number
  rawSize: number
  rawPointer: number
}

const align4 = (value: number): number => (value + 3) & ~3

function readUtf16Z(block: Buffer, start: number, limit: number): { text: string; next: number } {
  let cursor = start
  let text = ''
  while (cursor + 1 < limit) {
    const code = block.readUInt16LE(cursor)
    cursor += 2
    if (code === 0) return { text, next: cursor }
    text += String.fromCharCode(code)
  }
  throw new Error('Unterminated version info key')
}

/** StringTable 的键是 8 位十六进制语言/代码页组合（如 `000004b0`）。 */
const isStringTableKey = (key: string): boolean => /^[0-9a-f]{8}$/iu.test(key)

function parseNode(block: Buffer, start: number, end: number, parentKey: string): VersionInfoNode {
  if (start + 6 > end) throw new Error('Truncated version info node')
  const length = block.readUInt16LE(start)
  const valueLength = block.readUInt16LE(start + 2)
  const type = block.readUInt16LE(start + 4)
  if (length < 6 || start + length > end) throw new Error(`Invalid version info node length ${String(length)}`)
  const nodeEnd = start + length
  const { text: key } = readUtf16Z(block, start + 6, nodeEnd)
  let cursor = start + align4(6 + (key.length + 1) * 2)
  let value: Buffer | undefined
  let valueInWords = false
  if (valueLength > 0) {
    const words = isStringTableKey(parentKey) ? valueLength * 2 : valueLength
    if (cursor + words > nodeEnd) throw new Error(`Version info value of ${key} overruns its node`)
    valueInWords = isStringTableKey(parentKey)
    value = block.subarray(cursor, cursor + words)
    cursor = start + align4(cursor - start + words)
  }
  const children: VersionInfoNode[] = []
  while (cursor + 6 <= nodeEnd) {
    const childLength = block.readUInt16LE(cursor)
    if (childLength === 0) break
    children.push(parseNode(block, cursor, nodeEnd, key))
    // Inno 的 wLength 不含节尾对齐补位，下一个兄弟节点从 4 字节边界开始。
    cursor = align4(cursor + childLength)
  }
  return { key, type, value, valueInWords, children }
}

function encodeNode(node: VersionInfoNode): Buffer {
  const parts: Buffer[] = []
  let length = 0
  const push = (part: Buffer): void => { parts.push(part); length += part.length }
  const pad = (): void => { const extra = (4 - (length % 4)) % 4; if (extra > 0) push(Buffer.alloc(extra)) }
  push(Buffer.alloc(6))
  push(Buffer.from(`${node.key}\u0000`, 'utf16le'))
  pad()
  let valueLength = 0
  if (node.value) {
    valueLength = node.valueInWords ? node.value.length / 2 : node.value.length
    push(node.value)
    pad()
  }
  for (const child of node.children) push(encodeNode(child))
  pad()
  const out = Buffer.concat(parts, length)
  out.writeUInt16LE(length, 0)
  out.writeUInt16LE(valueLength, 2)
  out.writeUInt16LE(node.type, 4)
  return out
}

function trimNode(node: VersionInfoNode): void {
  if (node.value && node.valueInWords) {
    const text = node.value.toString('utf16le').replace(/\u0000+$/u, '')
    const trimmed = text.replace(/[ \t]+$/u, '')
    if (trimmed !== text) node.value = Buffer.from(`${trimmed}\u0000`, 'utf16le')
  }
  for (const child of node.children) trimNode(child)
}

/** 把版本资源里所有字符串项的尾随空格与 NUL 去掉，返回重新序列化后的块。 */
export function trimVersionBlock(block: Buffer): { block: Buffer; savedBytes: number } {
  const node = parseNode(block, 0, block.length, '')
  trimNode(node)
  const encoded = encodeNode(node)
  return { block: encoded, savedBytes: block.length - encoded.length }
}

export function parseVersionBlock(block: Buffer): VersionInfoNode {
  return parseNode(block, 0, block.length, '')
}

export function encodeVersionBlock(node: VersionInfoNode): Buffer {
  return encodeNode(node)
}

/** 扁平读取所有字符串项（`ProductName` / `ProductVersion` / `FileVersion` 等）。 */
export function readVersionStrings(node: VersionInfoNode): Record<string, string> {
  const strings: Record<string, string> = {}
  const walk = (current: VersionInfoNode): void => {
    if (current.valueInWords && current.value) strings[current.key] = current.value.toString('utf16le').replace(/\u0000+$/u, '')
    for (const child of current.children) walk(child)
  }
  walk(node)
  return strings
}

function rvaToOffset(sections: readonly Section[], rva: number): number {
  for (const section of sections) {
    const span = Math.max(section.virtualSize, section.rawSize)
    if (rva >= section.virtualAddress && rva < section.virtualAddress + span) return section.rawPointer + (rva - section.virtualAddress)
  }
  throw new Error(`RVA 0x${rva.toString(16)} is not backed by any section`)
}

function readSections(buffer: Buffer, table: number, count: number): Section[] {
  const sections: Section[] = []
  for (let index = 0; index < count; index += 1) {
    const entry = table + index * 40
    sections.push({
      virtualSize: buffer.readUInt32LE(entry + 8),
      virtualAddress: buffer.readUInt32LE(entry + 12),
      rawSize: buffer.readUInt32LE(entry + 16),
      rawPointer: buffer.readUInt32LE(entry + 20),
    })
  }
  return sections
}

interface ResourceEntry { id: number; named: boolean; target: number }

function readDirectory(buffer: Buffer, resourceOffset: number, relative: number): ResourceEntry[] {
  const base = resourceOffset + relative
  const named = buffer.readUInt16LE(base + 12)
  const ids = buffer.readUInt16LE(base + 14)
  const entries: ResourceEntry[] = []
  for (let index = 0; index < named + ids; index += 1) {
    const entry = base + 16 + index * 8
    const name = buffer.readUInt32LE(entry)
    entries.push({ id: name & 0x7fffffff, named: (name & 0x80000000) !== 0, target: buffer.readUInt32LE(entry + 4) })
  }
  return entries
}

/** 定位 RT_VERSION 资源数据在文件中的偏移与长度（不改动任何字节）。 */
export function locateVersionResource(buffer: Buffer): { offset: number; size: number } {
  if (buffer.length < 0x40 || buffer.readUInt16LE(0) !== 0x5a4d) throw new Error('Not a PE image')
  const peOffset = buffer.readUInt32LE(0x3c)
  if (buffer.readUInt32LE(peOffset) !== 0x00004550) throw new Error('Not a PE image')
  const coff = peOffset + 4
  const sectionCount = buffer.readUInt16LE(coff + 2)
  const optionalSize = buffer.readUInt16LE(coff + 16)
  const optional = coff + 20
  const magic = buffer.readUInt16LE(optional)
  const directories = optional + (magic === 0x20b ? 112 : 96)
  const resourceRva = buffer.readUInt32LE(directories + 16)
  if (resourceRva === 0) throw new Error('PE image has no resource directory')
  const sections = readSections(buffer, optional + optionalSize, sectionCount)
  const resourceOffset = rvaToOffset(sections, resourceRva)

  const findDirectory = (relative: number, id: number): number => {
    const entry = readDirectory(buffer, resourceOffset, relative).find(item => !item.named && item.id === id)
    if (!entry || (entry.target & 0x80000000) === 0) throw new Error(`Resource directory 0x${relative.toString(16)} has no subdirectory ${String(id)}`)
    return entry.target & 0x7fffffff
  }

  const typeDirectory = findDirectory(0, RT_VERSION)
  const nameDirectory = findDirectory(typeDirectory, 1)
  const languages = readDirectory(buffer, resourceOffset, nameDirectory)
  if (languages.length === 0) throw new Error('RT_VERSION has no language entry')
  const language = languages.find(item => !item.named && item.id === FILE_VERSION_LANGUAGE) ?? languages[0]!
  const dataEntry = resourceOffset + language.target
  const dataRva = buffer.readUInt32LE(dataEntry)
  const size = buffer.readUInt32LE(dataEntry + 4)
  if (size === 0) throw new Error('RT_VERSION resource is empty')
  return { offset: rvaToOffset(sections, dataRva), size }
}

/** 读取安装包内嵌的版本资源（不修改文件）。 */
export function readVersionInfo(path: string): VersionInfoSummary {
  const buffer = readFileSync(path)
  const { offset, size } = locateVersionResource(buffer)
  const strings = readVersionStrings(parseNode(buffer, offset, offset + size, ''))
  return {
    productName: strings.ProductName ?? '',
    productVersion: strings.ProductVersion ?? '',
    fileVersion: strings.FileVersion ?? '',
    savedBytes: 0,
  }
}

/**
 * 就地去掉安装包版本资源里的空格填充，写完回读自检。
 *
 * 只改 RT_VERSION 数据项本身：块变短时把余量清零，文件尺寸与尾部载荷保持原样。
 */
export function stripVersionInfoPadding(path: string): VersionInfoSummary {
  const buffer = readFileSync(path)
  const originalSize = buffer.length
  const { offset, size } = locateVersionResource(buffer)
  const node = parseNode(buffer, offset, offset + size, '')
  trimNode(node)
  const encoded = encodeNode(node)
  if (encoded.length > size) throw new Error(`Trimmed version block (${String(encoded.length)} bytes) does not fit the ${String(size)}-byte resource`)
  encoded.copy(buffer, offset)
  buffer.fill(0, offset + encoded.length, offset + size)

  const strings = readVersionStrings(parseNode(buffer, offset, offset + size, ''))
  const summary: VersionInfoSummary = {
    productName: strings.ProductName ?? '',
    productVersion: strings.ProductVersion ?? '',
    fileVersion: strings.FileVersion ?? '',
    savedBytes: size - encoded.length,
  }
  if (/[ \t]$/u.test(summary.productVersion)) throw new Error(`ProductVersion still has trailing padding: ${JSON.stringify(summary.productVersion)}`)
  if (buffer.length !== originalSize) throw new Error('Version info patch changed the file size')
  writeFileSync(path, buffer)
  return summary
}
