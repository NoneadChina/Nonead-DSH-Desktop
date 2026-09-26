# Update service

[中文](update-service.md)

The Desktop client checks for a new version right after startup and every fixed interval afterwards. Once the user confirms, it downloads the installer, validates it, and only then hands it to the system. This page documents the contract that is **already fixed** between the client and the service: what the service must serve, what the client rejects, and what to check on every release.

These addresses and headers are hard-coded in released builds, and the client exposes no setting that changes them. The service has to satisfy the existing contract; shipping a new client does not retire it. `scripts/check-update-service.mjs` verifies every item below using the client's own compiled implementation.

## Checking for updates

| Item | Value |
| --- | --- |
| Method | `GET` |
| URL | `https://www.nonead.com/software/ndsh-desktop/version` |
| Redirects | Not allowed; the client requests with `redirect: "error"` |
| Caching | Not allowed; the client requests with `cache: "no-store"` |
| Timeout | 15 seconds |

Request headers:

| Header | Meaning |
| --- | --- |
| `X-Nonead-DSH-Desktop-Version` | Installed version, for example `1.7.3` |
| `X-Nonead-DSH-Desktop-Channel` | `stable` or `beta` |
| `X-Nonead-DSH-Desktop-Installation-Id` | Per-installation identifier (UUID), stable within one installation |
| `Accept` | `application/json` |

Expected response: status `200`, `application/json`, body of at most 4096 bytes.

```json
{ "version": "1.7.3", "channel": "stable" }
```

Body rules:

- `version` must be canonical SemVer without a `v` prefix: `"v1.7.3"` is rejected.
- A `stable` version must not carry a prerelease segment; a `beta` version must be `X.Y.Z-beta.N`.
- A `beta` response must also carry `"channel": "beta"`.
- The status must be `200`. A non-200 status, a redirect, or a body that cannot be parsed is treated as "no update" and stays silent — the user sees no error.
- When a channel has no new release, do not return an error page: return a non-`200` status (for example `404`) and the client quietly skips it.

## Downloading the installer

| Item | Value |
| --- | --- |
| Method | `GET` |
| Windows URL | `https://www.nonead.com/software/ndsh-desktop/downloads/windows/Nonead-DSH-Desktop-<version>-windows.exe` |
| macOS URL | `https://www.nonead.com/software/ndsh-desktop/downloads/mac/Nonead-DSH-Desktop-<version>-mac.dmg` |
| Legacy bare URLs | `…/downloads/windows`, `…/downloads/mac` (clients released before this change still request only these; they must keep working) |
| Redirects | Allowed; the client follows them |
| Size limit | 1 GiB |

Request headers: `X-Nonead-DSH-Desktop-Target-Version` carries the target version and `X-Nonead-DSH-Desktop-Channel` the channel.

The client builds the file name in the request path from the version the version endpoint reported:

- Stable channel: `Nonead-DSH-Desktop-<version>-windows.exe`, `Nonead-DSH-Desktop-<version>-mac.dmg`.
- Beta channel: `Nonead-DSH-Desktop-Beta-<version>-windows.exe`, `Nonead-DSH-Desktop-Beta-<version>-mac.dmg`.
- The platform directory comes from the fixed prefixes `…/software/ndsh-desktop/downloads/windows` and `…/software/ndsh-desktop/downloads/mac`.

**The versioned URLs must return the installer bytes themselves, or a 302 to the real file; the legacy bare URLs must keep working too.** The client never parses a directory listing, and it never accepts an HTML page: any `200` with `text/html` is rejected as `invalid-artifact` ("the downloaded file is not a PE executable").

Download behavior and failures:

- The client streams the installer into a hidden temporary file in the destination directory (`.<file name>.<pid>.<random>.partial`) and renames it to the chosen `.exe` / `.dmg` only after the whole body has been written and validated. The final file a user sees always comes from one complete download.
- A torn transfer, a body that stops delivering data (120 seconds of silence by default), more than 1 GiB, failed validation, or cancellation removes the temporary file, leaves any existing installer of the same name untouched, and shows an "Update Failed" dialog with the reason and the advice to pick the save location again. **Do not rely on the client staying silent about a failure**: every failed download is reported.
- A temporary file that a force-killed process (Task Manager, power loss, crash) could not clean up is deleted automatically by the next download of the same file name, so a stray `.partial` heals itself. Never distribute a `.partial` file yourself.

Installer validation performed by the client:

- Windows: the first 64 bytes must start with `MZ` (`4d 5a`) and the PE header must contain `PE\0\0`.
- macOS: the last 512 bytes must contain `koly`, the DMG trailer magic.
- The size must fall between 1 MiB and 1 GiB.
- **When the final URL (after redirects) carries a version in its file name, that version must equal the one the client requested.** A `302` that lands on another release's file is therefore rejected by the client, instead of only becoming visible after the user installs and the version has not changed.

