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

import { NotificationType } from '@repo/notifications';
import { NewsletterCampaignService } from '@repo/service-core';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import { sendNotification } from '../../utils/notification-helper.js';
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
            // SPEC-108 T-108-02: wire the admin failure-notification callback
            // so campaigns that close with failed > 0 fan out an
            // ADMIN_SYSTEM_EVENT alert to every address configured in
            // HOSPEDA_ADMIN_NOTIFICATION_EMAILS. The cron is the only caller
            // of closeSentCampaigns today; if a second caller appears it
            // must wire the same DI seam.
            const adminEmails =
                env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS?.split(',')
                    .map((e) => e.trim())
                    .filter((e) => e.length > 0) ?? [];

            const campaignService = new NewsletterCampaignService(
                { logger: apiLogger },
                {
                    notifyCampaignClosedWithFailuresFn:
                        adminEmails.length > 0
                            ? async (event) => {
                                  for (const adminEmail of adminEmails) {
                                      await sendNotification({
                                          type: NotificationType.ADMIN_SYSTEM_EVENT,
                                          recipientEmail: adminEmail,
                                          recipientName: 'Admin',
                                          userId: null,
                                          severity: 'warning' as const,
                                          eventDetails: {
                                              eventType: 'newsletter_campaign_closed_with_failures',
                                              message: `Campaign "${event.subject}" closed with ${event.failed} failed deliveries (of ${event.totalRecipients} recipients, ${event.delivered} delivered).`,
                                              campaignId: event.campaignId,
                                              subject: event.subject,
                                              totalRecipients: event.totalRecipients,
                                              delivered: event.delivered,
                                              failed: event.failed,
                                              timestamp: event.closedAt.toISOString()
                                          }
                                      }).catch((err) => {
                                          apiLogger.debug(
                                              {
                                                  error:
                                                      err instanceof Error
                                                          ? err.message
                                                          : String(err),
                                                  adminEmail,
                                                  campaignId: event.campaignId
                                              },
                                              'Admin newsletter-failure alert failed (will retry)'
                                          );
                                      });
                                  }
                              }
                            : undefined
                }
            );
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
