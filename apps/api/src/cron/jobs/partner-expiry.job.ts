/**
 * Partner Expiry Cron Job (SPEC-271 T-271-12)
 *
 * Archives partners whose `endsAt` has passed and subscriptionStatus is still
 * ACTIVE. This is a backup safety net for when MP webhooks are missed — the
 * primary churn path is webhook → reconcilePartnerForSubscription, but this
 * cron catches partners that slip through (lost webhook, MP outage, etc.).
 *
 * Mirrors the sponsorship expiry pattern: uses the anticipatory composite
 * index `(lifecycleState, endsAt)` on the `partners` table.
 *
 * @module cron/jobs/partner-expiry
 */

import { PartnerModel } from '@repo/db';
import { LifecycleStatusEnum, PartnerSubscriptionStatusEnum } from '@repo/schemas';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition, CronJobResult } from '../types.js';

const BATCH_LIMIT = 100;

export const partnerExpiryJob: CronJobDefinition = {
    name: 'partner-expiry',
    description:
        'Archive partners whose endsAt has passed (backup for missed MP webhooks). SPEC-271 T-271-12.',
    schedule: '15 4 * * *',
    enabled: true,
    timeoutMs: 60_000,

    handler: async (ctx): Promise<CronJobResult> => {
        const { logger, startedAt, dryRun } = ctx;
        const startMs = startedAt.getTime();

        logger.info('partner-expiry: starting tick', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            const model = new PartnerModel();
            const expired = await model.findExpired();

            if (expired.length === 0) {
                logger.info('partner-expiry: no expired partners found');
                return {
                    success: true,
                    message: 'No expired partners found',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startMs
                };
            }

            const toProcess = expired.slice(0, BATCH_LIMIT);

            if (dryRun) {
                logger.info('partner-expiry: dry run — would archive', {
                    count: toProcess.length
                });
                return {
                    success: true,
                    message: `Dry run — would archive ${toProcess.length} expired partner(s)`,
                    processed: toProcess.length,
                    errors: 0,
                    durationMs: Date.now() - startMs,
                    details: { partnerIds: toProcess.map((p) => p.id) }
                };
            }

            let processed = 0;
            let errors = 0;

            for (const partner of toProcess) {
                try {
                    await model.update(
                        { id: partner.id },
                        {
                            subscriptionStatus: PartnerSubscriptionStatusEnum.CANCELLED,
                            lifecycleState: LifecycleStatusEnum.ARCHIVED
                        }
                    );
                    processed++;
                } catch (err) {
                    errors++;
                    apiLogger.error(
                        {
                            partnerId: partner.id,
                            error: err instanceof Error ? err.message : String(err)
                        },
                        'partner-expiry: failed to archive partner — continuing with the rest'
                    );
                }
            }

            logger.info('partner-expiry: tick complete', {
                processed,
                errors,
                durationMs: Date.now() - startMs
            });

            return {
                success: errors === 0,
                message: `Archived ${processed} expired partner(s)${errors > 0 ? `, ${errors} error(s)` : ''}`,
                processed,
                errors,
                durationMs: Date.now() - startMs
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('partner-expiry: fatal error', { error: message });
            return {
                success: false,
                message: `Fatal error: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startMs
            };
        }
    }
};
