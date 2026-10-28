# Nonead DSH Desktop User Guide

This guide is for people who install and use Nonead DSH Desktop. It covers installation and first launch, windows and the tray, profiles, plugins, the terminal, updates, and troubleshooting. The stable Nonead DSH Desktop build is the baseline; differences in DSH Desktop Beta (a separate installer and product identity) are called out explicitly. The current product version is 2.1.15.

## Installation and first launch

Download the macOS or Windows installer from the product download page. The installer already contains Electron, Node.js, pnpm, and a pinned DSH runtime (currently DSH `0.2.2-alpha.2`, shipped with the package and never downloaded), so ordinary users do not need to install Node.js or pnpm separately.

The first launch prepares the default profile and starts the official DSH Web surface locally. The first-run wizard walks through welcome, plugin market, remote control, Computer Use, and recovery mode. The market choice made in the wizard is remembered (choosing "no market" is remembered as well), so reopening the wizard does not ask again. When a tray is available, closing the window only hides it by default; quit from the tray menu instead.

## Launching with a folder (Beta)

Only DSH Desktop Beta accepts a folder at launch: the folder is registered as a workspace and opened, and a folder that is already a workspace is simply opened again rather than duplicated. Nonead DSH Desktop can only choose a directory inside the interface.

```sh
dsh-desktop-beta <folder>
```

`dsh-plugin-desktop-beta` is another command name for the same npm launcher; relative paths resolve against the current directory, and the installed EXE accepts one folder argument as well. When the path does not exist, names a file, or lives on unsupported storage such as exFAT, FAT32, or a network drive, the application shows a native message and registers nothing. Launching with a folder is one-shot: a restart triggered from settings does not reopen it.

Known limits: a Beta icon pinned to the Windows taskbar does not accept drops yet; Linux supports the command line only; macOS supports neither route yet.

## Windows, tray, and open at login

The application remembers the main window's position and size (including the maximized state) and restores them on the next start. Before restoring, it checks whether the saved position still intersects a mounted display: at least 160 by 80 pixels must be visible, otherwise the creation defaults of 1280 by 840 are used; even when it does intersect, the window is pushed inside the work area, so unplugging an external monitor or changing the scale factor never restores it offscreen. The position is stored in `window-state.json` in the application data directory.

The tray menu gathers the entry points for settings, checking for updates, switching profiles, the recovery assistant, opening DSH Terminal, and quitting; Beta additionally has a window mode submenu and an entry to install the stable edition. When no tray is available, closing the last window quits the application.

Settings provides an "open at login" switch. It reads the state the operating system actually recorded rather than a copy kept by the application, reads the value back after writing, and shows disabled when the system refuses the registration. The switch cannot be changed in safe or recovery mode.

Confirmations, warnings, and operation results appear as separate native dialogs (or in a dedicated native settings window) rather than as overlays inside the official page.

## Profiles and recovery

A profile is a composition of DSH bundles, dependencies, and patches. The tray's Profile menu lists existing profiles plus the on-demand `desktop` and `web` defaults. Selecting a profile performs an orderly restart. Beta records the new profile as the usable choice only after the Host, window, and browser client all start successfully, and returns to the previous working choice when startup fails; Nonead DSH Desktop enters its recovery flow when startup fails, and the tray's recovery assistant can roll back to the last successful-start configuration (backing up the current configuration first).

The rollback snapshots are not limited to "the last successful start": snapshots saved before installation and plugin changes or before a profile repair are equally usable. The recovery interface lists the recent healthy snapshots by default and also accepts any named stored snapshot. Every restore first saves and byte-checks a snapshot of the current state, so the rollback itself can be rolled back.

Reading, modifying, and writing profile configuration is serialized through a single writer, so several settings saved at the same time cannot overwrite each other or leave a half-written file. Switching profiles never copies the old profile's plugins into the new one silently: when you need a different plugin set, prepare the profile explicitly in the terminal. Official profiles normally share one DSH home, so sessions, settings, and storage need no migration; a profile whose patch deliberately redirects the persistence root wins instead.

## Window modes and materials

The three window modes are identified as `compatibility`, `extended`, and `advanced`. Beta switches between them from the tray's window mode submenu; Nonead DSH Desktop always runs the compatibility presentation (`compatibility`) and offers no switch.

- **Compatibility mode**: keeps the selected profile's official layout, sidebar, and conversation composition intact below a separate 36-pixel desktop frame. The frame is draggable, its icon actions remain clickable, and official dialogs stay inside the content viewport below it.
- **Extended window**: installs the Desktop-owned layout and sidebar surface, then hosts the official sidebar, conversation, and details occupants inside it; the 36-pixel top frame and the left sidebar surface form one inverted-L material region with a rounded inner corner.
- **Enhanced mode**: retains its own root registration and compact internal captions: macOS uses a 20-pixel content inset with a 32-pixel drag region, Windows a 32-pixel caption row, and it does not reuse the independent extended frame.

