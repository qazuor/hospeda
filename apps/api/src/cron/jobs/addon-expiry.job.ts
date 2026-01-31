/**
 * Add-on Expiry Cron Job
 *
 * Processes expired add-ons and sends expiration warnings.
 * Runs daily at 5:00 UTC (2:00 AM Argentina time).
 *
 * Features:
 * - Finds and expires add-ons that have passed their expiration date
 * - Sends ADDON_EXPIRATION_WARNING for add-ons expiring in 3 days
 * - Sends ADDON_EXPIRATION_WARNING for add-ons expiring in 1 day
 * - Uses idempotency keys to prevent duplicate notifications
 * - Fire-and-forget pattern for notification sending
 * - Processes in batches of 100 to avoid memory issues
 *
 * @module cron/jobs/addon-expiry
 */

import { NotificationType } from '@repo/notifications';
import { AddonExpirationService } from '../../services/addon-expiration.service.js';
import { sendNotification } from '../../utils/notification-helper.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Set of sent notification idempotency keys to prevent duplicates within the same run
 * Format: `${type}:${customerId}:${addonSlug}:${YYYY-MM-DD}`
 */
const sentNotifications = new Set<string>();

/**
 * Generate idempotency key for an add-on notification
 *
 * Ensures we don't send the same notification multiple times on the same day.
 *
 * @param type - Notification type
 * @param customerId - Billing customer ID
 * @param addonSlug - Add-on slug
 * @returns Idempotency key
 */
