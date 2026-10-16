# DSH Desktop Plugin Development

> **Do not confuse current APIs with a Draft:** this guide describes working DSH/Cordis and Desktop services. The manifest, capability, and unified event model in `dsh-community-fabric` remains a [community RFC Draft](../dsh-community-fabric/README.md) and cannot yet be used as a dependency or release target.

## Understand the two plugin layers

A normal DSH plugin can provide Host services, commands, routes, bundles, or a Web Client. It should depend on upstream DSH contracts whenever possible so the same package can work in the CLI, an ordinary Web profile, and DSH Desktop.

Desktop adds two public Host services:

- `desktopProfiles`: reads the active profile.
- `desktopPnpm`: runs the packaged pnpm in the active profile, or manages plugins through the official `dsh plugin` CLI semantics.

These services live in the Host child process's Cordis generation. The renderer cannot read them directly; a plugin with browser UI should continue to use ordinary DSH Web routes, RPC, client metadata, services, and slots.

The complete types, lifecycle, and failure semantics are in [`dsh-plugin-desktop-beta/docs/plugin-services.md`](../dsh-plugin-desktop-beta/docs/plugin-services.md). This page focuses on selection and the minimum safe patterns.

### Establish the **actual shape** of both services first

This is the easiest place to go wrong: **a service name existing does not mean a method of the same name exists.** What the runtime really provides today is:

```ts
// desktopProfiles
interface DesktopProfiles {
  readonly current: { readonly name: string; readonly dir: string }
}

// desktopPnpm
interface DesktopPnpm {
  run(argv: readonly string[], signal?: AbortSignal): DesktopPnpmHandle
  runPlugin(argv: readonly string[], invokingDir: string, signal?: AbortSignal): DesktopPnpmHandle
  runExternalMarketPluginInstall(argv: readonly string[], invokingDir: string, signal?: AbortSignal): DesktopPnpmHandle
}

interface DesktopPnpmHandle {
  readonly stdout: Readable
  readonly stderr: Readable
  readonly done: Promise<{ readonly exitCode: number | null; readonly signal: NodeJS.Signals | null }>
  cancel(): void
}
```

In the current Desktop-shell Host, `desktopProfiles` carries **only `current`** — profile discovery and switching belong to the shell's own windows and do not cross the Host service. `desktopPnpm` has **no** `installPlugin()`-style recoverable-install entry point, and offers no snapshot, rollback, retry, receipt, or recovery bookkeeping: **the caller owns package identity policy, command construction, `dsh.profile.bundles` reconciliation, and post-operation validation.**

## Desktop-only plugins

If a plugin only makes sense in Desktop, declare the services as required injections:

```ts
import type { Context } from '@deepseek-ai/cordis'
import type { DesktopPnpmHandle } from 'dsh-plugin-desktop-beta/pnpm'
import type {} from 'dsh-plugin-desktop-beta/profile-service'

export const name = 'example-desktop-plugin'
export const inject = ['desktopProfiles', 'desktopPnpm']

declare function registerInstallAction(
  callback: (target: string) => Promise<void>,
): () => void

export function apply(ctx: Context): void {
  ctx.logger.info(`active Desktop profile: ${ctx.desktopProfiles.current.name}`)
  ctx.effect(() => {
    let active: DesktopPnpmHandle | undefined

    // Connect this callback to an explicit user action in the plugin UI.
    const dispose = registerInstallAction(async (target) => {
      // Validate target against this plugin's trust policy before touching a package manager.
      const signal = AbortSignal.timeout(5 * 60_000)
      const operation = ctx.desktopPnpm.run(['add', '--save-exact', `${target}@1.0.0`], signal)
      active = operation
      operation.stdout.setEncoding('utf8')
      operation.stderr.setEncoding('utf8')
      operation.stdout.on('data', chunk => ctx.logger.info(String(chunk).trimEnd()))
      operation.stderr.on('data', chunk => ctx.logger.warn(String(chunk).trimEnd()))
      try {
        const outcome = await operation.done
        if (outcome.exitCode !== 0) {
          throw new Error(
            `plugin install failed: exit=${String(outcome.exitCode)} signal=${String(outcome.signal)}`,
          )
        }
      } finally {
        if (active === operation) active = undefined
      }
    })

    return async () => {
      dispose()
      const operation = active
      operation?.cancel()
      await operation?.done.catch(() => {})
    }
  }, 'example: package-manager user action')
}
```

Production code should invoke package operations from an explicit user action, validate the target, set its own deadline, drain stdout/stderr, and check both `exitCode` and `signal` afterwards; a zero exit code does not replace the plugin's own domain validation. A generation allows only one `desktopPnpm` package operation at a time and a second call **throws synchronously**; dispose must cancel and await it.

### Depending on a service name that does not exist stays silently pending