macOS can turn the transparent material on or off; Windows has no material choice and always uses an opaque window, with legacy Acrylic and Mica preferences treated as off. Changing the mode or material restarts the application; it does not hot-swap root slots or native materials in a live renderer. Linux provides compatibility mode only.

## Local Web port

Both products let you pin the local Web port in settings. When it is unset, Nonead DSH Desktop defaults to `port: 0` (assigned by the operating system), while Beta starts at the default port 43120 and tries the following ports (up to 32 attempts) when that one is taken. Browser `localStorage` is isolated by origin, so UI plugins that store settings there need a fixed port to read the same settings after Desktop restarts.

- **Nonead DSH Desktop**: enter the port in Desktop settings; the value lives in `desktop-preferences.json` under the data directory (`~/.dsh` by default).
- **DSH Desktop Beta**: the port is `port` in the Desktop shell section of the DSH settings document; that section is keyed by the Loader entry id `desktop-shell` (the 0.1.6 name `dsh-desktop` is migrated automatically):

```yaml
desktop-shell:
  port: 43189
```

The port must be an integer from `0` through `65535` (`0` is assigned by the operating system). Changing it performs an orderly restart. The service binds only to `127.0.0.1` by default; it listens on all network interfaces only after you acknowledge the danger prompt and explicitly allow LAN access in Desktop settings. If another program already uses a fixed port, Nonead DSH Desktop cannot start — release that port or change the setting back to `0` or another available port — while Beta moves on to the following port instead of failing.

## Plugins and the plugin market

Plugins add capabilities such as models, tools, interfaces, and workflows to DSH. Nonead DSH Desktop uses the same plugin system as official Harness, so official plugins install and work directly, and multiple plugins follow the same conventions and can be installed together.

```sh
dsh plugin --profile desktop add <plugin>
dsh plugin --profile desktop remove <plugin>
dsh plugin --profile desktop update
```

In the terminal opened from the tray, `dsh plugin` commands without `--profile` target the active profile; an explicit `--profile <name>` always wins. Restart the application after plugin changes so the new bundle enters the Loader composition.

The bundled DSH Community Market lets you browse and install plugins; it is mutually exclusive with `dsh-market` in the same profile's bundles. The brand skin plugin `dsh-nonead-client-skin` ships inside the installer and is loaded by default for every profile through profile composition. The market can preview non-image media (video, for example) and install a plugin directly by name; market data and install records follow the profile.

## Opening the terminal

Choose "Open DSH Terminal" from the tray or Desktop settings; Beta also offers it from the desktop frame. The settings entry has a restart menu beside it for an ordinary restart or "Restart in Recovery Mode", both requiring confirmation. macOS opens Terminal; Windows prefers Windows Terminal, then PowerShell 7, Windows PowerShell, and finally Command Prompt.

The welcome text shows the application version, active profile, profile directory, and DSH home. Desktop creates private `dsh`, `pnpm`, and `node` shims in its own user-data directory and prepends that directory only for the new terminal process; it does not modify the system PATH or the user's shell files.

## Settings and deep links

Settings contains general, profiles (including create profile), tools, recovery, and permissions areas; the update card lives in the general area. The application claims the `dsh-desktop://` scheme, so a page can be opened directly from a browser, shortcut, or script:

```text
dsh-desktop://settings/general
```

The first segment is the action and the remaining segments are passed to the interface as a path (the link above opens settings). Single-segment forms such as `dsh-desktop:open` are accepted too. A link that arrives before the window is ready is queued and delivered once the interface has loaded; a link that names no recognizable action is ignored. macOS receives links through the system `open-url` event, Windows and Linux through the protocol launch argument.

## Updates

Packaged macOS and Windows applications request `https://www.nonead.com/software/ndsh-desktop/version` in the background. The request carries the installed version (`X-DSH-Desktop-Version`), the release channel (`X-DSH-Desktop-Channel`, either `stable` or `beta`), and a randomly generated, locally persisted installation identifier (`X-DSH-Desktop-Installation-Id`). Startup is not blocked; network errors, non-200 responses, invalid versions, and a server version that is not newer remain silent. A newer version only updates the tray state and never opens a download confirmation by itself; Beta additionally raises one non-blocking system notification per version, and clicking it reveals Desktop.

The tray update item checks the current release channel manually: Nonead DSH Desktop follows `stable` and receives only stable updates, Beta follows `beta`. It shows a result even when the installed version is current and reports a retry message when the check fails. Beta also provides "Install Stable Edition", which installs stable alongside Beta. Cancelling any step never requests the counted download endpoint.

A version response may carry release notes and a notes link. The update card in settings shows "Release notes" and can open the full text; Beta also includes the notes in the native download confirmation dialog. After you confirm a download the flow differs per product:

