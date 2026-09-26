import type { Context } from '@deepseek-ai/cordis'
import type { JobEvent, JobId, JobView } from '@deepseek-ai/dsh-jobs'
import type { Session, SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import { describe, expect, it, vi } from 'vitest'
import {
  apply,
  DESKTOP_NOTIFICATIONS_SETTINGS_NAMESPACE,
  DesktopNotificationSettingsSchema,
  inject,
  name,
  type DesktopNotificationSettings,
} from '../src/notifications.ts'
import type { DesktopRuntime } from '../src/runtime.ts'

type OptionalService = 'jobs' | 'sessions' | 'settings'

interface NotificationHarness {
  readonly notifyAttention: ReturnType<typeof vi.fn>
  readonly describeSettings: ReturnType<typeof vi.fn>
  readonly stopJobs: ReturnType<typeof vi.fn>
  readonly stopSessions: ReturnType<typeof vi.fn>
  jobSettled(job: JobView): void
  sessionEvent(session: Session, event: SessionEvent): Promise<void>
  sessionDisposed(session: Session): Promise<void>
  updateSettings(settings: DesktopNotificationSettings): void
  teardownSessions(): void
  reattachSessions(): void
  dispose(): void
}

/** One settled background job as the registry projects it. */
function job(id: string, status: JobView['status'], label = 'build', detail?: string): JobView {
  return {
    id: id as JobId,
    kind: 'bash',
    label,
    status,
    startedAt: 1,
    finishedAt: 2,
    output: { total: 0, earliest: 0 },
    ...(detail === undefined ? {} : { detail }),
  }
}

function createHarness(available: readonly OptionalService[] = ['jobs', 'sessions', 'settings']): NotificationHarness {
  const notifyAttention = vi.fn()
  const stopJobs = vi.fn()
  const stopSessions = vi.fn()
  const enabled = new Set(available)
  const injections = new Map<OptionalService, (ctx: Context) => void>()
  const disposers = new Map<OptionalService, Array<() => void>>()
  const settingsListeners = new Set<(namespace: string) => void>()
  let activeService: OptionalService | undefined
  let jobListener: ((event: JobEvent) => void) | undefined
  let sessionListener: ((session: Session, event: SessionEvent) => void | PromiseLike<void>) | undefined
  let sessionDisposedListener: ((session: Session) => void | PromiseLike<void>) | undefined
  let currentSettings: DesktopNotificationSettings = {
    enabled: true,
    notifyOnTurnCompletion: true,
    notifyOnTurnFailure: true,
    notifyOnJobCompletion: true,
    notifyOnJobFailure: true,
  }

  const runtime = {
    platform: 'darwin',
    locale: 'en',
    notifyAttention,
  } as unknown as DesktopRuntime

  const describeSettings = vi.fn(() => [
    { ns: DESKTOP_NOTIFICATIONS_SETTINGS_NAMESPACE, value: currentSettings },
  ])
  const settings = { describe: describeSettings }

  const ctx = {
    desktopRuntime: runtime,
    settings,
    get: (key: string) => (key === 'settings' ? settings : undefined),
    jobs: {
      events: {
        subscribe: (filter: { owners: string }, listener: (event: JobEvent) => void) => {
          void filter
          jobListener = listener
          return () => {
            jobListener = undefined
            stopJobs()
          }
        },
      },
    },
    on: (event: string, listener: typeof sessionListener | typeof sessionDisposedListener) => {
      if (event === 'settings/document-updated') {
        const updated = listener as unknown as (namespace: string) => void
        settingsListeners.add(updated)
        return () => { settingsListeners.delete(updated) }
      }
      if (event === 'session/event') sessionListener = listener as typeof sessionListener
      else if (event === 'session/disposed') sessionDisposedListener = listener as typeof sessionDisposedListener
      else return () => {}
      return () => {
        if (event === 'session/event') sessionListener = undefined
        else sessionDisposedListener = undefined
        stopSessions()
      }
    },
    inject: (services: OptionalService[], callback: (child: Context) => void) => {
      const service = services[0]
      if (service === undefined) return
      injections.set(service, callback)
      if (!enabled.has(service)) return
      activeService = service
      callback(ctx as unknown as Context)
      activeService = undefined
    },
    effect: (register: () => void | (() => void)) => {
      const dispose = register()
      if (activeService !== undefined && typeof dispose === 'function') {
        disposers.set(activeService, [...(disposers.get(activeService) ?? []), dispose])
      }
      return dispose
    },
  } as unknown as Context

  const teardown = (service: OptionalService): void => {
    for (const dispose of [...(disposers.get(service) ?? [])].reverse()) dispose()
    disposers.delete(service)
  }

  apply(ctx)

  return {
    notifyAttention,
    describeSettings,
    stopJobs,
    stopSessions,
    jobSettled(job) {
      jobListener?.({ type: 'settled', job, cause: 'producer', awaited: true })
    },
    async sessionEvent(session, event) { await sessionListener?.(session, event) },
    async sessionDisposed(session) { await sessionDisposedListener?.(session) },
    updateSettings(next) {
      currentSettings = next
      for (const listener of settingsListeners) listener(DESKTOP_NOTIFICATIONS_SETTINGS_NAMESPACE)
    },
    teardownSessions() { teardown('sessions') },
    reattachSessions() {
      activeService = 'sessions'
      injections.get('sessions')?.(ctx)
      activeService = undefined
    },
    dispose() {
      teardown('sessions')
      teardown('jobs')
      teardown('settings')
    },
  }
}

function session(id: string, origin?: 'subagent'): Session {
  return {
    header: {
      id: id as SessionId,
      version: 0,
      createdAt: 1,
      ...(origin === undefined ? {} : { origin }),
    },
  } as unknown as Session
}

function event<T extends SessionEvent['type']>(
  type: T,
  data: Extract<SessionEvent, { type: T }>['data'],
  seq: number,
): Extract<SessionEvent, { type: T }> {
  return { type, data, seq, time: seq } as Extract<SessionEvent, { type: T }>
}

function userMessage(source: 'user' | 'plugin', seq: number): SessionEvent<'user/message'> {
  return event('user/message', {
    id: `message-${String(seq)}` as never,
    role: 'user',
    content: [{ type: 'text', text: 'secret /Users/example session-123' }] as never,
    source: source === 'user'
      ? { kind: 'user' }
      : { kind: 'plugin', plugin: 'test', form: 'notice', summary: 'continuation' },
  } as never, seq)
}

describe('desktop notifications Host plugin', () => {
  it('registers live notification settings with the global switch enabled by default', () => {
    const harness = createHarness(['settings'])

    expect(name).toBe('desktop-notifications')
    expect(inject).toEqual(['desktopRuntime'])
    expect(String(DESKTOP_NOTIFICATIONS_SETTINGS_NAMESPACE)).toBe('dsh-desktop-notifications')
    const defaults = DesktopNotificationSettingsSchema({} as DesktopNotificationSettings)
    expect(Object.keys(defaults)).toHaveLength(5)
    expect(defaults.enabled.get()).toBe(true)
    expect(defaults.notifyOnTurnCompletion.get()).toBe(true)
    expect(defaults.notifyOnTurnFailure.get()).toBe(true)
    expect(defaults.notifyOnJobCompletion.get()).toBe(true)
    expect(defaults.notifyOnJobFailure.get()).toBe(true)
    expect(harness.describeSettings).toHaveBeenCalled()
  })

  it('notifies for completed and failed jobs without exposing job details', () => {
    const harness = createHarness(['jobs', 'settings'])
    const secretLabel = 'node /Users/example/private.js --token secret'

    harness.jobSettled(job('bash-1', 'completed', secretLabel, 'session-123'))
    harness.jobSettled(job('bash-1', 'failed', secretLabel, 'session-123'))
    harness.jobSettled(job('bash-1', 'killed', secretLabel, 'session-123'))

    expect(harness.notifyAttention.mock.calls).toEqual([
      [{ title: 'Background Job Completed', body: 'A background job has finished.' }],
      [{ title: 'Background Job Failed', body: 'A background job could not finish. Open Nonead DSH Desktop for details.' }],
    ])
    expect(JSON.stringify(harness.notifyAttention.mock.calls)).not.toMatch(/Users|private|secret|session-123/u)
  })

  it('applies live settings independently to successful and failed outcomes', async () => {
    const harness = createHarness()
    const completed = job('bash-2', 'completed')

    harness.updateSettings({
      enabled: true,
      notifyOnTurnCompletion: false,
      notifyOnTurnFailure: true,
      notifyOnJobCompletion: false,
      notifyOnJobFailure: true,
    })
    harness.jobSettled(completed)
    harness.jobSettled(job('bash-2', 'failed'))

    const active = session('session-1')
    await harness.sessionEvent(active, event('turn/start', { turn: 1 }, 1))
    await harness.sessionEvent(active, userMessage('user', 2))
    await harness.sessionEvent(active, event('turn/end', { turn: 1, reason: { kind: 'completed' } }, 3))
    await harness.sessionEvent(active, event('turn/start', { turn: 2 }, 4))
    await harness.sessionEvent(active, userMessage('user', 5))
    await harness.sessionEvent(active, event('turn/end', {
      turn: 2,
      reason: { kind: 'error', error: { code: 'UNKNOWN', message: 'private error' } },
    }, 6))

    expect(harness.notifyAttention.mock.calls).toEqual([
      [{ title: 'Background Job Failed', body: 'A background job could not finish. Open Nonead DSH Desktop for details.' }],
      [{ title: 'User Turn Failed', body: 'A user-initiated turn could not finish. Open Nonead DSH Desktop for details.' }],
    ])
  })

  it('keeps fine-grained choices while the live global switch is disabled', async () => {
    const harness = createHarness()

    harness.updateSettings({
      enabled: false,
      notifyOnTurnCompletion: true,
      notifyOnTurnFailure: true,
      notifyOnJobCompletion: true,
      notifyOnJobFailure: true,
    })
    harness.jobSettled(job('bash-disabled', 'completed'))

    const active = session('disabled')
    await harness.sessionEvent(active, event('turn/start', { turn: 1 }, 1))
    await harness.sessionEvent(active, userMessage('user', 2))
    await harness.sessionEvent(active, event('turn/end', { turn: 1, reason: { kind: 'completed' } }, 3))

    expect(harness.notifyAttention).not.toHaveBeenCalled()
  })

  it('notifies only matching direct-user turn endings', async () => {
    const harness = createHarness(['sessions'])
    const direct = session('direct')
    const plugin = session('plugin')
    const subagent = session('subagent', 'subagent')

    await harness.sessionEvent(direct, event('turn/start', { turn: 7 }, 1))
    await harness.sessionEvent(direct, userMessage('user', 2))
    await harness.sessionEvent(direct, event('turn/end', { turn: 8, reason: { kind: 'completed' } }, 3))
    await harness.sessionEvent(direct, event('turn/end', { turn: 7, reason: { kind: 'completed' } }, 4))

    await harness.sessionEvent(plugin, event('turn/start', { turn: 1 }, 5))
    await harness.sessionEvent(plugin, userMessage('plugin', 6))
    await harness.sessionEvent(plugin, event('turn/end', { turn: 1, reason: { kind: 'completed' } }, 7))

    await harness.sessionEvent(subagent, event('turn/start', { turn: 1 }, 8))
    await harness.sessionEvent(subagent, userMessage('user', 9))
    await harness.sessionEvent(subagent, event('turn/end', { turn: 1, reason: { kind: 'completed' } }, 10))

    expect(harness.notifyAttention).toHaveBeenCalledOnce()
    expect(harness.notifyAttention).toHaveBeenCalledWith({
      title: 'User Turn Completed',
      body: 'A user-initiated turn has finished.',
    })
  })

  it('treats max-tokens as a failure and keeps non-failure endings silent', async () => {
    const harness = createHarness(['sessions'])
    const active = session('direct')
    const endings: Array<Extract<SessionEvent, { type: 'turn/end' }>['data']['reason']> = [
      { kind: 'max-tokens' },
      { kind: 'aborted', reason: { kind: 'user' } },
      { kind: 'blocked' },
      { kind: 'interrupted' },
    ]

    for (const [index, reason] of endings.entries()) {
      const turn = index + 1
      await harness.sessionEvent(active, event('turn/start', { turn }, turn * 3))
      await harness.sessionEvent(active, userMessage('user', turn * 3 + 1))
      await harness.sessionEvent(active, event('turn/end', { turn, reason } as never, turn * 3 + 2))
    }

    expect(harness.notifyAttention).toHaveBeenCalledOnce()
    expect(harness.notifyAttention).toHaveBeenCalledWith({
      title: 'User Turn Failed',
      body: 'A user-initiated turn could not finish. Open Nonead DSH Desktop for details.',
    })
  })

  it('drops open turn state when sessions detach and disposes optional observers', async () => {
    const harness = createHarness()
    const active = session('session-1')
    await harness.sessionEvent(active, event('turn/start', { turn: 1 }, 1))
    await harness.sessionEvent(active, userMessage('user', 2))

    harness.teardownSessions()
    harness.reattachSessions()
    await harness.sessionEvent(active, event('turn/end', { turn: 1, reason: { kind: 'completed' } }, 3))

    expect(harness.notifyAttention).not.toHaveBeenCalled()
    expect(harness.stopSessions).toHaveBeenCalledTimes(2)
    harness.dispose()
    expect(harness.stopSessions).toHaveBeenCalledTimes(4)
    expect(harness.stopJobs).toHaveBeenCalledOnce()
  })

  it('drops an unfinished turn when its session is disposed', async () => {
    const harness = createHarness(['sessions'])
    const active = session('session-1')
    await harness.sessionEvent(active, event('turn/start', { turn: 1 }, 1))
    await harness.sessionEvent(active, userMessage('user', 2))
    await harness.sessionDisposed(active)
    await harness.sessionEvent(active, event('turn/end', { turn: 1, reason: { kind: 'completed' } }, 3))

    expect(harness.notifyAttention).not.toHaveBeenCalled()
  })
})
