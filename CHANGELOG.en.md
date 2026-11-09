<p align="center">
  <strong>Nonead DSH Desktop · Changelog</strong><br>
  <sub><a href="CHANGELOG.md">中文</a> · English · <a href="CHANGELOG.ja.md">日本語</a> · <a href="CHANGELOG.es.md">Español</a> · <a href="CHANGELOG.fr.md">Français</a> · <a href="CHANGELOG.de.md">Deutsch</a> · <a href="CHANGELOG.ru.md">Русский</a> · <a href="CHANGELOG.pt.md">Português</a></sub>
</p>

# Changelog

This file records user-facing changes to Nonead DSH Desktop. Every release raises the version in both desktop workspaces (`nonead-dsh-desktop` and `dsh-plugin-desktop-beta`) in lockstep; the version also appears in installer filenames, the update endpoint response and the bare download URL mapping, and all three must agree.

Maintenance conventions:

- Every release adds one entry per language (`CHANGELOG.md`, `CHANGELOG.en.md` and the ja/es/fr/de/ru/pt versions) and refreshes the Git blob hashes recorded in `CHANGELOG.i18n.yaml`, otherwise `corepack yarn check:bilingual-docs` fails.
- Entries record only changes users can perceive and boundary changes maintainers must know about; pure refactors do not get their own entry.
- Earlier history lives in the Git tags (`v1.7.3`, `v2.0.7`, `v2.0.8`, `v2.1.3`, `v2.1.4`, `v2.1.5`) and in the commit log.

## 2.2.9 — 2026-11-10

The runtime moves to DSH 0.2.2-rc.1, the bundled plugin set reaches 36, and the out-of-the-box guide tells that story differently:

- Runtime: the bundled DeepSeek Harness moves from 0.2.2-alpha.3 to **0.2.2-rc.1** (upstream commit `66491b0`, with the cordis family promoted to 4.1.0 and schemastery 3.19.0). `vendor/dsh-runtime/0.2.2-rc.1` is rebuilt from the local upstream checkout as 373 packages, exactly the same package set as before; all 24 desktop patches are rebased onto the new artifacts, the root `resolutions` and both desktop workspaces point at the new version, and `yarn check:vendored-runtime` passes for both channels.
- Onboarding: the installer's "ready to go" step no longer lists every plugin up front; it explains what the bundled set covers by category. Once installation starts, each plugin shows its name, version, category and full description as its turn comes, and credits its author — "Thanks to X for this plugin."
- Bundled plugins: the set grows from 30 to **36**, adding `@changfenhuang/dsh-genui`, `@deepseek-ai/dsh-tool-subagent`, `@linxin666/dsh-client-ui-task-board`, `@weibaohui/skills-management`, `billion-context`, `dsh-client-auto-continue`, `dsh-cost-meter`, `dsh-markitdown`, `dsh-nonead-prompt-rewind`, `dsh-office-tools` and `dshmarket`; `dsh-api-client`, `dsh-design`, `dsh-doc-reader`, `dsh-rewind-plugin` and `@kenz1117/dsh-ui-usage-billing` leave the bundled set.
- Plugin upgrades: `dsh-ppt-master` 1.0.8 → 6.1.0, `dsh-config-manager` 0.3.1 → 0.6.0, `@michengai/dsh-skills-manager` 1.2.28 → 1.4.0, `dsh-better-sidebar` 0.28.2 → 0.30.1, `dsh-context` 0.80.3 → 0.83.0, the rest follow npm latest.
- Plugin manifest: `plugin/manifest.json` moves to v4, every entry now carrying a category and an author, which is what drives the onboarding grouping and the credit line.
- Version: product 2.2.6 → **2.2.9** (both desktop workspaces move together).

### Bundled plugin list (36)

These 36 plugins ship with the installer; after first launch you can enable, disable, or remove them on the Plugins page. The number after each name is the bundled version.

