import type { DrizzleClient } from '@repo/db';
import { notificationLog } from '@repo/db';
import type { ILogger } from '@repo/logger';
import { NOTIFICATION_CATEGORY_MAP } from '../config/notification-categories.js';
import type { EmailTransport } from '../transports/email/email-transport.interface.js';
import type { DeliveryResult, DeliveryStatus } from '../types/delivery.types.js';
import type { NotificationPayload, SendNotificationOptions } from '../types/notification.types.js';
import { buildCompGrantMetadata } from '../utils/comp-grant-metadata.js';
import { renderNotificationEmail, resolveNotificationSubject } from './notification-render.js';
import type { PreferenceService } from './preference.service.js';
import { type RetryableNotification, RetryService } from './retry.service.js';

/**
 * Dependencies for NotificationService
 */
export interface NotificationServiceDeps {
    /** Email transport implementation */
    emailTransport: EmailTransport;
    /** Preference service for opt-in/opt-out checks */
    preferenceService: PreferenceService;
    /** Retry service (optional, null if Redis unavailable) */
    retryService: RetryService | null;
    /** Database client for logging */
    db: DrizzleClient;
    /** Logger instance */
    logger: ILogger;
    /** Site base URL used in email CTA links (e.g. https://hospeda.com.ar) */
    siteUrl: string;
}

/**
 * NotificationService
 *
 * Main orchestrator for the notification system. Handles sending notifications,
 * checking user preferences, logging delivery status, and managing retries for failures.
 *
 * @example
 * ```ts
 * const notificationService = new NotificationService({
 *   emailTransport: new ResendEmailTransport({ apiKey: env.RESEND_API_KEY }),
 *   preferenceService: new PreferenceService({ ... }),
 *   retryService: new RetryService(redisClient),
 *   db: getDb(),
 *   logger: createLogger('notifications')
 * });
 *
 * const result = await notificationService.send({
 *   type: NotificationType.PAYMENT_SUCCESS,
 *   recipientEmail: 'user@example.com',
 *   recipientName: 'John Doe',
 *   userId: 'user-123',
 *   amount: 1000,
 *   currency: 'ARS',
 *   planName: 'Standard'
 * });
 * ```
 */
export class NotificationService {
    constructor(private deps: NotificationServiceDeps) {}

    /**
     * Send a notification
     *
     * Main entry point for sending a notification. Checks user preferences,
     * renders email template, sends via transport, and logs delivery status.
     *
     * @param payload - Notification payload
     * @param options - Optional flags to control side-effects
     * @returns Delivery result with status and message ID
     *
     * @example
     * ```ts
     * const result = await notificationService.send({
     *   type: NotificationType.SUBSCRIPTION_PURCHASE,
     *   recipientEmail: 'user@example.com',
     *   recipientName: 'Jane Smith',
     *   userId: 'user-456',
     *   customerId: 'cus-789',
     *   planName: 'Premium',
     *   amount: 5000,
     *   currency: 'ARS',
     *   billingPeriod: 'monthly'
     * });
     *
     * if (result.success) {
     *   console.log('Email sent:', result.messageId);
     * } else {
     *   console.error('Failed:', result.error);
     * }
     *
     * // Fire-and-forget feedback email: skip DB log and structured logging
     * await notificationService.send(feedbackPayload, { skipDb: true, skipLogging: true });
     * ```
     */
    async send(
        payload: NotificationPayload,
        options?: SendNotificationOptions
    ): Promise<DeliveryResult> {
        const { preferenceService, emailTransport, logger } = this.deps;
        const { type, recipientEmail, userId, customerId } = payload;

        if (!options?.skipLogging) {
            logger.info({ type, recipientEmail, userId, customerId }, 'Processing notification');
        }

        // Check if user has opted out of this notification type
        const shouldSend = await preferenceService.shouldSendNotification(userId, type);

        if (!shouldSend) {
            const skippedReason = 'User has opted out of this notification type';

            if (!options?.skipLogging) {
                logger.info(
                    { type, userId, reason: skippedReason },
                    'Notification skipped due to user preferences'
                );
            }

            // Log as skipped in database
            if (!options?.skipDb) {
                await this.logNotification({
                    payload,
                    status: 'skipped',
                    error: skippedReason
                });
            }

            return {
                success: false,
                status: 'skipped',
                skippedReason
            };
        }

        // Select appropriate email template and subject
        const {
            react: emailTemplate,
            subject,
            unresolvedPlaceholders
        } = renderNotificationEmail({ payload, siteUrl: this.deps.siteUrl });
        this.reportUnresolvedSubject(payload, unresolvedPlaceholders);

        try {
            // Send email via transport
            const result = await emailTransport.send({
                to: recipientEmail,
                subject,
                react: emailTemplate,
                tags: [
                    { name: 'notification_type', value: type },
                    { name: 'category', value: NOTIFICATION_CATEGORY_MAP[type] }
                ],
                attachments: options?.emailAttachments
            });

            if (!options?.skipLogging) {
                logger.info(
                    { type, recipientEmail, messageId: result.messageId },
                    'Notification sent successfully'
                );
            }

            // Log successful delivery
            if (!options?.skipDb) {
                await this.logNotification({
                    payload,
                    status: 'sent',
                    messageId: result.messageId
                });
            }

            return {
                success: true,
                status: 'sent',
                messageId: result.messageId
            };
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error during email send';

            if (!options?.skipLogging) {
                logger.error(
                    { type, recipientEmail, error: errorMessage },
                    'Failed to send notification'
                );
            }

            // Log failed delivery
            if (!options?.skipDb) {
                await this.logNotification({
                    payload,
                    status: 'failed',
                    error: errorMessage
                });
            }

            // Enqueue for retry if retry service available
            await this.enqueueForRetry(payload, errorMessage);

            return {
                success: false,
                status: 'failed',
                error: errorMessage
            };
        }
    }

