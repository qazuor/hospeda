/**
 * Alerts & Offers Daily Digest Cron Job (SPEC-286 T-007)
 *
 * Sends every subscribed tourist a single daily email summarizing:
 * - Accommodations they have a price-drop alert on that dropped past
 *   threshold in the evaluation window ({@link PriceDropEvaluatorService}, T-006).
 * - Active promo offers relevant to them ({@link PromoOfferEvaluatorService}, T-012).
 *
 * Schedule: '0 8 * * *' (8 AM daily).
 *
 * Design notes:
 * - Unlike `conversation-notification.job.ts`, this job does NOT use a
 *   Postgres advisory lock or a Redis idempotency key. That job runs every
 *   5 minutes and mutates a streak counter — a double-fire would corrupt
 *   that state. This job runs once daily and only sends an idempotent
 *   "here's what changed" summary; a rare double-fire means at most one
 *   duplicate email, not data corruption. Mirrors the simpler structure of
 *   `trial-expiry.ts` instead (no lock, no `withTransaction` wrapper).
 * - Users are batched in groups of {@link DIGEST_BATCH_SIZE} via `chunkArray`
 *   from `@repo/utils` before calling `AlertDigestDeliveryService.deliverBatch()`,
 *   to avoid holding the full email-send fan-out in a single unbounded loop.
 * - Dependencies (`PriceDropEvaluatorService`, `UserModel`,
 *   `AlertDigestDeliveryService`, ...) are constructed inline in the handler,
 *   same as `trial-expiry.ts`'s `new TrialService(...)`. Cron jobs in this
 *   codebase are plain `CronJobDefinition` objects, not classes — there is no
 *   constructor to inject through, so tests mock the imported modules
 *   directly (`vi.mock('@repo/service-core', ...)`, `vi.mock('@repo/db', ...)`,
 *   `vi.mock('@repo/notifications', ...)`) rather than passing a deps object
 *   into the handler, matching `conversation-notification.job.test.ts`.
 *
 * @module cron/jobs/alerts-digest
 */

import { UserModel } from '@repo/db';
import {
    AlertDigestDeliveryService,
    BrevoEmailTransport,
    EmailAlertChannel,
    createEmailClient
} from '@repo/notifications';
import type { AlertDigestPayload } from '@repo/notifications';
import { PriceDropEvaluatorService, PromoOfferEvaluatorService } from '@repo/service-core';
import { chunkArray } from '@repo/utils';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Width (in hours) of the evaluation window: "since this many hours before
 * the current run started". There is no established "since the last
 * successful cron run" pattern elsewhere in this codebase to reuse, so a
 * fixed 24h window is used instead — this matches the job's own 8 AM daily
 * schedule ("yesterday 8 AM to today 8 AM").
 */
const DIGEST_WINDOW_HOURS = 24;

/** Number of users delivered per `AlertDigestDeliveryService.deliverBatch()` call. */
const DIGEST_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Job definition
// ---------------------------------------------------------------------------

/**
 * Alerts & offers daily digest cron job.
 *
 * Schedule: daily at 8 AM (`0 8 * * *`).
 */
