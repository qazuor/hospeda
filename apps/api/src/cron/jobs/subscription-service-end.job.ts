import { endScheduledServices, providerLinkCancellationSeen } from '@repo/service-core';
import { beforeCancelNotice } from '../../routes/billing-subscription/before-cancel-notice.js';
import { getAnalyticsFactSink } from '../../utils/analytics/analytics-facts.js';
import { getClock } from '../../utils/clock.js';
import { buildBillingCoveragePorts } from '../../utils/listing-access/billing-coverage.js';
import { createBootstrapCoverageReader } from '../../utils/listing-access/bootstrap-coverage-reader.js';
import { getCoverageNotices } from '../../utils/listing-access/coverage-notices.js';
import { getPaymentProvider } from '../../utils/payment-provider.js';
import type { CronJobDefinition } from '../types.js';

/**
 * HOS-1569 / AC:B8a:5-6: every 15 minutes, S12 on every `CANCEL_SCHEDULED` row whose end of
 * service passed — principals and their orphanhood first, then the complements left. The
 * `políticaDeAddon` and `ficha` ports come from `buildBillingCoveragePorts`, so the job inherits
 * the real `ficha` once it is registered; no succession closer is registered (it fails closed).
 */
export const subscriptionServiceEndJob: CronJobDefinition = {
    name: 'subscription-service-end',
    description:
        'Run S12 on scheduled cancellations whose end of service passed: principals and their orphanhood first, then complements (HOS-1569, AC:B8a:5-6)',
    schedule: '*/15 * * * *',
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping the end of scheduled services');
            return {
                success: true,
                message: 'Dry run - no scheduled service ended',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }

        try {
            const { addonPolicy, listing } = buildBillingCoveragePorts({
                reader: createBootstrapCoverageReader()
            }).ports;
            const summary = await endScheduledServices(
                { limit: 100 },
                {
                    clock: getClock().clock,
                    billingFacts: getAnalyticsFactSink(),
                    provider: getPaymentProvider(),
                    beforeCancelNotice,
                    coverageNotices: getCoverageNotices(),
                    addonPolicy,
                    listing,
                    cancellationSeen: providerLinkCancellationSeen
                }
            );
            const processed = summary.principals.cancelled + summary.complements.cancelled;
            const errors = summary.principals.failed + summary.complements.failed;
            const durationMs = Date.now() - startedAt.getTime();
            logger.info('End of scheduled services completed', {
                principals: summary.principals,
                complements: summary.complements,
                durationMs
            });
            return {
                success: true,
                message: `Ended ${processed} scheduled services`,
                processed,
                errors,
                durationMs,
                details: { principals: summary.principals, complements: summary.complements }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('End of scheduled services failed', { error: message });
            return {
                success: false,
                message: `End of scheduled services failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
