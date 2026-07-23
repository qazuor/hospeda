/**
 * Notification Helper
 *
 * Fire-and-forget utility for sending notifications from anywhere in the API.
 * Failures are handled silently by the retry service.
 *
 * @module utils/notification-helper
 */

import { getDb } from '@repo/db';
import type { NotificationPayload, SendNotificationOptions } from '@repo/notifications';
import {
    BrevoEmailTransport,
    createEmailClient,
    NotificationService,
    PreferenceService,
    RetryService
} from '@repo/notifications';
import { env } from './env';
import { apiLogger } from './logger';
import { getRedisClient } from './redis';

/**
 * Lazy singleton for NotificationService
 * Initialized only when first needed
 */
let notificationServiceInstance: NotificationService | null = null;

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
 * Connects RetryService to the shared Redis client so transactional retry
 * logic is live. If Redis is not configured (HOSPEDA_REDIS_URL unset),
 * RetryService is instantiated with `null` and degrades to logging-only
 * behavior per its own contract.
 *
 * @returns NotificationService instance or null if initialization failed
 */
async function getNotificationService(): Promise<NotificationService | null> {
    // Return existing instance if already initialized
    if (notificationServiceInstance) {
        return notificationServiceInstance;
    }

    try {
        // Check if HOSPEDA_EMAIL_API_KEY is set
        if (!env.HOSPEDA_EMAIL_API_KEY) {
            apiLogger.warn(
                'HOSPEDA_EMAIL_API_KEY not set in environment. Notifications will not be sent.'
            );
            return null;
        }

        // Create email client with validated env config
        const emailClient = createEmailClient({ apiKey: env.HOSPEDA_EMAIL_API_KEY });

        // Create email transport with validated env config
        const emailTransport = new BrevoEmailTransport(emailClient, {
            fromEmail: env.HOSPEDA_EMAIL_FROM_EMAIL ?? 'noreply@hospeda.com.ar',
            fromName: env.HOSPEDA_EMAIL_FROM_NAME ?? 'Hospeda'
        });

        // Create preference service with mock functions
        const preferenceService = new PreferenceService({
            getUserSettings: mockGetUserSettings,
            updateUserSettings: mockUpdateUserSettings
        });

        // Connect RetryService to the shared Redis client (T-101-46 / SPEC-101 §8.1).
        // If Redis is unavailable, RetryService gracefully no-ops instead of throwing.
        const redis = await getRedisClient();
        const retryService = new RetryService(redis ?? null);
        if (!redis) {
            apiLogger.warn('Redis client unavailable; RetryService will skip retries silently.');
        }

        // Get database instance
        const db = getDb();

        // Create NotificationService instance with siteUrl from validated env
        notificationServiceInstance = new NotificationService({
            emailTransport,
            preferenceService,
            retryService,
            db,
            logger: apiLogger,
            siteUrl: env.HOSPEDA_SITE_URL ?? 'https://hospeda.com.ar'
        });

        apiLogger.info('NotificationService initialized successfully');

        return notificationServiceInstance;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Do NOT set a permanent flag - retry on next call (GAP-031-86)
        apiLogger.error(
            `Failed to initialize NotificationService (will retry on next call): ${errorMessage}`
        );
        return null;
    }
}

/**
 * Delivery-aware outcome of an attempted notification send.
 *
 * `delivered` is TRUE only when the notification service reported a successful send
 * (`result.success`). A missing service (email key unset / init failure), a non-success
 * result, or a thrown error all yield `delivered: false`. Callers with a correctness or
 * legal dependency on the send actually going out (e.g. the HOS-176 price-increase advance
 * notice) MUST gate on this, never on `sendNotification` merely returning.
 */
export interface NotificationSendOutcome {
    readonly delivered: boolean;
}

/**
 * Send a notification and REPORT whether it was delivered.
 *
 * Same fire-and-forget safety as {@link sendNotification} (never throws), but returns a
 * {@link NotificationSendOutcome} so a caller that must not proceed on a silent
 * non-delivery can branch on it. Use this instead of {@link sendNotification} whenever
 * "the notice was actually sent" is a precondition for a subsequent state change.
 *
 * @param payload - Notification payload.
 * @param options - Optional send options.
 * @returns `{ delivered: true }` only on a successful send; `{ delivered: false }` for a
 *   missing service, a non-success result, or any thrown error.
 */
export async function trySendNotification(
    payload: NotificationPayload,
    options?: SendNotificationOptions
): Promise<NotificationSendOutcome> {
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
        const notificationService = await getNotificationService();

        // If service not available, log and skip gracefully. NOT delivered.
        if (!notificationService) {
            apiLogger.debug(
                {
                    type: payload.type,
                    recipientEmail: payload.recipientEmail
                },
                'NotificationService not available, skipping notification'
            );
            return { delivered: false };
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
            return { delivered: true };
        }
        apiLogger.warn(
            {
                type: payload.type,
                recipientEmail: payload.recipientEmail,
                status: result.status,
                error: 'error' in result ? result.error : result.skippedReason
            },
            'Notification not sent'
        );
        return { delivered: false };
    } catch (error) {
        // Log but don't throw - fire-and-forget pattern. NOT delivered.
        apiLogger.error(
            {
                type: payload.type,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to send notification'
        );
        return { delivered: false };
    }
}

/**
 * Send a notification asynchronously (fire-and-forget)
 *
 * This function returns a promise but is designed to be called without await.
 * Errors are logged but not thrown, allowing the calling code to continue. Thin wrapper
 * over {@link trySendNotification} that discards the delivery outcome — use
 * {@link trySendNotification} directly when delivery matters.
 *
 * @param payload - Notification payload
 * @returns Promise that resolves/rejects silently
 */
export async function sendNotification(
    payload: NotificationPayload,
    options?: SendNotificationOptions
): Promise<void> {
    await trySendNotification(payload, options);
}
