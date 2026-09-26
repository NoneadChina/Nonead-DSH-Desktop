/** Headless, confirmation-gated downloads for Nonead DSH Desktop installers. */

import { randomUUID } from 'node:crypto'
import { chmod, lstat, mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import {
  compareSemVerVersions,
  DESKTOP_RELEASE_CHANNEL_HEADER,
  parseSemVer,
  type DesktopReleaseChannel,
} from './update-checker.ts'

/** Desktop platforms with a fixed installer download endpoint. */
export type DesktopDownloadPlatform = 'darwin' | 'win32'

/** Fixed download endpoints that record one user-confirmed installer download. */
export const DESKTOP_DOWNLOAD_URLS: Readonly<Record<DesktopDownloadPlatform, string>> = {
  darwin: 'https://www.nonead.com/software/ndsh-desktop/downloads/mac',
  win32: 'https://www.nonead.com/software/ndsh-desktop/downloads/windows',
}

/** Header pinning a download request and response to the checked release. */
export const DESKTOP_TARGET_VERSION_HEADER = 'X-Nonead-DSH-Desktop-Target-Version'

/** Maximum accepted installer size, in bytes. */
export const MAX_UPDATE_DOWNLOAD_BYTES = 1024 * 1024 * 1024

/**
 * Longest silence tolerated between two streamed installer chunks.
 * A CDN that stops delivering bytes without closing the connection would otherwise keep one
 * downloaded-into `.partial` file and one pending download alive until the process exits.
 */
export const UPDATE_DOWNLOAD_STALL_TIMEOUT_MS = 120_000

/** Failure categories exposed to the update coordinator. */
export type UpdateDownloadErrorCode =
  | 'aborted'
  | 'empty-body'
  | 'http-status'
  | 'invalid-artifact'
  | 'invalid-options'
  | 'network'
  | 'response-too-large'
  | 'stalled'

/** Fetch-compatible request boundary supplied by the Electron adapter or a test. */
export type UpdateArtifactRequest = (url: string, init: RequestInit) => Promise<Response>

/** Inputs for one user-confirmed installer download. */
export interface DownloadDesktopUpdateOptions {
  /** Host platform selecting the fixed endpoint and installer validation. */
  readonly platform: DesktopDownloadPlatform
  /** Stable release version used to validate the selected installer. */
  readonly version: string
  /** Release stream selected by the running Desktop flavor. */
  readonly channel?: DesktopReleaseChannel
  /** Absolute installer path selected by the user. */
  readonly destinationPath: string
  /** Request implementation, normally backed by Electron `net.fetch`. */
  readonly request: UpdateArtifactRequest
  /** Optional cancellation signal owned by the update coordinator. */
  readonly signal?: AbortSignal
  /** Optional override of the streamed-body stall deadline, in milliseconds. */
  readonly stallTimeoutMs?: number
}

/** Typed failure from installer request, validation, or cancellation. */
export class UpdateDownloadError extends Error {
  /** Stable programmatic failure category. */
  readonly code: UpdateDownloadErrorCode
  /** HTTP status for an unsuccessful response, otherwise undefined. */
  readonly status: number | undefined

  /**
   * Create one safe update-download failure.
   * @param code - Stable failure category.
   * @param message - Diagnostic text without response content.
   * @param options - Optional HTTP status and underlying failure.
   */
  constructor(
    code: UpdateDownloadErrorCode,
    message: string,
    options: { readonly status?: number; readonly cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'UpdateDownloadError'
    this.code = code
    this.status = options.status
  }
}

const PRIVATE_DIRECTORY_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600
const DECIMAL_BYTES = /^(0|[1-9][0-9]*)$/u
const DMG_TRAILER_BYTES = 512
const DMG_TRAILER_MAGIC = Buffer.from('koly', 'ascii')
const DOS_HEADER_BYTES = 64
const PE_OFFSET_POSITION = 0x3c
const PE_MAGIC = Buffer.from([0x50, 0x45, 0x00, 0x00])
const TEMPORARY_ARTIFACT_SUFFIX = '.partial'
/** Grace for cancelling an errored response stream before its reader is released. */
const READER_CANCEL_GRACE_MS = 1_000
/** Bounded attempts for deleting a private file that a Windows handle may still hold. */
const UNLINK_ATTEMPTS = 5
const UNLINK_RETRY_MS = 100
const REGEXP_METACHARACTERS = /[.*+?^${}()|[\]\\]/gu

interface DownloadPaths {
  readonly completed: string
  readonly temporary: string
}

/** Downloaded installer tracked until the upgraded application resolves retention. */
export interface DesktopUpdateArtifact {
  readonly platform: DesktopDownloadPlatform
  readonly version: string
  readonly path: string
}

const UPDATE_ARTIFACT_STATE_VERSION = 1
const UPDATE_ARTIFACT_STATE_BYTES = 4 * 1024
const UPDATE_ARTIFACT_STATE_FILENAME = 'pending-installer.json'

/** Release-version token carried in an installer URL path, when it names one. */
const RELEASE_VERSION_IN_PATH = /(?<![\d.])(\d+\.\d+\.\d+(?:-beta\.\d+)?)(?!\d)/u

/**
 * Reject an installer the service resolved to a different release.
 *
 * The version has to travel through both the request path and the
 * target-version header, so a redirect that resolves to another release's file
 * is a real failure mode: the client never inspects which build it received, and
 * the Windows installer would happily replace a newer build with an older one.
 *
 * This is the strongest check available today. The update service provides no
 * `Content-Digest` or sidecar hash, so the client cannot verify that an
 * installer's *contents* match the published artifact — it validates only the
 * PE/DMG format, the size, and (here) the served version. A file swapped in at
 * the correct address with a matching version in its name would be accepted;
 * CDN/origin integrity, HTTPS, and the release process own that risk. If the
 * service ever exposes a hash, verify it here.
 * @param response - the artifact response, whose final URL reflects redirects.
 * @param requestedVersion - the release the service reported and the client asked for.
 */
function assertServedVersionMatches(response: Response, requestedVersion: string): void {
  const finalUrl = response.url
  if (finalUrl === undefined || finalUrl.length === 0) return
  let pathname: string
  try {
    pathname = new URL(finalUrl).pathname
  } catch {
    return
  }
  const served = RELEASE_VERSION_IN_PATH.exec(pathname)?.[1]
  // An unversioned file name cannot be checked here; the service-side release
  // check owns that, and the download stays available for older deployments.
  if (served === undefined || served === requestedVersion) return
  throw new UpdateDownloadError(
    'invalid-artifact',
    `The update download service resolved to ${served} while ${requestedVersion} was requested.`,
  )
}

/**
 * Download one installer after its caller has obtained user confirmation.
 * @param options - Fixed platform, release version, selected destination, request, and cancellation inputs.
 * @returns Absolute path to the completely written and validated installer.
 * @throws {UpdateDownloadError} For invalid inputs, transport failures, rejected responses, cancellation, and invalid installers.
 */
export async function downloadDesktopUpdate(options: DownloadDesktopUpdateOptions): Promise<string> {
  const platform = validatedPlatform(options.platform)
  const channel = options.channel ?? 'stable'
  validatedVersion(options.version, channel)
  const destinationPath = validatedArtifactPath(options.destinationPath, platform)
  const stallTimeoutMs = validatedStallTimeout(options.stallTimeoutMs)
  const paths = await prepareDownloadPaths(destinationPath)
  // A killed or force-exited earlier run cannot clean up its own private stream, so the next
  // attempt removes those leftovers instead of leaving one hidden `.partial` beside the installer.
  await removeAbandonedTemporaryArtifacts(dirname(destinationPath), basename(destinationPath))
  throwIfAborted(options.signal)

  let response: Response
  try {
    response = await options.request(desktopUpdateDownloadUrl(platform, options.version, channel), {
      method: 'GET',
      headers: {
        [DESKTOP_RELEASE_CHANNEL_HEADER]: channel,
        [DESKTOP_TARGET_VERSION_HEADER]: options.version,
      },
      cache: 'no-store',
      redirect: 'follow',
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    })
  } catch (cause) {
    if (options.signal?.aborted === true || isAbortFailure(cause)) throw aborted(cause)
    throw new UpdateDownloadError('network', 'The update installer could not be downloaded.', { cause })
  }

  if (response.status !== 200) {
    throw new UpdateDownloadError(
      'http-status',
      `The update download service returned HTTP ${String(response.status)}.`,
      { status: response.status },
    )
  }
  assertServedVersionMatches(response, options.version)
  if (response.body === null) {
    throw new UpdateDownloadError('empty-body', 'The update download service returned an empty body.')
  }
  assertDeclaredSize(response)

  let failure: unknown
  try {
    await writeResponseBody(paths.temporary, response.body, options.signal, stallTimeoutMs)
    throwIfAborted(options.signal)
    await validateArtifact(paths.temporary, platform)
    throwIfAborted(options.signal)
    await unlinkIfPresent(paths.completed)
    await rename(paths.temporary, paths.completed)
    return paths.completed
  } catch (cause) {
    failure = options.signal?.aborted === true || isAbortFailure(cause) ? aborted(cause) : cause
    throw failure
  } finally {
    try {
      await removeTemporaryArtifact(paths.temporary)
    } catch (cleanupCause) {
      if (failure === undefined) throw cleanupCause
      throw new AggregateError([failure, cleanupCause], 'Failed to download and clean up the update installer.')
    }
  }
}

/** Fixed default filename shown by the native destination picker. */
export function desktopUpdateFilename(
  platform: DesktopDownloadPlatform,
  version: string,
  channel: DesktopReleaseChannel = 'stable',
): string {
  validatedPlatform(platform)
  validatedVersion(version, channel)
  const extension = platform === 'darwin' ? 'dmg' : 'exe'
  const platformName = platform === 'darwin' ? 'mac' : 'windows'
  const product = channel === 'beta' ? 'Nonead-DSH-Desktop-Beta' : 'Nonead-DSH-Desktop'
  return `${product}-${version}-${platformName}.${extension}`
}

/**
 * Installer URL for one platform and target version.
 * The update service stores one installer per release under the platform directory, so the file
 * name carries the version the service reported and the same version travels in
 * {@link DESKTOP_TARGET_VERSION_HEADER}.
 * @param platform - Fixed download platform.
 * @param version - Canonical release version the service reported.
 * @param channel - Stable or beta release channel.
 * @returns Absolute installer URL for the platform directory and versioned file name.
 */
export function desktopUpdateDownloadUrl(
  platform: DesktopDownloadPlatform,
  version: string,
  channel: DesktopReleaseChannel = 'stable',
): string {
  return `${DESKTOP_DOWNLOAD_URLS[platform]}/${desktopUpdateFilename(platform, version, channel)}`
}

/** Remember a downloaded installer until an upgraded application resolves its retention. */
export async function recordDesktopUpdateArtifact(
  userDataPath: string,
  artifact: DesktopUpdateArtifact,
): Promise<void> {
  const statePath = await prepareArtifactStatePath(userDataPath)
  const value = await validatedArtifactRecord(artifact, true)
  await writeFileAtomic(statePath, `${JSON.stringify({
    stateVersion: UPDATE_ARTIFACT_STATE_VERSION,
    ...value,
  })}\n`, {
    mode: PRIVATE_FILE_MODE,
    dirMode: PRIVATE_DIRECTORY_MODE,
  })
}

/** Return a retained installer only after the running version reaches its target. */
export async function pendingDesktopUpdateArtifact(
  userDataPath: string,
  currentVersion: string,
  platform: DesktopDownloadPlatform,
): Promise<DesktopUpdateArtifact | undefined> {
  const statePath = artifactStatePath(validatedUserDataPath(userDataPath))
  validatedReleaseVersion(currentVersion)
  validatedPlatform(platform)
  let value: DesktopUpdateArtifact
  try {
    value = await readArtifactRecord(statePath)
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw cause
  }
  if (value.platform !== platform) return undefined
  const comparison = compareSemVerVersions(currentVersion, value.version)
  if (comparison === null || comparison < 0) return undefined
  try {
    const stat = await lstat(value.path)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new UpdateDownloadError('invalid-options', 'The retained update installer is not a regular file.')
    }
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
    await unlinkIfPresent(statePath)
    return undefined
  }
  return value
}

/** Apply one explicit delete/keep choice and consume its cleanup state. */
export async function resolveDesktopUpdateArtifact(
  userDataPath: string,
  artifact: DesktopUpdateArtifact,
  remove: boolean,
): Promise<void> {
  const statePath = artifactStatePath(validatedUserDataPath(userDataPath))
  const current = await readArtifactRecord(statePath)
  const expected = await validatedArtifactRecord(artifact, false)
  if (current.platform !== expected.platform
    || current.version !== expected.version
    || current.path !== expected.path) {
    throw new UpdateDownloadError('invalid-options', 'The update artifact cleanup state changed.')
  }
  if (remove) await unlinkIfPresent(expected.path)
  await unlinkIfPresent(statePath)
}

function validatedPlatform(platform: DesktopDownloadPlatform): DesktopDownloadPlatform {
  if (platform !== 'darwin' && platform !== 'win32') {
    throw new UpdateDownloadError('invalid-options', `Unsupported update download platform: ${String(platform)}`)
  }
  return platform
}

function validatedVersion(version: string, channel: DesktopReleaseChannel = 'stable'): string {
  const parsed = parseSemVer(version)
  const expectedPrerelease = channel === 'stable'
    ? parsed?.prerelease.length === 0
    : parsed?.prerelease.length === 2
      && parsed.prerelease[0] === 'beta'
      && /^[0-9]+$/u.test(parsed.prerelease[1]!)
  if (parsed === null || !expectedPrerelease || parsed.version !== version) {
    throw new UpdateDownloadError('invalid-options', `The update version must match the ${channel} channel.`)
  }
  return version
}

function validatedStallTimeout(stallTimeoutMs: number | undefined): number {
  if (stallTimeoutMs === undefined) return UPDATE_DOWNLOAD_STALL_TIMEOUT_MS
  if (!Number.isSafeInteger(stallTimeoutMs) || stallTimeoutMs <= 0) {
    throw new UpdateDownloadError('invalid-options', 'The update download stall deadline must be a positive integer.')
  }
  return stallTimeoutMs
}

function validatedReleaseVersion(version: string): string {
  const parsed = parseSemVer(version)
  const isStable = parsed?.prerelease.length === 0
  const isBeta = parsed?.prerelease.length === 2
    && parsed.prerelease[0] === 'beta'
    && /^[0-9]+$/u.test(parsed.prerelease[1]!)
  if (parsed === null || parsed.version !== version || (!isStable && !isBeta)) {
    throw new UpdateDownloadError('invalid-options', 'The update version must belong to a supported release channel.')
  }
  return version
}

function validatedUserDataPath(userDataPath: string): string {
  if (userDataPath.length === 0 || /[\0\r\n]/u.test(userDataPath) || !isAbsolute(userDataPath)) {
    throw new UpdateDownloadError('invalid-options', 'The update user-data path must be an absolute path.')
  }
  return resolve(userDataPath)
}

async function prepareDownloadPaths(
  destinationPath: string,
): Promise<DownloadPaths> {
  const directory = dirname(destinationPath)
  const directoryStat = await lstat(directory)
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new UpdateDownloadError('invalid-options', 'The update destination directory must be a real directory.')
  }
  const completedStat = await lstatOptional(destinationPath)
  if (completedStat !== undefined) {
    if (!completedStat.isFile() || completedStat.isSymbolicLink()) {
      throw new UpdateDownloadError('invalid-options', 'The completed update path is not a regular file.')
    }
  }

  return {
    completed: destinationPath,
    temporary: join(directory, `.${basename(destinationPath)}.${process.pid}.${randomUUID()}.partial`),
  }
}

