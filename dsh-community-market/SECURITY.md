# Security Policy

[中文说明](SECURITY.zh.md)

## Trust model

Catalog responses are untrusted remote data. A listing, provider badge, repository link, or **Installable** result is not a security review, maintainer verification, recommendation, or compatibility guarantee.

Installed plugins and their dependency trees run locally with the user's permissions. The Market intentionally does not claim to inspect their code or dependencies for malicious behavior.

## Package-operation boundary

- Installation starts only after explicit user confirmation.
- The confirmation shows the Host-resolved package identity, its exact version, and the active Profile.
- Provider commands, scripts, HTML, headers, credentials, and package-manager argv are never accepted from catalog data.
- Automatic installation requires one valid npm package identity and a valid `dsh.bundle.patch` declaration in the official npm `latest` manifest. A catalog item may instead carry a commit-pinned GitHub `installSource`; that path requires a canonical GitHub repository identity, an exact 40-character commit, and the same valid `dsh.bundle.patch` declaration in that commit's `package.json`.
- Source-provided versions and verification claims are not installation authority.
- Market package changes go only through the official `pluginManager` service, which supplies its own package-manager argv, and they run one at a time.
- The Renderer submits source/item identities for install or a package name from the current Profile inventory for uninstall; it never chooses an arbitrary package name at execution time.
- Installed inventory is the official plugin manager's bundle list for the active Profile, reduced to community plugins, so packages installed by other markets or the DSH CLI are visible. The Market exposes enable, disable, and uninstall, each gated by the manager's own `readOnlyReason`, `error`, and `removable` flags.
- Market creates no install receipt, install-specific snapshot, retry, cleanup, or rollback. Recovery is owned by Desktop's unified three-slot healthy-start checkpoints.
- A successful mutation applies live where the Host runs HMR. When the manager reports `restart-required`, the completion notice says the change takes effect after the next restart; the Market never restarts Desktop.
- **Open DSH Terminal** carries an empty body and only opens Desktop's terminal; it never pastes or executes a displayed command.

These rules constrain authority and identity. They do not make a third-party plugin safe.

## Catalog sources

Adding or selecting a source is an explicit local action. A remote manifest cannot enable itself, choose priority, supply adapter code, or supply credentials.

Production source requests are HTTPS-only and credential-free. They enforce bounded redirects, timeouts, concurrency, decoded response size, item counts, nesting, and string lengths. Redirect and DNS targets are checked against loopback, private, link-local, and cloud-metadata destinations. JSON must satisfy the published schema before normalization.

Exactly one source is selected for browsing. Source failure never silently selects a fallback, changes the active Profile, or blocks DSH Desktop startup.

## Reporting a vulnerability

Report suspected vulnerabilities privately to [t4wefan@qq.com](mailto:t4wefan@qq.com). Include the affected version or commit, operating system, reproduction steps, expected impact, and a minimal proof of concept that can be shared safely.

Do not include secrets or personal data, and do not open a public issue for an unpatched vulnerability. Ordinary bugs, catalog corrections, and feature requests may use the public issue tracker.
