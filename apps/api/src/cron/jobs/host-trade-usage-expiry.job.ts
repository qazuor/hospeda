/**
 * Benefit-usage expiry job (HOS-376 T-042, §7.6).
 *
 * Daily. Moves every `PENDING` usage whose 30-day window has run out to
 * `EXPIRED`.
 *
 * IT NOTIFIES NOBODY, and that is the design rather than a shortcut. Expiry is
 * the outcome of silence, and silence is not an accusation (§6.6): mailing both
 * parties to announce that nothing happened would turn a neutral timeout into a
 * reproach about a record that never counted for anything.
 *
 * It also moves no counter. Only CONFIRMED usages feed the five aggregates, so
 * a row going PENDING → EXPIRED cannot change a number — recomputing would be
 * one query per listing to write back what was already there.
 *
 * @module cron/jobs/host-trade-usage-expiry
 */

import { HostTradeUsageService } from '@repo/service-core';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/** Daily expiry sweep of stale benefit-usage declarations. */
export const hostTradeUsageExpiryJob: CronJobDefinition = {
    name: 'host-trade-usage-expiry',
    description: 'Expire PENDING benefit usages whose confirmation window has run out',
    schedule: '15 4 * * *', // Daily at 4:15 UTC
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        if (dryRun) {
            logger.info('Dry run mode - skipping benefit-usage expiry');
            return {
                success: true,
                message: 'Dry run - no usages expired',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }

        try {
            const service = new HostTradeUsageService({ logger: apiLogger });
            const { expired } = await service.expireOverdueUsages();

            const durationMs = Date.now() - startedAt.getTime();
            logger.info('Benefit-usage expiry completed', { expired, durationMs });

            return {
                success: true,
                message: `Expired ${expired} benefit usages`,
                processed: expired,
                errors: 0,
                durationMs,
                details: { expired }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Benefit-usage expiry failed', { error: message });

            return {
                success: false,
                message: `Benefit-usage expiry failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
