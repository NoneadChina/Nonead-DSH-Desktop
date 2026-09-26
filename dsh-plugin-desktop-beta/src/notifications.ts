/** Privacy-safe desktop attention for completed user turns and background jobs. */

import type { Context } from '@deepseek-ai/cordis'
import type { JobView } from '@deepseek-ai/dsh-jobs'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import type { DesktopLocale, DesktopNotification } from './runtime.ts'
import { volatileField } from './settings.ts'

export const name = 'desktop-notifications'
export const inject = ['desktopRuntime']

/** Profile patch row id, which is also the upstream settings entry id. */
export const DESKTOP_NOTIFICATIONS_SETTINGS_NAMESPACE = 'dsh-desktop-notifications'

/** Notification preferences owned by the `dsh-desktop-notifications` row. */
export interface DesktopNotificationSettings {
  enabled: boolean
  notifyOnTurnCompletion: boolean
  notifyOnTurnFailure: boolean
  notifyOnJobCompletion: boolean
  notifyOnJobFailure: boolean
}

/** Editable notification preferences; every field is user-editable. */
export const DesktopNotificationSettingsSchema = z.object({
  enabled: volatileField(z.boolean().default(true)),
  notifyOnTurnCompletion: volatileField(z.boolean().default(true)),
  notifyOnTurnFailure: volatileField(z.boolean().default(true)),
  notifyOnJobCompletion: volatileField(z.boolean().default(true)),
  notifyOnJobFailure: volatileField(z.boolean().default(true)),
})

/** Configurable plugin entry schema read by the upstream settings document. */
export const Config = DesktopNotificationSettingsSchema

const DEFAULT_SETTINGS: DesktopNotificationSettings = Object.freeze({
  enabled: true,
  notifyOnTurnCompletion: true,
  notifyOnTurnFailure: true,
  notifyOnJobCompletion: true,
  notifyOnJobFailure: true,
})

