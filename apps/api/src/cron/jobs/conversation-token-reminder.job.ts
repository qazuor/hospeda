/**
 * Conversation Token Reminder Cron Job
 *
 * Sends expiry reminder emails to anonymous guests whose conversation access
 * tokens are approaching their 30-day expiry deadline.
 *
 * Two reminder windows (relative to `expiresAt` from `now`):
 * - Day-15 reminder: token expires in ~15 days (`[now+14d, now+16d]`).
 *   Template: `ConversationTokenExpiringDay15`
 * - Day-25 reminder: token expires in ~5 days (`[now+4d, now+6d]`).
 *   Template: `ConversationTokenExpiringDay25`
 *
 * Once a reminder is sent the corresponding `*_reminder_sent_at` column is
 * stamped by `AccessTokenService.markReminderSent`, preventing future runs
 * from re-sending the same email.
 *
 * Schedule: daily at 09:00 UTC (6:00 AM Argentina time).
 * Advisory lock: 43021
 *
 * @module cron/jobs/conversation-token-reminder
 */

import { AccommodationModel, conversations, getDb, sql, withTransaction } from '@repo/db';
import { createEmailClient, sendEmail } from '@repo/email';
import {
    ConversationTokenExpiringDay15,
    ConversationTokenExpiringDay25
} from '@repo/notifications';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { AccessTokenService } from '@repo/service-core';
import { and, eq, isNull } from 'drizzle-orm';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** PostgreSQL advisory lock ID reserved for this job. */
const ADVISORY_LOCK_ID = 43021;

/** Maximum number of tokens processed per run. */
const MAX_BATCH_SIZE = 200;

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
 * Conversation token reminder cron job.
 *
 * Schedule: daily at 09:00 UTC
 * Advisory lock: 43021
 */
