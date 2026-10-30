import { planCatalogModel } from '@repo/db';
import {
    activateCreditedPendingAuthorizations,
    expireAuthorizationWindows,
    sweepInheritedTouristVips
} from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { beforeCancelNotice } from '../../routes/billing-subscription/before-cancel-notice.js';
import { touristVipInheritance } from '../../routes/billing-subscription/tourist-vip-inheritance.js';
import { getAnalyticsFactSink } from '../../utils/analytics/analytics-facts.js';
import { buildComplementPolicyPorts } from '../../utils/billing-complement-ports.js';
import { getClock } from '../../utils/clock.js';
import { getCoverageNotices } from '../../utils/listing-access/coverage-notices.js';
import { getPaymentProvider } from '../../utils/payment-provider.js';
import type { CronJobDefinition } from '../types.js';

/** HOS-1521 / HOS-1740: recover credited pending signups, expire windows, then sweep VIP inheritance every 15 minutes. */
export const subscriptionWindowExpiryJob: CronJobDefinition = {
    name: 'subscription-window-expiry',
    description:
        'Recover credited pending signups and expire authorization windows (HOS-1521, HOS-1740)',
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

        let errors = 0;
        let rejected = false;
        let creditedPending = {
            candidates: 0,
            activated: 0,
            notActive: 0,
            skipped: 0,
            failed: 0,
            touristVipCancelled: 0
        };
        let summary = {
            abandoned: 0,
            activated: 0,
            cancelCalls: 0,
            noticePending: 0,
            skipped: 0,
            touristVipCancelled: 0,
            retainedReevaluated: 0,
            failed: 0
        };
        let vipSummary = { cancelled: 0, deferred: 0, skipped: 0 };
        const ports = {
            provider: getPaymentProvider(),
            clock: getClock().clock,
            beforeCancelNotice,
            touristVipInheritance,
            coverageNotices: getCoverageNotices(),
            billingFacts: getAnalyticsFactSink(),
            changeDirection: createPlanCatalogInverse({ reader: planCatalogModel }).changeDirection,
            complements: buildComplementPolicyPorts()
        };
        try {
            creditedPending = await activateCreditedPendingAuthorizations(100, ports);
            errors += creditedPending.failed;
        } catch (error) {
            rejected = true;
            errors++;
            logger.error('Credited pending authorization recovery failed', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
        try {
            summary = await expireAuthorizationWindows(100, ports);
            errors += summary.failed;
        } catch (error) {
            rejected = true;
            errors++;
            logger.error('Authorization window expiry failed', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
        try {
            vipSummary = await sweepInheritedTouristVips(100, {
                provider: getPaymentProvider(),
                clock: getClock().clock,
                beforeCancelNotice,
                touristVipInheritance,
                coverageNotices: getCoverageNotices()
            });
        } catch (error) {
            rejected = true;
            errors++;
            logger.error('Tourist VIP inheritance sweep failed', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
        const durationMs = Date.now() - startedAt.getTime();
        const processed = creditedPending.activated + summary.abandoned + summary.activated;
        logger.info('Authorization window expiry completed', {
            ...summary,
            creditedPending,
            durationMs
        });
        return {
            success: !rejected,
            message: `Processed ${processed} authorization windows`,
            processed,
            errors,
            durationMs,
            details: { ...summary, creditedPending, ...vipSummary }
        };
    }
};
