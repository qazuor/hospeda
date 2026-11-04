/**
 * Retries our NOTICE_PENDING provider cancellations after their notice settles (owner option 3).
 * The daily reconciliation sweep remains the safety net. Minute 4 plus five avoids other
 * provider calling jobs and minute zero (HOS-1999 AC-17).
 */
import {
    createPaymentReconciliationMarkPayments,
    providerLinkCancellationSeen,
    runNoticeDeferredCancellationRetry
} from '@repo/service-core';
import {
    beforeCancelNotice,
    beforeCancelNoticeStatus
} from '../../routes/billing-subscription/before-cancel-notice.js';
import { getClock } from '../../utils/clock.js';
import { getPaymentProvider } from '../../utils/payment-provider.js';
import type { CronJobDefinition } from '../types.js';
import { billingReconciliationSweepJob } from './billing-reconciliation-sweep.job.js';

/** HOS-1955, AC:B11:6: retry settled before-cancel notices within minutes. */
export const billingDeferredCancellationRetryJob: CronJobDefinition = {
    name: 'billing-deferred-cancellation-retry',
    description:
        'Retry deferred provider cancellations after the before-cancel notice settles (HOS-1955, AC:B11:6)',
    schedule: '4-59/5 * * * *',
    exclusive: true,
    enabled: true,
    timeoutMs: 240_000,
    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping deferred cancellation retry');
            return {
                success: true,
                message: 'Dry run - no deferred cancellations retried',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const clock = getClock().clock;
            const summary = await runNoticeDeferredCancellationRetry(
                {
                    correlationId: ctx.correlationId,
                    sweepRunMaxAgeMs: billingReconciliationSweepJob.timeoutMs ?? 600_000
                },
                {
                    provider: getPaymentProvider(),
                    clock,
                    beforeCancelNotice,
                    noticeStatus: beforeCancelNoticeStatus,
                    markPayments: createPaymentReconciliationMarkPayments(clock),
                    cancellationSeen: providerLinkCancellationSeen
                }
            );
            const { failures, ...details } = summary;
            if (summary.rowsFailed > 0 || summary.retried.callFailed > 0) {
                logger.warn('Deferred cancellation retry had failures', {
                    rowsFailed: summary.rowsFailed,
                    cancelCallFailed: summary.retried.callFailed,
                    failedSubscriptionIds: failures.map(({ subscriptionId }) => subscriptionId)
                });
            }
            return {
                success: summary.rowsFailed === 0,
                message: summary.skipped
                    ? 'Deferred cancellation retry skipped: sweep running'
                    : `Retried ${summary.retried.confirmed} deferred cancellations`,
                processed: summary.rowsRead,
                errors: summary.rowsFailed + summary.retried.callFailed,
                durationMs: Date.now() - startedAt.getTime(),
                details: {
                    ...details,
                    failedSubscriptionIds: failures.map(({ subscriptionId }) => subscriptionId)
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Deferred cancellation retry failed', { error: message });
            return {
                success: false,
                message: `Deferred cancellation retry failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: {}
            };
        }
    }
};
