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
 * ## Why email dispatch never shares a transaction with the DB write (HOS-129)
 *
 * `sendEmail` makes an HTTP call to Brevo per due token. An earlier
 * implementation ran BOTH `findDueReminders` queries AND both per-window send
 * loops inside a single `withTransaction` callback whose first statement was
 * `pg_try_advisory_xact_lock(43021)` — so a slow/unresponsive email provider
 * held one DB connection open for the whole run (up to 400 tokens across two
 * windows), the same `idle_in_transaction_session_timeout` risk already fixed
 * in `conversation-notification.job.ts` (HOS-112) and documented on
 * `destination-weather-fetch.job.ts`. This job now runs two phases with the
 * persist step folded into the dispatch loop, per-token:
 *
 *  1. **Resolve** (`findDueReminders` + per-token reads via
 *     `resolveTokenContext`) — no transaction, no lock. Builds an in-memory
 *     list of tokens due for each window.
 *  2. **Dispatch + persist** — for each due token, sequentially:
 *     - `await sendEmail(...)` — no transaction open, no lock held.
 *     - On failure: count an error, log it, and move to the next token. No
 *       stamp is written, so the token remains due and is retried on the next
 *       daily run.
 *     - On success: IMMEDIATELY persist that one token's `*_reminder_sent_at`
 *       stamp via `AccessTokenService.markReminderSent`, in its OWN short
 *       `withTransaction` call, right here in the loop — before moving on to
 *       the next token. The stamp for a sent email can never be dropped as
 *       part of a larger batch, because there is no larger batch — each
 *       send/stamp pair is atomic-in-effect at the granularity that matters
 *       (one token).
 *
 * ## There is no advisory lock in this job anymore
 *
 * Lock `43021` (see `packages/db/docs/advisory-locks.md`) has been REMOVED
 * from this job — it is reserved but no longer acquired anywhere in this
 * file. Unlike `conversation-notification.job.ts` (HOS-112), this job has no
 * Redis idempotency claim at all: the durable dedup guard is the
 * `*_reminder_sent_at` DB column itself, checked by `findDueReminders`'
 * `IS NULL` filter. Two overlapping daily runs would each read the same
 * "not yet reminded" tokens and could both send once before either stamps —
 * a narrow race — but this job's own 24h cadence (`0 9 * * *`, non-overlapping
 * in practice) makes that window effectively theoretical, and a duplicate
 * reminder email is a low-severity outcome (same conclusion HOS-112 reached
 * for lock `43020`: the lock added serialization overhead without closing a
 * gap worth the tradeoff of holding it across external HTTP calls).
 *
 * ## Residual risk (accepted, no retry queue)
 *
 * A hard process crash between a successful `sendEmail` and that SAME
 * token's stamp-transaction commit leaves the token un-stamped, so it is
 * "due" again on the next daily run — one duplicate email. This is accepted
 * (same tradeoff HOS-112 made for the notification job): a rare duplicate is
 * preferable to building a retry queue for a non-critical reminder email.
 * There is no catch-up mechanism for this case — it is a narrow, logged
 * (`warn`), single-token blast radius, not a batch-wide one.
 *
 * Schedule: daily at 09:00 UTC (6:00 AM Argentina time).
 *
 * @module cron/jobs/conversation-token-reminder
 */

import {
    AccommodationModel,
    getDb,
    type SelectConversationAccessToken,
    withTransaction
} from '@repo/db';
import { createEmailClient, sendEmail } from '@repo/email';
import {
    ConversationTokenExpiringDay15,
    ConversationTokenExpiringDay25
} from '@repo/notifications';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { AccessTokenService } from '@repo/service-core';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobContext, CronJobDefinition } from '../types.js';
import { resolveTokenContext } from './conversation-token-reminder.resolve.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of tokens processed per run (per window). */
const MAX_BATCH_SIZE = 200;

/** The two reminder windows this job dispatches. */
type ReminderType = 'day15' | 'day25';

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
// Per-token dispatch + persist
// ---------------------------------------------------------------------------

/** Outcome of one token's dispatch-and-persist attempt. */
interface DispatchOutcome {
    /** Whether `sendEmail` reported success for this token. */
    readonly sent: boolean;
    /** Whether persisting the `*_reminder_sent_at` stamp failed AFTER a successful send. */
    readonly markFailed: boolean;
}

/** Dependencies + data needed to dispatch and persist one token's reminder. */
interface DispatchTokenReminderInput {
    readonly tokenId: string;
    readonly reminderType: ReminderType;
    readonly recipientEmail: string;
    readonly subject: string;
    readonly emailTemplate: ReturnType<typeof ConversationTokenExpiringDay15>;
    readonly emailClient: ReturnType<typeof createEmailClient>;
    readonly accessTokenSvc: AccessTokenService;
    readonly logger: CronJobContext['logger'];
}

/**
 * Sends one token's reminder email and, on success, immediately persists its
 * `*_reminder_sent_at` stamp in its own short transaction — no advisory lock,
 * no batching across tokens. See the module doc-comment for the full
 * two-phase rationale (HOS-129).
 *
 * A failed send returns `{ sent: false, markFailed: false }` and writes no
 * stamp, so the token stays due and is retried on the next daily run. A
 * successful send that fails to persist its stamp (DB error mid-transaction)
 * returns `{ sent: true, markFailed: true }` — logged as a `warn`, never
 * rethrown; the token is accepted as "may re-send once more" (see module
 * doc-comment residual risk).
 *
 * @param input - Token/email data plus the dependencies needed to send and persist.
 * @returns The dispatch outcome for the caller to fold into its counters.
 */
