/**
 * Presentation of an item's Host-resolved media inside the market page.
 *
 * Catalog contract v1 standardizes a single media slot, the plugin icon, and
 * the Host normalizes that slot to an image. Non-image attachments (video,
 * audio, PDF, archives) are hosted next to the icon in later contract
 * revisions; this module already classifies such an entry from its declared
 * file name so the card and the detail view can render a type label, its size
 * and a link that opens it with the system handler, instead of an `<img>` that
 * would only fail.
 */

export type MarketMediaKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'archive'
  | 'document'
  | 'other'

/** One media slot as the Renderer receives it, with optional forward-compatible metadata. */
export interface MarketMediaReference {
  readonly assetRef: string
  readonly role: string
  readonly alt?: string
  /** Original file name when the Host exposes one; it is the only kind signal. */
  readonly name?: string
  /** Declared byte length when the Host exposes one. */
  readonly bytes?: number
}

/** A media slot with everything the market page needs to render it. */
export interface MarketMediaPreview {
  readonly assetRef: string
  readonly role: string
  readonly alt?: string
  readonly kind: MarketMediaKind
  /** Lowercase extension used as the compact badge text, when a name was given. */
  readonly extension?: string
  readonly name?: string
  /** Human-readable size, for example `1.4 MB`. */
  readonly size?: string
}

const KIND_BY_EXTENSION: Readonly<Record<string, MarketMediaKind>> = {
  avif: 'image',
  bmp: 'image',
  gif: 'image',
  jpeg: 'image',
  jpg: 'image',
  png: 'image',
  svg: 'image',
  webp: 'image',
  m4v: 'video',
  mkv: 'video',
  mov: 'video',
  mp4: 'video',
  webm: 'video',
  aac: 'audio',
  flac: 'audio',
  m4a: 'audio',
  mp3: 'audio',
  ogg: 'audio',
  wav: 'audio',
  pdf: 'pdf',
  '7z': 'archive',
  gz: 'archive',
  rar: 'archive',
  tar: 'archive',
  tgz: 'archive',
  xz: 'archive',
  zip: 'archive',
  csv: 'document',
  doc: 'document',
  docx: 'document',
  json: 'document',
  md: 'document',
  ppt: 'document',
  pptx: 'document',
  txt: 'document',
  xls: 'document',
  xlsx: 'document',
  xml: 'document',
  yaml: 'document',
  yml: 'document',
}

/** Lowercase extension of a file name, without the dot. */
export function marketMediaExtension(name: string | undefined): string | undefined {
  if (typeof name !== 'string') return undefined
  const trimmed = name.trim()
  const dot = trimmed.lastIndexOf('.')
  if (dot <= 0 || dot === trimmed.length - 1) return undefined
  const extension = trimmed.slice(dot + 1).toLowerCase()
  return /^[a-z0-9]{1,12}$/.test(extension) ? extension : undefined
}

/**
 * Classify a media slot. Without a file name the slot keeps the v1 meaning of
 * the icon: an image.
 */
export function marketMediaKindOf(name: string | undefined): MarketMediaKind {
  const extension = marketMediaExtension(name)
  if (extension === undefined) return name === undefined ? 'image' : 'other'
  return KIND_BY_EXTENSION[extension] ?? 'other'
}

/** Compact byte size; integer units below one megabyte, one decimal above it. */
export function formatMarketMediaSize(bytes: number | undefined): string | undefined {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return undefined
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`
  const megabytes = kilobytes / 1024
  if (megabytes < 1024) return `${megabytes.toFixed(1)} MB`
  return `${(megabytes / 1024).toFixed(1)} GB`
}

/**
 * Project the item's media slots into render-ready previews. The helper takes
 * the raw contract shape so an unknown or malformed optional field degrades to
 * the v1 icon instead of throwing inside render.
 */
export function marketMediaPreviewsOf(item: {
  readonly media?: {
    readonly icon?: {
      readonly assetRef: string
      readonly role: string
      readonly alt?: unknown
      readonly name?: unknown
      readonly bytes?: unknown
    }
  }
}): readonly MarketMediaPreview[] {
  const icon = item.media?.icon
  if (icon === undefined) return []
  const name = typeof icon.name === 'string' && icon.name.trim().length > 0 ? icon.name.trim() : undefined
  const size = formatMarketMediaSize(typeof icon.bytes === 'number' ? icon.bytes : undefined)
  const extension = marketMediaExtension(name)
  const alt = typeof icon.alt === 'string' && icon.alt.trim().length > 0 ? icon.alt : undefined
  return [{
    assetRef: icon.assetRef,
    role: icon.role,
    kind: marketMediaKindOf(name),
    ...(alt === undefined ? {} : { alt }),
    ...(extension === undefined ? {} : { extension }),
    ...(name === undefined ? {} : { name }),
    ...(size === undefined ? {} : { size }),
  }]
}
