import { expect, it, vi } from 'vitest'
import {
  DEEP_LINK_ACTIONS,
  DEEP_LINK_PROTOCOL,
  deepLinkFromArgv,
  isSupportedDeepLinkAction,
  parseDeepLink,
  registerDeepLinkProtocol,
} from '../src/deep-link.ts'

it('parses the supported dsh-desktop link shapes', () => {
  expect(DEEP_LINK_PROTOCOL).toBe('dsh-desktop')
  expect(parseDeepLink('dsh-desktop://settings/general')).toEqual({
    url: 'dsh-desktop://settings/general', action: 'settings', segments: ['general'], params: {},
  })
  expect(parseDeepLink('dsh-desktop://open?path=/x&path=/y')).toEqual({
    url: 'dsh-desktop://open?path=/x&path=/y', action: 'open', segments: [], params: { path: '/x' },
  })
  expect(parseDeepLink('  dsh-desktop:Settings/Permissions  ')).toEqual({
    url: 'dsh-desktop:Settings/Permissions', action: 'settings', segments: ['Permissions'], params: {},
  })
  expect(parseDeepLink('dsh-desktop://settings')).toEqual({ url: 'dsh-desktop://settings', action: 'settings', segments: [], params: {} })
})

it('ignores other schemes and malformed values', () => {
  expect(parseDeepLink('https://example.com/settings')).toBeUndefined()
  expect(parseDeepLink('dsh-desktop-fake://settings')).toBeUndefined()
  expect(parseDeepLink('')).toBeUndefined()
  expect(parseDeepLink('   ')).toBeUndefined()
  expect(parseDeepLink('dsh-desktop://')).toBeUndefined()
  // @ts-expect-error non-string arguments come from unchecked process argv entries.
  expect(parseDeepLink(undefined)).toBeUndefined()
})

it('picks the first link from an argv list and skips installer arguments', () => {
  expect(deepLinkFromArgv(['/app', '--dsh-installer-quit'])).toBeUndefined()
  const link = deepLinkFromArgv(['/app', '--dsh-installer-quit', 'dsh-desktop://settings/profiles', 'dsh-desktop://open'])
  expect(link?.action).toBe('settings')
  expect(link?.segments).toEqual(['profiles'])
  expect(deepLinkFromArgv(['dsh-desktop://broken url'])).toBeUndefined()
})

it('claims the scheme for a packaged build and for a source run', () => {  const application = { setAsDefaultProtocolClient: vi.fn(() => true) }
  expect(registerDeepLinkProtocol(application)).toBe(true)
  expect(application.setAsDefaultProtocolClient).toHaveBeenCalledExactlyOnceWith('dsh-desktop')
  expect(registerDeepLinkProtocol(application, '/electron', ['/app'])).toBe(true)
  expect(application.setAsDefaultProtocolClient).toHaveBeenLastCalledWith('dsh-desktop', '/electron', ['/app'])
  expect(registerDeepLinkProtocol({ setAsDefaultProtocolClient: () => { throw new Error('denied') } })).toBe(false)
  expect(registerDeepLinkProtocol({ setAsDefaultProtocolClient: () => false })).toBe(false)
})

it('accepts only the documented actions', () => {
  expect([...DEEP_LINK_ACTIONS]).toEqual(['settings', 'open'])
  expect(isSupportedDeepLinkAction('settings')).toBe(true)
  expect(isSupportedDeepLinkAction('open')).toBe(true)
  // Any local process can launch `dsh-desktop://…`, so everything else must be dropped.
  for (const action of ['unknown', 'shell', 'settings2', '', 'settings/x', 'open?path=/x']) {
    expect(isSupportedDeepLinkAction(action)).toBe(false)
  }

  const unknown = parseDeepLink('dsh-desktop://unknown?command=calc')
  expect(unknown?.action).toBe('unknown')
  expect(unknown && isSupportedDeepLinkAction(unknown.action)).toBe(false)
  const supported = parseDeepLink('dsh-desktop://settings/permissions')
  expect(supported && isSupportedDeepLinkAction(supported.action)).toBe(true)
})