function validatedArtifactPath(path: string, platform: DesktopDownloadPlatform): string {
  if (path.length === 0 || /[\0\r\n]/u.test(path) || !isAbsolute(path)) {
    throw new UpdateDownloadError('invalid-options', 'The update destination path must be absolute.')
  }
  const expectedExtension = platform === 'darwin' ? '.dmg' : '.exe'
  if (extname(path).toLowerCase() !== expectedExtension) {
    throw new UpdateDownloadError('invalid-options', `The update destination must use ${expectedExtension}.`)
  }
  return resolve(path)
}

async function prepareArtifactStatePath(userDataPath: string): Promise<string> {
  const root = validatedUserDataPath(userDataPath)
  const rootStat = await lstat(root)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new UpdateDownloadError('invalid-options', 'The update user-data path must be a real directory.')
  }
  const directory = join(root, 'updates')
  await preparePrivateDirectory(directory)
  return artifactStatePath(root)
}

function artifactStatePath(userDataPath: string): string {
  return join(userDataPath, 'updates', UPDATE_ARTIFACT_STATE_FILENAME)
}

async function validatedArtifactRecord(
  artifact: DesktopUpdateArtifact,
  requireFile: boolean,
): Promise<DesktopUpdateArtifact> {
  const platform = validatedPlatform(artifact.platform)
  const version = validatedReleaseVersion(artifact.version)
  const path = validatedArtifactPath(artifact.path, platform)
  if (requireFile) {
    const stat = await lstat(path)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new UpdateDownloadError('invalid-options', 'The retained update installer must be a regular file.')
    }
  }
  return { platform, version, path }
}

