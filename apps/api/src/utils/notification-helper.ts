/**
 * Notification Helper
 *
 * Fire-and-forget utility for sending notifications from anywhere in the API.
 * Failures are handled silently by the retry service.
 *
 * @module utils/notification-helper
 */

import type { NotificationPayload } from '@repo/notifications';
import { apiLogger } from './logger';

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
export async function sendNotification(payload: NotificationPayload): Promise<void> {
    try {
        apiLogger.debug(
            {
                type: payload.type,
                recipientEmail: payload.recipientEmail,
                userId: payload.userId,
                customerId: payload.customerId
            },
            'Queuing notification (async)'
        );

        // TODO: Initialize NotificationService and send
        // For now, just log - actual implementation will be added when NotificationService is wired up
        // This allows the webhook to work without blocking on notification infrastructure

        // When implementing:
        // 1. Get or create NotificationService instance (singleton)
        // 2. Call notificationService.send(payload)
        // 3. Handle errors silently (retry service picks up failures)

        apiLogger.info(
            {
                type: payload.type,
                recipientEmail: payload.recipientEmail
            },
            'Notification queued (implementation pending)'
        );
    } catch (error) {
        // Log but don't throw - fire-and-forget pattern
        apiLogger.error(
            {
                type: payload.type,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to queue notification'
        );
    }
}
