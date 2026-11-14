/**
 * Rewrite the space padding out of the PE version resource, in place.
 *
 * Inno Setup stores every VersionInfo field in a fixed-width buffer, so the compiled installer reports
 * `ProductVersion` as `2.2.12` plus 44 spaces and `ProductName` as the name plus trailing spaces. The
 * updater in shipped builds (2.2.11 and 2.2.12) compares those strings with `!==`, so a brand-new
 * installer that still carries the padding can never be accepted by the client that is already
 * installed: the download finishes and then the app reports "更新未完成，请重试".
 *
 * Trimming here rescues those installations: the old client's exact comparison then succeeds, because
 * the value it reads is the bare version. Nothing else about the resource changes — every node keeps
 * its `wLength`, so the offsets readers rely on stay valid; only the value, its `wValueLength` and the
 * padding behind it are rewritten.
 *
 * Usage: `node scripts/trim-version-info.ts <setup.exe> [more files]`
 */
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export interface VersionInfoChange {
  readonly key: string
  readonly before: string
  readonly after: string
}

const RT_VERSION = 16

function align4(value: number): number {
  return (value + 3) & ~3
}

/** Read a NUL-terminated UTF-16LE string and report where its terminator ended. */
function readWideString(buffer: Buffer, offset: number, limit: number): { text: string; end: number } {
  let end = offset
  while (end + 1 < limit && !(buffer[end] === 0 && buffer[end + 1] === 0)) end += 2
  return { text: buffer.toString('utf16le', offset, end), end: Math.min(end + 2, limit) }
}

/**
 * Walk one VS_VERSIONINFO node tree and trim the trailing spaces of every string value.
 *
 * `wType` cannot distinguish a StringTable from a String (both use 1), so a node counts as a string
 * when its parent is a StringTable — identified by the eight hex digits Inno and every other writer
 * uses as the language/codepage key.
 */
export function trimVersionInfoBlock(
  buffer: Buffer,
  start: number,
  length: number,
  changes: VersionInfoChange[] = [],
): VersionInfoChange[] {
  const walk = (offset: number, end: number, parentKey: string | undefined, depth: number): void => {
    while (offset + 6 <= end) {
      const nodeLength = buffer.readUInt16LE(offset)
      const valueLength = buffer.readUInt16LE(offset + 2)
      const type = buffer.readUInt16LE(offset + 4)
      if (nodeLength < 6 || offset + nodeLength > end) return
      const nodeEnd = offset + nodeLength
      const key = readWideString(buffer, offset + 6, nodeEnd)
      const valueOffset = align4(key.end)
      // VS_VERSION_INFO stores the byte size of VS_FIXEDFILEINFO; a string stores a character count.
      const valueBytes = depth === 0 ? valueLength : valueLength * 2
      const isString = type === 1 && parentKey !== undefined && /^[0-9a-f]{8}$/i.test(parentKey)
      if (isString && valueBytes > 0 && valueOffset + 2 <= nodeEnd) {
        const raw = buffer.toString('utf16le', valueOffset, Math.min(valueOffset + valueBytes, nodeEnd))
        const text = raw.replace(/[\u0000]+$/, '')
        const trimmed = text.replace(/ +$/, '')
        if (trimmed !== text) {
          const written = trimmed.length + 1
          buffer.fill(0, valueOffset, Math.min(valueOffset + valueBytes, nodeEnd))
          buffer.write(trimmed, valueOffset, 'utf16le')
          buffer.writeUInt16LE(written, offset + 2)
          changes.push({ key: key.text, before: text, after: trimmed })
        }
      }
      const childStart = align4(valueOffset + valueBytes)
      if (childStart < nodeEnd) walk(childStart, nodeEnd, key.text, depth + 1)
      offset = align4(nodeEnd)
    }
  }
  walk(start, start + length, undefined, 0)
  return changes
}

/** Locate RT_VERSION inside the PE resource directory and trim every string it holds. */
export function trimVersionInfoStrings(pe: Buffer): VersionInfoChange[] {
  if (pe.length < 0x40 || pe.toString('latin1', 0, 2) !== 'MZ') throw new Error('not a PE image: missing DOS header')
  const peOffset = pe.readUInt32LE(0x3c)
  if (peOffset + 0x18 > pe.length || pe.toString('latin1', peOffset, peOffset + 4) !== 'PE\0\0') throw new Error('not a PE image: missing PE signature')
  const sections = pe.readUInt16LE(peOffset + 6)
  const optionalSize = pe.readUInt16LE(peOffset + 20)
  const optional = peOffset + 24
  const magic = pe.readUInt16LE(optional)
  const directorySize = magic === 0x20b ? 112 : magic === 0x10b ? 96 : 0
  if (directorySize === 0) throw new Error('not a PE image: unknown optional header magic')
  const resourceRva = pe.readUInt32LE(optional + directorySize + 2 * 8)
  if (resourceRva === 0) throw new Error('the image has no resource directory')
  const sectionTable = optional + optionalSize
  const toOffset = (rva: number): number => {
    for (let index = 0; index < sections; index += 1) {
      const entry = sectionTable + index * 40
      const virtualSize = pe.readUInt32LE(entry + 8)
      const virtualAddress = pe.readUInt32LE(entry + 12)
      const rawSize = pe.readUInt32LE(entry + 16)
      const rawPointer = pe.readUInt32LE(entry + 20)
      const span = Math.max(virtualSize, rawSize)
      if (rva >= virtualAddress && rva < virtualAddress + span) return rawPointer + (rva - virtualAddress)
    }
    throw new Error(`RVA 0x${rva.toString(16)} is outside every section`)
  }
  const root = toOffset(resourceRva)
  const entries = (directory: number): { id: number; target: number; subdirectory: boolean }[] => {
    const named = pe.readUInt16LE(directory + 12)
    const ids = pe.readUInt16LE(directory + 14)
    const found: { id: number; target: number; subdirectory: boolean }[] = []
    for (let index = 0; index < named + ids; index += 1) {
      const entry = directory + 16 + index * 8
      const name = pe.readUInt32LE(entry)
      const target = pe.readUInt32LE(entry + 4)
      found.push({ id: name & 0x7fffffff, target: root + (target & 0x7fffffff), subdirectory: (target & 0x80000000) !== 0 })
    }
    return found
  }
  const descend = (directory: number, id: number): number | undefined => {
    const match = entries(directory).find(entry => entry.subdirectory && entry.id === id)
    return match?.target
  }
  const typeDirectory = descend(root, RT_VERSION)
  if (typeDirectory === undefined) throw new Error('the image has no RT_VERSION resource')
  const nameDirectory = entries(typeDirectory)[0]
  if (!nameDirectory?.subdirectory) throw new Error('the RT_VERSION resource has no name entry')
  const languageDirectory = entries(nameDirectory.target)[0]
  if (!languageDirectory) throw new Error('the RT_VERSION resource has no language entry')
  const dataEntry = languageDirectory.target
  const dataRva = pe.readUInt32LE(dataEntry)
  const dataSize = pe.readUInt32LE(dataEntry + 4)
  return trimVersionInfoBlock(pe, toOffset(dataRva), dataSize)
}

async function main(argv: readonly string[]): Promise<void> {
  if (argv.length === 0) throw new Error('usage: node scripts/trim-version-info.ts <setup.exe> [more files]')
  for (const file of argv) {
    const image = await readFile(file)
    const changes = trimVersionInfoStrings(image)
    if (changes.length === 0) { console.log(`${file}: already trimmed`); continue }
    await writeFile(file, image)
    for (const change of changes) console.log(`${file}: ${change.key} "${change.before}" -> "${change.after}"`)
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
