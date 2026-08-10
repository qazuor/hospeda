/**
 * Benefit-usage reminder job (HOS-376 T-043, AC-8).
 *
 * Daily. Sends ONE nudge for each `PENDING` usage that has been waiting past
 * the reminder threshold, then stamps it so it is never chased again.
 *
 * THE STAMP IS THE IDEMPOTENCY, not a log line. Every row this job finds stays
 * old enough forever, so a reminder that is sent without being stamped is sent
 * again tomorrow, and the next day, until the row expires — one courteous nudge
 * turns into three weeks of pestering about something the recipient may simply
 * not remember.
 *
 * THE STAMP GOES AFTER THE SEND, deliberately in the other direction: stamping
 * first would silence a reminder that never actually left. Between the two
 * failure modes, a duplicate is recoverable and a silent miss is not — the
 * whole chain depends on this landing (§6.6).
 *
 * @module cron/jobs/host-trade-usage-reminder
 */

import { HostTradeUsageService } from '@repo/service-core';
import { notifyUsageReminder } from '../../lib/host-trade-notifications.js';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/** Daily reminder for benefit usages still awaiting an answer. */
export const hostTradeUsageReminderJob: CronJobDefinition = {
    name: 'host-trade-usage-reminder',
    description: 'Send the single day-10 reminder for benefit usages still pending',
    schedule: '30 4 * * *', // Daily at 4:30 UTC, after the expiry sweep
    enabled: true,
    timeoutMs: 300_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        try {
            const service = new HostTradeUsageService({ logger: apiLogger });
            const { items } = await service.listRemindableUsages();

            if (dryRun) {
                logger.info('Dry run mode - not sending benefit-usage reminders', {
                    wouldRemind: items.length
                });
                return {
                    success: true,
                    message: `Dry run - ${items.length} reminders withheld`,
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: { dryRun: true, wouldRemind: items.length }
                };
            }

            let reminded = 0;
            let errors = 0;

            for (const usage of items) {
                try {
                    await notifyUsageReminder(usage as never);
                    await service.markReminderSent({ usageId: usage.id });
                    reminded += 1;
                } catch (error) {
                    // One unreachable recipient must not cost the rest their
                    // reminder, and an unstamped row is simply retried tomorrow.
                    errors += 1;
                    logger.warn('Benefit-usage reminder failed for one row', {
                        usageId: usage.id,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            const durationMs = Date.now() - startedAt.getTime();
            logger.info('Benefit-usage reminders completed', { reminded, errors, durationMs });

            return {
                success: true,
                message: `Sent ${reminded} benefit-usage reminders`,
                processed: reminded,
                errors,
                durationMs,
                details: { reminded, errors, candidates: items.length }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Benefit-usage reminder job failed', { error: message });

            return {
                success: false,
                message: `Benefit-usage reminder failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
