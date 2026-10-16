# DSH Desktop repository rules

This repository owns the desktop product around an unmodified DeepSeek Harness checkout.

## Prerequisites and setup

- Use Node.js `^22.19.0` or `>=24.0.0` and the root Yarn `4.18.0` release through Corepack.
- Initialize the pinned upstream checkout with `git submodule update --init --recursive`.
- Install root dependencies with `corepack yarn install --immutable`.

## Build, run, and verify

- Start the desktop development workflow with `corepack yarn dev:beta`. The former unsuffixed `corepack yarn dev`/`start`/`dist:*` aliases targeted the deleted Stable workspace and are gone: Beta commands keep the `:beta` suffix and the Nonead DSH Desktop workspace (`nonead-dsh-desktop/`) uses the `:stable` suffix.
- Build the desktop packages with `corepack yarn build`.
- Root build and packaging commands refresh `dshmarket` from npm `latest` for Beta and Nonead DSH Desktop via `corepack yarn market:prepare`. Commit its exact dependency versions, Desktop compatibility patch, and lockfile together. `corepack yarn market:check` verifies freshness without writes; offline lookups or incompatible patches fail rather than silently retaining an old market. Installed apps do not hot-update executable plugins on launch.
- Before each release, run `corepack yarn aa:prepare-release` to build the latest official Agents Anywhere `main` for every Desktop workspace that consumes the bridge. Commit the resulting artifact, provenance, manifests, and lockfile before packaging. Signed macOS releases and root Windows distribution commands verify freshness and installed versions; `DSH_AA_SOURCE_REF=pinned` is no longer supported.
- Run unit tests with `corepack yarn test`.
- Run type checking with `corepack yarn typecheck`.
- Run the complete headless gate with `corepack yarn check`.
- `corepack yarn dev:stable` explicitly launches Nonead DSH Desktop, the experimental shell; `corepack yarn check:stable` validates it without a graphical application. It uses the official published Web frontend and the recorded upstream Desktop presentation, with product capabilities composed as a separate bundle. Note that the shell polls the `stable` release channel (`X-DSH-Desktop-Channel: stable`), so the `:stable` command suffix names the workspace and matches the update channel it consumes.
- Develop and validate Desktop feature changes in `dsh-plugin-desktop-beta/`. It is now the only full Desktop workspace: the former Stable workspace `dsh-plugin-desktop/` and its `corepack yarn check:desktop-variants` mirror gate were removed, so there is no second variant to synchronize.
- Run upstream operations through the root scripts, such as `corepack yarn upstream:build`.

- `deepseek-harness/` is a pinned upstream Git submodule. Never edit files inside it from a desktop feature branch.
- `dsh-plugin-desktop-beta/` owns the Cordis Host and Client faces, Electron bootstrap, packaging, and release tests.
- `nonead-dsh-desktop/` owns the separate experimental Desktop shell, Profiles and recovery, and adapters for the existing AA bridge and Community Market. Changes that only concern the Nonead DSH Desktop shell do not belong in the Beta Desktop workspace. Keep its upstream reference and published runtime versions aligned; do not fork the official main frontend.
- `dsh-nonead-client-skin/` owns the brand skin distributed inside the installer. `nonead-dsh-desktop/` depends on it as a `file:` package and inserts it for every profile from its own `cordis.patch.yml`.
- `dsh-community-fabric/` owns the community interoperability RFC. Until schemas and a reviewed reference adapter exist, it remains a private documentation scaffold and must not declare loadable DSH or package entry points.
- `dsh-community-market/` owns the community-market shell. Until its runtime is implemented, it remains a private documentation scaffold and must not declare loadable DSH or package entry points.
- `upstream.json` records both release channels and their vendored runtime packages under `vendor/dsh-runtime/`. The active channel is `beta` (DSH `0.2.1-alpha.4`), which both Desktop workspaces build against; the `stable` entry keeps the runtime and root resolutions of the deleted `dsh-plugin-desktop/` workspace.
- The outer repository and all owned packages use the root Yarn release with `nodeLinker: node-modules`.
- The upstream submodule keeps its own pnpm workspace. Run upstream commands through the root `upstream:*` scripts, whose Yarn portable-shell commands enter the submodule before invoking Corepack.
- Compatibility mode must run the upstream default client without overrides. Advanced presentation belongs to desktop-owned client plugins and may replace documented slots or services through profile composition.
- Keep graphical application launch explicit. Builds, typechecks, unit tests, and Loader smokes must remain headless-safe.
- Commit before major changes of direction and keep the submodule pin update separate from desktop behavior changes.
- Keep the repository topology and package-manager split consistent with the [owning Agent Note](.agents/notes/implemented/process/2026-08-15-pinned-upstream-and-isolated-yarn-workspace.md).

## Known limitations

- A Windows update installer is verified only against the ProductName and ProductVersion in its PE version resource. Cryptographic SHA-256 digests are enforced as soon as the version service publishes them, which it does not do yet.
- The Agents Anywhere bridge has to be rebuilt on a credentialed machine with `corepack yarn aa:prepare-release` before it is compatible with the `0.2.1-alpha.4` profile.
- `corepack yarn check` requires a `.git` directory: the bilingual-docs gate resolves tracked `*.i18n.yaml` records and document blob hashes through Git.
