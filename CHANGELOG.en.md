<p align="center">
  <strong>Nonead DSH Desktop · Changelog</strong><br>
  <sub><a href="CHANGELOG.md">中文</a> · English</sub>
</p>

# Changelog

This file records user-facing changes to Nonead DSH Desktop. Every release raises the version in both desktop workspaces (`nonead-dsh-desktop` and `dsh-plugin-desktop-beta`) in lockstep; the version also appears in installer filenames, the update endpoint response and the bare download URL mapping, and all three must agree.

Maintenance conventions:

- Every release adds one entry to both files (`CHANGELOG.md`, `CHANGELOG.en.md`) and refreshes the Git blob hashes recorded in `CHANGELOG.i18n.yaml`, otherwise `corepack yarn check:bilingual-docs` fails.
- Entries record only changes users can perceive and boundary changes maintainers must know about; pure refactors do not get their own entry.
- Earlier history lives in the Git tags (`v1.7.3`, `v2.0.7`, `v2.0.8`, `v2.1.3`, `v2.1.4`, `v2.1.5`) and in the commit log.

## 2.1.16 — 2026-10-22

Security hardening and gate fixes (the result of a full audit):

- CI now runs change classification and the documentation/market gates from the **pull request base side**, so the code under review can no longer weaken its own classifier to skip every product gate.
- Electron fuses tightened: both shells close the `NODE_OPTIONS` / `--inspect` injection surface; the Stable shell (`asar: true`) now loads only from `app.asar`, while the Beta channel keeps that bit off because it ships a physical directory (`asar: false`). `runAsNode` has to stay on — on Windows the Host, the CLI and the pnpm shims all launch the Electron binary with `ELECTRON_RUN_AS_NODE`. Both `verify-fuses` scripts now derive the expected value from the real layout and assert the whole set, so loosening it fails; Stable previously called `verifyElectronExecutableFuses(path, undefined, false)`, which never checked the archive bit at all.
- The renderer credential no longer travels in the Host child environment; it is injected once over a private pipe at startup, so same-user processes cannot read it from process environment or a crash dump and impersonate the renderer.
- The web access gate now **fails closed** when the credential is missing (it used to fail open); browser-class requests are no longer silently allowed.
- `dsh-desktop://` deep links are dispatched through an action allowlist; unknown actions are dropped with a single log line.
- Secret masking for diagnostics and logs now covers base64url shapes, so the renderer credential can no longer be exported.
- The directory picker route shares the loopback same-origin check used by the settings route instead of trusting a client-supplied `Origin`.

Packaging and release:

- The Stable shell `asarUnpack` contract was re-proved against app-builder-lib 26.15.7: matches are resolved against the **packaging project path**, so the three patterns must keep the `.desktop-build/payload/` prefix from `files[].from` to hit (`scripts/node-bin`, `assets` and `build` are indeed unpacked beside `app.asar`). The patterns stay as they are; a new test derives the expected prefix from `files[].from` and asserts it, failing if either side drifts — this coupling had no assertion covering it before.
- CI gained Stable-shell packaging coverage, and `verify-layout` now enforces version parity: both workspaces' `version` must match the newest `CHANGELOG` heading.
- CI no longer rewrites `dsh-plugin-desktop-beta/package.json` in place to skip AA smoke; an explicit `check:ci` script replaces that mutation, so CI and local runs match.

Repository hygiene and supply chain:

- Every third-party Action used by CI is pinned to a commit SHA (`actions/checkout`, `actions/setup-node`, `actions/cache`), with the tag kept only as a trailing comment for readability, so a moved upstream tag cannot silently change what the gates run.
- The change classifier no longer treats every file under `docs/` as documentation: non-document extensions inside `docs/` (`.js`/`.mjs`/`.json`/`.ts` and friends) now trigger the product gates, with only real documentation formats and `docs/schemas/*.schema.json` exempt.
- Six unreferenced historical tgz files (~1.7 MB) were removed from `vendor/agents-anywhere/`, keeping only the pinned one; that directory's README no longer teaches the removed `DSH_AA_SOURCE_REF=pinned` path and instead pins through `provenance.pinnedCommit`.
- The `nonead-dsh-desktop/README.md` and `README.zh.md` files no longer hard-code the product version (they said `2.1.3`); they point at `package.json`'s `version` and the newest root `CHANGELOG` entry instead.
- Docs now state that the Linux x64 AppImage and deb are built by the Beta channel only and that the stable channel ships a runnable directory on Linux; the first real check of the fuses and `onlyLoadAppFromAsar` is the CI `desktop-windows-stable` job (`package:dir:stable`), since locally only unit tests cover them.

