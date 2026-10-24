# DSH Desktop Plugin Development

DSH Desktop runs the **unmodified upstream runtime**, so the first rule of writing a plugin is: write it as a normal DSH plugin first, then decide whether it needs anything desktop-specific. The shell adds exactly two things — profiles and package operations — and both are deliberately narrowed to two Host services.

> This document describes the **current implementation**. The manifest and capability proposals in `dsh-community-fabric` are still Drafts (`0.1.0-dev.0`); do not write production code against them.

## Understand the two layers first

A plugin that runs inside Desktop consists of at most two halves.

### The Host-side Cordis plugin

An ordinary Cordis plugin that runs in the Host process with `export const name`, `export const inject` and `export function apply(ctx)`. It can use every service upstream provides, plus the services the desktop shell injects. This half is Node code: it can read files, start child processes and install packages.

### The browser half

The half that runs in the renderer, declared by `dsh.client` and loaded by the upstream client loader. It **cannot** read profiles directly and cannot call Host services; its only view of the desktop is what the Web API and the desktop shell's renderer-facing channel expose.

The split is the same as in ordinary DSH: keep logic that needs Node in the Host half and hand the renderer only the result.

### The real shape of the two public Host services

Desktop exposes exactly two Host services to plugins. Everything else (`desktopRuntime`, `desktopPnpmBootstrap`, `desktopSettingsController`, ...) is internal to the shell.

```ts
interface DesktopCurrentProfile { readonly name: string; readonly dir: string }

interface DesktopProfiles {
  readonly current: DesktopCurrentProfile
  create(name: string): DesktopProfileSummary
  list(): readonly DesktopProfileSummary[]
  prepareSelection(name: string): Promise<DesktopProfileSelection>
  select(name: string): Promise<void>
  canDelete(name: string): boolean
  delete(name: string): Promise<void>
}
```

**Only `current` is safe to depend on.** `create` / `list` / `prepareSelection` / `select` / `canDelete` / `delete` are profile management surfaces that Desktop added for itself; they are desktop-product internals that move with the desktop version. Do not treat them as a cross-platform contract.

```ts
interface DesktopPnpmOutcome {
  readonly exitCode: number | null
  readonly signal: NodeJS.Signals | null
}

interface DesktopPnpmHandle {
  readonly stdout: Readable
  readonly stderr: Readable
  readonly done: Promise<DesktopPnpmOutcome>
  cancel(): void
}

interface DesktopPnpm {
  run(argv: readonly string[], signal?: AbortSignal): DesktopPnpmHandle
  runPlugin(argv: readonly string[], invokingDir: string, signal?: AbortSignal): DesktopPnpmHandle
  runExternalMarketPluginInstall(argv: readonly string[], invokingDir: string, signal?: AbortSignal): DesktopPnpmHandle
}
```

There is no `installPlugin()`, no snapshots, no rollback, no retry and no receipt. To install something you send an argv, read the output and judge the result yourself.

## A desktop-only plugin

```ts
export const name = 'example-desktop-capability'
export const inject = ['desktopProfiles', 'desktopPnpm']

export function apply(ctx: any) {
  ctx.effect(() => {
    ctx.logger?.info?.('profile: %s', ctx.desktopProfiles.current.name)
    return () => {}
  })
}
```

A real package operation looks like this:

```ts
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), 5 * 60_000)
const handle = ctx.desktopPnpm.runPlugin(
  ['add', 'some-plugin@1.2.3'],
  '/absolute/path/of/your/plugin',
  controller.signal,
)
handle.stdout.on('data', chunk => ctx.logger?.info?.(String(chunk).trimEnd()))
handle.stderr.on('data', chunk => ctx.logger?.warn?.(String(chunk).trimEnd()))
const { exitCode, signal } = await handle.done
clearTimeout(timer)
if (exitCode !== 0 || signal !== null) throw new Error(`package operation failed: ${exitCode ?? signal}`)
```

Rules to remember:

- `runPlugin`'s `invokingDir` must be an **absolute path**.
- Arguments are passed as argv, never through a shell; empty argv, a NUL byte, an already-aborted signal, or a package operation already in flight all **throw synchronously** (they do not return a rejected promise).
- `done` settles only after the whole child process tree has exited; check `exitCode` and `signal` together, because looking only at `exitCode` treats a signal-killed run (`exitCode === null`) as success.
- One package operation per generation; a second call fails synchronously instead of queueing.
- The handle carries `cancel()` to abandon **this one** operation; it is a separate path from the `AbortSignal` you passed in, and neither implies `done` stops settling — `done` still reports that operation's exit code and signal.
- Do not treat the `AbortSignal` as a politeness request: generation dispose terminates the operation, so your cleanup must handle that.

### An inject for a service that does not exist stays pending silently

If `inject: ['desktopPnpm']` is wrong (say `desktopPnpmBootstrap`, or an old name), the plugin does not fail — it waits in pending forever and only shows external symptoms (a 4xx in the UI). This is the most expensive trap in this loader: **there is no exception to read**.

Investigation order: check the spelling → check that the bundle providing it is actually loaded in this generation → check that the profile's insert row was not filtered out. If you are unsure, use conditional injection (next section) so it degrades instead of hanging.

## Compatible with both Desktop and plain DSH

A package that must run in both places cannot declare desktop-only required injects at the top level.

```ts
export const inject = ['webServer']   // only services that exist in both

export function apply(ctx: any) {
  const profiles = ctx.get('desktopProfiles')
  if (!profiles) {
    ctx.logger?.info?.('running outside DSH Desktop; desktop features disabled')
    return
  }
  ctx.inject(['desktopPnpm'], (desktopCtx: any) => {
    // both services are guaranteed to exist here
  })
}
```