- `@a9i5k4/dsh-auto-memory` 3.3.17 — Automatic memory. Recalls relevant history and settled decisions before a task starts, and distils logs into notes, ledgers and a whiteboard so long tasks continue across sessions.
- `@changfenhuang/dsh-genui` 0.16.0 — Generative UI. The model renders layouts, charts, forms and flow charts inside a reply, and clicks on those panels travel back to it.
- `@deepseek-ai/dsh-tool-subagent` 0.2.2-rc.1 — Sub-agent delegation. Gives the model a named tool that hands independent work to a chosen backend, with the runtime owning completion notices and cleanup.
- `@linxin666/dsh-client-ui-git-graph` 0.4.14 — Git graph. Switches branches from an empty session and shows the commit graph plus worktree isolation, with guarded branch operations.
- `@linxin666/dsh-client-ui-skill-explorer` 0.4.16 — Skill centre. Browses loaded skills by origin, toggles model-facing availability, and creates or deletes skills.
- `@linxin666/dsh-client-ui-task-board` 0.4.16 — Task board. Cards are host-managed and really open sessions to run, with cron scheduling and sleep inhibition for unattended checks.
- `@michengai/dsh-agency-agents` 1.2.27 — Expert library. Bundles 331 summonable specialist agents and five expert teams; name the expert instead of approximating the analysis.
- `@michengai/dsh-archive-manager` 1.3.0 — Session archive. Archives, restores, favourites and permanently deletes sessions, and diagnoses corrupted session logs.
- `@michengai/dsh-code-review` 1.0.9 — Code review. A separate sub-agent inspects Git, sources, callers and tests, then brings the report back to the main session in Chinese or English.
- `@michengai/dsh-skills-manager` 1.4.0 — Skill manager. Loads and safely manages local skills in one place, with GitHub installs, update previews and backup rollback.
- `@tt-a1i/archify-dsh` 1.1.0 — Architecture diagrams. Brings Archify in as a pure skill pack so the model can draw architecture diagrams from a description.
- `@weibaohui/skills-management` 0.9.3 — Skills marketplace. Manages skills from every local coding agent on one page, with a 6600+ marketplace and an injection-cost figure per skill.
- `@wenaixi/dsh-superpower` 8.0.0 — Engineering skill pack. Ports the 15 engineering-discipline skills from obra/superpowers, described in Chinese and English, each switchable on its own.
- `@yolk_vat-y/dsh-project-memory` 0.6.12 — Project memory. Indexes documents and code symbols into a local store with path:line citations, and keeps tasks, read files and hard-won lessons for the next session.
- `billion-context` 0.1.213 — Context compression. Folds long conversations into summaries to run in a smaller window with fewer tokens; the project reports months-long single sessions.
- `dsh-better-sidebar` 0.30.1 — Better sidebar. Puts the file tree, editor, changes, tasks and side chat in one per-session column, and exposes sidebar tab and file viewer services to other plugins.
- `dsh-client-auto-continue` 0.17.4 — Auto continue. Re-sends a localised continue prompt when a request dies for reasons that are not the user's, and can keep looping after successful turns.
- `dsh-config-manager` 0.6.0 — Configuration manager. Backs up, restores, exports, imports, migrates and syncs DSH configuration across settings, plugins, MCP, skills and workspaces.
- `dsh-context` 0.83.0 — Context insight. A dashboard shows what the context is made of and how it grows, compresses when needed, and also answers to the /context command.
- `dsh-cost-meter` 1.9.62 — Cost dashboard. Counts tokens and cost for the session, the day and history, ships a 170+ model price catalogue, and checks subscription quotas and provider balances.
- `dsh-excel-chat` 0.43.0 — Spreadsheet chat. Reads, edits and cleans up spreadsheets in natural language and re-checks formulas after every edit, without needing Excel installed.
- `dsh-find-plugins` 0.3.0 — Plugin discovery. Searches five community catalogues plus live GitHub and npm, ranking by relevance, trust, freshness and popularity rather than stars alone.
- `dsh-github-skills` 0.2.1 — GitHub workflow skills. Takes OpenAI Codex GitHub semantics as the upstream baseline and adapts them to DSH's multiple providers, approvals and on-demand loading.
- `dsh-image-gen` 0.11.1 — Image generation. Draws and edits images by talking, through Gemini, OpenAI, Seedream, DashScope or a local ComfyUI, and can run on a subscription account without a key.
- `dsh-markitdown` 0.2.2 — Documents to Markdown. Calls Microsoft MarkItDown to turn PDF, Word, Excel, PPT, HTML, CSV, EPUB or a URL into text the model can actually read.
- `dsh-mcp-connector` 0.2.97 — MCP connector. Bundles a marketplace of over a hundred connectors, manages authorisation, searches tools across connections and diagnoses connection problems.
- `dsh-nonead-prompt-recall` 0.8.7 — Prompt history. Press ↑ in an empty composer to recall the previous instruction, per workspace and across restarts; a rewrite button polishes the draft while keeping @ references.
- `dsh-nonead-prompt-rewind` 0.5.4 — Conversation rewind. Rolls back in place to any earlier user message and refills the composer, and restores files changed by write tools along the way.
- `dsh-nonead-universal-robots` 0.8.6 — UR arms. Drives Universal Robots cobots in natural language, covering pose reads, joint moves, drawing and I/O.
- `dsh-nonead-ursim` 0.3.14 — UR simulation. Rehearses and verifies Universal Robots motion offline, so trajectories and logic are proven before the real arm moves.
- `dsh-office-tools` 1.0.8 — Office files. Eight tools create, read and append Word, Excel and PowerPoint files, all through the official file service.
- `dsh-ppt-master` 6.1.0 — Presentation workflow. Produces editable PPTX from content, and can export SVG snapshots, fill native templates and enhance finished decks.
- `dsh-remotion` 0.10.5 — Video workbench. Turns a React project into video, bundling the official Remotion skills, templates, asset ordering, Studio preview and MP4 export.
- `dsh-superagent` 0.1.0 — Proactive agent prototype. Watches one GitHub repository (optionally Feishu), evaluates requests against a policy and runs authorised ones as tickets in their own sessions (DeepSeek research prototype, not an official product).
- `dsh-univer-office` 0.4.0 — Office integration. Brings spreadsheets, documents, slides, boards and bases into DSH, with changes previewed, approved or discarded in the conversation.
- `dshmarket` 1.73.16 — Visual plugin market. Browses, searches and installs community plugins without the command line, and a mistaken install can be disabled on the Plugins page.

