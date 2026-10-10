# Nonead DSH Desktop Release Service API Specification

[中文](desktop-release-service.md)

For the server team implementing the release service. The client behaviour is **already fixed** inside the Nonead DSH Desktop package, and this document describes the contract that client **already enforces**: any server deviation reports no error to the user and instead makes updates **fail silently**.

> Status: matches the client behaviour implemented in Desktop `2.0.7`. The machine-readable version is [desktop-release-service.openapi.yaml](desktop-release-service.openapi.yaml). The authoritative decision logic lives in `dsh-plugin-desktop/src/update-checker.ts` and `update-download.ts`.

## 1. Endpoint overview

Fixed host `https://www.nonead.com` (hardcoded in the client; there is no environment override).

| Endpoint | Purpose | When the client calls it |
| --- | --- | --- |
| `GET /software/ndsh-desktop/version` | Release discovery | Packaged apps: 60 seconds after launch, then every 6 hours (timed from the end of each attempt). Users: manual "Check for updates" from the tray |
| `GET /software/ndsh-desktop/downloads/{mac\|windows\|linux}` | Installer delivery | **Only** after the user confirms "Download" in a native dialog |

The request deadline is 15 seconds. Development and unpackaged launches make no background network requests at all.

## 2. Version endpoint

### 2.1 Request

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Accept` | yes | `application/json` | — |
| `X-DSH-Desktop-Channel` | yes | `stable` / `beta` / `next` | Selects the release stream |
| `X-DSH-Desktop-Version` | yes | Installed version, canonical SemVer | The client guarantees the format |
| `X-DSH-Desktop-Installation-Id` | yes (this endpoint only) | Lowercase UUID v4 | Locally generated pseudonymous installation identity used for de-duplication; **not** an authorization credential, and the server must not reject requests based on it |

Fixed client semantics: `cache: no-store`, and **`redirect: 'error'` — any 3xx fails that check**.

### 2.2 Successful response

The status must be **200**; `Content-Type: application/json`; body **at most 4096 bytes** (UTF-8).

```json
{ "version": "2.0.7", "channel": "stable", "sha256": { "windows": "…", "mac": "…", "linux": "…" } }
```

| Field | Required | Rules |
| --- | --- | --- |
| `version` | yes | String; **canonical** SemVer (no `v` prefix, no leading zeros, `parsed.version === input`); must match the requested channel's shape (2.3) |
| `channel` | optional for `stable`; **required** for `beta`/`next` | When present it must **equal** the requested channel |
| `sha256` | no | Object; keys may **only** be `windows` / `mac` / `linux`; values are 64 hex digits (case-insensitive; trimmed and lowercased). Invalid entries are **silently ignored per key** |

### 2.3 Channel and version shape matrix

| Requested channel | `version` must look like | Valid example | Rejected counter-example |
| --- | --- | --- | --- |
| `stable` | `x.y.z` (**no prerelease identifiers**) | `2.0.7` | `2.0.7-beta.1` |
| `beta` | `x.y.z-beta.N` (**exactly two** identifiers, first is `beta`, second numeric) | `2.0.7-beta.1` | `2.0.7-beta`, `2.0.7-beta.1.2` |
| `next` | `x.y.z-next` (**exactly one** identifier equal to `next`) | `2.0.7-next` | `2.0.7-next.1` |

The `channel` field rule is separate: the `stable` branch does not require it, while the `beta`/`next` branches **require it to be present and equal to the requested value**, otherwise the whole response is discarded.

### 2.4 Failure semantics (what the client does)

| What the server returns | Scheduled check | Manual check |
| --- | --- | --- |
| 200 with a version newer than installed | Native "Download / Later" prompt (once per version across restarts) | Same |
| 200 with a version equal to or older than installed | **Silent** | "Up to date" dialog |
| Any 3xx, non-200, timeout, network failure | **Silent** | Fixed retry dialog with no details |
| Body over 4096 bytes, invalid JSON, non-string `version`, wrong version shape, wrong `channel` | **Silent** | Fixed retry dialog |

**Critical consequence: the client has no reporting channel.** A misconfiguration produces no server-visible error — it just quietly stops every user from receiving updates. The observability in section 7 is a **requirement**, not an optional improvement.

### 2.5 Explicitly forbidden

- **Any 3xx**, including `UseHttpsRedirection`, trailing-slash normalization, `RedirectToAction`, and CDN/gateway path-canonicalization redirects.
- Writing `sha256` keys as `win32` / `darwin`: those keys are ignored, so you would believe an integrity gate exists when it does not. The correct keys are `windows` / `mac` / `linux`.
- Versions with a `v` prefix or leading zeros (`v2.0.7`, `02.0.7`).
- `next` versions such as `2.0.7-next.1`.
- Letting a CDN cache this response; use `Cache-Control: no-store`.

## 3. Download endpoints

### 3.1 Request

| Header | Required | Value |
| --- | --- | --- |
| `X-DSH-Desktop-Channel` | yes | `stable` / `beta` / `next` |
| `X-DSH-Desktop-Target-Version` | yes | The version the user confirmed downloading (the value `/version` just returned) |

The client uses `redirect: 'follow'`: a 302 to object storage or a CDN is **allowed and expected** — that hop is exactly the "one user-confirmed download" accounting point.

### 3.2 Response

- The **final response after following redirects must be 200** and must have a body.
- The settled URL must be `https`, must contain **no** username/password, and its port must be empty or 443 (`https://cdn.example.com:8443/…` is rejected).
- Size: when `Content-Length` is present it must be a plain decimal (`^(0|[1-9][0-9]*)$`) and at most **1 GiB**; with or without the header, the actual byte count must not exceed 1 GiB.
- Range support is **not** required (the client issues one GET); `Content-Disposition` and the filename are **irrelevant** (the client picks the filename it shows the user).
- When the same channel's `/version` publishes that platform's `sha256`, the client **streams SHA-256 and compares in constant time**; a mismatch blocks installer execution. Therefore **an artifact must never be replaced after its digest is published**.

