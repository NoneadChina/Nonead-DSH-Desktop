/** Launcher facts shared by embedded and isolated Desktop Hosts. */
import { delimiter } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { readProfilePatches, type ProfileContext } from '@deepseek-ai/dsh-app-boot'
import type { AppReady } from '@deepseek-ai/dsh-cmdline'
import type { DesktopPnpmBootstrap } from './pnpm.ts'
import { withDesktopPnpmPolicy } from './pnpm-policy.ts'
import { desktopInstallAnchor, type PreparedDesktopProfile } from './profile.ts'

/** Keep package operations and subsequent HMR on the launcher's actual Profile. */
export function createDesktopProfileBoot(prepared: PreparedDesktopProfile, pnpm: DesktopPnpmBootstrap) {
  const options = prepared.reloadOptions
  if (pnpm.activeProfileName !== options.profileName || pnpm.activeProfileDir !== prepared.profile.dir
    || pnpm.homeDir !== prepared.homeDir) {
    throw new Error('Desktop Profile context and package-manager identity disagree')
  }
  const inheritedPath = Object.entries(process.env).find(([key]) => key.toUpperCase() === 'PATH')?.[1]
  // 重读路径（配置编辑器写入校验、HMR、插件管理）只拿得到本 context，而它们内部的
  // readProfilePatches 会做 […磁盘层, …patchPath, …home, …overlays]。桌面组合出的层若不从这里
  // 出去，重读就会丢掉它们——旧版由 ProfileContext.readPatches 重新组合，故不存在该问题。
  // 基线用 readProfilePatches 自身算，保证与重读逻辑逐字一致；按序列化键去重，避免重复追加。
  const contextSeed = {
    name: options.profileName,
    dir: prepared.profile.dir,
    patchPath: prepared.profile.patchPath,
    installAnchor: desktopInstallAnchor(),
    cwd: process.cwd(),
    home: prepared.homeDir,
    startedBundles: prepared.profile.layers.map(layer => layer.packageName),
    telemetryDisabledEnv: options.telemetryDisabled,
  }
  const baselineKey = (patch: unknown): string => JSON.stringify(patch)
  const diskKeys = new Set(readProfilePatches(options.profileName, {
    ...contextSeed,
    overlays: [],
  } as ProfileContext).map(baselineKey))
  const composedOverlays = prepared.patches.filter(patch => !diskKeys.has(baselineKey(patch)))
  const context: ProfileContext = {
    ...contextSeed,
    overlays: structuredClone([...(prepared.overlays ?? []), ...composedOverlays]),
    packageManager: {
      command: pnpm.appExecutable,
      args: ['--import', pathToFileURL(pnpm.clearEnvironmentPath).href, pnpm.pnpmBinPath,
        ...withDesktopPnpmPolicy([])],
      env: {
        PATH: [pnpm.nodeBinDir, inheritedPath].filter(Boolean).join(delimiter),
        NODE: pnpm.nodeShimPath,
        ELECTRON_RUN_AS_NODE: '1',
        DSH_HOME: prepared.homeDir,
        CI: 'true',
        npm_config_runtime: 'electron',
        npm_config_target: pnpm.electronVersion,
        npm_config_disturl: 'https://electronjs.org/headers',
      },
    },
  }
  let ready = false
  let disposed = false
  const listeners = new Set<() => void>()
  const readiness: AppReady = {
    onReady(listener) {
      if (disposed) return () => {}
      if (ready) listener()
      else listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
  return {
    prepare(ctx: Context): void {
      ctx.provide('profileContext', context)
      ctx.provide('appReady', readiness)
      ctx.effect(() => () => { disposed = true; listeners.clear() }, 'Desktop Profile readiness')
    },
    /** Signal only after boot has settled successfully, never on a failed tree. */
    markReady(): void {
      if (disposed || ready) return
      ready = true
      const pending = [...listeners]
      listeners.clear()
      for (const listener of pending) listener()
    },
  }
}
