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
 * Features:
 * - PostgreSQL advisory lock (lock ID 43020) prevents overlapping runs.
 * - Per-schedule Redis idempotency key (`conv:notif:{scheduleId}`, TTL 10 min)
 *   prevents duplicate dispatch when the cron restarts quickly.
 * - Streak >= 3 at dispatch: `advanceSchedule` cancels the schedule.
 * - Email send failure does NOT advance the streak (retry next run).
 *
 * @module cron/jobs/conversation-notification
 */

import {
    AccommodationModel,
    UserModel,
    conversations,
    getDb,
    messages,
    sql,
    withTransaction
} from '@repo/db';
import { createEmailClient, sendEmail } from '@repo/email';
import { ConversationNewMessage, ConversationNewMessageAnon } from '@repo/notifications';
import { NotificationRecipientSideEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { NotificationScheduleService } from '@repo/service-core';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import { getRedisClient } from '../../utils/redis.js';
import type { CronJobDefinition } from '../types.js';

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

/** Maximum number of recent message excerpts included in the email body. */
const MAX_MESSAGE_EXCERPTS = 3;

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
// Idempotency helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when a Redis key for this scheduleId already exists,
 * meaning the schedule was dispatched within the last 10 minutes.
 */
async function isAlreadyDispatched(scheduleId: string): Promise<boolean> {
    try {
        const redis = await getRedisClient();
        if (redis) {
            const exists = await redis.exists(`${REDIS_IDEMPOTENCY_PREFIX}${scheduleId}`);
            return exists === 1;
        }
    } catch {
        // Redis unavailable — fall through, allow dispatch
    }
    return false;
}

/**
 * Marks a schedule as dispatched in Redis with a 10-minute TTL.
 */
async function markDispatched(scheduleId: string): Promise<void> {
    try {
        const redis = await getRedisClient();
        if (redis) {
            await redis.set(
                `${REDIS_IDEMPOTENCY_PREFIX}${scheduleId}`,
                '1',
                'EX',
                REDIS_IDEMPOTENCY_TTL_S
            );
        }
    } catch {
        // Non-critical
    }
}

// ---------------------------------------------------------------------------
// Discriminated union for withTransaction return
// ---------------------------------------------------------------------------

type CronTransactionResult =
    | { readonly skipped: true }
    | {
          readonly skipped: false;
          readonly success: boolean;
          readonly message: string;
          readonly processed: number;
          readonly errors: number;
          readonly durationMs: number;
          readonly details?: Record<string, unknown>;
      };

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
            const cronResult = await withTransaction<CronTransactionResult>(async (_tx) => {
                // Acquire advisory lock to prevent overlapping runs
                const lockResult = await _tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_ID}) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                logger.info('Starting conversation-notification cron', {
                    dryRun,
                    startedAt: startedAt.toISOString()
                });

                const schedSvc = new NotificationScheduleService({ logger: apiLogger });

                // Find all due notification schedules
                const dueResult = await schedSvc.findDue(SYSTEM_ACTOR, { now: new Date() });

                if (dueResult.error) {
                    logger.error('Failed to query due notification schedules', {
                        error: dueResult.error.message
                    });
                    return {
                        skipped: false,
                        success: false,
                        message: `Failed to query schedules: ${dueResult.error.message}`,
                        processed: 0,
                        errors: 1,
                        durationMs: Date.now() - startedAt.getTime()
                    };
                }

                const dueSchedules = (dueResult.data ?? []).slice(0, MAX_BATCH_SIZE);

                logger.info('Due notification schedules found', {
                    total: dueSchedules.length
                });

                if (dryRun) {
                    logger.info('Dry run — skipping email dispatch', {
                        wouldProcess: dueSchedules.length
                    });
                    return {
                        skipped: false,
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
                        skipped: false,
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

                for (const schedule of dueSchedules) {
                    const scheduleId = schedule.id;

                    try {
                        // Redis idempotency guard
                        if (await isAlreadyDispatched(scheduleId)) {
                            logger.debug('Schedule already dispatched recently — skipping', {
                                scheduleId
                            });
                            continue;
                        }

                        // Fetch conversation (skip if soft-deleted)
                        const convRows = await db
                            .select()
                            .from(conversations)
                            .where(
                                and(
                                    eq(conversations.id, schedule.conversationId),
                                    isNull(conversations.deletedAt)
                                )
                            )
                            .limit(1);

                        const conversation = convRows[0];
                        if (!conversation) {
                            logger.warn('Conversation not found or deleted — skipping schedule', {
                                scheduleId,
                                conversationId: schedule.conversationId
                            });
                            errors++;
                            continue;
                        }

                        // Fetch accommodation
                        const accommodation = await accommodationModel.findById(
                            conversation.accommodationId
                        );
                        if (!accommodation) {
                            logger.warn('Accommodation not found for conversation', {
                                scheduleId,
                                accommodationId: conversation.accommodationId
                            });
                            errors++;
                            continue;
                        }

                        const accommodationName = accommodation.name ?? accommodation.slug;

                        // Fetch recent message excerpts
                        const recentMessages = await db
                            .select({ body: messages.body, createdAt: messages.createdAt })
                            .from(messages)
                            .where(eq(messages.conversationId, schedule.conversationId))
                            .orderBy(desc(messages.createdAt))
                            .limit(MAX_MESSAGE_EXCERPTS);

                        const messageExcerpts = recentMessages.reverse().map((m) => ({
                            excerpt: m.body,
                            timestamp: m.createdAt.toLocaleString('es-AR', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                            })
                        }));

                        // Determine recipient email and CTA URL
                        const isGuestRecipient =
                            schedule.recipientSide === NotificationRecipientSideEnum.GUEST;

                        let recipientEmail: string | null = null;
                        let guestIdentity: string;
                        let ctaUrl: string;
                        let isAnonymous = false;

                        if (isGuestRecipient) {
                            if (conversation.userId) {
                                // Authenticated guest
                                const user = await userModel.findById(conversation.userId);
                                recipientEmail = user?.email ?? null;
                                guestIdentity = user?.displayName ?? user?.email ?? 'Invitado';
                                ctaUrl = `${env.HOSPEDA_SITE_URL}/es/mensajes/${schedule.conversationId}`;
                            } else if (conversation.anonymousEmail) {
                                // Anonymous guest
                                isAnonymous = true;
                                recipientEmail = conversation.anonymousEmail;
                                guestIdentity =
                                    conversation.anonymousName ?? conversation.anonymousEmail;
                                ctaUrl = `${env.HOSPEDA_SITE_URL}/guest/messages/${schedule.conversationId}`;
                            } else {
                                logger.warn('Anonymous guest has no email — skipping schedule', {
                                    scheduleId
                                });
                                errors++;
                                continue;
                            }
                        } else {
                            // Owner recipient — use accommodation owner
                            const ownerId = accommodation.ownerId;
                            if (!ownerId) {
                                logger.warn('Accommodation has no ownerId — skipping schedule', {
                                    scheduleId,
                                    accommodationId: conversation.accommodationId
                                });
                                errors++;
                                continue;
                            }
                            const owner = await userModel.findById(ownerId);
                            recipientEmail = owner?.email ?? null;
                            guestIdentity =
                                conversation.anonymousName ??
                                conversation.anonymousEmail ??
                                'Huésped';
                            ctaUrl = `${env.HOSPEDA_SITE_URL}/es/mensajes/${schedule.conversationId}`;
                        }

                        if (!recipientEmail) {
                            logger.warn('No recipient email resolved — skipping schedule', {
                                scheduleId,
                                conversationId: schedule.conversationId,
                                recipientSide: schedule.recipientSide
                            });
                            errors++;
                            continue;
                        }

                        // Build email template
                        const locale =
                            (conversation.locale as 'es' | 'en' | 'pt' | undefined) ?? 'es';
                        const emailTemplate = isAnonymous
                            ? ConversationNewMessageAnon({
                                  accommodationName,
                                  guestIdentity,
                                  messages: messageExcerpts,
                                  ctaUrl,
                                  locale
                              })
                            : ConversationNewMessage({
                                  accommodationName,
                                  guestIdentity,
                                  messages: messageExcerpts,
                                  ctaUrl,
                                  locale
                              });

                        // Dispatch email
                        const emailResult = await sendEmail({
                            client: emailClient,
                            to: recipientEmail,
                            subject: `Nuevo mensaje sobre ${accommodationName}`,
                            react: emailTemplate
                        });

                        if (!emailResult.success) {
                            logger.error('Failed to send notification email', {
                                scheduleId,
                                error: emailResult.error
                            });
                            errors++;
                            // Do NOT advance streak on failure — retry next run
                            continue;
                        }

                        // Mark dispatched in Redis before advancing streak
                        await markDispatched(scheduleId);

                        // Advance streak (or cancel schedule if streak >= 3)
                        const advanceResult = await schedSvc.advanceSchedule(SYSTEM_ACTOR, {
                            scheduleId,
                            currentStreakCount: schedule.streakCount
                        });

                        if (advanceResult.error) {
                            logger.warn('Failed to advance notification schedule streak', {
                                scheduleId,
                                error: advanceResult.error.message
                            });
                        } else if (advanceResult.data === null) {
                            logger.debug('Schedule cancelled after streak 3', { scheduleId });
                        }

                        processed++;

                        logger.debug('Notification email dispatched', {
                            scheduleId,
                            recipientSide: schedule.recipientSide,
                            streak: schedule.streakCount,
                            messageId: emailResult.messageId
                        });
                    } catch (itemError) {
                        errors++;
                        logger.error('Unexpected error processing schedule', {
                            scheduleId,
                            error:
                                itemError instanceof Error ? itemError.message : String(itemError)
                        });
                    }
                }

                const durationMs = Date.now() - startedAt.getTime();

                logger.info('conversation-notification cron completed', {
                    processed,
                    errors,
                    durationMs
                });

                return {
                    skipped: false,
                    success: true,
                    message: `Dispatched ${processed} notification(s), ${errors} error(s)`,
                    processed,
                    errors,
                    durationMs,
                    details: { dueCount: dueSchedules.length }
                };
            });

            if (cronResult.skipped) {
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

            return {
                success: cronResult.success,
                message: cronResult.message,
                processed: cronResult.processed,
                errors: cronResult.errors,
                durationMs: cronResult.durationMs,
                ...(cronResult.details ? { details: cronResult.details } : {})
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
