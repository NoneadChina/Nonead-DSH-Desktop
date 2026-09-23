#!/usr/bin/env node
/**
 * Verify the live Nonead DSH Desktop update service against the contract the shipped
 * client enforces.
 *
 * The response parser, SemVer comparison and installer validation come from the
 * compiled client implementation in dsh-plugin-desktop/lib, so a PASS here means a
 * shipped build would accept the very same response. The service is only read, never
 * modified.
 *
 * Usage:
 *   node scripts/check-update-service.mjs [options]
 *
 * Options:
 *   --base <origin>      service origin (default https://www.nonead.com)
 *   --channel <name>     stable | beta (default stable)
 *   --current <version>  installed version used for the comparison (default: package version)
 *   --expect <version>   require the service to report exactly this version
 *   --full               also download each installer end to end (about 140 MB per platform)
 *   -h, --help           show this help
 *
 * Exit status: 0 when every check passes, 1 otherwise.
 */

import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DEFAULT_ORIGIN = 'https://www.nonead.com'
const MAX_VERSION_BYTES = 4096
const MAX_INSTALLER_BYTES = 1024 * 1024 * 1024
const MIN_INSTALLER_BYTES = 1024 * 1024
const PE_MAGIC = [0x4d, 0x5a]
const BASELINE_VERSION = '1.0.0'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const desktopDirectory = join(repositoryRoot, 'dsh-plugin-desktop')

const HELP = `Usage: node scripts/check-update-service.mjs [options]

Verify the live Nonead DSH Desktop update service against the contract the shipped
client enforces. Parsing, SemVer comparison and installer validation reuse the compiled
client, so a PASS means a shipped build would accept the same response. The service is
only read, never modified.

Options:
  --base <origin>      service origin (default ${DEFAULT_ORIGIN})
  --channel <name>     stable | beta (default stable)
  --current <version>  installed version used for the comparison (default: package version)
  --expect <version>   require the service to report exactly this version
  --full               also download each installer end to end (about 140 MB per platform)
  -h, --help           show this help

Exit status: 0 when every check passes, 1 otherwise.`

class UsageError extends Error {}

function readFlagValue(argv, index, flag) {
  const value = argv[index]
  if (value === undefined || value.startsWith('--')) throw new UsageError(`${flag} needs a value`)
  return value
}

function parseArguments(argv) {
  const options = {
    base: DEFAULT_ORIGIN,
    channel: 'stable',
    current: undefined,
    expect: undefined,
    full: false,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--base') {
      index += 1
      options.base = readFlagValue(argv, index, argument).replace(/\/+$/u, '')
    } else if (argument === '--channel') {
      index += 1
      options.channel = readFlagValue(argv, index, argument)
    } else if (argument === '--current') {
      index += 1
      options.current = readFlagValue(argv, index, argument)
    } else if (argument === '--expect') {
      index += 1
      options.expect = readFlagValue(argv, index, argument)
    } else if (argument === '--full') {
      options.full = true
    } else if (argument === '--help' || argument === '-h') {
      options.help = true
    } else {
      throw new UsageError(`unknown argument: ${argument}`)
    }
  }
  if (options.channel !== 'stable' && options.channel !== 'beta') {
    throw new UsageError('--channel must be stable or beta')
  }
  return options
}

function defaultCurrentVersion() {
  const manifest = JSON.parse(readFileSync(join(desktopDirectory, 'package.json'), 'utf8'))
  if (typeof manifest.version !== 'string') throw new Error('dsh-plugin-desktop/package.json has no version')
  return manifest.version
}

async function loadClient() {
  const checkerPath = join(desktopDirectory, 'lib', 'update-checker.js')
  const downloadPath = join(desktopDirectory, 'lib', 'update-download.js')
  for (const file of [checkerPath, downloadPath]) {
    if (!existsSync(file)) {
      throw new Error(`${file} is missing — build the desktop package first: yarn workspace dsh-plugin-desktop build`)
    }
  }
  const [checker, download] = await Promise.all([
    import(pathToFileURL(checkerPath).href),
    import(pathToFileURL(downloadPath).href),
  ])
  return { checker, download }
}

const reports = []

function startReport(title) {
  const report = { title, ok: true, lines: [], fixes: [] }
  reports.push(report)
  return {
    line: text => report.lines.push(text),
    fail: (text, ...fixes) => {
      report.ok = false
      report.lines.push(text)
      report.fixes.push(...fixes)
    },
    fix: text => report.fixes.push(text),
  }
}

function skipReport(title, reason) {
  const report = { title, ok: true, skipped: true, lines: [reason], fixes: [] }
  reports.push(report)
}