async function dispatchTokenReminder(input: DispatchTokenReminderInput): Promise<DispatchOutcome> {
    const {
        tokenId,
        reminderType,
        recipientEmail,
        subject,
        emailTemplate,
        emailClient,
        accessTokenSvc,
        logger
    } = input;

    const emailResult = await sendEmail({
        client: emailClient,
        to: recipientEmail,
        subject,
        react: emailTemplate
    });

    if (!emailResult.success) {
        logger.error(`Failed to send ${reminderType} token reminder`, {
            tokenId,
            error: emailResult.error
        });
        return { sent: false, markFailed: false };
    }

    logger.debug(`${reminderType} token reminder dispatched`, {
        tokenId,
        messageId: emailResult.messageId
    });

    // Persist THIS token's reminder-sent stamp right now, in its own short
    // transaction — the core HOS-129 fix. No batching across tokens, so a
    // crash window here can orphan at most this one token (see module
    // doc-comment).
    try {
        const markResult = await withTransaction((tx) =>
            accessTokenSvc.markReminderSent(SYSTEM_ACTOR, { tokenId, reminderType }, { tx })
        );
        if (markResult.error) {
            logger.warn('Failed to mark reminder as sent', {
                tokenId,
                reminderType,
                error: markResult.error.message
            });
            return { sent: true, markFailed: true };
        }
    } catch (persistError) {
        logger.warn('Failed to persist reminder-sent stamp after send', {
            tokenId,
            reminderType,
            error: persistError instanceof Error ? persistError.message : String(persistError)
        });
        return { sent: true, markFailed: true };
    }

    return { sent: true, markFailed: false };
}

// ---------------------------------------------------------------------------
// Job definition
// ---------------------------------------------------------------------------

/**
 * Conversation token reminder cron job.
 *
 * Schedule: daily at 09:00 UTC
 * Advisory lock: none (removed HOS-129 — see module doc-comment; the
 * `*_reminder_sent_at` DB column is the durable dedup guard).
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
            logger.info('Starting conversation-token-reminder cron', {
                dryRun,
                startedAt: startedAt.toISOString()
            });

            const accessTokenSvc = new AccessTokenService({ logger: apiLogger });

            // -----------------------------------------------------------
            // Phase 0 — find due tokens for both windows. No transaction,
            // no advisory lock.
            // -----------------------------------------------------------
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

            let day15Sent = 0;
            let day25Sent = 0;

            // -----------------------------------------------------------
            // Phase 1 — resolve + dispatch + persist, per token. No
            // transaction, no advisory lock is ever open while
            // `sendEmail` runs — see module doc-comment for the HOS-129
            // rationale.
            // -----------------------------------------------------------
            const processWindow = async (
                tokens: SelectConversationAccessToken[],
                reminderType: ReminderType,
                subjectFor: (accommodationName: string) => string,
                templateFor: (params: {
                    accommodationName: string;
                    renewUrl: string;
                    expiryDate: string;
                    locale: 'es' | 'en' | 'pt';
                }) => ReturnType<typeof ConversationTokenExpiringDay15>
            ): Promise<number> => {
                let sentCount = 0;

                for (const token of tokens) {
                    try {
                        const resolved = await resolveTokenContext({
                            tokenId: token.id,
                            conversationId: token.conversationId,
                            db,
                            accommodationModel,
                            logger
                        });
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

                        const outcome = await dispatchTokenReminder({
                            tokenId: token.id,
                            reminderType,
                            recipientEmail,
                            subject: subjectFor(accommodationName),
                            emailTemplate: templateFor({
                                accommodationName,
                                renewUrl,
                                expiryDate,
                                locale
                            }),
                            emailClient,
                            accessTokenSvc,
                            logger
                        });

                        if (!outcome.sent) {
                            errors++;
                            continue;
                        }
                        if (outcome.markFailed) {
                            errors++;
                        }

                        sentCount++;
                        processed++;
                    } catch (itemError) {
                        errors++;
                        logger.error(`Unexpected error processing ${reminderType} token reminder`, {
                            tokenId: token.id,
                            error:
                                itemError instanceof Error ? itemError.message : String(itemError)
                        });
                    }
                }

                return sentCount;
            };

            day15Sent = await processWindow(
                day15Tokens,
                'day15',
                (accommodationName) =>
                    `Tu enlace de acceso vence en 15 días — ${accommodationName}`,
                ({ accommodationName, renewUrl, expiryDate, locale }) =>
                    ConversationTokenExpiringDay15({
                        accommodationName,
                        renewUrl,
                        expiryDate,
                        locale
                    })
            );

            day25Sent = await processWindow(
                day25Tokens,
                'day25',
                (accommodationName) =>
                    `¡Último aviso! Tu enlace vence en 5 días — ${accommodationName}`,
                ({ accommodationName, renewUrl, expiryDate, locale }) =>
                    ConversationTokenExpiringDay25({
                        accommodationName,
                        renewUrl,
                        expiryDate,
                        locale
                    })
            );

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('conversation-token-reminder cron completed', {
                day15Sent,
                day25Sent,
                errors,
                durationMs
            });

            return {
                success: true,
                message: `Sent day15=${day15Sent}, day25=${day25Sent}, errors=${errors}`,
                processed,
                errors,
                durationMs,
                details: { day15Sent, day25Sent }
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