## 2.2.6 — 2026-11-03

The runtime moves to DSH 0.2.2-alpha.3, and the bundled plugin set reaches 30:

- Runtime: the bundled DeepSeek Harness moves from 0.2.2-alpha.2 to **0.2.2-alpha.3** (upstream commit `05b1cae`, including the cordis 4.0.6-alpha.2 and cosmokit 1.8.7-alpha.2 vendor refresh). `vendor/dsh-runtime/0.2.2-alpha.3` is rebuilt from the local upstream checkout as 373 packages, and the root `resolutions` plus both desktop workspaces point at the new version; `yarn check:vendored-runtime` passes for both channels.
- New plugin: `dsh-superagent` 0.1.0 (DeepSeek research prototype: watches GitHub and Feishu, turns authorized requests into tickets that run in their own sessions, and a web panel lists what needs a person; built from `deepseek-ai/dsh-superagent-prototype` with its official build chain).
- Plugin refresh: `dsh-remotion` moves to 0.10.4 and `dsh-design` replaces the unpublished `dsh-design-skills`; `@michengai/dsh-agency-agents` 1.2.23, `@michengai/dsh-archive-manager` 1.2.0, `@michengai/dsh-code-review` 1.0.7, `@michengai/dsh-skills-manager` 1.2.28, `dsh-config-manager` 0.3.1, `dsh-context` 0.80.3 and `dsh-rewind-plugin` 0.19.2 follow npm latest.
- Bundled market: `dshmarket` moves to 1.73.9.
- Tooling: new `yarn plugins:update` refreshes every archive in `plugin/` to npm latest and rebuilds the manifest.
- Version: product 2.2.5 → **2.2.6** (both desktop workspaces move together).

### Bundled plugin list (30)

These 30 plugins ship with the installer; after first launch you can enable, disable, or remove them on the Plugins page. The number after each name is the bundled version.

