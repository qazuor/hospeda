import { expireLapsedPayments } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import { getPaymentProvider } from '../../utils/payment-provider.js';
import type { CronJobDefinition } from '../types.js';

/** HOS-1709 / AC:B5:5: fail pending payments after their provider collection window closes. */
export const paymentWindowExpiryJob: CronJobDefinition = {
    name: 'payment-window-expiry',
    description:
        'Run P2 on pending payments whose provider collection window closed without collection (HOS-1709, AC:B5:5)',
    schedule: '20 * * * *',
    enabled: true,
    timeoutMs: 300_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping payment window expiry');
            return {
                success: true,
                message: 'Dry run - no payment windows expired',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }

        try {
            const summary = await expireLapsedPayments(
                { pageSize: 100 },
                { provider: getPaymentProvider(), clock: getClock().clock }
            );
            const durationMs = Date.now() - startedAt.getTime();
            logger.info('Payment window expiry completed', { ...summary, durationMs });
            return {
                success: true,
                message: `Failed ${summary.failed} lapsed payments`,
                processed: summary.failed,
                errors: summary.errors,
                durationMs,
                details: { ...summary }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Payment window expiry failed', { error: message });
            return {
                success: false,
                message: `Payment window expiry failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