`ctx.get(name)` returning `undefined` means "not there", not "broken"; `ctx.inject([...], cb)` handles services that arrive later. Do **not** infer the active profile inside a plugin — `desktopProfiles.current` is the single source of truth; read it instead of parsing environment variables or paths.

## Using profile patches to plug into the platform

Profile patches are the sanctioned way for a plugin to take part in composition, not a shortcut for editing the user's config. Three legitimate uses:

1. Override the config of an upstream row (for example, disable automatically opening a browser).
2. Disable a row with `disabled: true`.
3. Append your own loader entry with `insert`.

```yaml
# <your package>/cordis.patch.yml
- id: web-runtime
  config:
    openBrowser: false
- insert:
    - id: example-capabilities
      name: example-plugin
```

Three rules, ordered by cost:

- A wrong `- id:` only logs an `entry not found` warning while the remaining patches still apply — so "my patch did nothing" is usually a mistyped id, not a broken patch.
- The `name` in an `insert` is a **module specifier**; a wrong one fails loudly (the module cannot load), which is easier to diagnose than a wrong id.
- Patch layers are ordered: the bundle's own patches → profile user patches → the shell's overlay → machine-wide patches. Do not assume "last writer wins"; check which layer covers you before you patch.

## Making the browser half load

All three conditions must hold:

1. `package.json`'s `dsh.bundle.patch` points at your patch file and the patch inserts a loader entry.
2. `dsh.client.platform = "web"` and you export `./client`.
3. The Node half still has a `main` — without a Host-side entry the loader considers the bundle incomplete.

The minimal shape:

```json
{
  "name": "example-plugin",
  "main": "lib/index.js",
  "exports": { "./client": "./lib/client.js" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-ui-layout"] }
  }
}
```

You can copy `dsh-nonead-client-skin`: it is a complete example of a Host plugin plus a browser half plus a patch.

## run(), runPlugin() and runExternalMarketPluginInstall()

All three run pnpm; the difference is **which semantics** they run:

| | cwd | Extra behaviour |
| --- | --- | --- |
| `run(argv)` | active profile | plain pnpm; the shell adds no semantics |
| `runPlugin(argv, invokingDir)` | active profile | requires an absolute `invokingDir`; performs bundle reconcile |
| `runExternalMarketPluginInstall(argv, invokingDir)` | active profile | accepts only `add` plus an exact-version npm target |

`runExternalMarketPluginInstall` accepts exactly one shape: `add`, flags, and an exact-version npm target. It rejects `latest`, paths and git targets, because a market install needs a reproducible result and `latest` is not one. The Host resolves `latest` itself and validates the DSH manifest before pinning the exact version.

Everything else is shared: arguments always travel as argv and never through a shell; empty argv, a NUL byte, an already-aborted signal or an operation in flight throw synchronously; `done` settles only after the whole process tree exits; generation dispose terminates the generation's operation.

## Market plugins: install by name and non-image media preview

`dsh-community-market` has two behaviours on the market side that plugin authors meet directly (2.1.15):

- **Install by name** (`src/plugin-spec.ts`) accepts only valid package names, rejecting empty, over-long (>214), version-pinned and invalid names. The module has zero dependencies and the renderer and Host share the same rules, so the rejection a user sees matches the final install decision.
- **Non-image media preview** (`src/client/media-preview.ts`) classifies an asset by the extension in its `name` (`image` / `video` / `audio` / `pdf` / `archive` / `document` / `other`). Non-image assets are not pushed into an `<img>` to fail; they show a type label, a size and an "open with the system handler" link.

The takeaway for plugin authors: give market media assets a `name` with an extension, otherwise they can only be classified as `other`.

## Interfaces not to depend on

These are shell internals and can change at any time. Treat them as private:

- `desktopRuntime`, `desktopPnpmBootstrap`, `desktopSettingsController`
- `BrowserWindow`, the tray registry, native menu items
- any private Node helper, `ELECTRON_RUN_AS_NODE`, the shim the shell generates
- the control channel between shell and Host (private RPC in Beta, `process.send` messages in Stable) — that is an internal handshake, and the two shells implement it differently; a plugin should never see it

The test is simple: if the thing a plugin needs can only be obtained from the shell and the plugin cannot run in plain DSH without it, it does not belong in a plugin.

## Testing and release checks

- Run it in **plain DSH**: with no desktop services it must degrade through `ctx.get` instead of hanging.
- Run it in Desktop: confirm `desktopProfiles.current` matches the profile the window actually shows.
- Turn the market off, switch to another profile, then start once from recovery mode — these three scenarios expose any "assume this generation exists" assumption fastest.
- Check that `dsh.client.platform` and `dsh.bundle.patch` both exist; a browser half without a Host half will fail to load.
- Check that the package lands in the production closure: anything in `devDependencies` does not exist after packaging.

## Dependency classification when packaging

| Category | Outcome |
| --- | --- |
| `dependencies` | enters the production closure and ships |
| non-optional `peerDependencies` | enters the production closure (and must be something upstream really provides) |
| installed `optionalDependencies` | enters the production closure |
| `devDependencies` | does not ship |
| type-only dependencies | demote to optional peers or devDependencies; never leave them in `dependencies` |

Two boundaries worth knowing: closure placement is decided by resolving *from the dependent*, not by simple top-level hoisting, so do not depend on a large package from a position hoisting would change; and `files` accepts only literal names and `directory/**`, so no amount of glob cleverness is recognised.

## Related documents

- [Architecture](architecture.en.md)
- [Plugin ecosystem proposal](plugin-ecosystem.en.md)
- [Desktop shell service reference (Beta)](../dsh-plugin-desktop-beta/docs/plugin-services.md)
- [Community market](../dsh-community-market/README.md)
- [Community fabric (Draft)](../dsh-community-fabric/README.md)