- **DSH Desktop Beta**: the app first opens the native "Save Update Installer" dialog, defaulting to the Downloads directory. You can choose another directory and filename, and cancelling the dialog does not start a download. Only after the destination is confirmed does the app request the fixed platform download URL and remember the installer location. macOS opens the DMG so you replace the copy in Applications; Windows prepares the NSIS installer and then asks whether to quit and start installation. After the upgrade completes and the app starts again, it asks whether to delete the installer to free disk space or keep it.
- **Nonead DSH Desktop**: no save dialog opens. The installer is downloaded into the app's own user-data cache and verified before installation. macOS hands installation and restart to the system updater; Windows runs the downloaded NSIS installer directly.

Both products use the same fixed download URLs: `https://www.nonead.com/software/ndsh-desktop/downloads/mac` and `https://www.nonead.com/software/ndsh-desktop/downloads/windows`. Download or installer failures do not damage the current version, and the tray operation can be retried; the downloaded installer is kept, so a retried installation does not download it again. After a failed installation you can also roll back to a saved configuration snapshot (see "Profiles and recovery").

Update checking also offers skipping and restoring:

| Action | Behaviour |
| --- | --- |
| Skip this version | The version stops being offered in background checks; the choice is written into the application data directory and survives restarts |
| Stop skipping | Clears the skip record so the version is offered again; a later release is offered anyway |
| Retry install | Reuses the downloaded, prepared installer instead of downloading it again |
| Install and restart | Installs once the package has been prepared |

Current verification rules. macOS verifies the identity, version, and signing team of the application inside the disk image; Windows currently compares only `ProductName` and `ProductVersion` in the PE version resource, with **no cryptographic verification and no certificate or publisher check** (2.1.15 reverted the signature and publisher checks introduced earlier). That identity check exists only in the Stable shell; the Beta shell's download path checks just the installer magic bytes and size (Windows `MZ`/`PE\0\0`, the `koly` trailer for a macOS disk image) and then executes the installer. The download path enforces a SHA-256 digest only once the service publishes it. On Linux the in-app update only checks the version and downloads nothing, so upgrade by downloading the AppImage again.

## Configuration files and environment variables

The application reads a `.env` from its own user-data directory, and in development also from the repository root. That layer only fills variables the Host child process would otherwise miss: an already defined environment variable (including one supplied by a more specific `.env` layer) wins, a file never replaces a real environment variable, and `process.env` itself is never modified.

`.env` syntax is strict `KEY=VALUE`, with no variable expansion, escaping, or inline comments:

- a whole line starting with `#` is a comment, and blank lines are ignored;
- a key takes its first assignment only, and later duplicates do not apply;
- one matching pair of surrounding quotes is removed, and an unbalanced quote makes the whole line skipped;
- every skipped line produces one warning in the diagnostics log;
- on Windows variable names are case-insensitive, so one name keeps one variable.

## Troubleshooting

- **The application still reaches the tray**: right-click the tray icon and export diagnostics. Beta creates a `diagnostics-*.zip` and reveals it in the file manager; Nonead DSH Desktop asks where to save and exports `nonead-dsh-desktop-diagnostics-*.json`. Diagnostics contain recent logs, and on Beta also Crashpad `.dmp` files and `system-info.txt`; recognized credentials are masked in logs, but local paths, workspace and session IDs, and crash-time memory fragments may remain, so review the archive before uploading it publicly.
- **The application crashes before the tray appears** (Beta): run the installed executable directly with the recovery option, replacing the path with the real one on your machine.

  ```powershell
  & "<actual installation directory>\DSH Desktop Beta.exe" --export-diagnostics
  ```

  The command starts no Host, profile, plugin, or window, and prints the absolute diagnostics ZIP path when complete; npm installs can also run `dsh-desktop-beta --export-diagnostics`.
- **An operation in the interface fails**: unhandled errors and promise rejections in the native page appear in the notice area instead of only in the developer-tools console.
- **A panel such as "Files" on the right keeps returning HTTP 4xx**: the usual cause is an enabled plugin that is missing a service it depends on and therefore stays pending, so the route it would have registered never appears. Search `logs/` in the data directory for `pending (waiting for service:` (the data directory defaults to `~/.dsh`, so logs are in `~/.dsh/logs/`); a matching line names the plugin and the missing service, for example `better-sidebar (dsh-better-sidebar): pending (waiting for service: webRuntime)`. Disable that plugin and restart to get the official panels back.
- **The window disappeared**: check the system tray; closing the window is not quitting.
- **A plugin has no effect**: confirm the command targeted the intended profile, then restart the application.
- **A terminal command is missing**: open a fresh Desktop terminal from the tray; Desktop does not modify the global PATH.
- **No update notification appeared**: background failures are silent; use the manual check in the tray or settings to see the result.

The lower-level lifecycle, packaging, and platform limits belong to the developer documentation; see the [documentation index](README.en.md).

## Related documentation

- [FAQ](faq.en.md)
- [Why a desktop edition](why-desktop.en.md)
- [Architecture](architecture.en.md)
- [Plugin development](plugin-development.en.md)
- [Plugin ecosystem](plugin-ecosystem.en.md)
- [Documentation index](README.en.md)