    /**
     * Send multiple notifications in batch
     *
     * Processes notifications sequentially to avoid rate limiting.
     * Does not stop on individual failures - returns results for all notifications.
     *
     * @param payloads - Array of notification payloads
     * @returns Array of delivery results in same order as payloads
     *
     * @example
     * ```ts
     * const results = await notificationService.sendBatch([
     *   { type: NotificationType.RENEWAL_REMINDER, ... },
     *   { type: NotificationType.TRIAL_ENDING_REMINDER, ... }
     * ]);
     *
     * const successful = results.filter(r => r.success).length;
     * console.log(`Sent ${successful} of ${results.length} notifications`);
     * ```
     */
    async sendBatch(payloads: NotificationPayload[]): Promise<DeliveryResult[]> {
        const { logger } = this.deps;

        logger.info({ count: payloads.length }, 'Processing batch notifications');

        const results: DeliveryResult[] = [];

        // Process sequentially to avoid rate limiting
        for (const payload of payloads) {
            const result = await this.send(payload);
            results.push(result);
        }

        const successful = results.filter((r) => r.success).length;
        const failed = results.filter((r) => r.status === 'failed').length;
        const skipped = results.filter((r) => r.status === 'skipped').length;

        logger.info(
            { total: payloads.length, successful, failed, skipped },
            'Batch notifications complete'
        );

        return results;
    }

    /**
     * Generate email subject line based on notification type
     *
     * The pure work (pattern, placeholders, generic fallback) lives in
     * `resolveNotificationSubject`. This method adds the reporting half of the
     * H-64 / H-75 guard: a subject that fell back to the generic one is logged
     * at error level instead of being published silently.
     *
     * @param payload - Notification payload
     * @returns Email subject line in Spanish
     * @private
     */
    private generateSubject(payload: NotificationPayload): string {
        const { subject, unresolvedPlaceholders } = resolveNotificationSubject({ payload });
        this.reportUnresolvedSubject(payload, unresolvedPlaceholders);
        return subject;
    }

    /**
     * Logs a subject whose placeholders could not be resolved.
     *
     * @param payload - Notification payload
     * @param unresolved - Placeholder names left unresolved
     * @private
     */
    private reportUnresolvedSubject(
        payload: NotificationPayload,
        unresolved: readonly string[]
    ): void {
        if (unresolved.length > 0) {
            this.deps.logger.error(
                { type: payload.type, unresolved },
                'Subject placeholders could not be resolved; falling back to the generic subject'
            );
        }
    }

    /**
     * Log notification delivery to database
     *
     * @param params - Logging parameters
     * @private
     */
    private async logNotification(params: {
        payload: NotificationPayload;
        status: DeliveryStatus;
        messageId?: string;
        error?: string;
    }): Promise<void> {
        const { db, logger } = this.deps;
        const { payload, status, messageId, error } = params;

        try {
            await db.insert(notificationLog).values({
                type: payload.type,
                channel: 'email',
                recipient: payload.recipientEmail,
                subject: this.generateSubject(payload),
                templateId: payload.type, // Use notification type as template identifier
                status,
                sentAt: status === 'sent' ? new Date() : null,
                errorMessage: error || null,
                metadata: {
                    userId: payload.userId,
                    recipientName: payload.recipientName,
                    messageId: messageId || null,
                    category: NOTIFICATION_CATEGORY_MAP[payload.type],
                    idempotencyKey: payload.idempotencyKey || null,
                    // HOS-1171: a comp
                    // email rebuilt on retry without `hadActiveBilling` reverts
                    // to the "you never gave us a card" variant and drops the
                    // only notice that we cancelled the customer's preapproval.
                    ...buildCompGrantMetadata(payload)
                }
            });

            logger.debug(
                { type: payload.type, status, messageId },
                'Notification logged to database'
            );
        } catch (logError) {
            // Don't throw on logging errors - just log and continue
            const logErrorMessage =
                logError instanceof Error ? logError.message : 'Unknown logging error';

            logger.error(
                { type: payload.type, error: logErrorMessage },
                'Failed to log notification to database'
            );
        }
    }

    /**
     * Enqueue failed notification for retry
     *
     * @param payload - Notification payload
     * @param errorMessage - Error message from failed attempt
     * @private
     */
    private async enqueueForRetry(
        payload: NotificationPayload,
        errorMessage: string
    ): Promise<void> {
        const { retryService, logger } = this.deps;

        // Skip if retry service not available (Redis not configured)
        if (!retryService) {
            logger.warn(
                { type: payload.type },
                'Retry service not available, cannot enqueue for retry'
            );
            return;
        }

        try {
            const retryableNotification: RetryableNotification = {
                id: payload.idempotencyKey || `${payload.type}-${Date.now()}`,
                payload: JSON.stringify(payload),
                attemptCount: 1,
                lastError: errorMessage,
                createdAt: new Date().toISOString()
            };

            // Calculate retry delay (60s for first retry)
            const retryDelay = RetryService.calculateRetryDelay(1);

            await retryService.enqueue(retryableNotification, retryDelay);

            logger.info(
                { type: payload.type, retryAfter: `${retryDelay}ms` },
                'Notification enqueued for retry'
            );
        } catch (enqueueError) {
            const enqueueErrorMessage =
                enqueueError instanceof Error ? enqueueError.message : 'Unknown enqueue error';

            logger.error(
                { type: payload.type, error: enqueueErrorMessage },
                'Failed to enqueue notification for retry'
            );
        }
    }
}
