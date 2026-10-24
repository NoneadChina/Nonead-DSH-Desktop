# Why a desktop edition

This document explains why Nonead DSH Desktop exists: which work that arguably belongs to the operating system it takes over, why that work has to be added as plugins and profiles on top of an unmodified upstream Harness, and what it deliberately does not do. The current version is 2.1.15.

## The problem we solve

DeepSeek Harness is at its core a composable agent harness: it is meant for use from the command line and the Web interface, and for developers composing models, tools, sessions, and workflows into their own runtime. For an ordinary user, though, the first run still means facing the Node.js runtime, profile and dependency installation, port selection, and process lifetime — none of which has anything to do with actually using it.

Nonead DSH Desktop does not reimplement Harness. It puts the same runtime into an application that starts easily, is easy to manage, and follows operating-system conventions: the installer provides Electron, Node, and pinned DSH dependencies; the application owns the window, tray, single instance, quit, and local service lifetime; and users keep using the official DSH profiles, plugins, sessions, and Web interface.

## Three layers of responsibility

| Layer | Responsible for |
| --- | --- |
| Upstream DeepSeek Harness | agent, model, tool, session, and Web client semantics; imported unmodified at a pinned commit |
| Profile | the combination of DSH bundles, dependencies, and patches; switching is an orderly restart that can fall back |
| Nonead DSH Desktop | windows and tray, terminal, updates, configuration recovery, deep links, system integration, and Host lifetime |

Once boundaries blur, upgrades become expensive. Desktop therefore solves problems only in its own layer: upstream defines semantics, profiles define composition, and the desktop shell defines operating-system interaction.

## Why everything stays a plugin

"Everything is a plugin" lets Harness capabilities be composed instead of being pinned inside one fixed application. Desktop applies the same principle for three concrete reasons: upstream capability stays replaceable (the official Web client can be used, and user profiles can add model, tool, interface, and workflow plugins); Desktop capability stays extensible (windows, tray, and updates are exposed through explicit Host services instead of making plugins guess Electron internals); and boundaries stay maintainable (third-party plugins depend only on the contract they actually need).

Plugin-first also means not everything should be exposed. Third-party plugins may only use interfaces that are explicitly public and may not drive windows, the tray, the installer, or other internals directly; a stable boundary is easier to upgrade and to debug than "access to everything". See [Plugin development](plugin-development.en.md) for the interface details.

## Desktop fills in the daily details

Harness itself does not care which monitor a window belongs on, whether an update should interrupt the user, or who should fill in missing environment variables. Those daily details are fairly complete in 2.1.15:

- **Windows**: the main window position and size are remembered, and before restoring they are checked against the mounted displays so unplugging an external monitor never restores the window offscreen.
- **Tray and native interaction**: closing the window hides it to the tray by default, and confirmations, warnings, and results use separate native dialogs instead of intruding into the official page.
- **Open at login**: the switch reads the state the operating system actually recorded, and shows disabled honestly when the system refuses registration.
- **Updates**: release notes can be shown, "skip this version" persists, a failed installation can be retried without downloading again, and configuration can be rolled back to any saved snapshot.
- **Entry points**: the `dsh-desktop://` scheme is claimed, so a link such as `dsh-desktop://settings/general` opens settings directly.
- **Environment**: `.env` is strictly layered, filling only variables the Host child process is missing, never replacing an existing environment, and never rewriting `process.env`.
- **Concurrency safety**: reading, modifying, and writing profile configuration is serialized through a single writer, so saving several settings at once cannot leave a half-written file.
- **Observability**: unhandled errors in the interface appear in the notice area instead of only in developer tools.
- **Plugin market**: non-image media previews and installation by name are supported, and the wizard's "skip the market" choice is remembered too.

## Why we do not modify upstream

The repository imports the unmodified official Harness at a pinned upstream commit, recorded in the root `upstream.json`. Compatibility mode runs the upstream default Web client below a separate desktop frame without overriding its layout, sidebar, or conversation composition; the extended and advanced modes install the Desktop-owned root registration through plugin and profile composition boundaries while still hosting the official occupants.

What that buys is replaceability: an upstream upgrade can replace the runtime wholesale instead of first merging a long-lived fork. The price is that desktop capabilities must be implemented through public extension points, and anything out of reach is documented as a limitation rather than quietly patched upstream.

## What we deliberately do not do

- We do not reimplement the upstream Web interface as native Electron pages.
- We do not override the upstream layout, sidebar, or conversation composition in compatibility mode.
- We do not build a second "Desktop database": official profiles share sessions and settings in the DSH home.
- We do not hand third-party plugins an undefined private Electron API.
- We do not present roadmap features as delivered capabilities.
- We do not put an account or a machine fingerprint in update requests: they carry only a random installation identifier, the installed version, and the release channel.

## Known limits

These are current implementation choices, not a backlog ordered by importance:

- **Windows update packages have no cryptographic verification**: 2.1.15 reverted the signature and publisher checks introduced earlier, so only `ProductName` and `ProductVersion` in the PE version resource are compared; macOS still verifies the identity, version, and signing team of the application inside the disk image; both checks exist only in the Stable shell, while the Beta shell checks just the installer magic bytes and size and then executes it.
- **Linux in-app updates only check the version**: no installer is downloaded or run, so upgrading means downloading the AppImage again.
- **Capabilities upstream does not have will not appear**: the desktop edition is an entry point and adaptation layer, and it does not expand Harness model or tool capabilities.
- **Fixed port conflicts**: Nonead DSH Desktop fails to start (release the port or set `0` again) while Beta moves on to the following port.

## Who it is for

- Users who just want to install and use Harness: start with the [user guide](user-guide.en.md).
- Users who install or develop DSH plugins: read [Plugin development](plugin-development.en.md), then the [Desktop service contract](../dsh-plugin-desktop-beta/docs/plugin-services.md).
- Maintainers who need to understand launch, profile, and packaging boundaries: read the [architecture](architecture.en.md) and the [package README](../dsh-plugin-desktop-beta/README.md).

## Related documentation

- [User guide](user-guide.en.md)
- [FAQ](faq.en.md)
- [Architecture](architecture.en.md)
- [Plugin ecosystem](plugin-ecosystem.en.md)
- [Documentation index](README.en.md)
