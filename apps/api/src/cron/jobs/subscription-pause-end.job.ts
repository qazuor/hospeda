import { endDuePauses } from '@repo/service-core';
import { buildComplementPolicyPorts } from '../../utils/billing-complement-ports.js';
import { getClock } from '../../utils/clock.js';
import { getCoverageNotices } from '../../utils/listing-access/coverage-notices.js';
import { getPaymentProvider } from '../../utils/payment-provider.js';
import type { CronJobDefinition } from '../types.js';

/** HOS-1573 / AC:B8b:3: end due principal pauses with S10. */
export const subscriptionPauseEndJob: CronJobDefinition = {
    name: 'subscription-pause-end',
    description: 'End due principal pauses with S10 (HOS-1573, AC:B8b:3)',
    schedule: '47 * * * *',
    enabled: true,
    timeoutMs: 120_000,
    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping due pauses');
            return {
                success: true,
                message: 'Dry run - no pause ended',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const summary = await endDuePauses(
                { limit: 100 },
                {
                    provider: getPaymentProvider(),
                    clock: getClock().clock,
                    complements: buildComplementPolicyPorts(),
                    coverageNotices: getCoverageNotices()
                }
            );
            const durationMs = Date.now() - startedAt.getTime();
            logger.info('Due pauses completed', { summary, durationMs });
            return {
                success: true,
                message: `Resumed ${summary.resumed} due pauses`,
                processed:
                    summary.resumed +
                    summary.notApplied +
                    summary.notApplicable +
                    summary.lostRace +
                    summary.failed,
                errors: summary.failed,
                durationMs,
                details: summary
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Due pauses failed', { error: message });
            return {
                success: false,
                message: `Due pauses failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