### 3.3 Artifacts must pass magic-number checks

| Platform | Check |
| --- | --- |
| `mac` | The final 512 bytes must start with `koly` (a real UDIF `.dmg`) |
| `windows` | `MZ` at offset 0, and `PE\0\0` at `e_lfanew` (LE uint32 at offset `0x3C`) |
| `linux` | `\x7fELF` at offset 0 **and** `AI\x02` at offset 8 (a real AppImage) |

`.zip`, `.deb`, `.tar.gz`, a bare ELF executable, and any HTML error page are all rejected as invalid artifacts.

### 3.4 Failure semantics

An invalid artifact or a non-200 response shows the user a native error ("The downloaded file is not a UDIF disk image / not a PE executable / not an AppImage") and stays retryable; the upgrade does not continue. Download failures produce no background report.

## 4. Server-side data model

Store one release document per channel and switch releases with a single write:

```json
{
  "stable": {
    "version": "2.0.7",
    "sha256": { "windows": "<64hex>", "mac": "<64hex>", "linux": "<64hex>" },
    "installers": {
      "windows": "/software/ndsh-desktop/downloads/windows/Nonead-DSH-Desktop-2.0.7-x64-Setup.exe",
      "mac":     "/software/ndsh-desktop/downloads/mac/Nonead-DSH-Desktop-2.0.7-mac.dmg",
      "linux":   "/software/ndsh-desktop/downloads/linux/Nonead-DSH-Desktop-2.0.7-linux.AppImage"
    }
  },
  "beta": { "…": "same structure" },
  "next": { "…": "same structure" }
}
```

`sha256` and `installers` use the **same platform segments** (`mac` / `windows` / `linux`) as the download endpoint path, so no key translation is required on the server. An `installers` value may be an absolute `https://` URL (a CDN or object store) or a same-origin absolute path starting with `/`; the latter resolves to https under the client's https request and therefore satisfies the "settled URL must be https" rule too. Keep artifacts on **immutable versioned paths** so a rollback only rewrites the document.

### 4.1 Reference implementation (the nonead.com server)

The implementation in the `nonead.com` repository has landed:

