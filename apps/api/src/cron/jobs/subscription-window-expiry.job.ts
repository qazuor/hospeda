import { expireAuthorizationWindows } from '@repo/service-core';
import { beforeCancelNotice } from '../../routes/billing-subscription/before-cancel-notice.js';
import { getClock } from '../../utils/clock.js';
import { getPaymentProvider } from '../../utils/payment-provider.js';
import type { CronJobDefinition } from '../types.js';

/** HOS-1521 / AC:B3:9-10: sweep expired authorization windows every 15 minutes. */
export const subscriptionWindowExpiryJob: CronJobDefinition = {
    name: 'subscription-window-expiry',
    description: 'Expire authorization windows and cancel pending mandates (HOS-1521, AC:B3:9-10)',
    schedule: '*/15 * * * *',
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping authorization window expiry');
            return {
                success: true,
                message: 'Dry run - no authorization windows expired',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }

        try {
            const summary = await expireAuthorizationWindows(100, {
                provider: getPaymentProvider(),
                clock: getClock().clock,
                beforeCancelNotice
            });
            const durationMs = Date.now() - startedAt.getTime();
            logger.info('Authorization window expiry completed', { ...summary, durationMs });
            return {
                success: true,
                message: `Processed ${summary.abandoned + summary.activated} authorization windows`,
                processed: summary.abandoned + summary.activated,
                errors: 0,
                durationMs,
                details: { ...summary }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Authorization window expiry failed', { error: message });
            return {
                success: false,
                message: `Authorization window expiry failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