async function readAtMost(response, byteCount) {
  if (response.body === null) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  try {
    while (total < byteCount) {
      const chunk = await reader.read()
      if (chunk.done) break
      chunks.push(Buffer.from(chunk.value))
      total += chunk.value.byteLength
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      // A cancelled or already-closed stream is not a diagnostic signal here.
    }
  }
  return Buffer.concat(chunks).subarray(0, byteCount)
}

function describeResponse(response, body) {
  const contentType = response.headers.get('content-type') ?? '(none)'
  const declared = response.headers.get('content-length')
  const size = declared ?? (body === undefined ? '(unknown)' : `${String(body.byteLength)} so far`)
  return `${String(response.status)} ${contentType}, ${size} bytes`
}

function looksLikeHtml(body) {
  const head = body.subarray(0, 64).toString('utf8').trimStart().toLowerCase()
  return head.startsWith('<!doctype html') || head.startsWith('<html')
}

const RELEASE_VERSION_PATTERN = /(?<![\d.])\d+\.\d+\.\d+(?:-beta\.\d+)?(?!\d)/u

/** Return the release-version token a URL carries in its path, when its file name has one. */
function releaseVersionIn(value) {
  let pathname
  try {
    pathname = new URL(value).pathname
  } catch {
    pathname = value
  }
  const match = RELEASE_VERSION_PATTERN.exec(pathname)
  return match === null ? undefined : match[0]
}

