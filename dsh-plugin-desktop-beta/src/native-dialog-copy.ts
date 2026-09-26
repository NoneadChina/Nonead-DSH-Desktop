/** Localized copy for Desktop-owned native dialogs and notifications. */

import type { DesktopLocale } from './runtime.ts'

export interface DesktopNativeCopy {
  readonly ok: string
  readonly pluginRecoveryTitle: string
  readonly pluginRecoveryMessage: string
  readonly unknownPlugin: string
  readonly missingPluginError: string
  readonly failedPlugins: string
  readonly pluginRecoveryInstructions: string
  readonly openTerminal: string
  readonly restart: string
  readonly dismiss: string
  readonly updateAvailableTitle: string
  readonly updateAvailableMessage: (version: string) => string
  readonly downloadUpdate: string
  readonly installStableAlongsideBeta: string
  readonly download: string
  readonly later: string
  readonly updateCheckFailedTitle: string
  readonly updateCheckFailedMessage: string
  readonly tryAgainLater: string
  readonly upToDateTitle: string
  readonly upToDateMessage: string
  readonly installedVersion: (version: string) => string
  readonly installerUnavailable: string
  readonly updateDownloadedTitle: string
  readonly updateReady: (version: string) => string
  readonly updateFailedTitle: string
  readonly updateFailedMessage: (version: string) => string
  readonly macInstallInstructions: string
  readonly windowsInstallQuestion: string
  readonly restartAndInstall: string
  readonly saveInstallerTitle: string
  readonly saveAndDownload: string
  readonly diskImage: string
  readonly windowsInstaller: string
  readonly removeInstallerTitle: string
  readonly updateInstalled: (version: string) => string
  readonly removeInstallerQuestion: (path: string) => string
  readonly deleteInstaller: string
  readonly keepInstaller: string
  readonly terminalErrorTitle: string
  readonly terminalErrorMessage: string
  readonly diagnosticsErrorTitle: string
  readonly diagnosticsErrorMessage: string
  readonly skippedPluginTitle: string
  readonly skippedPluginBody: (name: string, additionalCount: number) => string
  readonly unsupportedStorageTitle: string
  readonly unsupportedStorageBody: (label: string) => string
  readonly profileCompatibilityTitle: string
  readonly profileCompatibilityMessage: (profileName: string, previousProductName?: string) => string
  readonly profileCompatibilityDetail: (
    previousDesktopVersion: string,
    previousDshVersion: string,
    currentProductName: string,
    currentDesktopVersion: string,
    currentDshVersion: string,
  ) => string
  readonly profileCompatibilityUnknownDetail: (
    currentProductName: string,
    currentDesktopVersion: string,
    currentDshVersion: string,
  ) => string
  readonly profileCompatibilityWarning: string
  readonly switchProfile: string
  readonly useProfileAnyway: string
  readonly quit: string
  readonly unknownVersion: string
}

