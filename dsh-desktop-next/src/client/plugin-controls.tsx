/** Desktop choices on the official Plugins overview, using its manager and existing controls. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { BundleInfo } from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { Button, PluginArtworkDefault, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { Choice, MARKET_OPTIONS, marketBody, marketTitle } from '../../../dsh-plugin-desktop-beta/src/client/DesktopSettingsSection.tsx'
import { en as desktopEn, zh as desktopZh, type DesktopSettingsLocaleKey } from '../../../dsh-plugin-desktop-beta/src/client/desktop-settings-locales.ts'
import { ComputerUseSettings } from './computer-use.tsx'
import { COMMUNITY_MARKET as COMMUNITY, DSH_MARKET as MARKET, marketToggleTargets, type MarketName } from './market-toggle.ts'

const REMOTE = '@agents-anywhere/dsh-bridge-next'
const COMPUTER_ITEM = 'desktop-next-computer-use'

type Translate = (cn: string, en: string) => string

export function registerPluginControls(ctx: Context): void {
  ctx.inject(['remote', 'remote.pluginManager'], inner => {
    // 0.2.1-alpha.2 删除了 plugins.overview 与 plugins.bundle.hidden。与 dsh-plugin-desktop/-beta 一致，
    // 这里不再注册自定义总览视图，只把 Computer Use 挂到上游现存的交互位上。
    inner.slots.inject('plugins.item', () => {
      const item = inner.slots.register({ name: 'plugins.item', id: COMPUTER_ITEM, label: 'Computer Use',
        locale: 'desktop-next', inject: () => ({ context: inner }),
      }, ComputerUseItem)
      const actions = inner.slots.register({ name: 'plugins.detail.actions', id: COMPUTER_ITEM,
        locale: 'desktop-next', inject: () => ({ context: inner }),
      }, ComputerUseActions)
      return () => { actions(); item() }
    })
  })
}

const computerDescription = (t: Translate): string => t(
  '让 AI 查看屏幕、操作鼠标和键盘。截图理解需要支持图片输入的模型。',
  'Let AI view the screen and control the mouse and keyboard. Understanding screenshots requires a model with image input.',
)

function ComputerUseItem({ context, t, view }: PropsLocale<'desktop-next'> & PropsRuntime<'plugins.item'> & { context: Context }) {
  const zh = t('language') === 'zh'
  if (view === 'summary') return computerDescription((cn, en) => zh ? cn : en)
  return <ComputerUseSettings context={context} zh={zh} mode="page" />
}

function ComputerUseActions({ context, t, subject }: PropsLocale<'desktop-next'> & PropsRuntime<'plugins.detail.actions'> & { context: Context }) {
  if (subject.kind !== 'item' || subject.id !== COMPUTER_ITEM) return null
  return <ComputerUseSettings context={context} zh={t('language') === 'zh'} mode="actions" />
}