async function parseArtifactRecord(text: string): Promise<DesktopUpdateArtifact> {
  let value: unknown
  try { value = JSON.parse(text) } catch {
    throw new UpdateDownloadError('invalid-options', 'The update artifact cleanup state is invalid.')
  }
  if (value === null
    || typeof value !== 'object'
    || (value as { stateVersion?: unknown }).stateVersion !== UPDATE_ARTIFACT_STATE_VERSION
    || ((value as { platform?: unknown }).platform !== 'darwin'
      && (value as { platform?: unknown }).platform !== 'win32')
    || typeof (value as { version?: unknown }).version !== 'string'
    || typeof (value as { path?: unknown }).path !== 'string'
    || Object.keys(value).some(key => !['stateVersion', 'platform', 'version', 'path'].includes(key))) {
    throw new UpdateDownloadError('invalid-options', 'The update artifact cleanup state is invalid.')
  }
  return await validatedArtifactRecord(value as DesktopUpdateArtifact, false)
}

async function readArtifactRecord(statePath: string): Promise<DesktopUpdateArtifact> {
  const stat = await lstat(statePath)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > UPDATE_ARTIFACT_STATE_BYTES) {
    throw new UpdateDownloadError('invalid-options', 'The update artifact cleanup state is invalid.')
  }
  return await parseArtifactRecord(await readFile(statePath, 'utf8'))
}