### 2026-10-23 supplement (same version number, included in later builds)

Market self-update:

- Opening Settings → Plugins checks GitHub for the newest `dshmarket` release automatically; the upgrade action appears on the `Plugin market  dsh-market v<installed version>` row and on the market card title only when a newer release really exists, and not at all otherwise. A failed check now explains itself ("Market update check failed: …") instead of failing silently.
- Pressing upgrade performs the two steps from outside the app: the version comes from GitHub releases and the bytes come from the npm registry, verified against the manifest's sha512 `dist.integrity` before anything is extracted and activated. The market cannot replace itself inside its own request — the host unloads it before the reinstall runs — so the desktop has to do this step.
- The release lands in `<home>/market-store/` first, then projects into **each Profile's own `node_modules`**, and repins that Profile's exact version in `package.json`. It previously wrote only the shared directory, while the Profile copy and its version pin both outrank it, which is why upgrading "did nothing". A replaced real directory is renamed to `<name>.pre-market-<uuid>` rather than deleted.
- The row action in the official plugin list registers through `plugins.bundle.actions`; if that registration is rejected the row simply loses a button instead of taking the whole plugins page down.
- Staging now moves an unusable leftover aside and renames the new tree into place afterwards. An interrupted upgrade once left an empty version directory, and because staging only checked whether the directory existed, it was treated as already staged: the Host then received a package with no manifest and no entry point, and the whole market failed to load (`Cannot find package …\dshmarket\index.js`). A directory now counts as staged only when its manifest, version and entry file all match; otherwise it is re-extracted.
- `dsh-community-market` has only a placeholder npm version and no release pipeline, so it never self-updates.

Packaging chain:

- Fixed three Windows packaging gates that had drifted from the product's actual behaviour: junctions created by pnpm inside a Profile could not be removed recursively; `verify:host` never passed the renderer credential (32 base64url bytes, and it has to be the same one the Host received); and that script impersonated the renderer with a fixed string, which the fail-closed Web gate rejects.
- `dsh-plugin-desktop-beta` now declares `@deepseek-ai/dsh-plugin-manager` (a required peer of `dsh-plugin-market`), restoring the 318-node runtime closure.

## 2.1.15 — 2026-10-22

The version jumps from `2.1.13` straight to `2.1.15`; there is no separate `2.1.14` release commit in the history.

Runtime and dependencies:

- The DSH runtime stays on **`0.2.1-rc.2`** and `channels.beta.commit` in `upstream.json` is still `687f282e`; the Agents Anywhere bridge is still `39b82d4`.
- The plugin market `dshmarket` is bumped to `1.66.45` and the desktop patch is rebased onto it.
- The brand patch moved from `.yarn/patches/dsh-web-frontend-nonead-wordmark.patch` to `patches/dsh-web-frontend@0.2.1-rc.2.patch`, joining the other runtime patches.
- The AA connector httpx patch grew to cover the new connection path.

Updates and recovery:

- The update card can show **release notes** supplied by the version response; the Beta channel's tray menu and native dialogs also offer a "view full release notes" entry (tray labels and notification bodies are truncated by platform rules), while the stable channel's native update dialog still carries fixed copy only.
- **Skip this version** is new: the decision is persisted, so the unattended scheduled check no longer re-offers a skipped release.
- A failed install can be retried, and recovery can roll back to **any saved snapshot**, not just the latest.
- Launching the native installer now starts **before** the quit sequence, so quitting cannot take the installer down with it.
- Windows installer signing and publisher verification were introduced and then **fully reverted** in `c5896ac`; Windows installers still compare only `ProductName` / `ProductVersion` from the PE version resource.

