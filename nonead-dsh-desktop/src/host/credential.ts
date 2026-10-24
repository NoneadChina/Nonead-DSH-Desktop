/** Renderer credential hand-off: read from the private stdin pipe, never the environment. */

import { isRendererAccessToken } from '../desktop-browser-access.ts'

/** Bound on the hand-off line; the real credential is 43 bytes plus a newline. */
const MAX_CREDENTIAL_CHARS = 256

/**
 * Read the single-line renderer credential the Desktop shell writes to this process's stdin
 * and then closes.
 *
 * The credential deliberately does not travel in the child environment: any same-user process
 * can read a child's environment (`/proc/<pid>/environ`, crash dumps, the Windows PEB) and
 * then impersonate the Electron renderer with the `x-dsh-desktop-renderer` header.
 * @param stream - byte stream carrying the hand-off line; defaults to this process's stdin.
 * @returns the credential.
 * @throws when stdin ended without a well-formed credential, so the Host never boots
 *   without the capability that gates ordinary-browser traffic.
 */
export async function readRendererCredential(
  stream: AsyncIterable<Buffer | string> = process.stdin,
): Promise<string> {
  const line = await readFirstLine(stream)
  if (line === undefined || line.length === 0) {
    throw new Error('Next Host did not receive the renderer credential over stdin')
  }
  if (!isRendererAccessToken(line)) {
    throw new Error('Next Host received an invalid renderer credential over stdin')
  }
  return line
}

async function readFirstLine(stream: AsyncIterable<Buffer | string>): Promise<string | undefined> {
  let text = ''
  for await (const chunk of stream) {
    text += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    const newline = text.indexOf('\n')
    if (newline >= 0) return text.slice(0, newline).trim()
    if (text.length > MAX_CREDENTIAL_CHARS) return undefined
  }
  // A shell that did not append a newline still handed over exactly one value.
  return text.trim()
}
