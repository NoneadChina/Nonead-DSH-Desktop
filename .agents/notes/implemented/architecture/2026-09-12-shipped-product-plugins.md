# Agent Note: Shipped product plugins ride the launcher generation

Status: implemented

English | [中文](2026-09-12-shipped-product-plugins.zh.md)

> **Update (2026-09-21):** `dsh-nonead-universal-robots` left the shipped set. The launcher no longer inserts its loader row, neither desktop edition depends on or packages it, and `desktopBundleList()` no longer filters it out of a Profile bundle list. Only [`dsh-nonead-client-skin/`](../../../../dsh-nonead-client-skin/) still rides the launcher generation as described below.
>
> **Update (2026-09-26):** `dsh-nonead-universal-robots` was then removed from the repository entirely: its sources are gone and the root Yarn workspace no longer declares it. Where the text below still names it as a workspace member or a production dependency, read that as the state before this update; the skin is now the only product-owned plugin workspace member.

## Problem

Nonead DSH Desktop must start with the Universal Robots tool set and the Nonead brand skin already installed and active: on every machine, in every Profile, in development and in the packaged installer, without an operator running `dsh plugin add` first. The two plugins were private, standalone repositories; the desktop launcher composed only the official Web bundles plus whatever third-party bundles a Profile had installed itself.

A Profile bundle would not meet the requirement. `dsh.profile.bundles` is per-Profile user state that the launcher deliberately does not rewrite outside its installation-owned prefix, it needs a resolvable package spec (the skin is `private` and unpublished, and the Universal Robots package is not on the npm registry either), and every direct bundle stays user-disableable in the Desktop plugin inventory.

## Decision

[`dsh-nonead-universal-robots/`](../../../../dsh-nonead-universal-robots/) and [`dsh-nonead-client-skin/`](../../../../dsh-nonead-client-skin/) are product-owned members of the outer Yarn workspace and production dependencies of both desktop editions, referenced by exact version exactly like [`dsh-community-market`](../../../../dsh-community-market/).

Neither package is added to any Profile. The launcher-owned patch layer ([`dsh-plugin-desktop/cordis.patch.yml`](../../../../dsh-plugin-desktop/cordis.patch.yml) and its Beta counterpart) inserts one loader row per plugin, so every generation of every Profile composes them, no Profile file is mutated, and the Desktop plugin inventory never lists them — there is no bundle to disable. Resolution follows the ordinary installation-anchor path: the rows are bare specifiers resolved from the sealed installation, and the plugins' own bare imports (`@deepseek-ai/dsh-tools`, `@deepseek-ai/schemastery`) fall back from Node's normal lookup to the Profile anchor and then to the installation anchor in [`module-resolution.ts`](../../../../dsh-plugin-desktop/src/module-resolution.ts). No plugin-local `node_modules` is required.

A Profile that still lists either package — a machine where the plugin was installed by hand before it shipped — would otherwise compose a second copy under that bundle's own loader-row ids. [`desktopBundleList()`](../../../../dsh-plugin-desktop/src/profile.ts) therefore drops both names from the persistent bundle list exactly like the retired `@deepseek-ai/dsh-desktop-app` bundle, and the launcher rewrites the manifest once before the generation composes. The user-owned dependency list is preserved, so a leftover `link:` entry simply stops being composed.

The skin needs no extra wiring for the browser: `dsh-client-modules` scans Host Loader entries for packages declaring `dsh.client`, and the package declares `platform: web` with `immediately: true`, so its prebuilt `lib/client.js` joins the renderer boot graph.

Both packages were absorbed from their private corporate repositories as ordinary content. The nested `.git` directories were moved into the already ignored `.build/nonead-source-git/` so the outer repository owns the files; provenance — `git@git.corp.nonead.com:tonyke/dsh-nonead-client-skin.git` at `c8461da5c0cdd51f8552ce8266fd95476d57e267` (master, 2026-09-08) and `git@git.corp.nonead.com:tonyke/dsh-nonead-universal-robots.git` at `a2474aa775cc61e6558e596d8546ed7f3514774c` (main, 2026-09-09) — is recorded here because those directories no longer carry their own history.

Their peer ranges were narrowed to the vendored runtime family (`0.1.7-rc.1` for the DSH packages, `4.0.4` for Cordis) so the outer install resolves inside `vendor/dsh-runtime` instead of the registry and does not trip the release-age gate. The skin's `@deepseek-ai/dsh-client-runtime` peer stays optional: this repository consumes the prebuilt browser bundle and never compiles the skin, so that type-only dependency must not be resolved here.

## Verification

`verify:profile` boots the complete published Desktop profile headlessly for both editions with the new rows and now asserts that `ur_connect` and `ur_ping` are registered on the Host tools service and that `dsh-nonead-client-skin` appears in the real renderer boot graph. A negative control (renaming the expected client id) was run to confirm the graph assertion fails when the row is absent. Also passing: `verify:closure` (247 first-party nodes stay closed), `verify:licenses`, `verify:loader`, `vitest run tests/profile.spec.ts tests/desktop-plugins.spec.ts tests/plugin.spec.ts tests/profiles.spec.ts` (86 tests), `check:desktop-variants`, and `yarn install --immutable`.

`check:layout` cannot run without the pinned upstream submodule, so its owned-member expectation was extended in [`scripts/verify-layout.mjs`](../../../../scripts/verify-layout.mjs) (workspace list plus the protocol-boundary scan) and verified by an equivalent check. `THIRD_PARTY_NOTICES.md` is generated per release host: the two packages belong in it, but a local Windows regeneration also rewrites platform-specific optional-dependency rows and moves the Agents Anywhere bridge version, so the released notices must be regenerated on the release host rather than committed from a developer machine.

## Alternatives considered

**Declare the plugins as Profile bundles.** Rejected: it mutates user Profile state, covers only the Profile that happened to install them, stays user-disableable, and needs a resolvable spec that neither package can provide.

**Depend on the plugins from the npm registry.** Rejected: `dsh-nonead-universal-robots` was never published (`registry.npmjs.org` returns 404), the skin is `private`, and the published desktop manifest is already unresolvable on its own because it ships `file:../vendor/...` and workspace-only versions.

**Track the plugin repositories as Git submodules.** Rejected: both remotes are private corporate SSH URLs, so an outer clone would be unfetchable outside the company, and uninitialized submodules would leave workspace members missing and fail `yarn install` outright.

**Vendor packed tarballs under `vendor/` like the Agents Anywhere bridge.** Rejected here (the bridge keeps that shape): reviewers must be able to read and change the plugin sources in-tree, and every tarball bump would need a second preparation step.

## Consequences

Every build of both editions — development and packaged — now starts with the robot tools and the brand skin, and the skin is therefore the default look of the community editions as well. This was an explicit product decision. Removing a plugin is a one-line launcher-layer change that applies everywhere at once. Ship size grows by the skin's embedded logo data URLs and the robot plugin's Python payload, and the Python interpreter with `numpy`/`paramiko` stays an operator prerequisite that `ur_ping` reports but no installer provides. Plugin sources are now duplicated between this repository and the corporate repositories, so a plugin change upstream needs a synchronizing commit here.
