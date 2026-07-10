/**
 * Conversation Notification Cron Job
 *
 * Dispatches pending new-message notification emails to guests and owners.
 * Runs every 5 minutes. Consults `conversation_notification_schedules` for
 * rows where `pending_notification_at <= now` and `cancelled_at IS NULL`.
 *
 * Streak model (per AC-006-05, AC-006-06):
 * - Streak 1: first dispatch 30 min after unread message.
 * - Streak 2: 24 h from streak start.
 * - Streak 3: 72 h from streak start (final — schedule cancelled afterwards).
 * - New activity resets streak to 1 unconditionally.
 *
 * Email templates:
 * - Authenticated recipient (userId present): `ConversationNewMessage`
 * - Anonymous guest (recipientSide GUEST, no userId): `ConversationNewMessageAnon`
 *
 * ## Why email dispatch runs outside the advisory-lock transaction (HOS-112)
 *
 * `sendEmail` makes an HTTP call to Brevo per due schedule. The original
 * implementation ran that call INSIDE the `pg_try_advisory_xact_lock(43020)`
 * transaction, so a slow/unresponsive provider held both the DB connection
 * AND the advisory lock for the entire batch — the same
 * `idle_in_transaction_session_timeout` risk documented on
 * `destination-weather-fetch.job.ts`, but worse here because the lock also
 * serialized every other overlapping run for as long as email sends took.
 * This job now runs three phases, mirroring the weather-fetch fix:
 *
 *  1. **Resolve** (`findDue` + per-schedule reads) — no transaction, no lock.
 *     Builds an in-memory list of everything needed to send each email.
 *  2. **Dispatch** (`sendEmail`, guarded by an atomic Redis claim) — no
 *     transaction, no lock. `SET conv:notif:{scheduleId} 1 NX EX 600`
 *     replaces the old check-then-set `isAlreadyDispatched`/`markDispatched`
 *     pair, closing the race where two ticks could both pass the check
 *     before either set the key. A failed send releases the claim (`DEL`) so
 *     the schedule is retried next tick instead of being locked out for the
 *     full TTL.
 *  3. **Persist** (`withTransaction`, advisory lock as the FIRST statement) —
 *     only `advanceSchedule` calls for schedules that were actually sent in
 *     phase 2. No external I/O happens inside this transaction, so it can
 *     never sit idle waiting on a provider.
 *
 * ## Trade-off: the lock now only guards the PERSIST phase
 *
 * Because emails are sent (phase 2) before the lock is acquired (phase 3),
 * two overlapping runs can both dispatch — but only for DIFFERENT schedules,
 * since the Redis claim in phase 2 already serializes per-schedule ownership
 * across runs. If phase 3's lock is not acquired (some other run holds it),
 * this run's streak advances for schedules it just sent are deferred/lost
 * for this tick — the schedule is not re-sent (its Redis claim is still set)
 * but its streak bookkeeping falls behind until a later tick catches up.
 * Accepted trade-off (no retry queue, NG-2) — logged at `warn` so it is
 * visible in ops. See `packages/service-core/.../notification-schedule.service.ts`
 * `advanceSchedule` for the double-advance guard (AC-10) that keeps this safe
 * even if two runs somehow race on the same schedule.
 *
 * @module cron/jobs/conversation-notification
 */

import { AccommodationModel, getDb, sql, UserModel, withTransaction } from '@repo/db';
import { createEmailClient, sendEmail } from '@repo/email';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { NotificationScheduleService } from '@repo/service-core';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import { getRedisClient } from '../../utils/redis.js';
import type { CronJobDefinition } from '../types.js';
import {
    type ResolvedNotification,
    resolveNotification
} from './conversation-notification.resolve.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** PostgreSQL advisory lock ID reserved for this job. */
const ADVISORY_LOCK_ID = 43020;

/** Redis key prefix for per-schedule idempotency. */
const REDIS_IDEMPOTENCY_PREFIX = 'conv:notif:';

/** TTL in seconds for Redis idempotency keys (10 minutes). */
const REDIS_IDEMPOTENCY_TTL_S = 10 * 60;

/** Maximum number of due schedules processed per run. */
const MAX_BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// System actor
// ---------------------------------------------------------------------------

/** System-level actor used for all service calls. */
const SYSTEM_ACTOR = {
    id: '00000000-0000-0000-0000-000000000001',
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.CONVERSATION_VIEW_OWN,
        PermissionEnum.CONVERSATION_VIEW_ANY,
        PermissionEnum.CONVERSATION_VIEW_ALL,
        PermissionEnum.CONVERSATION_REPLY_OWN,
        PermissionEnum.CONVERSATION_REPLY_ANY,
        PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN,
        PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY,
        PermissionEnum.CONVERSATION_BLOCK_OWN,
        PermissionEnum.CONVERSATION_BLOCK_ANY,
        PermissionEnum.CONVERSATION_DELETE_ANY
    ] as readonly PermissionEnum[],
    _isSystemActor: true
} as const;