Desktop shell:

- Window position and size are remembered; restore happens only while the window still overlaps a mounted display, so unplugging a monitor cannot put it offscreen.
- Strict layered `.env` support fills in missing variables for the Host child process without overriding the existing environment.
- `dsh-desktop://` deep links are supported (for example `dsh-desktop://settings/general`).
- A launch-at-login switch reads the effective OS state.
- Profile configuration read-modify-write cycles now run under a single writer lock, so the shell and the Host's profile manager cannot silently drop each other's updates.
- Single-instance and disposable cleanup retry budgets are fixed at three; unhandled renderer failures surface in the notice area.
- The guest browser's `.env` and runtime environment are passed through correctly.

Market and skin:

- The market previews **non-image media** and can **install a plugin by name**.
- Skipping the plugin market during onboarding is remembered, and reopening the wizard keeps the stored market setting.
- The skin's hero headline swap is scoped to the hero subtree and no longer touches other copy.

Fixes:

- The AA interaction stream keeps a live peer, and the DSH runtime stays usable while history syncs.
- Cross-platform assertions were repaired and the market bundle now ships with the package.
- CI runs the product gates when a runtime JSON Schema changes.
- The release flow derives the shipped version from the manifests.

## 2.1.13 — 2026-10-21

Runtime and dependencies:

- The DSH runtime moved from `0.2.1-alpha.5` to **`0.2.1-rc.2`**: every `@deepseek-ai/dsh*` dependency is pinned exactly to that version, `vendor/dsh-runtime/0.2.1-rc.2/` ships with the installer, and the old `alpha.5` runtime directory is gone. `upstream.json` records `channels.beta.commit` = `687f282e`.
- The plugin market `dshmarket` is bumped to `1.66.44`.
- The Agents Anywhere bridge is bumped to `2.1.0-desktop` (upstream `39b82d4`) with the `agents-anywhere-connector-httpx` patch.

Interface and experience:

- The boot screen now shows the NONEAD / DEEPSEEK HARNESS wordmark.
- The onboarding completion page now guides users to enter an API key and offers a NONEAD entry point.
- Onboarding enables the plugin market and Computer Use by default (effective from 2.1.12).

Stability:

- The AA bridge **drops events** when its queue is full instead of crashing.
- Fixed the PTC assertions broken by the rc.2 upstream refactor.
- CI now triggers on `main` instead of `master`.
- Removed the root `AGENTS.md`, `CLAUDE.md`, `PRIVACY*`, `CONTRIBUTING*` and `CODE_OF_CONDUCT*` files; repository rules now live only in `README.md` and `docs/`.

## 2.1.12 — 2026-10-19

- Onboarding enables the plugin market (`dsh-market`) and Computer Use by default, so new installations have both from the first launch.

## 2.1.11 — 2026-10-18

- Both desktop workspaces unified at `2.1.11`, with tests and documentation synchronized.
- Root manifests and documentation synchronized to DSH `0.2.1-rc.2` (after passing through `0.2.1-rc.1`).
- `aa:prepare-release` can now use a local source tree instead of a GitHub pack, which helps offline or bandwidth-constrained releases.

## 2.1.6 — 2026-10-17

- Added a compatibility patch for Profile plugins, fixing profile plugin loading under newer runtimes.
- Update download endpoints moved to `nonead.com`; the README gained Linux AppImage installation and run instructions.

## 2.0.8 — 2026-10-11

- All three channels unified at `2.0.8`, with refreshed icon assets, `dshmarket` and release documentation.
- The upstream runtime had already moved to `0.2.0-rc.2`.

## Known issues

- In-app update on Linux only checks the version and never downloads an installer; upgrade by downloading a fresh AppImage.
- Windows installers are not cryptographically verified yet: the download path supports a server `installerSha256`, but the version endpoint does not publish it, so only `ProductName` and `ProductVersion` from the PE version resource are compared.
- An uninitialised `deepseek-harness` submodule makes `corepack yarn check:layout` fail; normal builds, typecheck and tests are unaffected.
