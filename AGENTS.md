# DSH Desktop repository rules

This repository owns the desktop product around an unmodified DeepSeek Harness checkout. It is developed and maintained by Nonead Corporation and published under the `anywhere-labs` GitHub organization; that organization is only where the project is published, so repository, issue, discussion and release URLs must not be rewritten to the developer name.

## Prerequisites and setup

- Use Node.js `^22.19.0` or `>=24.0.0` and the root Yarn `4.18.0` release through Corepack.
- Initialize the pinned upstream checkout with `git submodule update --init --recursive`.
- Install root dependencies with `corepack yarn install --immutable`.

## Build, run, and verify

- Start the desktop development workflow with `corepack yarn dev`.
- Build the desktop package with `corepack yarn build`.
- Run unit tests with `corepack yarn test`. Some Desktop specs launch the real Electron binary recorded in `dsh-plugin-desktop/node_modules/electron` — the Windows Electron Node-mode, browser-opener and Safe Mode cleanup checks — so run this from an ordinary terminal. A sandboxed agent session confines `electron.exe` to the workspace, and those specs then fail with `EPERM` on their system temp fixtures even though an equivalent `node.exe` child succeeds. The specs are correct; such a session is not a valid environment for them.
- Run type checking with `corepack yarn typecheck`.
- Run the complete headless gate with `corepack yarn check`.
- Develop and validate Desktop feature changes in `dsh-plugin-desktop-beta/` first, then synchronize shared changes into `dsh-plugin-desktop/` while preserving declared variant differences. Before committing or pushing shared Desktop changes, run `corepack yarn check:desktop-variants` and validate both affected packages; neither package automatically inherits the other's source edits.
- Run upstream operations through the root scripts, such as `corepack yarn upstream:build`.

- `deepseek-harness/` is a pinned upstream Git submodule. Never edit files inside it from a desktop feature branch.
- `dsh-plugin-desktop/` owns the Cordis Host and Client faces, Electron bootstrap, packaging, and release tests.
- `dsh-community-fabric/` owns the community interoperability RFC. Until schemas and a reviewed reference adapter exist, it remains a private documentation scaffold and must not declare loadable DSH or package entry points.
- `dsh-community-market/` owns the implemented community-market shell: the Cordis Host face, the Web Client face, the catalog adapter boundary, managed package operations, and its own `cordis.patch.yml` bundle patch. It is an outer Yarn workspace member that declares DSH and package entry points, and the desktop launcher composes it as a shipped product plugin.
- `dsh-nonead-client-skin/` owns the shipped brand-skin client plugin and is the only product-owned plugin workspace member. Its `lib/` directory is the tracked distribution artifact that `main`, `exports` and `files` point at, so `lib/` output is committed deliberately and must never be treated as disposable build output.
- The outer repository and all owned packages use the root Yarn release with `nodeLinker: node-modules`.
- The upstream submodule keeps its own pnpm workspace. Run upstream commands through the root `upstream:*` scripts, whose Yarn portable-shell commands enter the submodule before invoking Corepack.
- Compatibility mode must run the upstream default client without overrides. Advanced presentation belongs to desktop-owned client plugins and may replace documented slots or services through profile composition.
- Keep graphical application launch explicit. Builds, typechecks, unit tests, and Loader smokes must remain headless-safe.
- Commit before major changes of direction and keep the submodule pin update separate from desktop behavior changes.
- Keep the repository topology and package-manager split consistent with the [owning Agent Note](.agents/notes/implemented/process/2026-08-15-pinned-upstream-and-isolated-yarn-workspace.md).