// ---------------------------------------------------------------------------
// Redis idempotency — atomic claim / release
// ---------------------------------------------------------------------------

/**
 * Atomically claims dispatch ownership of a schedule via `SET key 1 NX EX
 * ttl`. Returns `true` when the claim was acquired (caller should proceed to
 * send) or `false` when another run/tick already holds it (caller should
 * skip silently — not an error).
 *
 * Fails OPEN (returns `true`) when Redis is unconfigured or errors, since
 * idempotency-under-Redis-outage is an accepted degradation (spec §6) rather
 * than a reason to stop dispatching notifications — but a `warn` log makes
 * the degraded mode visible in ops instead of silently proceeding.
 */
async function claimDispatch(scheduleId: string): Promise<boolean> {
    try {
        const redis = await getRedisClient();
        if (!redis) {
            apiLogger.warn(
                { scheduleId },
                'Redis unavailable — claiming notification dispatch without idempotency protection'
            );
            return true;
        }
        const result = await redis.set(
            `${REDIS_IDEMPOTENCY_PREFIX}${scheduleId}`,
            '1',
            'EX',
            REDIS_IDEMPOTENCY_TTL_S,
            'NX'
        );
        return result === 'OK';
    } catch (error) {
        apiLogger.warn(
            { scheduleId, error: error instanceof Error ? error.message : String(error) },
            'Redis error while claiming notification dispatch — proceeding without idempotency protection'
        );
        return true;
    }
}

/**
 * Releases a previously-acquired dispatch claim (best-effort, never throws).
 * Called when an email send fails so the schedule remains eligible for the
 * next cron tick instead of being locked out until the TTL expires.
 */
async function releaseClaim(scheduleId: string): Promise<void> {
    try {
        const redis = await getRedisClient();
        if (redis) {
            await redis.del(`${REDIS_IDEMPOTENCY_PREFIX}${scheduleId}`);
        }
    } catch {
        // Best-effort — a stale claim just delays retry until TTL expiry.
    }
}

// ---------------------------------------------------------------------------
// Discriminated union for the phase-3 withTransaction return
// ---------------------------------------------------------------------------

type CronTransactionResult =
    | { readonly skipped: true }
    | { readonly skipped: false; readonly advanceErrors: number };

// ---------------------------------------------------------------------------
// Job definition
// ---------------------------------------------------------------------------

/**
 * Conversation notification cron job.
 *
 * Schedule: every 5 minutes
 * Advisory lock: 43020
 */
