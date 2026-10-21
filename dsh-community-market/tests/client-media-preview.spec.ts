import { describe, expect, it } from 'vitest'
import {
  formatMarketMediaSize,
  marketMediaExtension,
  marketMediaKindOf,
  marketMediaPreviewsOf,
} from '../src/client/media-preview.js'

describe('market media previews', () => {
  it('classifies a media slot by its file extension', () => {
    expect(marketMediaKindOf('logo.png')).toBe('image')
    expect(marketMediaKindOf('demo.mp4')).toBe('video')
    expect(marketMediaKindOf('voiceover.MP3')).toBe('audio')
    expect(marketMediaKindOf('manual.pdf')).toBe('pdf')
    expect(marketMediaKindOf('release.zip')).toBe('archive')
    expect(marketMediaKindOf('notes.md')).toBe('document')
    expect(marketMediaKindOf('payload.bin')).toBe('other')
    expect(marketMediaKindOf('no-extension')).toBe('other')
  })

  it('keeps the version 1 meaning of an icon slot that declares no file name', () => {
    expect(marketMediaKindOf(undefined)).toBe('image')
    expect(marketMediaExtension(undefined)).toBeUndefined()
    expect(marketMediaExtension('.hidden')).toBeUndefined()
    expect(marketMediaExtension('trailing.')).toBeUndefined()
    expect(marketMediaExtension('archive.tar.gz')).toBe('gz')
  })

  it('formats a declared byte length for display', () => {
    expect(formatMarketMediaSize(512)).toBe('512 B')
    expect(formatMarketMediaSize(2048)).toBe('2 KB')
    expect(formatMarketMediaSize(1_572_864)).toBe('1.5 MB')
    expect(formatMarketMediaSize(2_147_483_648)).toBe('2.0 GB')
    expect(formatMarketMediaSize(undefined)).toBeUndefined()
    expect(formatMarketMediaSize(Number.NaN)).toBeUndefined()
    expect(formatMarketMediaSize(-1)).toBeUndefined()
  })

  it('projects the icon slot into a render-ready preview', () => {
    expect(marketMediaPreviewsOf({})).toEqual([])
    expect(marketMediaPreviewsOf({ media: {} })).toEqual([])

    const [image] = marketMediaPreviewsOf({
      media: { icon: { assetRef: 'mktimg_abc', role: 'plugin-icon', alt: 'Plugin icon' } },
    })
    expect(image).toEqual({ assetRef: 'mktimg_abc', role: 'plugin-icon', alt: 'Plugin icon', kind: 'image' })

    const [video] = marketMediaPreviewsOf({
      media: {
        icon: {
          assetRef: 'mktimg_video',
          role: 'plugin-icon',
          alt: 'Walkthrough',
          name: 'walkthrough.mp4',
          bytes: 1_572_864,
        },
      },
    })
    expect(video).toEqual({
      assetRef: 'mktimg_video',
      role: 'plugin-icon',
      alt: 'Walkthrough',
      kind: 'video',
      extension: 'mp4',
      name: 'walkthrough.mp4',
      size: '1.5 MB',
    })
  })

  it('degrades a malformed optional field instead of throwing during render', () => {
    const [preview] = marketMediaPreviewsOf({
      media: { icon: { assetRef: 'mktimg_odd', role: 'plugin-icon', name: 42, bytes: 'big', alt: '  ' } },
    })
    expect(preview).toEqual({ assetRef: 'mktimg_odd', role: 'plugin-icon', kind: 'image' })
  })
})