| Item | Location / behaviour |
| --- | --- |
| Release document | `wwwroot/software/ndsh-desktop/releases.json`, read on every request, so **replacing it needs no restart** |
| Document template | `wwwroot/software/ndsh-desktop/releases.json.example`; rename it to `releases.json` after filling in real values |
| Migration fallback | When `releases.json` is absent, the service falls back to the legacy single file `wwwroot/software/ndsh-desktop/version` (stable only, returned verbatim); all three `/downloads/*` then answer `404` |
| Endpoints | `GET /software/ndsh-desktop/version` and `GET /software/ndsh-desktop/downloads/{platform}` in `Program.cs` |
| Parsing and validation | `Services/NdsDesktopReleaseService.cs` |

Status codes and logs. The client handles all of these per section 2.4; the distinct codes exist so that **server-side logs and probing** can detect a broken contract, because client failures are silent.

| Situation | Status | Log |
| --- | --- | --- |
| Normal | `200` | Warning when the document contained ignored fields |
| Unknown channel | `400` | Warning |
| Channel not published | `404` | Warning |
| Version shape, `sha256`, or response size violated | `503` | **Error** |
| Download: target version differs from the current release | `409` | Warning |
| Download: no URL configured for that platform | `404` | Warning |
| Download: normal redirect | `302` | Information (accounting) |

The `X-DSH-Desktop-Target-Version` guard exists because the client re-validates the version immediately before downloading, so under normal operation that header equals the current release. A mismatch means the release just rotated; failing with a log is preferable to serving an installer that does not match what the client checked.

## 5. Release order (an invariant)