export const alertsDigestJob: CronJobDefinition = {
    name: 'alerts-digest',
    description: 'Send the daily price-drop and promo-offer digest email to subscribed tourists',
    schedule: '0 8 * * *',
    enabled: true,
    timeoutMs: 300000, // 5 minutes

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        let processed = 0;
        let errors = 0;

        logger.info('Starting alerts-digest cron', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            // Bail out early when email is not configured — mirrors the
            // billing-not-configured guard in trial-expiry.ts and the
            // email-not-configured guard in conversation-notification.job.ts.
            if (!env.HOSPEDA_EMAIL_API_KEY) {
                logger.warn(
                    'HOSPEDA_EMAIL_API_KEY not configured — skipping alerts-digest dispatch'
                );
                return {
                    success: true,
                    message: 'Skipped — email not configured',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            const since = new Date(startedAt.getTime() - DIGEST_WINDOW_HOURS * 60 * 60 * 1000);

            const priceDropEvaluator = new PriceDropEvaluatorService();
            const promoOfferEvaluator = new PromoOfferEvaluatorService();
            const userModel = new UserModel();

            const priceDropsByUser = await priceDropEvaluator.evaluatePriceDrops({ since });
            const promoOffersByUser = await promoOfferEvaluator.evaluatePromoOffers({ since });

            // Merge into one entry per user that has at least one match from
            // either evaluator. Neither evaluator ever stores an empty-array
            // entry for a user with no matches (per T-006's contract) — a
            // userId only appears in a map when it has >= 1 match — so the
            // union of both maps' keys can never itself contain a user whose
            // merged arrays are BOTH empty.
            const userIds = new Set<string>([
                ...priceDropsByUser.keys(),
                ...promoOffersByUser.keys()
            ]);

            if (userIds.size === 0) {
                logger.info('alerts-digest cron: no qualifying users found', {
                    durationMs: Date.now() - startedAt.getTime()
                });
                return {
                    success: true,
                    message: 'No qualifying price drops or promo offers found',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            if (dryRun) {
                logger.info('Dry run — skipping digest delivery', {
                    wouldProcess: userIds.size
                });
                return {
                    success: true,
                    message: `Dry run: would send digest to ${userIds.size} user(s)`,
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: { dryRun: true, wouldProcess: userIds.size }
                };
            }

            // Batch-fetch every candidate user in a single query rather than
            // one findById() round trip per user — mirrors the
            // AccommodationModel.findByIds() batching in
            // PriceDropEvaluatorService.evaluatePriceDrops().
            const users = await userModel.findByIds([...userIds]);
            const userById = new Map(users.map((user) => [user.id, user]));

            const payloads: AlertDigestPayload[] = [];

            for (const userId of userIds) {
                const user = userById.get(userId);
                if (!user?.email) {
                    logger.warn('Skipping digest — user not found or missing email', { userId });
                    errors++;
                    continue;
                }

                payloads.push({
                    userId,
                    userEmail: user.email,
                    locale: user.settings?.languageWeb ?? 'es',
                    priceDrop: priceDropsByUser.get(userId) ?? [],
                    promoOffers: promoOffersByUser.get(userId) ?? []
                });
            }

            const emailClient = createEmailClient({ apiKey: env.HOSPEDA_EMAIL_API_KEY });
            const emailTransport = new BrevoEmailTransport(emailClient, {
                fromEmail: env.HOSPEDA_EMAIL_FROM_EMAIL ?? 'noreply@hospeda.com.ar',
                fromName: env.HOSPEDA_EMAIL_FROM_NAME ?? 'Hospeda'
            });
            const emailAlertChannel = new EmailAlertChannel({ emailTransport, logger: apiLogger });
            const deliveryService = new AlertDigestDeliveryService({
                channels: [emailAlertChannel],
                logger: apiLogger
            });

            // `AlertDigestDeliveryService.deliver()` never throws — per-channel
            // errors are logged and swallowed internally (T-008). As a result
            // the `errors` counter below only tracks user-lookup failures
            // (missing user / missing email), not delivery failures. Delivery
            // failures are only observable via structured logs from
            // `AlertDigestDeliveryService`/`EmailAlertChannel`, not this
            // counter — documented tradeoff per the T-007 task text.
            for (const batch of chunkArray(payloads, DIGEST_BATCH_SIZE)) {
                await deliveryService.deliverBatch(batch);
                processed += batch.length;
            }

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('alerts-digest cron completed', {
                processed,
                errors,
                durationMs
            });

            return {
                success: true,
                message: `Sent digest to ${processed} user(s), ${errors} error(s)`,
                processed,
                errors,
                durationMs,
                details: { candidateCount: userIds.size }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            errors++;

            logger.error(
                'alerts-digest cron failed with unhandled error',
                { error: errorMessage, stack: errorStack },
                { capture: true }
            );

            return {
                success: false,
                message: `Failed to send alerts digest: ${errorMessage}`,
                processed,
                errors,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage }
            };
        }
    }
};
