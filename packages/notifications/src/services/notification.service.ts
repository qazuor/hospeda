import { billingNotificationLog, type getDb } from '@repo/db';
import type { ILogger } from '@repo/logger';
import type { ReactElement } from 'react';
import { NOTIFICATION_CATEGORY_MAP } from '../config/notification-categories.js';
import { NOTIFICATION_CONSTANTS } from '../constants/notification.constants.js';
import {
    AddonExpirationWarning,
    AddonExpired,
    AddonRenewalConfirmation,
    AdminPaymentFailure,
    AdminSystemEvent,
    FeedbackReportEmail,
    PaymentFailure,
    PaymentSuccess,
    PlanChangeConfirmation,
    PurchaseConfirmation,
    RenewalReminder,
    SubscriptionCancelled,
    SubscriptionPaused,
    SubscriptionReactivated,
    TrialEndingReminder,
    TrialExpired
} from '../templates/index.js';
import type { EmailTransport } from '../transports/email/email-transport.interface.js';
import type { DeliveryResult, DeliveryStatus } from '../types/delivery.types.js';
import type {
    AddonEventPayload,
    AdminNotificationPayload,
    FeedbackReportPayload,
    NotificationPayload,
    PaymentNotificationPayload,
    PurchaseConfirmationPayload,
    SendNotificationOptions,
    SubscriptionEventPayload,
    SubscriptionLifecyclePayload,
    TrialEventPayload
} from '../types/notification.types.js';
import { getSubject } from '../utils/subject-builder.js';
import type { PreferenceService } from './preference.service.js';
import { RetryService, type RetryableNotification } from './retry.service.js';

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
    db: ReturnType<typeof getDb>;
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

        // Select appropriate email template
        const emailTemplate = this.selectTemplate(payload);
        const subject = this.generateSubject(payload);

        try {
            // Send email via transport
            const result = await emailTransport.send({
                to: recipientEmail,
                subject,
                react: emailTemplate,
                from: `${NOTIFICATION_CONSTANTS.DEFAULT_FROM_NAME} <${NOTIFICATION_CONSTANTS.DEFAULT_FROM_EMAIL}>`,
                tags: [
                    { name: 'notification_type', value: type },
                    { name: 'category', value: NOTIFICATION_CATEGORY_MAP[type] }
                ]
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
     * Select appropriate email template for notification type
     *
     * Maps notification types to their corresponding React Email templates.
     * Maps payload data to template component props.
     *
     * @param payload - Notification payload
     * @returns React Email component
     * @private
     */
    private selectTemplate(payload: NotificationPayload): ReactElement {
        const { type, recipientName } = payload;

        // Map notification type to template component and props
        switch (type) {
            case 'subscription_purchase':
            case 'addon_purchase': {
                const p = payload as PurchaseConfirmationPayload;
                return PurchaseConfirmation({
                    recipientName,
                    planName: p.planName,
                    amount: p.amount,
                    currency: p.currency,
                    baseUrl: this.deps.siteUrl,
                    billingPeriod: p.billingPeriod,
                    nextBillingDate: p.nextBillingDate
                });
            }

            case 'payment_success': {
                const p = payload as PaymentNotificationPayload;
                return PaymentSuccess({
                    recipientName,
                    amount: p.amount,
                    currency: p.currency,
                    planName: p.planName,
                    baseUrl: this.deps.siteUrl,
                    paymentMethod: p.paymentMethod
                });
            }

            case 'payment_failure': {
                const p = payload as PaymentNotificationPayload;
                return PaymentFailure({
                    recipientName,
                    amount: p.amount,
                    currency: p.currency,
                    baseUrl: this.deps.siteUrl,
                    failureReason: p.failureReason,
                    retryDate: p.retryDate
                });
            }

            case 'renewal_reminder': {
                const p = payload as SubscriptionEventPayload;
                return RenewalReminder({
                    recipientName,
                    planName: p.planName,
                    baseUrl: this.deps.siteUrl,
                    amount: p.amount,
                    currency: p.currency,
                    renewalDate: p.renewalDate || ''
                });
            }

            case 'plan_change_confirmation': {
                const p = payload as SubscriptionEventPayload;
                return PlanChangeConfirmation({
                    recipientName,
                    baseUrl: this.deps.siteUrl,
                    oldPlanName: p.oldPlanName || '',
                    newPlanName: p.newPlanName || '',
                    amount: p.amount,
                    currency: p.currency
                });
            }

            case 'addon_expiration_warning': {
                const p = payload as AddonEventPayload;
                return AddonExpirationWarning({
                    recipientName,
                    addonName: p.addonName,
                    baseUrl: this.deps.siteUrl,
                    daysRemaining: p.daysRemaining,
                    expirationDate: p.expirationDate
                });
            }

            case 'addon_expired': {
                const p = payload as AddonEventPayload;
                return AddonExpired({
                    recipientName,
                    addonName: p.addonName,
                    baseUrl: this.deps.siteUrl,
                    expirationDate: p.expirationDate || ''
                });
            }

            case 'addon_renewal_confirmation': {
                const p = payload as AddonEventPayload;
                return AddonRenewalConfirmation({
                    recipientName,
                    addonName: p.addonName,
                    baseUrl: this.deps.siteUrl,
                    amount: p.amount || 0,
                    currency: p.currency || 'ARS'
                });
            }

            case 'trial_ending_reminder': {
                const p = payload as TrialEventPayload;
                return TrialEndingReminder({
                    recipientName,
                    planName: p.planName,
                    trialEndDate: p.trialEndDate,
                    daysRemaining: p.daysRemaining,
                    upgradeUrl: p.upgradeUrl
                });
            }

            case 'trial_expired': {
                const p = payload as TrialEventPayload;
                return TrialExpired({
                    recipientName,
                    planName: p.planName,
                    trialEndDate: p.trialEndDate,
                    upgradeUrl: p.upgradeUrl
                });
            }

            case 'admin_payment_failure': {
                const p = payload as AdminNotificationPayload;
                return AdminPaymentFailure({
                    recipientName,
                    affectedUserEmail: p.affectedUserEmail,
                    affectedUserId: p.affectedUserId,
                    severity: p.severity,
                    eventDetails: p.eventDetails
                });
            }

            case 'admin_system_event': {
                const p = payload as AdminNotificationPayload;
                return AdminSystemEvent({
                    recipientName,
                    severity: p.severity,
                    eventDetails: p.eventDetails
                });
            }

            case 'feedback_report': {
                const p = payload as FeedbackReportPayload;
                return FeedbackReportEmail({
                    reportType: p.reportType,
                    title: p.reportTitle,
                    description: p.reportDescription,
                    reporterName: p.recipientName,
                    reporterEmail: p.recipientEmail,
                    severity: p.severity,
                    stepsToReproduce: p.stepsToReproduce,
                    expectedResult: p.expectedResult,
                    actualResult: p.actualResult,
                    attachmentUrls: p.attachmentUrls,
                    environment: p.feedbackEnvironment
                });
            }

            case 'subscription_cancelled': {
                const lifecyclePayload = payload as SubscriptionLifecyclePayload;
                return SubscriptionCancelled({
                    recipientName: payload.recipientName,
                    planName: lifecyclePayload.planName,
                    currentPeriodEnd: lifecyclePayload.currentPeriodEnd,
                    baseUrl: this.deps.siteUrl
                });
            }

            case 'subscription_paused': {
                const lifecyclePayload = payload as SubscriptionLifecyclePayload;
                return SubscriptionPaused({
                    recipientName: payload.recipientName,
                    planName: lifecyclePayload.planName,
                    baseUrl: this.deps.siteUrl
                });
            }

            case 'subscription_reactivated': {
                const lifecyclePayload = payload as SubscriptionLifecyclePayload;
                return SubscriptionReactivated({
                    recipientName: payload.recipientName,
                    planName: lifecyclePayload.planName,
                    nextBillingDate: lifecyclePayload.nextBillingDate,
                    baseUrl: this.deps.siteUrl
                });
            }

            default:
                throw new Error(`No template found for notification type: ${type}`);
        }
    }

    /**
     * Generate email subject line based on notification type
     *
     * Uses subject-builder utility to generate Spanish subject lines
     * with proper variable interpolation.
     *
     * @param payload - Notification payload
     * @returns Email subject line in Spanish
     * @private
     */
    private generateSubject(payload: NotificationPayload): string {
        const subjectData: Record<string, string> = {};

        // Extract relevant data for subject placeholders
        if ('planName' in payload) {
            subjectData.planName = payload.planName;
        }

        if ('addonName' in payload) {
            subjectData.addonName = payload.addonName;
        }

        if ('amount' in payload && payload.amount !== undefined) {
            subjectData.amount = payload.amount.toString();
        }

        // Admin notification specific fields
        if (payload.type === 'admin_payment_failure' && 'affectedUserEmail' in payload) {
            subjectData.userEmail = payload.affectedUserEmail || '';
        }

        if (payload.type === 'admin_system_event' && 'eventDetails' in payload) {
            const details = payload.eventDetails as Record<string, unknown>;
            subjectData.eventType = (details.eventType as string) || 'unknown';
        }

        // Feedback report specific fields
        if (payload.type === 'feedback_report' && 'reportType' in payload) {
            subjectData.reportType = payload.reportType;
            subjectData.reportTitle = payload.reportTitle;
        }

        return getSubject(payload.type, subjectData);
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
            await db.insert(billingNotificationLog).values({
                customerId: payload.customerId ?? null,
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
                    idempotencyKey: payload.idempotencyKey || null
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