1. Build the artifacts (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`).
2. Compute each artifact's SHA-256.
3. Upload to immutable paths and verify those URLs **directly**: reachable, correct magic numbers, digests matching the computed values. Nothing is public yet.
4. **Write the release document** (`version` + `sha256` + `installers`). This is the only action that makes a release public: one write atomically publishes the version and points at the installers, so there is no intermediate state where a new version is announced while the old installer is still being served.
5. Verify `/version` on all three channels and all three download endpoints (use the script in section 9).

**Consequence of reversing the order**: announcing `2.0.7` first while `/downloads/windows` still serves `2.0.4` makes users download the wrong build; if `sha256` was published too, the hard gate rejects it with "does not match the published digest", which is very hard to diagnose.

**Rollback**: point the release document back at the previous version (artifacts stay, the old version remains downloadable), then re-run step 5.

## 6. Caching and CDN

| Object | Recommendation |
| --- | --- |
| `/version` | `Cache-Control: no-store` (otherwise both releases and rollbacks lag) |
| The **302 response itself** for `/downloads/*` | `Cache-Control: no-store` (a cached redirect delays rollbacks; the client sends `X-DSH-Desktop-Target-Version` on every request, so the target may legitimately change) |
| Artifact files | Long caching is fine (immutable paths) |

## 7. Observability (required)

Because the client fails silently, the server must detect a broken contract on its own:

- **Active probing**: every 5 minutes request `/version` once per channel and validate it against sections 2.3 and 2.4; alert on failure.
- **Download availability probing**: hourly, issue a `HEAD`/range request per platform and check the status code, the https settled URL, and the magic numbers (fetch a few bytes at head and tail; do not download 250 MB).
- **Reconciliation**: compare the `sha256` values in the release document against the artifacts' real digests; alert on any mismatch (that mismatch means "every user's download will fail").
- **Accounting**: the `/downloads/*` record is "one user-confirmed download"; break it down by `channel`, platform, and `target-version`.
- **Capacity**: the default cadence is one check per installation every 6 hours (plus one 60 seconds after launch and jitter); size `/version` QPS and distinct `Installation-Id` counts accordingly.

## 8. ASP.NET Core implementation notes

1. **Keep this route out of redirecting middleware**: `UseHttpsRedirection`, trailing-slash normalization, `UseStatusCodePages` redirects, and error-page redirects all break `redirect: 'error'`.
2. Use Minimal APIs or a Controller with a fixed route and return `Results.File(json, "application/json")` or `Json()` so the status code really is 200.
3. **Do not add `[Authorize]`**: the client carries no credentials (and no cookies).
4. This endpoint **must not depend on Session/Cookie**; setting them is harmless, but the client never sends them back.
5. **Actually branch on `X-DSH-Desktop-Channel`** — ignoring the channel and returning one document for all three is the easiest mistake to make and the hardest to notice (see the current production measurement in section 9).
6. **A fallback page must not return 200**: today all three `/downloads/*` paths land on the site's HTML fallback page (HTTP 200, `text/html`), which the client reports as "not a valid installer". Unimplemented paths should return 404/503, never a 200 HTML page.
7. Leave headroom in the body: do not add large extra fields to the JSON (the limit is 4096 bytes).
8. Use port 443 externally; redirect targets must not carry a non-443 port.

## 9. Acceptance

The server must self-check after any change — the client will not report anything.

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE=https://www.nonead.com/software/ndsh-desktop

check_version() { # $1=channel  $2=expected version regex
  body=$(curl -sS --max-time 20 -H "Accept: application/json" \
              -H "X-DSH-Desktop-Channel: $1" -H "X-DSH-Desktop-Version: 0.0.0" "$BASE/version")
  [ "$(printf %s "$body" | wc -c)" -le 4096 ] || { echo "$1: body over 4 KiB"; exit 1; }
  printf %s "$body" | grep -Eq "\"version\":\"$2\"" || { echo "$1: wrong version -> $body"; exit 1; }
  if [ "$1" != stable ]; then
    printf %s "$body" | grep -Eq "\"channel\":\"$1\"" || { echo "$1: missing channel field -> $body"; exit 1; }
  fi
  echo "$1 OK  $body"
}

check_version stable '2\.0\.3'
check_version beta   '2\.0\.3-beta\.[0-9]+'
check_version next   '2\.0\.3-next'

for p in mac windows linux; do
  out=$(curl -sS -o /tmp/dsh-artifact -w '%{http_code} %{url_effective}' -L --max-time 300 \
        -H "X-DSH-Desktop-Channel: stable" "$BASE/downloads/$p")
  case "$out" in *https://*) ;; *) echo "$p: settled URL is not https -> $out"; exit 1;; esac
  case "$p" in
    mac)     [ "$(tail -c 512 /tmp/dsh-artifact | head -c 4)" = koly ] || { echo "mac: not UDIF"; exit 1;};;
    windows) [ "$(head -c 2 /tmp/dsh-artifact)" = MZ ] || { echo "windows: not PE"; exit 1;};;
    linux)   [ "$(head -c 4 /tmp/dsh-artifact | od -An -tx1 | tr -d ' \n')" = 7f454c46 ] || { echo "linux: not ELF"; exit 1;};;
  esac
  echo "$p OK  $out  $(wc -c < /tmp/dsh-artifact) bytes"
done
```

**Measured against production on 2026-10-07, as a baseline:**

| Check | Measured | Verdict |
| --- | --- | --- |
| `stable` | `{"version":"2.0.4","channel":"stable"}` | Version is stuck at 2.0.4 |
| `beta` | `{"version":"2.0.4","channel":"stable"}` | ❌ `channel` is not `beta`, so the client discards the whole response |
| `next` | `{"version":"2.0.4","channel":"stable"}` | ❌ Same |
| `/downloads/mac` | 200 + `text/html`, 128430 bytes, trailing `sch` | ❌ The site's HTML fallback page |
| `/downloads/windows` | Same (identical ETag) | ❌ |
| `/downloads/linux` | Same (identical ETag) | ❌ |

In other words: the version header is ignored on all three channels, and the three download endpoints are not implemented, so in-app downloads cannot succeed on any platform.

## 10. References

- Version checking and SemVer rules: `dsh-plugin-desktop/src/update-checker.ts`
- Download, size and magic-number validation, digest gate: `dsh-plugin-desktop/src/update-download.ts`
- Installation identity: `dsh-plugin-desktop/src/desktop-installation-id.ts`
- Original architecture decision and release-order record: `.agents/notes/implemented/architecture/2026-08-15-desktop-release-discovery-and-terminal.md`