/** Narrow one projected settings value to a plain record. */
function plainRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/** Narrow one projected preference, falling back to its default. */
function parsePreference(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Read the effective notification preferences of this context.
 *
 * The value comes from the settings projection rather than the resolved plugin
 * config so it stays plain and version independent.
 * @param ctx - host context carrying the optional `settings` service.
 * @returns complete preferences with the schema defaults applied.
 */
export function readDesktopNotificationSettings(ctx: Context): DesktopNotificationSettings {
  const descriptor = ctx.get('settings')
    ?.describe()
    .find(entry => entry.ns === DESKTOP_NOTIFICATIONS_SETTINGS_NAMESPACE)
  if (descriptor === undefined) return DEFAULT_SETTINGS
  const value = plainRecord(descriptor.value)
  return {
    enabled: parsePreference(value.enabled, DEFAULT_SETTINGS.enabled),
    notifyOnTurnCompletion: parsePreference(value.notifyOnTurnCompletion, DEFAULT_SETTINGS.notifyOnTurnCompletion),
    notifyOnTurnFailure: parsePreference(value.notifyOnTurnFailure, DEFAULT_SETTINGS.notifyOnTurnFailure),
    notifyOnJobCompletion: parsePreference(value.notifyOnJobCompletion, DEFAULT_SETTINGS.notifyOnJobCompletion),
    notifyOnJobFailure: parsePreference(value.notifyOnJobFailure, DEFAULT_SETTINGS.notifyOnJobFailure),
  }
}

type NotificationOutcome = 'turn-completed' | 'turn-failed' | 'job-completed' | 'job-failed'

const NOTIFICATION_COPY: Record<DesktopLocale, Record<NotificationOutcome, DesktopNotification>> = {
  en: {
    'turn-completed': { title: 'User Turn Completed', body: 'A user-initiated turn has finished.' },
    'turn-failed': { title: 'User Turn Failed', body: 'A user-initiated turn could not finish. Open Nonead DSH Desktop for details.' },
    'job-completed': { title: 'Background Job Completed', body: 'A background job has finished.' },
    'job-failed': { title: 'Background Job Failed', body: 'A background job could not finish. Open Nonead DSH Desktop for details.' },
  },
  zh: {
    'turn-completed': { title: '用户回合已完成', body: '一个由你发起的回合已完成。' },
    'turn-failed': { title: '用户回合失败', body: '一个由你发起的回合未能完成，请打开 Nonead DSH Desktop 查看详情。' },
    'job-completed': { title: '后台任务已完成', body: '有一个后台任务已结束。' },
    'job-failed': { title: '后台任务失败', body: '一个后台任务未能完成，请打开 Nonead DSH Desktop 查看详情。' },
  },
}

interface OpenTurn {
  readonly turn: number
  userInitiated: boolean
}

function notifyJob(
  runtime: Context['desktopRuntime'],
  settings: DesktopNotificationSettings,
  job: JobView,
): void {
  if (!settings.enabled) return
  if (job.status === 'completed' && settings.notifyOnJobCompletion) {
    runtime.notifyAttention(NOTIFICATION_COPY[runtime.locale]['job-completed'])
  } else if (job.status === 'failed' && settings.notifyOnJobFailure) {
    runtime.notifyAttention(NOTIFICATION_COPY[runtime.locale]['job-failed'])
  }
}

function trackTurn(
  runtime: Context['desktopRuntime'],
  settings: DesktopNotificationSettings,
  openTurns: Map<string, OpenTurn>,
  session: Session,
  event: SessionEvent,
): void {
  if (!settings.enabled) return
  if (session.header.origin === 'subagent') return
  const sessionId = String(session.header.id)

  if (event.type === 'turn/start') {
    openTurns.set(sessionId, { turn: event.data.turn, userInitiated: false })
    return
  }
  if (event.type === 'user/message') {
    const openTurn = openTurns.get(sessionId)
    if (openTurn !== undefined && event.data.source.kind === 'user') openTurn.userInitiated = true
    return
  }
  if (event.type !== 'turn/end') return

  const openTurn = openTurns.get(sessionId)
  if (openTurn === undefined || openTurn.turn !== event.data.turn) return
  openTurns.delete(sessionId)
  if (!openTurn.userInitiated) return

  const reason = event.data.reason.kind
  if (reason === 'completed' && settings.notifyOnTurnCompletion) {
    runtime.notifyAttention(NOTIFICATION_COPY[runtime.locale]['turn-completed'])
  } else if ((reason === 'error' || reason === 'max-tokens') && settings.notifyOnTurnFailure) {
    runtime.notifyAttention(NOTIFICATION_COPY[runtime.locale]['turn-failed'])
  }
}

/** Register independently optional settings, job, and live-session observers. */
export function apply(ctx: Context): void {
  let settings = DEFAULT_SETTINGS

  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.effect(() => {
      settings = readDesktopNotificationSettings(settingsCtx)
      const stopUpdated = settingsCtx.on('settings/document-updated', (namespace) => {
        if (namespace !== DESKTOP_NOTIFICATIONS_SETTINGS_NAMESPACE) return
        settings = readDesktopNotificationSettings(settingsCtx)
      })
      return () => {
        stopUpdated()
        settings = DEFAULT_SETTINGS
      }
    }, 'dsh-plugin-desktop: native notification settings')
  })

  ctx.inject(['jobs'], (jobsCtx) => {
    jobsCtx.effect(
      () => jobsCtx.jobs.events.subscribe({ owners: 'all' }, (event) => {
        if (event.type !== 'settled') return
        notifyJob(jobsCtx.desktopRuntime, settings, event.job)
      }),
      'dsh-plugin-desktop: background job attention',
    )
  })

  ctx.inject(['sessions'], (sessionsCtx) => {
    sessionsCtx.effect(() => {
      const openTurns = new Map<string, OpenTurn>()
      const stopEvents = sessionsCtx.on('session/event', (session, event) => {
        trackTurn(sessionsCtx.desktopRuntime, settings, openTurns, session, event)
      })
      const stopDisposed = sessionsCtx.on('session/disposed', (session) => {
        openTurns.delete(String(session.header.id))
      })
      return () => {
        stopDisposed()
        stopEvents()
      }
    }, 'dsh-plugin-desktop: direct user turn attention')
  })
}
