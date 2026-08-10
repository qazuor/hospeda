/**
 * Host-trade aggregate reconciliation job (HOS-376 T-044, AC-29).
 *
 * Weekly. Recomputes the five denormalised counters on every listing and
 * reports which ones were wrong.
 *
 * THIS IS A BACKSTOP, NOT THE MECHANISM (R-6). The counters are recomputed
 * synchronously by every write that can move them, so in a healthy system this
 * job corrects nothing week after week. Its value is precisely that: a run that
 * reports drift is evidence one of those write paths has a hole, and without it
 * a wrong number is invisible — nothing about "37 usos" says it should have
 * said 36.
 *
 * It therefore LOGS WHAT IT CORRECTED rather than silently fixing it. A repair
 * nobody can see is a bug that stays.
 *
 * @module cron/jobs/host-trade-stats-reconcile
 */

import { reconcileAllHostTradeAggregates } from '@repo/service-core';
import type { CronJobDefinition } from '../types.js';

/** Weekly drift check over the denormalised provider counters. */
export const hostTradeStatsReconcileJob: CronJobDefinition = {
    name: 'host-trade-stats-reconcile',
    description: 'Recompute host-trade aggregate counters and report drift',
    schedule: '0 5 * * 1', // Mondays at 5:00 UTC
    enabled: true,
    timeoutMs: 600_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        try {
            const { checked, corrected } = await reconcileAllHostTradeAggregates({
                dryRun: Boolean(dryRun)
            });

            const durationMs = Date.now() - startedAt.getTime();

            if (corrected.length > 0) {
                // Each correction names the listing and both sets of numbers:
                // the drift is the finding, and a repair nobody can read is a
                // bug that stays.
                logger.warn('Host-trade aggregate drift corrected', {
                    dryRun,
                    corrected
                });
            }

            logger.info('Host-trade aggregate reconciliation completed', {
                checked,
                correctedCount: corrected.length,
                durationMs
            });

            return {
                success: true,
                message: `Checked ${checked} listings, corrected ${corrected.length}`,
                processed: checked,
                errors: 0,
                durationMs,
                details: { checked, corrected, dryRun: Boolean(dryRun) }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Host-trade aggregate reconciliation failed', { error: message });

            return {
                success: false,
                message: `Host-trade reconciliation failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