async function sha256OfFile(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function checkVersionResponse(options, client, currentVersion) {
  const report = startReport('version endpoint response')
  const endpoint = client.checker.DESKTOP_VERSION_ENDPOINT
  const url = options.base === DEFAULT_ORIGIN ? endpoint : endpoint.replace(DEFAULT_ORIGIN, options.base)
  const headers = client.checker.desktopVersionRequestHeaders(randomUUID(), currentVersion, options.channel)
  report.line(`GET ${url}`)

  let response
  try {
    response = await fetch(url, { method: 'GET', headers, redirect: 'manual', cache: 'no-store' })
  } catch (cause) {
    report.fail(`request failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    return undefined
  }

  const body = await readAtMost(response, MAX_VERSION_BYTES + 1)
  report.line(describeResponse(response, body))

  const location = response.headers.get('location')
  if (response.status !== 200) {
    report.fail(`expected 200, received ${String(response.status)}`, 'the client treats any non-200 response as "no update" and stays silent')
  }
  if (location !== null) {
    report.fail(`responded with a redirect to ${location}`, 'the version check is sent with redirect: "error"; it must answer 200 directly')
  }
  if (body.byteLength > MAX_VERSION_BYTES) {
    report.fail(`body exceeds the ${String(MAX_VERSION_BYTES)} byte client limit`)
  }
  if (looksLikeHtml(body)) {
    report.fail('body looks like an HTML page, not JSON', 'the version check must return application/json')
  }

  let parsed
  try {
    parsed = JSON.parse(body.toString('utf8'))
  } catch {
    if (report.ok) report.fail(`body is not valid JSON: ${JSON.stringify(body.subarray(0, 80).toString('utf8'))}`)
    return undefined
  }
  report.line(`body ${body.toString('utf8').trim()}`)

  if (parsed === null || typeof parsed !== 'object' || typeof parsed.version !== 'string') {
    report.fail('body has no string "version" field', 'the client requires {"version":"<semver>"}')
    return undefined
  }
  if (options.expect !== undefined && parsed.version !== options.expect) {
    report.fail(`service reports ${parsed.version}, expected ${options.expect}`)
  }
  return parsed.version
}

async function checkClientParsing(options, client, currentVersion, serviceVersion) {
  const report = startReport('version parsed and compared by the client')
  const request = (url, init) => fetch(
    options.base === DEFAULT_ORIGIN ? url : url.replace(DEFAULT_ORIGIN, options.base),
    init,
  )
  const installationId = randomUUID()

  for (const [label, version] of [['installed', currentVersion], ['older baseline', BASELINE_VERSION]]) {
    const result = await client.checker.checkForDesktopUpdate({
      currentVersion: version,
      channel: options.channel,
      currentChannel: options.channel,
      installationId,
      request,
    })
    report.line(`${label} ${version} -> ${result === null ? 'null (rejected or unreachable)' : `${result.status} ${result.latestVersion}`}`)
    if (result === null) {
      report.fail(
        `the client rejected the service response while checking from ${version}`,
        'the response must be 200 JSON whose version matches the requested channel',
      )
    }
  }

  if (currentVersion === BASELINE_VERSION) {
    report.fix(`install a different --current than ${BASELINE_VERSION} to exercise the update-available branch`)
  } else {
    const visible = await client.checker.checkForDesktopUpdate({
      currentVersion: BASELINE_VERSION,
      channel: options.channel,
      currentChannel: options.channel,
      installationId,
      request,
    })
    if (visible !== null && visible.status !== 'update-available') {
      report.fail(`a ${BASELINE_VERSION} installation would not see an update although ${String(serviceVersion)} is published`, 'the published version must be newer than the installed version')
    }
  }
  return undefined
}

async function checkInstallerEndpoint(options, client, reportedVersion, requestVersion, platform, title) {
  const report = startReport(title)
  const endpoint = client.download.desktopUpdateDownloadUrl(platform, requestVersion, options.channel)
  const headers = {
    [client.checker.DESKTOP_RELEASE_CHANNEL_HEADER]: options.channel,
    [client.download.DESKTOP_TARGET_VERSION_HEADER]: requestVersion,
  }
  const url = options.base === DEFAULT_ORIGIN ? endpoint : endpoint.replace(DEFAULT_ORIGIN, options.base)
  report.line(`GET ${url}`)

  let response
  try {
    response = await fetch(url, { method: 'GET', headers, redirect: 'manual', cache: 'no-store' })
  } catch (cause) {
    report.fail(`request failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    return
  }

  const location = response.headers.get('location')
  if (response.status >= 300 && response.status < 400) {
    if (location === null) {
      report.fail(`redirected with ${String(response.status)} but sent no Location header`)
      return
    }
    report.line(`redirected ${String(response.status)} -> ${location} (allowed; the client follows installer redirects)`)
    const target = new URL(location, url).href
    try {
      await response.body?.cancel()
    } catch {
      // The intermediate redirect body is irrelevant.
    }
    try {
      response = await fetch(target, { method: 'GET', headers, redirect: 'follow', cache: 'no-store' })
    } catch (cause) {
      report.fail(`following the redirect failed: ${cause instanceof Error ? cause.message : String(cause)}`)
      return
    }
  }

  if (response.status !== 200) {
    report.fail(
      `expected 200, received ${String(response.status)}`,
      'the client reports http-status and silently abandons the download',
    )
    return
  }

  const prefix = await readAtMost(response, 64)
  const contentType = response.headers.get('content-type') ?? '(none)'
  const declaredLength = response.headers.get('content-length')
  report.line(`${String(response.status)} ${contentType}, ${declaredLength ?? '(unknown)'} bytes`)
  report.line(`first bytes ${prefix.subarray(0, 16).toString('hex')} ${JSON.stringify(prefix.subarray(0, 16).toString('utf8'))}`)

  const finalUrl = response.url === '' ? url : response.url
  if (reportedVersion === undefined) {
    report.line(`final url ${finalUrl}`)
    report.fix('the version endpoint did not report a usable version, so version correspondence could not be checked')
  } else {
    const servedVersion = releaseVersionIn(finalUrl)
    if (servedVersion === undefined) {
      report.line(`final url ${finalUrl}`)
      report.fix('name the installer after the release version: this URL carries no version, so a stale download target cannot be detected here')
    } else if (servedVersion !== reportedVersion) {
      report.fail(
        `the download resolves to ${servedVersion} while the service reports ${reportedVersion}`,
        'resolve the requested version from the X-Nonead-DSH-Desktop-Target-Version header at request time instead of pinning one file',
        'clients never check which version they received, so users would silently reinstall the wrong build',
      )
    } else {
      report.line(`final url ${finalUrl} (carries the reported version ${servedVersion})`)
    }
  }

  if (looksLikeHtml(prefix)) {
    report.fail(
      'the endpoint returned an HTML page instead of an installer',
      'return the installer bytes themselves, or a 302 redirect to them',
      'the client rejects a 200 HTML body as invalid-artifact ("not a PE executable") and silently abandons the download',
    )
  }
  if (platform === 'win32') {
    const isPe = prefix[0] === PE_MAGIC[0] && prefix[1] === PE_MAGIC[1]
    if (!isPe) {
      report.fail(
        `the payload does not start with the PE magic bytes MZ (got ${prefix.subarray(0, 2).toString('hex')})`,
        'a Windows installer must be an NSIS-built .exe served byte for byte',
      )
    }
  }
  if (declaredLength !== null && /^[0-9]+$/u.test(declaredLength)) {
    const size = Number(declaredLength)
    if (size < MIN_INSTALLER_BYTES) report.fail(`declared size ${declaredLength} bytes is implausible for an installer`)
    if (size > MAX_INSTALLER_BYTES) report.fail(`declared size ${declaredLength} bytes exceeds the client limit`)
  } else {
    report.fix('serve a Content-Length header so the client can reject oversized payloads before writing')
  }

  // Installations released before versioned installer URLs still request the bare platform path,
  // so the service has to serve or redirect it as well. That only affects upgrades from older
  // builds, so it is reported as a fix hint instead of a failure.
  const bareUrl = url.slice(0, url.lastIndexOf('/'))
  try {
    const legacy = await fetch(bareUrl, { method: 'GET', headers, redirect: 'follow', cache: 'no-store' })
    const legacyPrefix = await readAtMost(legacy, 64)
    const legacyType = legacy.headers.get('content-type') ?? '(none)'
    report.line(`legacy bare path ${bareUrl} -> ${String(legacy.status)} ${legacyType}`)
    if (legacy.status !== 200 || looksLikeHtml(legacyPrefix)) {
      report.fix(`serve the installer at ${bareUrl} or redirect it to the versioned file: installations released before versioned URLs request that bare path`)
    }
  } catch (cause) {
    report.line(`legacy bare path ${bareUrl} -> request failed: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

async function checkFullDownload(options, client, serviceVersion) {
  const title = 'full download and validation'
  if (serviceVersion === undefined) {
    skipReport(title, 'skipped: the service did not report a usable version')
    return
  }
  const report = startReport(title)
  const directory = await mkdtemp(join(tmpdir(), 'dsh-update-service-check-'))
  try {
    for (const platform of ['win32', 'darwin']) {
      const filename = client.download.desktopUpdateFilename(platform, serviceVersion, options.channel)
      const destinationPath = join(directory, filename)
      try {
        const saved = await client.download.downloadDesktopUpdate({
          platform,
          version: serviceVersion,
          channel: options.channel,
          destinationPath,
          request: (url, init) => fetch(
            options.base === DEFAULT_ORIGIN ? url : url.replace(DEFAULT_ORIGIN, options.base),
            init,
          ),
        })
        const info = await stat(saved)
        report.line(`${platform}: accepted ${filename} — ${String(info.size)} bytes, sha256 ${await sha256OfFile(saved)}`)
        await rm(saved, { force: true })
      } catch (cause) {
        const code = cause?.code ?? cause?.name
        report.fail(
          `${platform}: the client implementation refused the download (${String(code)}: ${cause?.message ?? String(cause)})`,
          'this is exactly what a user sees when the download silently does nothing',
        )
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function render(options, currentVersion) {
  console.log('Nonead DSH Desktop update service check')
  console.log(`origin  ${options.base}`)
  console.log(`channel ${options.channel}`)
  console.log(`current ${currentVersion}`)
  console.log('')
  let passed = 0
  let skipped = 0
  for (const [index, report] of reports.entries()) {
    const status = report.skipped === true ? 'SKIP' : report.ok ? 'PASS' : 'FAIL'
    console.log(`${status}  ${String(index + 1)}. ${report.title}`)
    for (const line of report.lines) console.log(`      ${line}`)
    for (const fix of report.fixes) console.log(`      fix: ${fix}`)
    console.log('')
    if (report.skipped === true) skipped += 1
    else if (report.ok) passed += 1
  }
  const failed = reports.filter(report => report.ok !== true).length
  console.log(`result: ${String(passed)} passed, ${String(failed)} failed, ${String(skipped)} skipped`)
  return failed === 0
}

async function main() {
  let options
  try {
    options = parseArguments(process.argv.slice(2))
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause))
    console.error('')
    console.error(HELP)
    process.exitCode = 2
    return
  }
  if (options.help) {
    console.log(HELP)
    return
  }

  let client
  try {
    client = await loadClient()
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause))
    process.exitCode = 2
    return
  }

  const currentVersion = options.current ?? defaultCurrentVersion()
  const serviceVersion = await checkVersionResponse(options, client, currentVersion)
  await checkClientParsing(options, client, currentVersion, serviceVersion)
  const requestVersion = serviceVersion ?? currentVersion
  await checkInstallerEndpoint(options, client, serviceVersion, requestVersion, 'win32', 'windows installer endpoint')
  await checkInstallerEndpoint(options, client, serviceVersion, requestVersion, 'darwin', 'macOS installer endpoint')
  if (options.full) await checkFullDownload(options, client, serviceVersion)

  const ok = render(options, currentVersion)
  if (!ok) process.exitCode = 1
}

await main()
