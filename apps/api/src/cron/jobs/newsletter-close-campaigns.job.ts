/**
 * Newsletter Close Campaigns Cron Job
 *
 * Periodically transitions newsletter campaigns from `sending` to `sent`
 * once every delivery row has been resolved (no `pending` rows remain).
 *
 * Replaces the QStash `/internal/newsletter/close-campaigns` endpoint
 * removed in `chore/vps-migration`. Runs every 5 minutes via the
 * in-process node-cron scheduler.
 *
 * @module cron/jobs/newsletter-close-campaigns
 */

import { NewsletterCampaignService } from '@repo/service-core';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Newsletter close-campaigns cron job definition.
 *
 * Schedule: every 5 minutes (`*` star slash 5 in the minute field).
 * Purpose: close fully-resolved sending campaigns per SPEC-101 tech-analysis
 * §8.5. Uses the EXISTS-style query inside
 * {@link NewsletterCampaignService.closeSentCampaigns}.
 */
export const newsletterCloseCampaignsJob: CronJobDefinition = {
    name: 'newsletter-close-campaigns',
    description:
        'Close newsletter campaigns whose deliveries have all resolved (status sending → sent).',
    schedule: '*/5 * * * *',
    enabled: true,
    timeoutMs: 60_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting newsletter close-campaigns job', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        if (dryRun) {
            logger.info('Dry run mode - skipping closeSentCampaigns invocation');
            return {
                success: true,
                message: 'Dry run - no campaigns closed',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }

        try {
            const campaignService = new NewsletterCampaignService({ logger: apiLogger });
            const result = await campaignService.closeSentCampaigns();

            const durationMs = Date.now() - startedAt.getTime();

            if (result.error) {
                logger.error('Newsletter close-campaigns job failed', {
                    error: result.error.message,
                    code: result.error.code,
                    durationMs
                });
                return {
                    success: false,
                    message: result.error.message,
                    processed: 0,
                    errors: 1,
                    durationMs,
                    details: { code: result.error.code }
                };
            }

            const closedCount = result.data ?? 0;

            logger.info('Newsletter close-campaigns job completed', {
                closedCount,
                durationMs
            });

            return {
                success: true,
                message: `Closed ${closedCount} campaign(s)`,
                processed: closedCount,
                errors: 0,
                durationMs,
                details: { closedCount }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            const durationMs = Date.now() - startedAt.getTime();

            logger.error('Newsletter close-campaigns job threw', {
                error: errorMessage,
                stack: errorStack,
                durationMs
            });

            return {
                success: false,
                message: `Job failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: { error: errorMessage }
            };
        }
    }
};