export const conversationTokenReminderJob: CronJobDefinition = {
    name: 'conversation-token-reminder',
    description: 'Send day-15 and day-25 expiry reminder emails for anonymous guest access tokens',
    schedule: '0 9 * * *',
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

                logger.info('Starting conversation-token-reminder cron', {
                    dryRun,
                    startedAt: startedAt.toISOString()
                });

                const accessTokenSvc = new AccessTokenService({ logger: apiLogger });

                // Fetch tokens due for both reminder windows
                const [day15Result, day25Result] = await Promise.all([
                    accessTokenSvc.findDueReminders(SYSTEM_ACTOR, { reminderType: 'day15' }),
                    accessTokenSvc.findDueReminders(SYSTEM_ACTOR, { reminderType: 'day25' })
                ]);

                if (day15Result.error) {
                    logger.error('Failed to query day-15 due reminder tokens', {
                        error: day15Result.error.message
                    });
                }
                if (day25Result.error) {
                    logger.error('Failed to query day-25 due reminder tokens', {
                        error: day25Result.error.message
                    });
                }

                const day15Tokens = (day15Result.data ?? []).slice(0, MAX_BATCH_SIZE);
                const day25Tokens = (day25Result.data ?? []).slice(0, MAX_BATCH_SIZE);

                logger.info('Token reminder candidates', {
                    day15Count: day15Tokens.length,
                    day25Count: day25Tokens.length
                });

                if (dryRun) {
                    logger.info('Dry run — skipping email dispatch', {
                        wouldProcessDay15: day15Tokens.length,
                        wouldProcessDay25: day25Tokens.length
                    });
                    return {
                        skipped: false,
                        success: true,
                        message: `Dry run: day15=${day15Tokens.length}, day25=${day25Tokens.length}`,
                        processed: 0,
                        errors: 0,
                        durationMs: Date.now() - startedAt.getTime(),
                        details: {
                            dryRun: true,
                            day15Count: day15Tokens.length,
                            day25Count: day25Tokens.length
                        }
                    };
                }

                // Email client — bail early if not configured
                const emailApiKey = env.HOSPEDA_EMAIL_API_KEY;
                if (!emailApiKey) {
                    logger.warn(
                        'HOSPEDA_EMAIL_API_KEY not configured — skipping token reminder dispatch'
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

                const emailClient = createEmailClient({ apiKey: emailApiKey });
                const db = getDb();
                const accommodationModel = new AccommodationModel();

                // Helper: resolve recipient email and accommodation name for a token
                const resolveTokenContext = async (
                    tokenId: string,
                    conversationId: string
                ): Promise<{
                    recipientEmail: string;
                    accommodationName: string;
                    locale: 'es' | 'en' | 'pt';
                } | null> => {
                    const convRows = await db
                        .select()
                        .from(conversations)
                        .where(
                            and(
                                eq(conversations.id, conversationId),
                                isNull(conversations.deletedAt)
                            )
                        )
                        .limit(1);

                    const conversation = convRows[0];
                    if (!conversation) {
                        logger.warn('Conversation not found or deleted — skipping token reminder', {
                            tokenId,
                            conversationId
                        });
                        return null;
                    }

                    const recipientEmail = conversation.anonymousEmail;
                    if (!recipientEmail) {
                        logger.warn(
                            'No anonymous email on conversation — skipping token reminder',
                            { tokenId, conversationId }
                        );
                        return null;
                    }

                    const accommodation = await accommodationModel.findById(
                        conversation.accommodationId
                    );
                    if (!accommodation) {
                        logger.warn('Accommodation not found — skipping token reminder', {
                            tokenId,
                            accommodationId: conversation.accommodationId
                        });
                        return null;
                    }

                    return {
                        recipientEmail,
                        accommodationName: accommodation.name ?? accommodation.slug,
                        locale: (conversation.locale as 'es' | 'en' | 'pt' | undefined) ?? 'es'
                    };
                };

                let day15Sent = 0;
                let day25Sent = 0;

                // Process day-15 reminders
                for (const token of day15Tokens) {
                    try {
                        const resolved = await resolveTokenContext(token.id, token.conversationId);
                        if (!resolved) {
                            errors++;
                            continue;
                        }

                        const { recipientEmail, accommodationName, locale } = resolved;
                        const renewUrl = `${env.HOSPEDA_SITE_URL}/guest/messages/${token.conversationId}`;
                        const expiryDate = token.expiresAt.toLocaleDateString('es-AR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });

                        const emailResult = await sendEmail({
                            client: emailClient,
                            to: recipientEmail,
                            subject: `Tu enlace de acceso vence en 15 días — ${accommodationName}`,
                            react: ConversationTokenExpiringDay15({
                                accommodationName,
                                renewUrl,
                                expiryDate,
                                locale
                            })
                        });

                        if (!emailResult.success) {
                            logger.error('Failed to send day-15 token reminder', {
                                tokenId: token.id,
                                error: emailResult.error
                            });
                            errors++;
                            continue;
                        }

                        // Stamp the reminder-sent column to prevent re-dispatch
                        const markResult = await accessTokenSvc.markReminderSent(SYSTEM_ACTOR, {
                            tokenId: token.id,
                            reminderType: 'day15'
                        });

                        if (markResult.error) {
                            logger.warn('Failed to mark day-15 reminder as sent', {
                                tokenId: token.id,
                                error: markResult.error.message
                            });
                        }

                        day15Sent++;
                        processed++;

                        logger.debug('Day-15 token reminder dispatched', {
                            tokenId: token.id,
                            messageId: emailResult.messageId
                        });
                    } catch (itemError) {
                        errors++;
                        logger.error('Unexpected error processing day-15 token reminder', {
                            tokenId: token.id,
                            error:
                                itemError instanceof Error ? itemError.message : String(itemError)
                        });
                    }
                }

                // Process day-25 reminders
                for (const token of day25Tokens) {
                    try {
                        const resolved = await resolveTokenContext(token.id, token.conversationId);
                        if (!resolved) {
                            errors++;
                            continue;
                        }

                        const { recipientEmail, accommodationName, locale } = resolved;
                        const renewUrl = `${env.HOSPEDA_SITE_URL}/guest/messages/${token.conversationId}`;
                        const expiryDate = token.expiresAt.toLocaleDateString('es-AR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });

                        const emailResult = await sendEmail({
                            client: emailClient,
                            to: recipientEmail,
                            subject: `¡Último aviso! Tu enlace vence en 5 días — ${accommodationName}`,
                            react: ConversationTokenExpiringDay25({
                                accommodationName,
                                renewUrl,
                                expiryDate,
                                locale
                            })
                        });

                        if (!emailResult.success) {
                            logger.error('Failed to send day-25 token reminder', {
                                tokenId: token.id,
                                error: emailResult.error
                            });
                            errors++;
                            continue;
                        }

                        const markResult = await accessTokenSvc.markReminderSent(SYSTEM_ACTOR, {
                            tokenId: token.id,
                            reminderType: 'day25'
                        });

                        if (markResult.error) {
                            logger.warn('Failed to mark day-25 reminder as sent', {
                                tokenId: token.id,
                                error: markResult.error.message
                            });
                        }

                        day25Sent++;
                        processed++;

                        logger.debug('Day-25 token reminder dispatched', {
                            tokenId: token.id,
                            messageId: emailResult.messageId
                        });
                    } catch (itemError) {
                        errors++;
                        logger.error('Unexpected error processing day-25 token reminder', {
                            tokenId: token.id,
                            error:
                                itemError instanceof Error ? itemError.message : String(itemError)
                        });
                    }
                }

                const durationMs = Date.now() - startedAt.getTime();

                logger.info('conversation-token-reminder cron completed', {
                    day15Sent,
                    day25Sent,
                    errors,
                    durationMs
                });

                return {
                    skipped: false,
                    success: true,
                    message: `Sent day15=${day15Sent}, day25=${day25Sent}, errors=${errors}`,
                    processed,
                    errors,
                    durationMs,
                    details: { day15Sent, day25Sent }
                };
            });

            if (cronResult.skipped) {
                logger.warn(
                    'conversation-token-reminder cron: skipping — previous run holds advisory lock'
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

            logger.error('conversation-token-reminder cron failed with unhandled error', {
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