async function preparePrivateDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE })
  const stat = await lstat(directory)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new UpdateDownloadError('invalid-options', 'An update destination component is not a real directory.')
  }
  await chmod(directory, PRIVATE_DIRECTORY_MODE)
}

async function lstatOptional(filename: string): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
  try {
    return await lstat(filename)
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw cause
  }
}

function assertDeclaredSize(response: Response): void {
  const declared = response.headers.get('content-length')
  if (declared === null || !DECIMAL_BYTES.test(declared)) return
  if (BigInt(declared) > BigInt(MAX_UPDATE_DOWNLOAD_BYTES)) {
    throw new UpdateDownloadError(
      'response-too-large',
      `The update installer exceeds ${String(MAX_UPDATE_DOWNLOAD_BYTES)} bytes.`,
    )
  }
}

async function writeResponseBody(
  filename: string,
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
  stallTimeoutMs: number,
): Promise<void> {
  const handle = await open(filename, 'wx', PRIVATE_FILE_MODE)
  const reader = body.getReader()
  let bytesWritten = 0
  let failure: unknown
  try {
    while (true) {
      throwIfAborted(signal)
      const chunk = await readChunk(reader, stallTimeoutMs)
      throwIfAborted(signal)
      if (chunk.done) break
      if (chunk.value.byteLength > MAX_UPDATE_DOWNLOAD_BYTES - bytesWritten) {
        throw new UpdateDownloadError(
          'response-too-large',
          `The update installer exceeds ${String(MAX_UPDATE_DOWNLOAD_BYTES)} bytes.`,
        )
      }
      await writeAll(handle, chunk.value)
      bytesWritten += chunk.value.byteLength
    }
    if (bytesWritten === 0) {
      throw new UpdateDownloadError('empty-body', 'The update download service returned an empty body.')
    }
    await handle.sync()
  } catch (cause) {
    failure = cause
    // Cancelling an errored Chromium stream can stay pending forever, so the grace period keeps
    // this function settling: the caller must always reach the cleanup below.
    await cancelReader(reader, cause)
    throw cause
  } finally {
    // A stalled read still owns the stream, and a failed release must never skip closing the
    // handle: on Windows one open handle makes deleting the private file impossible.
    try {
      reader.releaseLock()
    } catch {
      // The abandoned read keeps its lock; the enclosing finally still removes the file.
    }
    try {
      await handle.close()
    } catch (closeCause) {
      if (failure === undefined) throw closeCause
    }
  }
}