Serving `Content-Length` is recommended. The file name in the request path follows the same rule as the client's default save name (with a `Nonead-DSH-Desktop-Beta-` prefix on the beta channel), so the service's `Content-Disposition` does not affect where the file lands.

### What the client does not verify (known limitation)

The update service does **not** provide a content hash or signature today, so the client **cannot verify that an installer's contents match the published artifact**:

- The client does not compare a `sha256`, does not check a code signature, and does not check Apple notarization — it performs only the format, size, and version-consistency checks above.
- A file swapped in at the correct address that is still a valid PE / DMG with the right version in its name is therefore accepted and handed to the operating system. Only CDN/origin integrity, HTTPS, and the release process defend against that.
- If the service ever exposes a `Content-Digest` response header or a sidecar hash file, the client can add content verification there. Until then, do not assume the client compares contents.

## Version numbers and file names

Service-side installer filenames carry the version (for example `nonead-dsh-desktop-1.7.3-windows.exe`), so they **change with every release**. The client puts that version into both the request path and the `X-Nonead-DSH-Desktop-Target-Version` header, so the service may resolve the file from either one — but both must name the same version.

- **Never pin the 302 target to one version's file.** Once it is pinned, a client asking for `1.7.3` after the next release still receives the old `1.5.4` installer.
- **The client rejects an installer that resolves to another release**: the version in the final URL's file name must equal the requested version, or the download fails with an error. A file name that carries no version cannot be judged, so a service that serves the wrong version can still stay invisible and the user only sees "the update ran and the version did not change". `scripts/check-update-service.mjs` cross-checks the version in the redirect target's filename against the version the service reports for the same reason.
- Every release must update three things together: the uploaded file, the version→file mapping behind the bare URL, and the version the version endpoint reports. When they disagree, the script reports it.
- Return `404` when the requested target version is unavailable; do not fall back to the latest build or to the site home page.
- Keep older installers around for a while so a client that is mid-upgrade can still fetch the version it asked for.

The client builds that file name from the version the version endpoint reports, so the endpoint, the uploaded file and the 302 target must all name the same version; a mismatch surfaces as `404` instead of a silently wrong install.

## Release checklist

1. Upload the installer and rename it to the name the client uses: the build writes `dsh-plugin-desktop/dist/Nonead-DSH-Desktop-v<version>-x64-Setup.exe`, while the service must store it as `Nonead-DSH-Desktop-<version>-windows.exe` (macOS: `Nonead-DSH-Desktop-<version>-mac.dmg`), then confirm `…/downloads/windows/Nonead-DSH-Desktop-<version>-windows.exe` downloads.
2. Make the bare URL resolve the file for the requested target version as well: `200` with the bytes, or a 302 redirect to it; never pin the target version. Clients released before this change request only the bare URL.
3. Update the version endpoint so it reports the new version, and confirm it names the same version as step 2.
4. Run `yarn check:update-service` and confirm every check passes; it cross-checks the version in the final file name against the reported version and hints when the legacy bare URL is unusable.
5. After publishing, manually verify one real upgrade path: old version → check → download → validate → hand-off to the installer, and confirm the installed version really is the new one.

## The check script

`scripts/check-update-service.mjs` reuses the compiled client (`dsh-plugin-desktop/lib/update-checker.js` and `lib/update-download.js`) to parse responses, compare versions, and validate installers, so a PASS means a released client would accept the same response. It only reads the service and never uploads or modifies anything.

```bash
yarn check:update-service
yarn check:update-service --full
yarn check:update-service --expect 1.7.3
yarn check:update-service --base http://127.0.0.1:8080
```

| Option | Meaning |
| --- | --- |
| `--base <origin>` | Service origin, default `https://www.nonead.com` |
| `--channel <name>` | `stable` (default) or `beta` |
| `--current <version>` | Installed version used for the comparison, default the package version |
| `--expect <version>` | Require the service to report exactly this version |
| `--full` | Also download and validate each installer through the client implementation (about 140 MB per platform) and print each artifact's byte size and sha256 |
| `-h`, `--help` | Show usage |

The script checks, in order: the raw version-endpoint response, client-side parsing and version comparison, the Windows installer URL, the macOS installer URL (both installer URLs cross-check the version in the redirect target's filename against the version the service reports), and — with `--full` — an end-to-end download. Failures come with a fix hint. Exit status `0` means everything passed, `1` means at least one check failed, and `2` means a usage error or missing client build output (build `dsh-plugin-desktop` first).