function generateIdempotencyKey(
    type: NotificationType,
    customerId: string,
    addonSlug: string
): string {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${type}:${customerId}:${addonSlug}:${today}`;
}

/**
 * Check if notification was already sent today
 *
 * @param type - Notification type
 * @param customerId - Billing customer ID
 * @param addonSlug - Add-on slug
 * @returns Whether notification was already sent
 */
function wasNotificationSent(
    type: NotificationType,
    customerId: string,
    addonSlug: string
): boolean {
    const key = generateIdempotencyKey(type, customerId, addonSlug);
    return sentNotifications.has(key);
}

/**
 * Mark notification as sent
 *
 * @param type - Notification type
 * @param customerId - Billing customer ID
 * @param addonSlug - Add-on slug
 */
function markNotificationSent(type: NotificationType, customerId: string, addonSlug: string): void {
    const key = generateIdempotencyKey(type, customerId, addonSlug);
    sentNotifications.add(key);
}

/**
 * Add-on expiry cron job definition
 *
 * Schedule: Daily at 5:00 UTC (2:00 AM Argentina time)
 * Purpose: Process expired add-ons and send expiration warnings
 */
export const addonExpiryJob: CronJobDefinition = {
    name: 'addon-expiry',
    description: 'Process expired add-ons and send expiration warnings',
    schedule: '0 5 * * *', // Daily at 5:00 UTC
    enabled: true,
    timeoutMs: 120000, // 2 minutes timeout

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting add-on expiry job', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        let processed = 0;
        let errors = 0;
        let warningsSent = 0;

        // Clear sent notifications set at start of each run
        sentNotifications.clear();

        try {
            // Create add-on expiration service
            const addonExpirationService = new AddonExpirationService();

            // 1. Process expired add-ons
            logger.info('Processing expired add-ons');

            if (dryRun) {
                // Dry run mode - find what would be expired
                const expiredResult = await addonExpirationService.findExpiredAddons();

                if (expiredResult.success) {
                    const expiredCount = expiredResult.data?.length || 0;
                    logger.info('Dry run mode - would expire add-ons', {
                        count: expiredCount
                    });
                    processed += expiredCount;
                } else {
                    logger.error('Failed to find expired add-ons', {
                        error: expiredResult.error
                    });
                    errors++;
                }
            } else {
                // Production mode - actually expire add-ons
                const processResult = await addonExpirationService.processExpiredAddons();

                if (processResult.success) {
                    const result = processResult.data;
                    if (result) {
                        processed += result.processed;
                        errors += result.failed;

                        logger.info('Processed expired add-ons', {
                            processed: result.processed,
                            failed: result.failed,
                            errorsDetails: result.errors
                        });
                    }
                } else {
                    logger.error('Failed to process expired add-ons', {
                        error: processResult.error
                    });
                    errors++;
                }
            }

            // 2. Find add-ons expiring in 3 days and send warnings
            logger.info('Finding add-ons expiring in 3 days');
            const expiring3DaysResult = await addonExpirationService.findExpiringAddons({
                daysAhead: 3
            });

            if (expiring3DaysResult.success) {
                const expiring3Days = expiring3DaysResult.data || [];

                logger.info('Found add-ons expiring in 3 days', {
                    count: expiring3Days.length
                });

                if (dryRun) {
                    logger.info('Dry run mode - would send expiration warnings (3 days)', {
                        count: expiring3Days.length
                    });
                    warningsSent += expiring3Days.length;
                } else {
                    // Send ADDON_EXPIRATION_WARNING for 3-day add-ons
                    for (const addon of expiring3Days) {
                        try {
                            // Check idempotency
                            if (
                                wasNotificationSent(
                                    NotificationType.ADDON_EXPIRATION_WARNING,
                                    addon.customerId,
                                    addon.addonSlug
                                )
                            ) {
                                logger.debug('Skipping duplicate notification (3 days)', {
                                    customerId: addon.customerId,
                                    addonSlug: addon.addonSlug
                                });
                                continue;
                            }

                            // Fire-and-forget notification
                            sendNotification({
                                type: NotificationType.ADDON_EXPIRATION_WARNING,
                                recipientEmail: '', // TODO: Get user email from customer
                                recipientName: '', // TODO: Get user name from customer
                                userId: null, // TODO: Get user ID from customer
                                customerId: addon.customerId,
                                addonName: addon.addonSlug,
                                expirationDate: addon.expiresAt.toISOString(),
                                daysRemaining: addon.daysUntilExpiration,
                                idempotencyKey: generateIdempotencyKey(
                                    NotificationType.ADDON_EXPIRATION_WARNING,
                                    addon.customerId,
                                    addon.addonSlug
                                )
                            }).catch((notifError) => {
                                logger.debug('Add-on expiration warning failed (will retry)', {
                                    customerId: addon.customerId,
                                    addonSlug: addon.addonSlug,
                                    error:
                                        notifError instanceof Error
                                            ? notifError.message
                                            : String(notifError)
                                });
                            });

                            markNotificationSent(
                                NotificationType.ADDON_EXPIRATION_WARNING,
                                addon.customerId,
                                addon.addonSlug
                            );
                            warningsSent++;

                            logger.debug('Sent add-on expiration warning (3 days)', {
                                customerId: addon.customerId,
                                addonSlug: addon.addonSlug,
                                daysRemaining: 3
                            });
                        } catch (error) {
                            errors++;
                            logger.error('Failed to send add-on expiration warning (3 days)', {
                                customerId: addon.customerId,
                                addonSlug: addon.addonSlug,
                                error: error instanceof Error ? error.message : String(error)
                            });
                        }
                    }
                }
            } else {
                logger.error('Failed to find add-ons expiring in 3 days', {
                    error: expiring3DaysResult.error
                });
                errors++;
            }

            // 3. Find add-ons expiring in 1 day and send warnings
            logger.info('Finding add-ons expiring in 1 day');
            const expiring1DayResult = await addonExpirationService.findExpiringAddons({
                daysAhead: 1
            });

            if (expiring1DayResult.success) {
                const expiring1Day = expiring1DayResult.data || [];

                logger.info('Found add-ons expiring in 1 day', {
                    count: expiring1Day.length
                });

                if (dryRun) {
                    logger.info('Dry run mode - would send expiration warnings (1 day)', {
                        count: expiring1Day.length
                    });
                    warningsSent += expiring1Day.length;
                } else {
                    // Send ADDON_EXPIRATION_WARNING for 1-day add-ons
                    for (const addon of expiring1Day) {
                        try {
                            // Check idempotency
                            if (
                                wasNotificationSent(
                                    NotificationType.ADDON_EXPIRATION_WARNING,
                                    addon.customerId,
                                    addon.addonSlug
                                )
                            ) {
                                logger.debug('Skipping duplicate notification (1 day)', {
                                    customerId: addon.customerId,
                                    addonSlug: addon.addonSlug
                                });
                                continue;
                            }

                            // Fire-and-forget notification
                            sendNotification({
                                type: NotificationType.ADDON_EXPIRATION_WARNING,
                                recipientEmail: '', // TODO: Get user email from customer
                                recipientName: '', // TODO: Get user name from customer
                                userId: null, // TODO: Get user ID from customer
                                customerId: addon.customerId,
                                addonName: addon.addonSlug,
                                expirationDate: addon.expiresAt.toISOString(),
                                daysRemaining: addon.daysUntilExpiration,
                                idempotencyKey: generateIdempotencyKey(
                                    NotificationType.ADDON_EXPIRATION_WARNING,
                                    addon.customerId,
                                    addon.addonSlug
                                )
                            }).catch((notifError) => {
                                logger.debug('Add-on expiration warning failed (will retry)', {
                                    customerId: addon.customerId,
                                    addonSlug: addon.addonSlug,
                                    error:
                                        notifError instanceof Error
                                            ? notifError.message
                                            : String(notifError)
                                });
                            });

                            markNotificationSent(
                                NotificationType.ADDON_EXPIRATION_WARNING,
                                addon.customerId,
                                addon.addonSlug
                            );
                            warningsSent++;

                            logger.debug('Sent add-on expiration warning (1 day)', {
                                customerId: addon.customerId,
                                addonSlug: addon.addonSlug,
                                daysRemaining: 1
                            });
                        } catch (error) {
                            errors++;
                            logger.error('Failed to send add-on expiration warning (1 day)', {
                                customerId: addon.customerId,
                                addonSlug: addon.addonSlug,
                                error: error instanceof Error ? error.message : String(error)
                            });
                        }
                    }
                }
            } else {
                logger.error('Failed to find add-ons expiring in 1 day', {
                    error: expiring1DayResult.error
                });
                errors++;
            }

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('Add-on expiry job completed', {
                processed,
                errors,
                warningsSent,
                durationMs
            });

            return {
                success: true,
                message: `Processed ${processed} expired add-ons, sent ${warningsSent} warnings (${errors} errors)`,
                processed: processed + warningsSent,
                errors,
                durationMs,
                details: {
                    expiredAddons: processed,
                    warningsSent,
                    dryRun
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            errors++;

            logger.error('Add-on expiry job failed', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to process add-on expiry: ${errorMessage}`,
                processed,
                errors,
                durationMs,
                details: {
                    error: errorMessage
                }
            };
        }
    }
};