/** Read one streamed chunk, reporting a torn-down response as one typed transport failure. */
async function readChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  stallTimeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  try {
    return await readBeforeStall(reader, stallTimeoutMs)
  } catch (cause) {
    if (cause instanceof UpdateDownloadError || isAbortFailure(cause)) throw cause
    throw new UpdateDownloadError(
      'network',
      'The update installer download was interrupted before it finished.',
      { cause },
    )
  }
}

/** Read one streamed chunk, failing once the body stops delivering bytes. */
async function readBeforeStall(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  stallTimeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const stalled = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new UpdateDownloadError(
        'stalled',
        `The update download service stopped sending data for ${String(stallTimeoutMs)} ms.`,
      ))
    }, stallTimeoutMs)
    timer.unref?.()
  })
  try {
    return await Promise.race([reader.read(), stalled])
  } finally {
    clearTimeout(timer)
  }
}

/** Cancel an errored stream within one bounded grace period. */
async function cancelReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  cause: unknown,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const grace = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, READER_CANCEL_GRACE_MS)
    timer.unref?.()
  })
  try {
    await Promise.race([reader.cancel(cause).catch(() => undefined), grace])
  } finally {
    clearTimeout(timer)
  }
}

async function writeAll(
  handle: Awaited<ReturnType<typeof open>>,
  chunk: Uint8Array,
): Promise<void> {
  let offset = 0
  while (offset < chunk.byteLength) {
    const result = await handle.write(chunk, offset, chunk.byteLength - offset, null)
    if (result.bytesWritten === 0) throw new Error('The update installer write made no progress.')
    offset += result.bytesWritten
  }
}

