import { planCatalogModel } from '@repo/db';
import {
    createGraceExpiryCheck,
    createLostFirstRejectionCheck,
    creditedPaymentsFromLedger,
    runReconciliationSweep
} from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { beforeCancelNotice } from '../../routes/billing-subscription/before-cancel-notice.js';
import { getClock } from '../../utils/clock.js';
import { createSentryCronMonitorPing } from '../../utils/cron-monitor-ping.js';
import { getPaymentProvider } from '../../utils/payment-provider.js';
import type { CronJobDefinition } from '../types.js';

/** HOS-1602, AC:B11:1: reconcile the owned billing inventory every day. */
export const billingReconciliationSweepJob: CronJobDefinition = {
    name: 'billing-reconciliation-sweep',
    description:
        'Read owned billing inventory by provider id and open marks for divergences (HOS-1602, AC:B11:1)',
    schedule: '0 6 * * *',
    enabled: true,
    timeoutMs: 600_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping billing reconciliation sweep');
            return {
                success: true,
                message: 'Dry run - no billing inventory reconciled',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const provider = getPaymentProvider();
            const clock = getClock().clock;
            const { planPolicy } = createPlanCatalogInverse({ reader: planCatalogModel });
            const summary = await runReconciliationSweep(
                { correlationId: ctx.correlationId },
                {
                    provider,
                    clock,
                    rowChecks: [
                        createLostFirstRejectionCheck({
                            provider,
                            clock,
                            payments: creditedPaymentsFromLedger,
                            planPolicy
                        }),
                        // AC:B7:7/AC:B7:8: S6 when the grace clock ran out, or P1 + S5 when the
                        // period charged; coverage, cancellation-seen, S19 and the DEC-OBS-001
                        // channel stay on their defaults until B4.2, B7.4b and B11/B13a wire them.
                        createGraceExpiryCheck({
                            provider,
                            clock,
                            beforeCancelNotice,
                            payments: creditedPaymentsFromLedger,
                            planPolicy
                        })
                    ],
                    zeroCallChecks: {},
                    livenessPing: createSentryCronMonitorPing()
                }
            );
            const { failures, ...details } = summary;
            const zeroCallFailures = summary.zeroCallChecks?.failures ?? [];
            const { failures: _zeroCallFailures, ...zeroCallDetails } = summary.zeroCallChecks ?? {
                results: [],
                failures: []
            };
            return {
                success: summary.rowsFailed === 0,
                message: `Processed ${summary.rowsRead} billing subscriptions`,
                processed: summary.rowsRead,
                errors: summary.rowsFailed + zeroCallFailures.length,
                durationMs: Date.now() - startedAt.getTime(),
                details: {
                    ...details,
                    failedSubscriptionIds: failures.map(({ subscriptionId }) => subscriptionId),
                    ...(summary.zeroCallChecks
                        ? {
                              zeroCallChecks: {
                                  ...zeroCallDetails,
                                  failedChecks: zeroCallFailures.map(({ check }) => check)
                              }
                          }
                        : {})
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Billing reconciliation sweep failed', { error: message });
            return {
                success: false,
                message: `Billing reconciliation sweep failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: {}
            };
        }
    }
};