const COPY: Record<DesktopLocale, DesktopNativeCopy> = {
  en: {
    ok: 'OK',
    pluginRecoveryTitle: 'Plugin Load Failed',
    pluginRecoveryMessage: 'Some plugins could not be loaded.',
    unknownPlugin: 'Unknown client plugin',
    missingPluginError: 'The plugin loader did not provide an error message.',
    failedPlugins: 'Plugins that failed to load:',
    pluginRecoveryInstructions: 'Update or uninstall the failed third-party plugins in DSH Terminal, then restart the app.',
    openTerminal: 'Open DSH Terminal',
    restart: 'Restart Nonead DSH Desktop',
    dismiss: 'Dismiss',
    updateAvailableTitle: 'Nonead DSH Desktop Update Available',
    updateAvailableMessage: version => `Nonead DSH Desktop ${version} is available.`,
    downloadUpdate: 'Download this update now?',
    installStableAlongsideBeta: 'Install the stable edition alongside Nonead DSH Desktop Beta? The Beta app will remain installed.',
    download: 'Download',
    later: 'Later',
    updateCheckFailedTitle: 'Unable to Check for Updates',
    updateCheckFailedMessage: 'Could not retrieve update information.',
    tryAgainLater: 'Please try again later.',
    upToDateTitle: 'Nonead DSH Desktop Is Up to Date',
    upToDateMessage: 'You are using the latest version.',
    installedVersion: version => `Installed version: ${version}`,
    installerUnavailable: 'This version cannot download installers from within the app.',
    updateDownloadedTitle: 'Nonead DSH Desktop Update Downloaded',
    updateReady: version => `Nonead DSH Desktop ${version} is ready to install.`,
    updateFailedTitle: 'Update Failed',
    updateFailedMessage: version => `The update to Nonead DSH Desktop ${version} could not be completed.`,
    macInstallInstructions: 'The disk image has opened. Replace Nonead DSH Desktop in Applications, then reopen it.',
    windowsInstallQuestion: 'Restart Nonead DSH Desktop and run the installer now?',
    restartAndInstall: 'Restart and Install',
    saveInstallerTitle: 'Save Update Installer',
    saveAndDownload: 'Save and Download',
    diskImage: 'Disk Image',
    windowsInstaller: 'Windows Installer',
    removeInstallerTitle: 'Remove Update Installer',
    updateInstalled: version => `Nonead DSH Desktop ${version} has been installed.`,
    removeInstallerQuestion: path => `Delete the downloaded installer to free disk space?\n\n${path}`,
    deleteInstaller: 'Delete Installer',
    keepInstaller: 'Keep Installer',
    terminalErrorTitle: 'Unable to Open DSH Terminal',
    terminalErrorMessage: 'Could not start the terminal. Please try again.',
    diagnosticsErrorTitle: 'Unable to Export Diagnostics',
    diagnosticsErrorMessage: 'Could not create the diagnostic archive. Please try again.',
    skippedPluginTitle: 'UI Plugin Not Loaded',
    skippedPluginBody: (name, additionalCount) => additionalCount > 0
      ? `${name} and ${additionalCount} other UI ${additionalCount === 1 ? 'plugin are' : 'plugins are'} not installed in this Profile.`
      : `${name} is not installed in this Profile.`,
    unsupportedStorageTitle: 'Storage May Be Unsupported',
    unsupportedStorageBody: label => `${label} is on a volume that may prevent sandboxed commands or plugin installation from working.`,
    profileCompatibilityTitle: 'Profile Compatibility Warning',
    profileCompatibilityMessage: profileName =>
      `The Desktop version last used by the current Profile “${profileName}” differs from the current version:`,
    profileCompatibilityDetail: (previousDesktopVersion, previousDshVersion, _currentProductName, currentDesktopVersion, currentDshVersion) =>
      `Last Desktop/DSH version: ${previousDesktopVersion}/${previousDshVersion}\nCurrent Desktop/DSH version: ${currentDesktopVersion}/${currentDshVersion}`,
    profileCompatibilityUnknownDetail: (_currentProductName, currentDesktopVersion, currentDshVersion) =>
      `Last Desktop/DSH version: Unknown/Unknown\nCurrent Desktop/DSH version: ${currentDesktopVersion}/${currentDshVersion}`,
    profileCompatibilityWarning: 'DSH version differences may cause:\n1. Historical session information to fail to load;\n2. Some plugins in the current Profile to be incompatible and possibly cause errors or crashes.\nWe recommend switching to a compatible Profile or creating a new Profile.',
    switchProfile: 'Switch Profile',
    useProfileAnyway: 'Use Anyway',
    quit: 'Quit',
    unknownVersion: 'Unknown',
  },
  zh: {
    ok: '确定',
    pluginRecoveryTitle: '插件加载失败',
    pluginRecoveryMessage: '部分插件未能加载。',
    unknownPlugin: '未知客户端插件',
    missingPluginError: '插件加载器没有提供错误信息。',
    failedPlugins: '加载失败的插件：',
    pluginRecoveryInstructions: '请在 DSH 终端中更新或卸载加载失败的第三方插件，然后重启应用。',
    openTerminal: '打开 DSH 终端',
    restart: '重启 Nonead DSH Desktop',
    dismiss: '关闭',
    updateAvailableTitle: 'Nonead DSH Desktop 有可用更新',
    updateAvailableMessage: version => `Nonead DSH Desktop ${version} 已可用。`,
    downloadUpdate: '现在下载此更新？',
    installStableAlongsideBeta: '是否同时安装稳定版？Nonead DSH Desktop Beta 将继续保留。',
    download: '下载',
    later: '稍后',
    updateCheckFailedTitle: '无法检查更新',
    updateCheckFailedMessage: '未能获取更新信息。',
    tryAgainLater: '请稍后重试。',
    upToDateTitle: 'Nonead DSH Desktop 已是最新版本',
    upToDateMessage: '当前已是最新版本。',
    installedVersion: version => `当前版本：${version}`,
    installerUnavailable: '当前版本不支持在应用内下载安装包。',
    updateDownloadedTitle: 'Nonead DSH Desktop 更新已下载',
    updateReady: version => `Nonead DSH Desktop ${version} 已可安装。`,
    updateFailedTitle: '更新失败',
    updateFailedMessage: version => `Nonead DSH Desktop ${version} 的更新未能完成。`,
    macInstallInstructions: '磁盘映像已打开。请替换“应用程序”中的 Nonead DSH Desktop，然后重新打开。',
    windowsInstallQuestion: '现在重启 Nonead DSH Desktop 并运行安装程序？',
    restartAndInstall: '重启并安装',
    saveInstallerTitle: '保存更新安装包',
    saveAndDownload: '保存并下载',
    diskImage: '磁盘映像',
    windowsInstaller: 'Windows 安装程序',
    removeInstallerTitle: '删除更新安装包',
    updateInstalled: version => `Nonead DSH Desktop ${version} 已安装。`,
    removeInstallerQuestion: path => `是否删除下载的安装包以释放磁盘空间？\n\n${path}`,
    deleteInstaller: '删除安装包',
    keepInstaller: '保留安装包',
    terminalErrorTitle: '无法打开 DSH 终端',
    terminalErrorMessage: '未能启动终端。请重试。',
    diagnosticsErrorTitle: '无法导出诊断信息',
    diagnosticsErrorMessage: '未能生成诊断包。请重试。',
    skippedPluginTitle: '界面插件未加载',
    skippedPluginBody: (name, additionalCount) => additionalCount > 0
      ? `${name} 及另外 ${additionalCount} 个界面插件未安装在当前 Profile 中。`
      : `${name} 未安装在当前 Profile 中。`,
    unsupportedStorageTitle: '存储位置可能不受支持',
    unsupportedStorageBody: label => `${label} 所在的磁盘可能导致沙盒命令或插件安装无法正常工作。`,
    profileCompatibilityTitle: 'Profile 兼容性警告',
    profileCompatibilityMessage: profileName =>
      `当前 Profile“${profileName}”最后一次使用的桌面版本与当前版本不同：`,
    profileCompatibilityDetail: (previousDesktopVersion, previousDshVersion, _currentProductName, currentDesktopVersion, currentDshVersion) =>
      `最后一次的桌面版/DSH 版本：${previousDesktopVersion}/${previousDshVersion}\n当前的桌面版/DSH 版本：${currentDesktopVersion}/${currentDshVersion}`,
    profileCompatibilityUnknownDetail: (_currentProductName, currentDesktopVersion, currentDshVersion) =>
      `最后一次的桌面版/DSH 版本：未知/未知\n当前的桌面版/DSH 版本：${currentDesktopVersion}/${currentDshVersion}`,
    profileCompatibilityWarning: 'DSH 版本差异可能会导致：\n1. 历史会话信息加载出错；\n2. 当前 Profile 下的部分插件不兼容，甚至引发报错或崩溃。\n建议您切换到兼容的 Profile，或创建新的 Profile。',
    switchProfile: '切换 Profile',
    useProfileAnyway: '仍然使用',
    quit: '退出',
    unknownVersion: '未知',
  },
}

