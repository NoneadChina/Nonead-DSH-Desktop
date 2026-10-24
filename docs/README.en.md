# Nonead DSH Desktop Documentation

[中文文档](README.md)

This directory is the product and developer documentation index for Nonead DSH Desktop, version **2.1.18**. The root [`README.en.md`](../README.en.md) covers what the product is, what it can do and how to install it; these pages explain why the project exists, how to get more out of it, and how to build plugins for it. Version history lives in the [changelog](../CHANGELOG.en.md).

## Read by goal

Ordinary users can start with the [user guide](user-guide.en.md) and never need the developer documentation.

### User documentation

| Document | Covers |
| --- | --- |
| [User guide](user-guide.en.md) | Installation and first launch, launching from a folder, profiles, window modes and materials, local port, plugin management, terminal, updates and troubleshooting |
| [FAQ](faq.en.md) | Direct answers about supported platforms, the bundled runtime, the relationship with upstream, data storage, plugins, proxies and update channels |
| [Why Nonead DSH Desktop](why-desktop.en.md) | The boundary with upstream Harness, the case for plugins, what Desktop itself provides, and what it deliberately does not do |
| [Changelog](../CHANGELOG.en.md) | User-visible changes, behavior-boundary changes and known issues for every release |

### Developer and maintainer documentation

| Document | Covers |
| --- | --- |
| [Architecture](architecture.en.md) | The shell, the Host child process, the Web carrier, profiles and patch layers, packaging and runtime closure, and the release-channel protocol |
| [Plugin development](plugin-development.en.md) | The two plugin kinds, the real shape of Desktop services, dual-face packages (Host plus browser half), profile patches, lifecycle, testing and dependency classification |
| [Plugin ecosystem manifesto](plugin-ecosystem.en.md) | The vision of an open, composable, sustainable plugin ecosystem and its three principles |
| [Community Fabric Draft](../dsh-community-fabric/README.md) | Community interoperability drafts spanning manifest/capability foundations, Runtime/Presentation, service composition, and provenance diagnostics |
| [Fabric community-feedback disposition](../dsh-community-fabric/docs/research/community-issue-23-review.md) | Which Issue #23 proposals were adopted, split into focused RFCs, deferred, or kept out of portable core |
| [Fabric framework and plugin-needs research](../dsh-community-fabric/docs/research/mature-plugin-frameworks.md) | Mature Koishi, Chrome, and VS Code patterns plus requirements observed in real DSH plugins |
| [VS Code extension-model research](../dsh-community-fabric/docs/research/vscode-extension-model.md) | Implemented declaration, Provider, UI, placement, and lifecycle patterns, with concrete constraints for the Fabric RFC |
| [Community Market](../dsh-community-market/README.md) | The built-in market's Discover/Installable/Installed/Sources views, extensible catalog sources, install confirmation, and safety boundary |
| [Market catalog provider contract](../dsh-community-market/docs/catalog-provider-contract.md) | Schemas, query parameters, multi-source behavior, and adapter rules for the implementation team |
| [Desktop service reference](../dsh-plugin-desktop-beta/docs/plugin-services.md) | Stable `desktopProfiles` and `desktopPnpm` contracts with TypeScript examples |
| [Beta package reference](../dsh-plugin-desktop-beta/README.md) | Build, runtime, release, and known limitations for the `dsh-plugin-desktop-beta` workspace |
| [Nonead workspace notes](../nonead-dsh-desktop/README.md) | The Nonead DSH Desktop workspace (`nonead-dsh-desktop`): its shell, Profiles and recovery, and its Agents Anywhere bridge and Community Market adapters |
| [Brand skin plugin](../dsh-nonead-client-skin/README.md) | `dsh-nonead-client-skin`, distributed inside the installer and inserted for every profile |
| [Measured evidence archive](evidence/) | Dated records of release and installer behavior (Windows installer upgrade, NSIS A/B method); historical evidence that does not follow the product version |

## Naming and bilingual conventions

- Paired pages in this directory are `X.md` (Chinese) and `X.en.md` (English). Both sides are equivalent, so every change must land on both.
- `*.i18n.yaml` files record the Git blob hashes of the paired documents. All seven `docs/` pairs, the root `README`/`CHANGELOG` and the package READMEs are covered (57 records for 114 documents today). The verifier only walks records hit by `git ls-files`, so a new `*.i18n.yaml` must be `git add`ed before it is checked; `corepack yarn check:bilingual-docs` verifies the hashes, so after editing a document recompute them as described in [“Building from source”](../README.en.md#building-from-source) of the root README.
- At the repository root `README.md` is Chinese and `README.en.md` is English; packages use the opposite convention (`README.md` English, `README.zh.md` Chinese), so check the directory before linking.

## How the README files are organized

The outer repository has two formal product READMEs plus one legacy compatibility entry:

- [`README.md`](../README.md): the Chinese product entry point.
- [`README.en.md`](../README.en.md): the English product entry point with the same product scope.
- [`README.zh.md`](../README.zh.md): a legacy Chinese-path compatibility page with no independent content.
- [`CHANGELOG.md`](../CHANGELOG.md) / [`CHANGELOG.en.md`](../CHANGELOG.en.md): the paired release changelog.

`dsh-plugin-desktop-beta/README.md` and `dsh-plugin-desktop-beta/README.zh.md` ship with the npm package and are the more technical package reference. `nonead-dsh-desktop/README.md` and `nonead-dsh-desktop/README.zh.md` describe the Nonead DSH Desktop workspace. `dsh-plugin-desktop-beta/docs/` contains stable API contracts rather than marketing copy. `.agents/notes/implemented/` contains dated maintainer decision records and does not replace user documentation.

`deepseek-harness/` is the pinned upstream submodule: its active channel is `beta`, its current pin is DSH `0.2.1-rc.3` (`1f81c047`), and it ships the vendored runtime at `vendor/dsh-runtime/0.2.1-rc.3/`; the other channel, `stable`, is recorded as DSH `0.2.0-rc.2` (`639ed015`). The root `upstream.json` records both channels. Normal builds, typecheck and tests do **not** need that submodule; only `corepack yarn upstream:*` does. Its README and `docs/` belong to the upstream project and are not Desktop documentation.

## Status convention

These pages distinguish **shipped behavior**, **platform limits** and **not-yet-implemented items** in plain words, without vague "coming soon" phrasing:

- The window has three modes: `compatibility` (the unmodified upstream Web client inside an independent Desktop frame), `extended` (installs Desktop's own layout/sidebar surface on top and hosts official occupants in an inverted-L layout), and `advanced` (a separate root registration with compact internal captions). Any other persisted value is read as `compatibility`.
- Native materials are capability-gated per platform: macOS/Linux accept `off`/`transparent`, Windows only accepts `off` (legacy `acrylic`/`mica` values all read as `off`).
- The plugin marketplace [`dsh-community-market`](../dsh-community-market/README.md) ships built in, is selectable from a profile's bundles, and is mutually exclusive with `dsh-market`.
- Mobile remote control (the Agents Anywhere bridge) ships with the installer but stays an optional capability: it is a bridge channel, not a promise that the current installer exposes a complete remote-control product entry point.
- Concrete implementation gaps (`Resources/runtime` interpreter tree outside the seal, `runtime.json` `payloadDigest` written but never verified, no cryptographic verification for Windows installers, no in-app installer download on Linux) are collected in [Architecture → Known limitations](architecture.en.md#known-limitations) and [Changelog → Known issues](../CHANGELOG.en.md#known-issues).
