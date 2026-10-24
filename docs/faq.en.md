# Nonead DSH Desktop FAQ

This page answers common questions about installation, platforms, runtime requirements, plugins, updates, and networking for the current version 2.1.18. The feature scope follows the [latest GitHub Release](https://github.com/anywhere-labs/deepseek-harness-desktop/releases/latest) and the [user guide](user-guide.en.md); the user guide describes the interface flows and limits in more detail.

## What is Nonead DSH Desktop?

Nonead DSH Desktop is an open-source desktop client for DeepSeek Harness on Windows and macOS. It wraps the official Harness local Web interface, Host service, and plugin system in a native application and adds windows, a system tray, a terminal, updates, profile management, and the bundled DSH Community Market plugin market.

## Is this an official DeepSeek product?

No. Nonead DSH Desktop is a community-maintained, independent open-source project. It is not affiliated with or endorsed by DeepSeek; the project name only describes its technical relationship to the official [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Which operating systems are supported?

The release scripts for official installers cover Windows x64 and universal macOS (Intel and Apple Silicon); the Linux x64 AppImage and Debian packages are built by the CI `desktop-linux` job using the Beta workspace and are x64 only. On Linux the in-app update only checks the version and downloads no installer, so upgrading means downloading the AppImage again.

## Do I need to install Node.js, pnpm, or DSH first?

No. The installer already contains Electron, Node.js, pnpm, and a pinned DSH runtime (currently DSH `0.2.1-rc.3`). You can start right after installing, and Desktop does not modify the global PATH or your shell configuration.

## Does the first launch download a runtime?

No. The runtime and pinned dependencies ship inside the installer, which is why the package is large: it buys a predictable first launch and version combination. The first launch prepares a default profile locally and starts the local Web interface; the network is needed for cloud models, update checks, and the plugin market.

## Does Nonead DSH Desktop modify official Harness?

No. The repository imports the unmodified official Harness at a pinned upstream commit (the Beta channel pin is `1f81c047`, corresponding to DSH `0.2.1-rc.3`, recorded in the root `upstream.json`). Compatibility mode runs the upstream default Web client below a separate desktop frame; the extended and advanced modes install the Desktop-owned root registration through plugin and profile composition boundaries while still hosting the official occupants. No mode edits upstream source.

## Is my data stored locally?

The Host, profiles, and DSH home live on your machine. Whether content leaves the machine depends on the model or tool providers you configure; with a cloud model, those requests still go to that provider. The window position (`window-state.json`), skipped versions, update cache, and logs live in the application's own user-data directory.

## How do I install plugins?

Use the official Harness plugin system. Open DSH Terminal from the tray and run `dsh plugin add`, `dsh plugin remove`, and `dsh plugin update`; commands target the active profile by default, and `--profile <name>` makes the target explicit. Restart the application after plugin changes.

## What can the plugin market do?

The bundled DSH Community Market browses and installs plugins and is mutually exclusive with `dsh-market` in a profile's bundles. It can preview non-image media such as video and install a plugin by name. The market choice made in the first-run wizard is remembered, including "no market", so reopening the wizard does not ask again. The brand skin plugin `dsh-nonead-client-skin` ships inside the installer and is loaded by default for every profile through profile composition.

## Do Desktop profiles and existing profiles sync automatically?

Plugins are never copied automatically. Each profile has its own bundles and dependency set, and after switching profiles the terminal's default plugin commands target the new active profile. Official profiles normally share one DSH home, so sessions, settings, and storage need no migration; a profile whose patch deliberately redirects the persistence root wins instead. Profile configuration is read, modified, and written by a single writer, so saving several settings at once cannot overwrite each other.

## Can I open a folder at launch?

Yes, but only DSH Desktop Beta: run `dsh-desktop-beta <folder>`, or drop a folder onto a Beta shortcut. The folder is registered as a workspace and opened, and one that is already a workspace is only opened again; this is one-shot, so a restart triggered from settings does not reopen it. Nonead DSH Desktop can only choose a directory inside the interface.

## Why does closing the window not quit the app?

When a tray is available, closing the window only hides it by default, and the Host and local services keep running. Quit from the tray menu to end everything, or turn off the close-to-tray preference first. Without a tray, closing the last window quits.

## Will my window end up offscreen after changing monitors?

No. The application remembers the window position and size (including the maximized state) and, before restoring, checks whether the saved position still intersects a mounted display: at least 160 by 80 pixels must be visible, otherwise the creation defaults of 1280 by 840 are used; even when it does intersect, the window is pushed inside the work area, so unplugging an external monitor or changing the scale factor never restores it offscreen.

## How do I make the app start at login?

Turn on "open at login" in settings. The switch reads the state the operating system actually recorded rather than a copy kept by the application, and shows disabled when the system refuses the registration. It cannot be changed in safe or recovery mode. You may also edit the operating system's own startup entry; the switch reflects the real result.

## Can a link or script open settings directly?

Yes. The application claims the `dsh-desktop://` scheme, so `dsh-desktop://settings/general` opens the settings page; the first segment is the action and the remaining segments are passed to the interface as a path. A link that arrives before the window is ready is queued and delivered after the interface loads, and a link that names no recognizable action is ignored.

## How does the application update?

Packaged applications check the version in the background (endpoint `https://www.nonead.com/software/ndsh-desktop/version`), sending the installed version, the channel (`stable` or `beta`), and a randomly generated, locally persisted installation identifier in the request headers. Background failures are silent and never interrupt use, and a newer version only updates the tray state without opening a download confirmation by itself. The tray update item checks the current channel manually and displays a result. Nonead DSH Desktop downloads into the application cache, verifies the package, and installs it; DSH Desktop Beta first opens a native save dialog for the installer location, and cancelling it starts no download. A version response may carry release notes: the update card in settings shows them, and Beta's download confirmation dialog includes them too. Installers come from the fixed URLs `https://www.nonead.com/software/ndsh-desktop/downloads/mac` and `.../windows`; the download request and its redirects carry neither the installation identifier nor the current version.

## How do I skip a release?

Choose "Skip this version" on the update card. The choice is written into the application data directory and persisted, so scheduled background checks stop offering that version and the choice survives restarts; "Stop skipping" clears the record so the version is offered again. A later release is offered anyway.

## What if an update fails or the new version misbehaves?

Download and installer failures never damage the running version. When an installation fails, the tray and the update card offer "Retry install"; the downloaded, prepared installer is kept, so retrying does not download it again. If you already installed a version that misbehaves, the recovery assistant can roll back to a saved configuration snapshot — the selectable snapshots are not limited to the last successful start but also include those taken before installation and plugin changes or before a profile repair, and every restore first backs up the current configuration, so the rollback itself can be rolled back.

## Is the installer signature checked?

On Windows the application currently compares only `ProductName` and `ProductVersion` in the PE version resource, with no cryptographic verification and no certificate or publisher check (2.1.15 reverted the signature and publisher checks introduced earlier). On macOS it verifies the identity, version, and signing team of the application inside the disk image. That identity check exists only in the Stable shell; the Beta shell's download path checks just the installer magic bytes and size, then executes the installer. The download path enforces a SHA-256 digest once the service publishes it. If you need stronger provenance, get the installer from the official download page and check the verification data published with the release.

## Does the app use my system proxy?

Yes. At startup the application reads the operating system proxy configuration through Chromium — Windows Internet Options, macOS network settings, Linux desktop settings, including automatic configuration scripts (PAC/WPAD) — and applies it to its own requests: model conversations, web fetches, web search, MCP services, plugin installs, and commands it starts in the terminal. Turning on the "system proxy" switch in a client such as Clash or v2rayN is enough. A few rules:

- **Your own proxy wins**: if `HTTPS_PROXY`, `HTTP_PROXY`, or `ALL_PROXY` is set before launch (including in `.env`), the application uses it; `NO_PROXY` applies as well.
- **Restart after changing the proxy**: the proxy configuration is read once at startup, so after toggling the system proxy or switching nodes in the client, quit and reopen the application.
- **SOCKS-only configurations do not work**: the HTTP egress accepts only `http://` and `https://` proxies; if the system proxy is SOCKS only, enable an HTTP or mixed port in the client.
- **Local addresses never use the proxy**: `localhost`, `127.0.0.1`, and local network addresses bypass it.
- **On macOS and Linux, launching from the Dock or Finder does not read proxy variables from shell files**: this is deliberate, because a proxy URL may embed credentials; use the system proxy settings or launch from a terminal instead.
- **How to confirm it took effect**: every startup logs one `outbound proxy = ...` line whose `source` is `system`, `environment`, or `none`; logs live in `logs/` under the application data directory and can be packaged with "Export diagnostics".

## Does `.env` override my system environment variables?

No. The application reads a `.env` from its own user-data directory (in development also the repository root), and that layer only fills variables the Host child process would otherwise miss: an already defined environment variable wins, a file never replaces a real environment variable, and `process.env` itself is never modified. The syntax is strict `KEY=VALUE` with no variable expansion, escaping, or inline comments; a key takes its first assignment, and every skipped line produces one warning in the diagnostics log.

## A panel such as "Files" keeps returning HTTP 4xx — how do I debug it?

The usual cause is an enabled plugin that is missing a service it depends on and therefore stays pending: the route it would have registered never appears, so requests from the interface get 4xx. Search `logs/` in the data directory for `pending (waiting for service:` (the data directory defaults to `~/.dsh`, so logs are in `~/.dsh/logs/`); a matching line names the plugin and the missing service:

```text
better-sidebar (dsh-better-sidebar): pending (waiting for service: webRuntime)
```

"Export diagnostics" packages the same logs. Disable that plugin (or run `dsh plugin remove` in DSH Terminal) and restart to get the official panels back.

## Where do I download it and report problems?

Download the installer from the [product download page](https://www.dshdesktop.cn/) or the [latest GitHub Release](https://github.com/anywhere-labs/deepseek-harness-desktop/releases/latest). When you hit a problem, read the troubleshooting part of the [user guide](user-guide.en.md) first; if that does not help, open a [GitHub Issue](https://github.com/anywhere-labs/deepseek-harness-desktop/issues/new/choose) with your operating system, application version, reproduction steps, and error text. For network problems, include the `outbound proxy = ...` line from the log.

## Related documentation

- [User guide](user-guide.en.md)
- [Why a desktop edition](why-desktop.en.md)
- [Architecture](architecture.en.md)
- [Plugin development](plugin-development.en.md)
- [Documentation index](README.en.md)