export function desktopNativeCopy(locale: DesktopLocale): DesktopNativeCopy {
  return COPY[locale]
}

const DOWNLOAD_FAILURE_REASON: Record<DesktopLocale, Record<string, string>> = {
  en: {
    aborted: 'The download was cancelled before it finished.',
    'empty-body': 'The update service returned an empty response.',
    'http-status': 'The update service rejected the request.',
    'invalid-artifact': 'The downloaded file was not a valid installer.',
    'invalid-options': 'The selected save location is not usable.',
    network: 'The download was interrupted by a network problem.',
    'response-too-large': 'The installer is larger than the 1 GiB limit.',
    stalled: 'The update service stopped sending data.',
    unknown: 'The update could not be completed.',
  },
  zh: {
    aborted: '下载在完成前被取消。',
    'empty-body': '更新服务返回了空内容。',
    'http-status': '更新服务拒绝了本次请求。',
    'invalid-artifact': '下载到的文件不是有效的安装包。',
    'invalid-options': '选择的保存位置不可用。',
    network: '网络中断导致下载未能完成。',
    'response-too-large': '安装包体积超过 1 GiB 上限。',
    stalled: '更新服务长时间没有继续传输数据。',
    unknown: '更新流程未能完成。',
  },
}

/**
 * Explain one rejected installer download, including that no incomplete file was kept.
 * @param locale - active native locale.
 * @param failure - serializable failure summary from the download owner.
 * @returns localized detail text for the failure dialog.
 */
export function desktopUpdateDownloadFailureDetail(
  locale: DesktopLocale,
  failure: { readonly code: string; readonly status?: number | undefined },
): string {
  const reasons = DOWNLOAD_FAILURE_REASON[locale]
  const status = failure.status === undefined ? '' : ` (HTTP ${String(failure.status)})`
  const reason = reasons[failure.code] ?? reasons.unknown!
  const downloadFailure = failure.code !== 'unknown'
  const advice = downloadFailure
    ? locale === 'zh'
      ? '没有保留任何不完整的文件。请重新选择保存位置并再次下载。'
      : 'No incomplete file was kept. Choose the save location again to retry the download.'
    : locale === 'zh'
      ? '请重新选择保存位置后再试一次。'
      : 'Choose the save location again to retry the update.'
  return `${reason}${status}\n${advice}`
}
