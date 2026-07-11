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
 * ## Why email dispatch never shares a transaction with the DB write (HOS-112)
 *
 * `sendEmail` makes an HTTP call to Brevo per due schedule. An earlier
 * implementation ran that call INSIDE a `pg_try_advisory_xact_lock(43020)`
 * transaction that also persisted every schedule's streak advance in one
 * batch at the end — so a slow/unresponsive provider held a DB connection
 * for the whole batch (the same `idle_in_transaction_session_timeout` risk
 * documented on `destination-weather-fetch.job.ts`), AND, worse, if the
 * batched persist transaction's `try`-lock lost to a concurrent run, the
 * ENTIRE batch of streak advances was silently dropped even though every one
 * of those emails had already been sent — the schedules stayed "due" and
 * were re-sent (duplicated) once their Redis claim TTL lapsed. This job now
 * runs two logical phases with the persist step folded into the dispatch
 * loop, per-schedule:
 *
 *  1. **Resolve** (`findDue` + per-schedule reads) — no transaction, no lock.
 *     Builds an in-memory list of everything needed to send each email.
 *  2. **Dispatch + persist** — for each due schedule, sequentially:
 *     - Claim it atomically in Redis: `SET conv:notif:{scheduleId} 1 NX EX
 *       600`. This is what actually prevents a double-send across
 *       overlapping runs/ticks — NOT a Postgres advisory lock. A schedule
 *       already claimed by another run is skipped silently.
 *     - `await sendEmail(...)` — no transaction open, no lock held.
 *     - On failure: release the claim (`DEL`) so the schedule retries next
 *       tick instead of waiting out the full TTL. No advance is persisted.
 *     - On success: IMMEDIATELY persist that one schedule's streak advance
 *       in its OWN short `withTransaction` call, right here in the loop —
 *       before moving on to the next schedule. This is the fix: the advance
 *       for a sent email can never be dropped as part of a larger batch,
 *       because there is no larger batch — each send/advance pair is
 *       atomic-in-effect at the granularity that matters (one schedule).
 *
 * ## There is no advisory lock in this job anymore
 *
 * Lock `43020` (see `packages/db/docs/advisory-locks.md`) has been REMOVED
 * from this job — it is reserved but no longer acquired anywhere in this
 * file. Two things make it redundant here:
 *
 * - The atomic Redis claim (`SET NX EX`) already serializes per-schedule
 *   ownership across overlapping runs — only one run/tick ever claims a
 *   given schedule, so at most one run ever sends and advances it.
 * - `advanceSchedule`'s double-advance guard (AC-10, in
 *   `packages/service-core/.../notification-schedule.service.ts`) is the
 *   DB-level safety net for the case Redis fails open (outage) and two runs
 *   somehow race on the same schedule anyway — it re-reads the row and
 *   refuses to advance (or re-cancel) a schedule that already moved past the
 *   caller-observed state.
 *
 * With those two guards already covering correctness, an advisory lock would
 * only add serialization overhead without closing any remaining gap — which
 * is exactly why the spec calls it "largely redundant" (HOS-112 OQ-2).
 *
 * ## Residual risk (accepted, no retry queue — NG-2)
 *
 * A hard process crash between a successful `sendEmail` and that SAME
 * schedule's advance-transaction commit orphans exactly that ONE schedule:
 * its Redis claim is set (so it won't re-send until the ~10-minute TTL
 * expires) but its `pendingNotificationAt` never moved, so once the claim
 * expires it becomes "due" again and gets re-sent — one duplicate email.
 * This is accepted (owner decision, 2026-07-10): a rare duplicate here is
 * preferable to building a retry queue for a non-critical notification
 * email. There is no catch-up mechanism for this case — it is a narrow,
 * logged (`warn`), single-schedule blast radius, not a batch-wide one.
 *
 * @module cron/jobs/conversation-notification
 */

import { AccommodationModel, getDb, UserModel, withTransaction } from '@repo/db';
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
// Job definition
// ---------------------------------------------------------------------------

/**
 * Conversation notification cron job.
 *
 * Schedule: every 5 minutes
 * Advisory lock: none (removed HOS-112 — see module doc-comment; the atomic
 * Redis claim + `advanceSchedule`'s double-advance guard cover correctness).
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
            const dueResult = await schedSvc.findDue(SYSTEM_ACTOR, {
                now: new Date(),
                limit: MAX_BATCH_SIZE
            });

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

            // The batch cap is enforced in SQL (ORDER BY pending_notification_at
            // ASC LIMIT MAX_BATCH_SIZE) inside findDue, so no JS slice is needed
            // here — overflow rows drain deterministically on the next run (HOS-133).
            const dueSchedules = dueResult.data ?? [];

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
            // Phase 2 — dispatch emails and persist each successful send's
            // streak advance immediately. No batched write phase, no
            // advisory lock — see module doc-comment for the HOS-112
            // rationale (the batched phase-3 transaction this replaced could
            // drop an entire batch of advances on lock contention, causing
            // duplicate sends after the Redis TTL).
            // ---------------------------------------------------------------
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

                    logger.debug('Notification email dispatched', {
                        scheduleId,
                        recipientSide: item.recipientSide,
                        streak: item.streakCount,
                        messageId: emailResult.messageId
                    });

                    // Persist THIS schedule's streak advance right now, in its
                    // own short transaction — the core HOS-112 fix. No batching
                    // across schedules, so a crash window here can orphan at
                    // most this one schedule (see module doc-comment).
                    try {
                        const advanceResult = await withTransaction((tx) =>
                            schedSvc.advanceSchedule(
                                SYSTEM_ACTOR,
                                { scheduleId, currentStreakCount: item.streakCount },
                                { tx }
                            )
                        );
                        if (advanceResult.error) {
                            errors++;
                            logger.warn('Failed to advance notification schedule streak', {
                                scheduleId,
                                error: advanceResult.error.message
                            });
                        } else if (advanceResult.data === null) {
                            logger.debug('Schedule cancelled after streak 3', { scheduleId });
                        }
                    } catch (advErr) {
                        // Advance failed AFTER the email was sent — the schedule stays due and
                        // will be re-sent (a duplicate) once the Redis claim TTL lapses. Rare
                        // (needs a DB failure mid-persist); logged so it is visible. No retry queue.
                        errors++;
                        logger.warn('Failed to persist streak advance after send', {
                            scheduleId,
                            error: advErr instanceof Error ? advErr.message : String(advErr)
                        });
                    }

                    processed++;
                } catch (itemError) {
                    errors++;
                    logger.error('Unexpected error dispatching schedule', {
                        scheduleId,
                        error: itemError instanceof Error ? itemError.message : String(itemError)
                    });
                    await releaseClaim(scheduleId);
                }
            }

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