export const conversationNotificationJob: CronJobDefinition = {
    name: 'conversation-notification',
    description: 'Dispatch pending new-message notification emails to guests and owners',
    schedule: '*/5 * * * *',
    enabled: true,
    timeoutMs: 120000, // 2 minutes

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        let processed = 0;
        let errors = 0;

        try {
            logger.info('Starting conversation-notification cron', {
                dryRun,
                startedAt: startedAt.toISOString()
            });

            const schedSvc = new NotificationScheduleService({ logger: apiLogger });

            // ---------------------------------------------------------------
            // Phase 0 — find due schedules. No transaction, no advisory lock.
            // ---------------------------------------------------------------
            const dueResult = await schedSvc.findDue(SYSTEM_ACTOR, { now: new Date() });

            if (dueResult.error) {
                logger.error('Failed to query due notification schedules', {
                    error: dueResult.error.message
                });
                return {
                    success: false,
                    message: `Failed to query schedules: ${dueResult.error.message}`,
                    processed: 0,
                    errors: 1,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            const dueSchedules = (dueResult.data ?? []).slice(0, MAX_BATCH_SIZE);

            logger.info('Due notification schedules found', { total: dueSchedules.length });

            if (dryRun) {
                logger.info('Dry run — skipping email dispatch', {
                    wouldProcess: dueSchedules.length
                });
                return {
                    success: true,
                    message: `Dry run: would dispatch ${dueSchedules.length} notification(s)`,
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: { dryRun: true, dueCount: dueSchedules.length }
                };
            }

            // Email client — bail early if not configured
            const resendApiKey = env.HOSPEDA_EMAIL_API_KEY;
            if (!resendApiKey) {
                logger.warn(
                    'HOSPEDA_EMAIL_API_KEY not configured — skipping notification dispatch'
                );
                return {
                    success: true,
                    message: 'Skipped — email not configured',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            const emailClient = createEmailClient({ apiKey: resendApiKey });
            const db = getDb();
            const accommodationModel = new AccommodationModel();
            const userModel = new UserModel();

            // ---------------------------------------------------------------
            // Phase 1 (continued) — resolve each due schedule. No transaction,
            // no advisory lock — only the read-only queries the original loop
            // already made.
            // ---------------------------------------------------------------
            const resolved: ResolvedNotification[] = [];

            for (const schedule of dueSchedules) {
                try {
                    const item = await resolveNotification({
                        schedule,
                        db,
                        accommodationModel,
                        userModel,
                        logger
                    });
                    if (item) {
                        resolved.push(item);
                    } else {
                        errors++;
                    }
                } catch (itemError) {
                    errors++;
                    logger.error('Unexpected error resolving schedule', {
                        scheduleId: schedule.id,
                        error: itemError instanceof Error ? itemError.message : String(itemError)
                    });
                }
            }

            // ---------------------------------------------------------------
            // Phase 2 — dispatch emails. No transaction, no advisory lock.
            // Guarded per-schedule by an atomic Redis claim.
            // ---------------------------------------------------------------
            const toAdvance: Array<{ scheduleId: string; streakCount: number }> = [];

            for (const item of resolved) {
                const { scheduleId } = item;
                try {
                    const claimed = await claimDispatch(scheduleId);
                    if (!claimed) {
                        logger.debug('Schedule already claimed by another run — skipping', {
                            scheduleId
                        });
                        continue;
                    }

                    const emailResult = await sendEmail({
                        client: emailClient,
                        to: item.recipientEmail,
                        subject: item.subject,
                        react: item.emailTemplate
                    });

                    if (!emailResult.success) {
                        logger.error('Failed to send notification email', {
                            scheduleId,
                            error: emailResult.error
                        });
                        errors++;
                        // Do NOT advance streak on failure — release the claim so
                        // the schedule is retried next tick instead of waiting out
                        // the full Redis TTL.
                        await releaseClaim(scheduleId);
                        continue;
                    }

                    toAdvance.push({ scheduleId, streakCount: item.streakCount });
                    processed++;

                    logger.debug('Notification email dispatched', {
                        scheduleId,
                        recipientSide: item.recipientSide,
                        streak: item.streakCount,
                        messageId: emailResult.messageId
                    });
                } catch (itemError) {
                    errors++;
                    logger.error('Unexpected error dispatching schedule', {
                        scheduleId,
                        error: itemError instanceof Error ? itemError.message : String(itemError)
                    });
                    await releaseClaim(scheduleId);
                }
            }

            // ---------------------------------------------------------------
            // Phase 3 — persist streak advances. Short transaction; advisory
            // lock is the FIRST statement. No external I/O in this phase, so
            // it can never sit idle waiting on the email provider.
            // ---------------------------------------------------------------
            const cronResult = await withTransaction<CronTransactionResult>(async (tx) => {
                const lockResult = await tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_ID}) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                let advanceErrors = 0;

                for (const { scheduleId, streakCount } of toAdvance) {
                    const advanceResult = await schedSvc.advanceSchedule(
                        SYSTEM_ACTOR,
                        { scheduleId, currentStreakCount: streakCount },
                        { tx }
                    );

                    if (advanceResult.error) {
                        advanceErrors++;
                        logger.warn('Failed to advance notification schedule streak', {
                            scheduleId,
                            error: advanceResult.error.message
                        });
                    } else if (advanceResult.data === null) {
                        logger.debug('Schedule cancelled after streak 3', { scheduleId });
                    }
                }

                return { skipped: false, advanceErrors };
            });

            if (cronResult.skipped) {
                // Another run holds the advisory lock. Emails already sent in
                // phase 2 are not re-sent (their Redis claims are set), but
                // this run's streak advances are deferred/lost for this tick —
                // accepted trade-off, see module doc-comment. No retry queue.
                logger.warn(
                    'conversation-notification cron: skipping — previous run holds advisory lock'
                );
                return {
                    success: true,
                    message: 'Skipped — another instance is already running',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            errors += cronResult.advanceErrors;

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('conversation-notification cron completed', {
                processed,
                errors,
                durationMs
            });

            return {
                success: true,
                message: `Dispatched ${processed} notification(s), ${errors} error(s)`,
                processed,
                errors,
                durationMs,
                details: { dueCount: dueSchedules.length }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            errors++;

            logger.error('conversation-notification cron failed with unhandled error', {
                error: errorMessage,
                stack: errorStack
            });

            return {
                success: false,
                message: `Failed: ${errorMessage}`,
                processed,
                errors,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage }
            };
        }
    }
};