- `@a9i5k4/dsh-auto-memory` 3.3.17 — Automatic memory. Injects the relevant past work and settled decisions before a task starts, without being asked; accumulated context stays on this machine and remains searchable across sessions.
- `@kenz1117/dsh-ui-usage-billing` 1.8.1 — Usage and cost dashboard. Collects call-volume metrics and spending detail into the sidebar so cost can be checked at any time.
- `@linxin666/dsh-client-ui-git-graph` 0.4.14 — Git branch graph. Plots commit history and branch flow, and lets you switch branches from an empty session instead of dropping back to the terminal.
- `@linxin666/dsh-client-ui-skill-explorer` 0.4.14 — Skill centre. Browses loaded skills by origin, shows what each one does, and makes it clear which component provides a given capability.
- `@michengai/dsh-agency-agents` 1.2.23 — Expert library. Bundles 331 summonable specialist agents across engineering, design, marketing, legal and more; summon the right expert to do the analysis instead of having the main session approximate it.
- `@michengai/dsh-archive-manager` 1.2.0 — Session archive. Archives, restores, favourites and permanently deletes sessions, and diagnoses corrupted session logs, so routine cleanup need not lose records you still want.
- `@michengai/dsh-code-review` 1.0.7 — Code review. A Codex-style review flow run by a native, separate sub-agent, with the review scope chosen flexibly (changes, a commit range, or the whole repository).
- `@michengai/dsh-skills-manager` 1.2.28 — Skill manager. Loads local agent skills in one place and keeps them safely managed, with origin and on/off state in plain view.
- `@tt-a1i/archify-dsh` 1.0.0 — Architecture diagrams. Turns system structure or a business process into interactive architecture, flow, sequence, data-flow and state diagrams.
- `@wenaixi/dsh-superpower` 8.0.0 — Engineering skill pack. Fifteen superpowers engineering skills, usable in Chinese and English.
- `@yolk_vat-y/dsh-project-memory` 0.6.9 — Project memory. Indexes documents (PDF, Markdown) and code symbols so later questions are answered by retrieval instead of re-reading.
- `dsh-api-client` 0.2.0 — API debugging. Issues HTTP requests and shows responses inside the editor, for interface integration work.
- `dsh-better-sidebar` 0.28.2 — A better sidebar. Merges file tree, editor, changes, tasks and side chat into one column, independent per session; it also exposes a sidebar-tab and file-viewer registration service to other plugins.
- `dsh-config-manager` 0.3.1 — Configuration manager. Backs up, restores, exports, imports, migrates and syncs DSH configuration, so a new machine or a reinstall can carry the setup over.
- `dsh-context` 0.80.3 — Context insight and management. Shows current context usage and compresses when it approaches the limit.
- `dsh-design` 0.2.0 — Design-system skills. Constrains design choices and uses `design_audit` to measure type scale, contrast, spacing and palette drift on rendered pages.
- `dsh-doc-reader` 0.2.0 — Document reader. Parses the body text of PDF, Word and similar files so the model reads the document itself rather than just its filename.
- `dsh-excel-chat` 0.43.0 — Spreadsheet chat. Works on Excel worksheets in natural language without memorising functions or cell coordinates.
- `dsh-find-plugins` 0.3.0 — Plugin search. Searches plugins across five community catalogues and runs live searches on GitHub and npm.
- `dsh-github-skills` 0.2.1 — GitHub workflow skills. Adapted from OpenAI Codex's GitHub skills.
- `dsh-image-gen` 0.10.2 — Image generation. Connects to Gemini, OpenAI and similar providers for drawing and editing images.
- `dsh-mcp-connector` 0.2.93 — MCP connector. Connects MCP services and provides unified tool search and invocation across them.
- `dsh-nonead-prompt-recall` 0.8.4 — Input history. Press ↑ in an empty composer to recall the previous instruction.
- `dsh-nonead-universal-robots` 0.8.5 — UR robot arms. Controls Universal Robots arms directly in natural language, without hand-writing scripts.
- `dsh-nonead-ursim` 0.3.13 — UR simulation. Choreographs arm motion in an offline simulator, so a trajectory can be validated before touching real hardware.
- `dsh-ppt-master` 1.0.8 — Presentation generation. Produces slide decks from the supplied content.
- `dsh-remotion` 0.10.4 — Video production. Renders video from a React project inside DSH.
- `dsh-rewind-plugin` 0.19.2 — Conversation rewind. Rolls the conversation back in the same window and restores the workspace files with it.
- `dsh-superagent` 0.1.0 — Super-agent prototype. Watches GitHub and Feishu, turns authorized requests into tickets that run in separate sessions, and a web panel lists what needs a person (DeepSeek research prototype, not an official product).
- `dsh-univer-office` 0.4.0 — Office documents. DSH and Univer integration for spreadsheets, documents and presentations.

## 2.2.4 — 2026-10-31

Version bump with no functional changes:

- Version: product 2.2.3 → **2.2.4** (both desktop workspaces in sync).

## 2.2.3 — 2026-10-29

The desktop shell is localized into eight languages (Simplified Chinese, English, Japanese, Spanish, French, German, Russian, Brazilian Portuguese):

- Shell copy: Spanish, French, German, Russian and Brazilian Portuguese dictionaries are added, 209 entries each alongside the existing languages; native dialogs, the permissions panel, Computer Use, the settings page, plugin controls and the terminal mode label all resolve through `desktopText`, and the native menus and stored interface language follow the same eight-language set.
- Settings page: settings dictionaries in six languages (125 entries each) cover the plugin market, remote control, window, browser and local-network, and notification sections instead of falling back to English.
- Interpolated copy: eleven dialogs (Profile removal and switching, plugin enable/disable/uninstall, data directory and update state) now look up `{name}` templates and substitute the value, so they no longer fall back to English in six languages.
- Renderer: recovery feedback copy moved out of the module that imports Node built-ins, so the native-ui build no longer reports `node:fs`/`node:path`/`node:crypto` externalization warnings.
- Boundary: the recovery assistant and Profile selector live in the shared `dsh-plugin-desktop-beta` workspace and remain Chinese/English only.
- Version: the product moves from 2.2.2 to **2.2.3** in both desktop workspaces.
- Docs: README and CHANGELOG are now published in Japanese, Spanish, French, German, Russian and Brazilian Portuguese as well; the bilingual gate now accepts multi-language records (at least two documents per record).


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
