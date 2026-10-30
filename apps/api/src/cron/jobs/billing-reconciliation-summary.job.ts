import { reconciliationSummaryWindowModel } from '@repo/db';
import { runReconciliationSummaryTick } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import type { CronJobDefinition } from '../types.js';

/** Runs one tick of the aggregated reconciliation summary window. */
export const billingReconciliationSummaryJob: CronJobDefinition = {
    name: 'billing-reconciliation-summary',
    description: 'Run one tick of the aggregated billing reconciliation summary window (HOS-1607).',
    schedule: '*/5 * * * *',
    enabled: true,
    timeoutMs: 120_000,
    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping billing reconciliation summary');
            return {
                success: true,
                message: 'Dry run - no reconciliation summary tick executed',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const outcome = await runReconciliationSummaryTick({
                now: getClock().clock.now(),
                correlationId: ctx.correlationId
            });
            const window = await reconciliationSummaryWindowModel.findLatest();
            const noRecipients = outcome === 'NO_RECIPIENTS';
            const sentEvents = outcome === 'SENT' ? (window?.eventCount ?? 0) : 0;
            return {
                success: !noRecipients,
                message: noRecipients
                    ? 'No SUPER_ADMIN recipients for reconciliation summary'
                    : `Reconciliation summary tick completed: ${outcome}`,
                processed: sentEvents,
                errors: noRecipients ? 1 : 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { outcome, windowId: window?.id ?? null }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Billing reconciliation summary tick failed', { error: message });
            return {
                success: false,
                message: `Billing reconciliation summary failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