async function validateArtifact(filename: string, platform: DesktopDownloadPlatform): Promise<void> {
  const handle = await open(filename, 'r')
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_UPDATE_DOWNLOAD_BYTES) {
      throw invalidArtifact(platform)
    }
    if (platform === 'darwin') {
      if (stat.size < DMG_TRAILER_BYTES) throw invalidArtifact(platform)
      const magic = Buffer.alloc(DMG_TRAILER_MAGIC.byteLength)
      const result = await handle.read(magic, 0, magic.byteLength, stat.size - DMG_TRAILER_BYTES)
      if (result.bytesRead !== magic.byteLength || !magic.equals(DMG_TRAILER_MAGIC)) {
        throw invalidArtifact(platform)
      }
      return
    }

    if (stat.size < DOS_HEADER_BYTES) throw invalidArtifact(platform)
    const dosHeader = Buffer.alloc(DOS_HEADER_BYTES)
    const dosResult = await handle.read(dosHeader, 0, dosHeader.byteLength, 0)
    if (dosResult.bytesRead !== dosHeader.byteLength || dosHeader[0] !== 0x4d || dosHeader[1] !== 0x5a) {
      throw invalidArtifact(platform)
    }
    const peOffset = dosHeader.readUInt32LE(PE_OFFSET_POSITION)
    if (peOffset > stat.size - PE_MAGIC.byteLength) throw invalidArtifact(platform)
    const peMagic = Buffer.alloc(PE_MAGIC.byteLength)
    const peResult = await handle.read(peMagic, 0, peMagic.byteLength, peOffset)
    if (peResult.bytesRead !== peMagic.byteLength || !peMagic.equals(PE_MAGIC)) {
      throw invalidArtifact(platform)
    }
  } finally {
    await handle.close()
  }
}

