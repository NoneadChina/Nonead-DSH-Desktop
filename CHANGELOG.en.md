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

## 2.2.2 — 2026-10-28

The runtime moves across to DSH `0.2.2-alpha.2` and the market to 1.73.1:

- Runtime upgrade: the beta channel jumps from dsh `0.2.1-rc.3` to **`0.2.2-alpha.2`** (submodule pin `1f81c047` → `f3803c96`, upstream "release(dsh): 0.2.2-alpha.2") — the runtime is repacked and re-vendored (370 packages, up from 344), and all 24 version patches are rebased. Seven packages needed semantic re-anchoring because their packed output changed: the bundle file names in `dsh`, `dsh-sandbox-windows-acl` and `dsh-web-frontend` carry new hashes; `dsh-client-ui-plugin-manager` was refactored upstream to derive `available` from `listed` but never defines it (this patch restores the desktop slots and supplies that definition); `dsh-client-ui-settings-account` moved its onboarding back icon into a module variable; `dsh-client-ui-directory-picker-browse` grew to nine locale dictionaries; `dsh-client-ui-primitives` switched wide tables to a hover-only scrollbar, which this patch turns back into an always-visible thin bar. The rc.3 runtime snapshot and patches stay as history.
- Dependency surface: `@deepseek-ai/cordis` moves to 4.0.6-alpha.1, `schemastery` to 3.18.6-alpha.1 and three cordis plugin packages each move one minor alpha, or the upstream 0.2.2-alpha.2 peer checks fail; `nonead-dsh-desktop` is aligned with the beta channel by hand because it belongs to the stable line and is outside the auto-synced workspace list.
- Market: `dshmarket` 1.70.1 → **1.73.1**, with the desktop patch (self-update entry, host-provided versions, trial-run baseline diff) rebased onto 1.73.1; upstream moved the update cache to `recheckAt` semantics, so the `checkUpdates` hunk is rewritten against the new shape.
- Agents Anywhere bridge: rebuilt for the new peer ranges (artifact `rd9c47cbc`, pin unchanged at `39b82d4`), connector patch untouched.
- Version: the product moves from 2.1.18 to **2.2.2** in both desktop workspaces.

## 2.1.18 — 2026-10-24

Upstream runtime upgrade, an Agents Anywhere source build and an experimental Windows ARM64 build (includes the 2.1.17 audit fix batch):

- Upstream runtime upgrade: the beta channel moved from dsh `0.2.1-rc.2` to **`0.2.1-rc.3`** (submodule pin `687f282e` → `1f81c047`): 24 versioned patches were rebased onto rc.3, `vendor/dsh-runtime/0.2.1-rc.3/` was vendored anew (344 packages), and the root manifests, both desktop workspaces and the Agents Anywhere bridge peer ranges follow; the superseded rc.2 runtime snapshot and patches are no longer tracked.
- Agents Anywhere bridge: now **built from source** (`39b82d4`, previously a reused artifact) with the connector patch rebased onto the new artifact — health reporting no longer blocks notification publishing, the `NO_PROXY` bare-IPv6 rewrite and the runtime-ready report are kept, and the answer-provider change superseded by upstream's `interactionPeer(connection)` refactor is dropped; Python files in the artifact are normalized to LF so the patch applies reproducibly.
- Windows ARM64 (experimental): a new `DSH_PACKAGE_ARCH=arm64` build path ships a native arm64 main process while the bundled Python / Node / Office runtimes reuse the x64 payload under Windows emulation; cross-architecture packaging skips the smokes that can only run on the host, the x64 build and its checks are unaffected, and this artifact is not yet wired into the download links or the update channel.
- Settings update card: the service-failure message now reads "Nonead-DSH-Desktop updates are temporarily unavailable. Try again later." instead of naming the retired Next product; the download progress bar moved between the "Downloading update x%" label and the release notes.

## 2.1.17 — 2026-10-24

Audit fix batch (26 fixes, itemized below):

- Recovery assistant: when the automatic diagnostics export and a user action refreshed the same document concurrently, the first navigation failed with `ERR_ABORTED`; on the non-action path that failure could be escalated by fail-loud into a full application exit. Refreshes are now serialized, a navigation aborted by window destruction is treated as a normal end, and action-path failures are only logged as diagnostics.
- Checkpoint reads and degradation: manifest and backup files are opened and then re-checked by inode (`O_NOFOLLOW` + `fstat`), so a path swapped between `lstat` and the read is no longer trusted; a damaged slot no longer fails the whole snapshot list — it is marked unreadable, stays visible but not restorable in the recovery page, and rotation reuses it as the next overwrite target.
- Settings writes: `settings.yaml` and a Profile's `pnpm-workspace.yaml` are published through a temporary file plus rename, so an interrupted write leaves either the old or the new content instead of half a YAML that loses every setting on the next start.
- Updates: response bodies are released on the size-limit and decode-failure paths; macOS arms the install handoff before the native stage starts, so quitting no longer deletes the package the local feed is still serving; choosing Quit in a recovery window the user opened is no longer reported as a startup failure (success code), while startup failures stay non-zero.
- Plugin and state stores: plugin state reads re-check the inode; stale data-lock reclamation tolerates a concurrent `ENOENT`; the damaged-state guard now checks the file it actually protects; runtime staging trees left by a crash are swept before the next publish.
- Stable shell: the tray-initiated update check dialog is owned by the main window, so it can no longer be buried and lose the answer; the Computer Use switch treats `cancelled` like `failed`; browser guest teardown is bounded (force after 1.5 s, then a 0.5 s grace), the lease is released first, and `browserRelease` no longer hangs forever.
- Community market and skin: an interrupted pagination request no longer leaves "load more" stuck in loading; the market overlay returns focus when it closes; the injected style declares `data-plugin`, so a later-loaded plugin can no longer claim it and delete it on unload; the package-name grammar matches the Host.
- Gates and CI: `upstream-command-windows` installs dependencies before `check:layout`; change classification disables rename detection so a source file renamed into a documentation path cannot skip the product gates; the inspector compatibility test anchors on the repository root.
- Packaging: the Stable shell's `verify:safe-cleanup` now points the Electron child's `TEMP` at a writable workspace directory (Electron 44 on this host is refused directory creation under `%TEMP%`), so the preflight no longer aborts before the installer is produced.

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