Cordis treats a required `inject` as "wait until this service appears": **a misspelled service name, or one the current runtime does not provide, leaves the plugin permanently inactive with no error from the host.** Its routes, commands, and tools simply never exist, and the UI only shows unexplained HTTP 4xx responses.

To confirm that a service name really exists, look in two places: the `cordis.patch.yml` / `host.cordis.patch.yml` the shell contributes inside the runtime directory, and whether the package you depend on is mounted as a Loader row in `dsh.profile.bundles`. Do not decide by whether the name looks right.

## Plugins that work in Desktop and ordinary DSH

When the same package must also run under ordinary `dsh web`, do not put Desktop services in the top-level required `inject` list. Detect Desktop from `ctx.get('desktopProfiles')`, then keep the Desktop service in a nested injection so the adapter unloads with its generation:

```ts
export const inject = ['webServer', 'loader']

export function apply(ctx: Context, config: { profile?: string }): void {
  const profiles = ctx.get('desktopProfiles')
  if (profiles === undefined) {
    mountOrdinaryDshManager(ctx, config.profile ?? 'web')
    return
  }

  ctx.inject(['desktopPnpm'], (desktopCtx) => {
    desktopCtx.effect(() => mountManager(desktopCtx, {
      profile: profiles.current.name,
      profileDir: profiles.current.dir,
      runPnpm: (argv, signal) => desktopCtx.desktopPnpm.run(argv, signal),
    }), 'example: Desktop plugin manager')
  })
}
```

`ctx.inject()` is not an optional-dependency declaration: every name passed to that callback is required for the callback. That is exactly what makes it useful here — **only the nested Desktop adapter waits for `desktopPnpm`**, while the outer plugin still owns the ordinary DSH fallback.

The ordinary DSH fallback remains the plugin's authoritative implementation. Do not infer the Desktop profile from `process.argv`, `ctx.baseUrl`, settings, or `$DSH_HOME`; in Desktop, use `desktopProfiles.current`. Do **not** use a name inferred outside Desktop to guess at a different profile.

## Compose platform capabilities through profile patches