function invalidArtifact(platform: DesktopDownloadPlatform): UpdateDownloadError {
  return new UpdateDownloadError(
    'invalid-artifact',
    platform === 'darwin'
      ? 'The downloaded file is not a UDIF disk image.'
      : 'The downloaded file is not a PE executable.',
  )
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted !== true) return
  throw aborted(signal.reason)
}

function aborted(cause: unknown): UpdateDownloadError {
  return new UpdateDownloadError('aborted', 'The update installer download was cancelled.', { cause })
}

function isAbortFailure(value: unknown): boolean {
  return value instanceof UpdateDownloadError
    ? value.code === 'aborted'
    : typeof value === 'object'
      && value !== null
      && 'name' in value
      && value.name === 'AbortError'
}

async function unlinkIfPresent(filename: string): Promise<void> {
  try {
    await unlink(filename)
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
  }
}

/**
 * Delete one private streaming artifact, retrying the handle-release races that Windows reports
 * as EBUSY, EPERM, or ENOTEMPTY for a file another process has only just closed.
 * @param filename - absolute private streaming path.
 */
async function removeTemporaryArtifact(filename: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await unlinkIfPresent(filename)
      return
    } catch (cause) {
      if (attempt >= UNLINK_ATTEMPTS - 1 || !isTransientUnlinkFailure(cause)) throw cause
      await delay(UNLINK_RETRY_MS)
    }
  }
}

/**
 * Remove private streaming artifacts abandoned by a process that no longer exists.
 * A killed, crashed, or force-exited Desktop process cannot run its own cleanup, and its leftovers
 * would otherwise sit next to the destination installer forever.
 * @param directory - real destination directory that received the abandoned stream.
 * @param destinationName - destination file name whose private streams are abandoned.
 * @param isAlive - process liveness probe, injectable for tests.
 * @returns absolute paths that were removed.
 */
export async function removeAbandonedTemporaryArtifacts(
  directory: string,
  destinationName: string,
  isAlive: (pid: number) => boolean = isProcessAlive,
): Promise<readonly string[]> {
  let entries: string[]
  try {
    entries = await readdir(directory)
  } catch {
    return []
  }
  const pattern = temporaryArtifactPattern(destinationName)
  const removed: string[] = []
  for (const entry of entries) {
    const pid = abandonedProcessId(entry, pattern)
    if (pid === undefined || pid === process.pid || isAlive(pid)) continue
    const filename = join(directory, entry)
    try {
      await removeTemporaryArtifact(filename)
      removed.push(filename)
    } catch {
      // An abandoned private stream is best-effort cleanup; the download itself must proceed.
    }
  }
  return removed
}

function temporaryArtifactPattern(destinationName: string): RegExp {
  const escaped = destinationName.replace(REGEXP_METACHARACTERS, '\\$&')
  return new RegExp(
    `^\\.${escaped}\\.(\\d+)\\.([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\\.partial$`,
    'u',
  )
}

function abandonedProcessId(entry: string, pattern: RegExp): number | undefined {
  const match = pattern.exec(entry)
  if (match === null || !entry.endsWith(TEMPORARY_ARTIFACT_SUFFIX)) return undefined
  const value = Number(match[1]!)
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
}

/** Report whether one process id still exists; an unpermitted probe still means it exists. */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (cause) {
    return (cause as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function isTransientUnlinkFailure(cause: unknown): boolean {
  const code = (cause as NodeJS.ErrnoException).code
  return code === 'EBUSY' || code === 'EPERM' || code === 'ENOTEMPTY' || code === 'EACCES'
}

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
  })
}
