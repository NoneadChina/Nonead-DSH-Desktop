# Nonead DSH Desktop implementation boundary

Nonead DSH Desktop (`nonead-dsh-desktop`) is the outer Yarn workspace's own desktop shell: the
Electron main process, the Node-mode Host it launches, Profiles and recovery, and the adapters for
the existing Agents Anywhere bridge and Community Market. Beta (`dsh-plugin-desktop-beta`) remains
the other full Desktop implementation; the former Stable workspace `dsh-plugin-desktop` is gone, so
there is no second variant to mirror.

The reference is the pinned upstream submodule at `deepseek-harness/` — currently DSH
`0.2.1-alpha.3`, recorded in `upstream.json` and vendored under `vendor/dsh-runtime/`. Its
`apps/desktop` and `apps/desktop-host` inform this shell. Desktop development never edits the
submodule, and the vendored runtime is the only packaged runtime.

The implementation uses an Electron shell, an Electron Node-mode Host, the authenticated WebServer
and WebSocket transport, and the official published Web frontend without a fork. The basic macOS and
Windows Desktop presentation comes from the same upstream reference. Additional features are named
Profiles, the system tray, desktop settings and tools, recovery, computer use, remote control, the
Agents Anywhere bridge, the Community Market, and the brand skin plugin. The upstream frontend and
the recorded upstream Desktop presentation stay unforked: advanced presentation belongs in
desktop-owned client plugins reached through profile patches.

Nonead owns its development home and Electron state. Profile switching and recovery stop the old
Host before starting the next generation, and recovery must be reachable without loading the broken
plugin graph. Market routes use the real upstream WebServer, and application-origin forwarding must
preserve their mutation authority checks. Remote control is explicitly enabled and keeps its
Connector state in this product's home. Build, typecheck, unit tests, and Host smokes must not launch
a graphical application; the optional Electron smoke uses only Node mode.

Signed release qualification, the published-runtime version alignment, and the Agents Anywhere
bridge rebuild (`corepack yarn aa:prepare-release`) remain release-time steps rather than
development prerequisites. The Windows installer digest stays deferred until the version endpoint
publishes digests; enforcing it earlier would refuse every legitimate update.

The tray and recovery controls are owned by Electron main independently of Host readiness. A
separate ephemeral home implements non-destructive safe mode; configuration repair and rollback
back up files before writing. The ordinary browser gate covers HTTP, fallback documents, and
WebSocket upgrades. Optional LAN HTTPS uses the existing certificate and ingress boundaries with an
OS-sealed CA key. The official Settings slot and fallback window share the same controls.