The supported way to add desktop capability is a **patch**, not a fork of upstream source. Patches match by row id and do three things; getting one wrong is not an error but a silent failure (see [the patch section of the architecture](architecture.en.md#patches-match-by-row-id-and-a-mistake-is-not-an-error)):

- **Override an upstream row's config**: `- id: <row id>` plus the field (`config` is replaced wholesale, not deep-merged).
- **Disable an upstream row**: `- id: <row id>` plus `disabled: true`.
- **Add your own rows**: `- insert: [{ id: ..., name: ... }]`; with an `id` it inserts into that group, without one it appends at the top level.

```yaml
# A plugin bundle's own cordis.patch.yml
- id: ui-sidebar-browser
  # Upstream decides this row from the Profile name; this product does not depend on it.
  disabled: false
- insert:
    - id: example-capabilities
      name: example-plugin
```

Three criteria:

1. **A wrong `id` produces only a Loader warning and startup proceeds.** `name` is an assertion rather than a rename, so a wrong `name` likewise skips the patch with a warning. When "I changed the config and nothing happened", read the patch warnings in the startup log before suspecting the plugin failed to load.
2. **An `insert`'s `name` is a module specifier** resolved through Node's rules; getting it wrong throws while loading that row, the opposite of a wrong `id`.
3. **Patch layers are ordered**: each bundle's own patch → the profile directory's `cordis.patch.yml` → launcher overlays. Later layers override earlier ones, which is why a user patch can turn off a default a bundle added.

## Getting the browser half loaded

A plugin with a Web Client half (a pure front-end plugin such as a brand skin) must satisfy three conditions at once, or you get "the Host half runs and the page never changes":

1. `package.json` declares `dsh.bundle.patch` pointing at your patch file, whose `insert` adds one loader entry — **the client-module scan walks rows that already exist in the Host Loader**, so without that row the browser half never enters the boot graph.
2. `package.json` declares `dsh.client.platform = "web"` and exports a `./client` bundle. Declaring `dsh.client` without a `./client` export throws; a package whose `platform` is not `web` is skipped by the scan.
3. The package keeps a Node half (the file `main` points at must exist) even if it does nothing. This is the dual-face package convention: **drop the Node half and the package has no `lib/index.js`, so the Host Loader cannot import it.**

For a working in-repository implementation, read [`dsh-nonead-client-skin`](../dsh-nonead-client-skin/): its `cordis.patch.yml` performs one `insert`, `dsh.client.platform = web` is declared, the Host half is an empty `apply()`, and the browser half injects slot-addressed styles.

Role boundary: **a plugin's host is just an ordinary package referenced by a Loader row** — it carries no privileges. A package installed into a profile takes the same resolution and loading path as an official one.

## `run()`, `runPlugin()`, and `runExternalMarketPluginInstall()`

`desktopPnpm.run(argv, signal)` is a low-level pnpm operation whose cwd is fixed to the active profile directory. It is appropriate for lifecycle-owned local work such as `['--dir', pluginDir, 'run', 'build']` when you need Desktop's packaged pnpm and Node surface without mutating the active profile. It does not promise DSH profile initialization, caller-relative `file:`/`link:` anchoring, or `dsh.profile.bundles` reconciliation — **those are the caller's responsibility.**

`desktopPnpm.runPlugin(argv, invokingDir, signal)` runs packaged `dsh plugin --profile <active>` semantics for non-install mutations and preserves upstream plugin-management behavior, including bundle reconciliation. It requires an **absolute** caller-owned working directory.

`desktopPnpm.runExternalMarketPluginInstall(argv, invokingDir, signal)` is a narrow adapter for the bundled `dshmarket`: it accepts only `add`, flag-style options, and **one exact-version** npm target, and rejects every other shape synchronously.

```ts
const signal = AbortSignal.timeout(5 * 60_000)
desktopPnpm.run(['add', '--save-exact', 'example-plugin@1.0.0'], signal)
desktopPnpm.runPlugin(['remove', packageName], invokingDir, signal)
desktopPnpm.runPlugin(['update'], invokingDir, signal)
desktopPnpm.runPlugin(['install', '--no-frozen-lockfile'], invokingDir, signal)
```

Arguments are always passed as argv; do not concatenate shell strings or depend on Windows `.cmd` shims. Empty argv, a NUL-bearing argument, an already-aborted signal, and a generation with an operation already running all **throw synchronously before a handle is returned**. The service settles only after the whole subprocess tree exits (not as soon as the direct wrapper exits) and terminates active operations during generation disposal.

## APIs not to depend on

`desktopRuntime`, `desktopPnpmBootstrap`, Electron `BrowserWindow`, the tray registry, private Node helpers, `ELECTRON_RUN_AS_NODE`, and generated shims are Desktop internals. Their presence in declarations or runtime context does not make them third-party compatibility contracts.

The IPC messages between the shell and the Host child (`ready` / `fatal` / `shutdown` / `permission` and the rest) are likewise an internal handshake, not a plugin interface.

## Testing and release checks

At minimum, a plugin should cover:

- Loading under ordinary DSH without Desktop services, or staying pending by design.
- Matching the profile name and directory reported by Desktop to the user's actual selection.
- Cancellation, non-zero exit, spawn failure, and generation teardown for package operations.
- Restarting after a plugin change and seeing the bundle in the next Loader composition.
- With a browser half, that the page actually changed — a loaded Host half does not prove the client half entered the boot graph.

Read the [architecture](architecture.en.md) next, then use the package-level [service contract](../dsh-plugin-desktop-beta/docs/plugin-services.md) as the API reference.

## Dependency classification for packaging

The payload inside the installer is assembled independently by the Desktop shell's scripts, and the production closure is `dependencies` + non-optional `peerDependencies` + installed `optionalDependencies`. **If a local plugin needs our packages only for types, those dependencies must be demoted to optional peers or left in `devDependencies`:** anything left in `dependencies` is treated as a runtime dependency, shipped inside the installer, and can also fail the build by conflicting with the version the installation already carries. Separately, workspace packages publish by their `files` list, and `files` accepts only literal names and the `directory/**` form — any other glob fails the build outright.

## Ecosystem vision: keep the plugin ecosystem composable

The DSH plugin ecosystem is growing quickly. The more plugins there are, the more their ability to work together matters — if every plugin assumes or overrides another plugin's internals, installing a few plugins starts to conflict and the ecosystem fragments.

We advocate a browser-plugin style of development: everyone extends the same platform against the same conventions, instead of each maintaining a modified runtime of their own. DSH Desktop is the first practitioner of this approach — the desktop shell itself is an ordinary plugin on the same composition path as official and third-party plugins, with no special privileges.

To that end we are starting a development-conventions initiative and hope it becomes a de facto standard through community adoption:

- **Composition first**: compose capabilities through official slots, services, and patches; do not assume or override other plugins' internals.
- **Declare clearly**: state the services and slots you depend on; do not rely on runtime coincidences.
- **Compatibility first**: keep upgrades backward compatible and never break existing compositions.

The manifesto is a living document that follows ecosystem practice and accepts community discussion and revisions. Once the plugin marketplace ships, plugins following shared conventions will be easier to discover, install, and evaluate for compatibility, making convention-driven development the beneficial choice for every author. See the [DSH plugin ecosystem manifesto](plugin-ecosystem.en.md) for the vision and [DSH Community Fabric](../dsh-community-fabric/README.md) for the proposed future interoperability contract.
