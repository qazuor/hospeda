/**
 * Notification Helper
 *
 * Fire-and-forget utility for sending notifications from anywhere in the API.
 * Failures are handled silently by the retry service.
 *
 * @module utils/notification-helper
 */

import { getDb } from '@repo/db';
import {
    NotificationService,
    PreferenceService,
    ResendEmailTransport,
    type RetryService,
    createResendClient
} from '@repo/notifications';
import type { NotificationPayload, SendNotificationOptions } from '@repo/notifications';
import { apiLogger } from './logger';

/**
 * Lazy singleton for NotificationService
 * Initialized only when first needed
 */
let notificationServiceInstance: NotificationService | null = null;
let initializationFailed = false;

/**
 * Simple mock functions for PreferenceService
 * Returns null (user has no preferences) since we don't have user settings table yet
 */
const mockGetUserSettings = async (_userId: string): Promise<Record<string, unknown> | null> => {
    return null;
};

const mockUpdateUserSettings = async (
    _userId: string,
    _settings: Record<string, unknown>
): Promise<void> => {
    // No-op for now
};

/**
 * Get or create NotificationService instance
 *
 * @returns NotificationService instance or null if initialization failed
 */
function getNotificationService(): NotificationService | null {
    // Return null if initialization previously failed
    if (initializationFailed) {
        return null;
    }

    // Return existing instance if already initialized
    if (notificationServiceInstance) {
        return notificationServiceInstance;
    }

    try {
        // Check if RESEND_API_KEY is set
        if (!process.env.RESEND_API_KEY) {
            apiLogger.warn(
                'RESEND_API_KEY not set in environment. Notifications will not be sent.'
            );
            initializationFailed = true;
            return null;
        }

        // Create Resend client
        const resendClient = createResendClient();

        // Create email transport
        const emailTransport = new ResendEmailTransport(resendClient);

        // Create preference service with mock functions
        const preferenceService = new PreferenceService({
            getUserSettings: mockGetUserSettings,
            updateUserSettings: mockUpdateUserSettings
        });

        // Retry service is optional (requires Redis)
        // For now, we pass null - notifications will be logged but not retried
        const retryService: RetryService | null = null;

        // Get database instance
        const db = getDb();

        // Create NotificationService instance
        notificationServiceInstance = new NotificationService({
            emailTransport,
            preferenceService,
            retryService,
            db,
            logger: apiLogger
        });

        apiLogger.info('NotificationService initialized successfully');

        return notificationServiceInstance;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        apiLogger.warn(
            `Failed to initialize NotificationService: ${errorMessage}. Notifications will not be sent.`
        );
        initializationFailed = true;
        return null;
    }
}

/**
 * Send a notification asynchronously (fire-and-forget)
 *
 * This function returns a promise but is designed to be called without await.
 * Errors are logged but not thrown, allowing the calling code to continue.
 *
 * @param payload - Notification payload
 * @returns Promise that resolves/rejects silently
 *
 * @example
 * ```ts
 * // Fire-and-forget (recommended)
 * sendNotification({
 *   type: NotificationType.ADDON_PURCHASE,
 *   recipientEmail: 'user@example.com',
 *   ...
 * }).catch(() => {}); // Silent catch
 *
 * // Or with explicit catch
 * try {
 *   sendNotification(...).catch((err) => {
 *     logger.debug('Notification failed (will retry)', err);
 *   });
 * } catch (err) {
 *   // This shouldn't happen
 * }
 * ```
 */
export async function sendNotification(
    payload: NotificationPayload,
    options?: SendNotificationOptions
): Promise<void> {
    try {
        apiLogger.debug(
            {
                type: payload.type,
                recipientEmail: payload.recipientEmail,
                userId: payload.userId,
                customerId: payload.customerId
            },
            'Sending notification (async)'
        );

        // Get NotificationService instance
        const notificationService = getNotificationService();

        // If service not available, log and skip gracefully
        if (!notificationService) {
            apiLogger.debug(
                {
                    type: payload.type,
                    recipientEmail: payload.recipientEmail
                },
                'NotificationService not available, skipping notification'
            );
            return;
        }

        // Send notification via NotificationService
        const result = await notificationService.send(payload, options);

        if (result.success) {
            apiLogger.info(
                {
                    type: payload.type,
                    recipientEmail: payload.recipientEmail,
                    messageId: result.messageId
                },
                'Notification sent successfully'
            );
        } else {
            apiLogger.warn(
                {
                    type: payload.type,
                    recipientEmail: payload.recipientEmail,
                    status: result.status,
                    error: 'error' in result ? result.error : result.skippedReason
                },
                'Notification not sent'
            );
        }
    } catch (error) {
        // Log but don't throw - fire-and-forget pattern
        apiLogger.error(
            {
                type: payload.type,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to send notification'
        );
    }
}
