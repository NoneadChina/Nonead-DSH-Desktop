import { describe, expect, it, vi } from 'vitest'
import { checkForDesktopUpdate } from '../src/update-checker.ts'

/**
 * A rejected version response must release its body.
 *
 * `readLimitedBody` cancels the body when the declared or streamed size exceeds the
 * limit (with a comment saying the connection would otherwise linger until the
 * garbage collector finalizes the response). A non-200 answer takes the same early
 * exit — the body is never read — so it has to release the connection the same way.
 */
function trackedResponse(status: number): { response: Response, cancel: ReturnType<typeof vi.fn> } {
  const cancel = vi.fn(async () => undefined)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('unavailable'))
      // Deliberately never closed: an unread body keeps its source open.
    },
    cancel,
  })
  return { response: new Response(stream, { status }), cancel }
}

describe('checkForDesktopUpdate: rejected responses', () => {
  it.each([500, 503])('releases the body of an HTTP %i response', async (status) => {
    const { response, cancel } = trackedResponse(status)
    await expect(checkForDesktopUpdate({
      currentVersion: '2.0.0',
      channel: 'stable',
      request: async () => response,
    })).resolves.toBeNull()
    expect(cancel).toHaveBeenCalled()
  })

  it('releases the body of a 304 response', async () => {
    const cancel = vi.fn(async () => undefined)
    const response = new Response(null, { status: 304 })
    Object.defineProperty(response, 'body', {
      configurable: true,
      value: { cancel },
    })
    await expect(checkForDesktopUpdate({
      currentVersion: '2.0.0',
      channel: 'stable',
      request: async () => response,
    })).resolves.toBeNull()
    expect(cancel).toHaveBeenCalled()
  })
})
