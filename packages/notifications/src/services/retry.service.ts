import { createLogger } from '@repo/logger';
import type Redis from 'ioredis';
import { NOTIFICATION_CONSTANTS } from '../constants/notification.constants.js';

const logger = createLogger('notifications');

/**
 * Retryable notification data structure
 */
export interface RetryableNotification {
    /** Unique notification ID */
    id: string;
    /** JSON-serialized notification payload */
    payload: string;
    /** Number of retry attempts made */
    attemptCount: number;
    /** Last error message */
    lastError: string;
    /** Timestamp when notification was first created */
    createdAt: string;
}

/**
 * Configuration options for RetryService
 */
export interface RetryServiceOptions {
    /** Callback invoked when a notification permanently fails after exhausting all retries */
    onPermanentFailure?: (notification: RetryableNotification) => Promise<void>;
}

/**
 * RetryService
 * Manages retry queue for failed notifications using Redis sorted set
 * with exponential backoff strategy
 */
export class RetryService {
    private readonly redis: Redis | null;
    private readonly options: RetryServiceOptions;

    constructor(redis: Redis | null, options?: RetryServiceOptions) {
        this.redis = redis;
        this.options = options ?? {};
    }

    /**
     * Enqueue a failed notification for retry
     *
     * @param notification - Notification data to retry
     * @param retryAfterMs - Milliseconds to wait before retry
     */
    async enqueue(notification: RetryableNotification, retryAfterMs: number): Promise<void> {
        // If Redis is not available, log warning and skip gracefully
        if (!this.redis) {
            logger.warn(
                `[RetryService] Redis not available, cannot enqueue notification ${notification.id} for retry`
            );
            return;
        }

        try {
            const score = Date.now() + retryAfterMs;
            const member = JSON.stringify(notification);

            // Add to sorted set with score as retry timestamp
            await this.redis.zadd(NOTIFICATION_CONSTANTS.REDIS_RETRY_QUEUE_KEY, score, member);

            // Set TTL on the key to prevent infinite retention
            await this.redis.expire(
                NOTIFICATION_CONSTANTS.REDIS_RETRY_QUEUE_KEY,
                NOTIFICATION_CONSTANTS.REDIS_RETRY_TTL_SECONDS
            );
        } catch (error) {
            logger.error(
                `[RetryService] Failed to enqueue notification ${notification.id}:`,
                error
            );
            throw error;
        }
    }

    /**
     * Get all notifications ready for retry (score <= now)
     *
     * @returns Array of notifications ready to be retried
     */
    async dequeueReady(): Promise<RetryableNotification[]> {
        // If Redis is not available, return empty array
        if (!this.redis) {
            return [];
        }

        try {
            const now = Date.now();

            // Get all items with score <= now (ready for retry)
            const items = await this.redis.zrangebyscore(
                NOTIFICATION_CONSTANTS.REDIS_RETRY_QUEUE_KEY,
                '-inf',
                now
            );

            // Parse notifications
            const notifications: RetryableNotification[] = items.map((item) => JSON.parse(item));

            // Remove dequeued items from the sorted set
            if (notifications.length > 0) {
                await this.redis.zremrangebyscore(
                    NOTIFICATION_CONSTANTS.REDIS_RETRY_QUEUE_KEY,
                    '-inf',
                    now
                );
            }

            return notifications;
        } catch (error) {
            logger.error('[RetryService] Failed to dequeue ready notifications:', error);
            throw error;
        }
    }

    /**
     * Calculate retry delay with exponential backoff
     *
     * Formula: base_delay * multiplier^(attempt-1)
     * Example: 60s, 300s (5min), 1500s (25min) - capped at 30min
     *
     * @param attemptCount - Current attempt number (1-based)
     * @returns Delay in milliseconds
     */
    static calculateRetryDelay(attemptCount: number): number {
        const baseDelay = NOTIFICATION_CONSTANTS.RETRY_BASE_DELAY_MS;
        const multiplier = NOTIFICATION_CONSTANTS.RETRY_BACKOFF_MULTIPLIER;

        // Calculate exponential backoff
        const delay = baseDelay * multiplier ** (attemptCount - 1);

        // Cap at 30 minutes (1800000ms)
        const maxDelay = 30 * 60 * 1000;

        return Math.min(delay, maxDelay);
    }

    /**
     * Check if max retries exceeded
     *
     * @param attemptCount - Current attempt count
     * @returns True if max retries reached
     */
    static isMaxRetriesReached(attemptCount: number): boolean {
        return attemptCount >= NOTIFICATION_CONSTANTS.MAX_RETRY_ATTEMPTS;
    }

    /**
     * Process all retries ready for sending
     *
     * Dequeues notifications ready for retry, attempts to send them using the provided
     * send function, and handles success/failure outcomes including re-enqueueing for
     * additional retries or marking as permanently failed.
     *
     * @param sendFn - Function to send a notification payload, returns delivery result
     * @returns Statistics about processed retries
     *
     * @example
     * ```ts
     * const retryService = new RetryService(redisClient);
     * const notificationService = new NotificationService({ ... });
     *
     * // Process retries using notification service's send method
     * const stats = await retryService.processRetries(
     *   async (payload) => await notificationService.send(payload)
     * );
     *
     * console.log(`Processed: ${stats.processed}, Succeeded: ${stats.succeeded}`);
     * ```
     */
    async processRetries(
        sendFn: (payload: unknown) => Promise<{ success: boolean; error?: string }>
    ): Promise<{
        processed: number;
        succeeded: number;
        failed: number;
        permanentlyFailed: number;
    }> {
        // If Redis is not available, return empty stats
        if (!this.redis) {
            logger.warn('[RetryService] Redis not available, cannot process retries');
            return { processed: 0, succeeded: 0, failed: 0, permanentlyFailed: 0 };
        }

        let processed = 0;
        let succeeded = 0;
        let failed = 0;
        let permanentlyFailed = 0;

        try {
            // Get all notifications ready for retry
            const notifications = await this.dequeueReady();

            if (notifications.length === 0) {
                logger.info('[RetryService] No notifications ready for retry');
                return { processed: 0, succeeded: 0, failed: 0, permanentlyFailed: 0 };
            }

            logger.info(
                `[RetryService] Processing ${notifications.length} notifications ready for retry`
            );

            // Process each notification
            for (const notification of notifications) {
                processed++;

                try {
                    // Parse the notification payload
                    const payload = JSON.parse(notification.payload);

                    // Attempt to send the notification
                    const result = await sendFn(payload);

                    if (result.success) {
                        succeeded++;
                        logger.info(
                            `[RetryService] Retry succeeded for notification ${notification.id} (attempt ${notification.attemptCount})`
                        );
                    } else {
                        // Send failed - increment attempt count
                        const newAttemptCount = notification.attemptCount + 1;
                        const errorMessage = result.error || 'Unknown error during retry';

                        // Check if max retries reached
                        if (RetryService.isMaxRetriesReached(newAttemptCount)) {
                            permanentlyFailed++;
                            logger.error(
                                `[RetryService] Max retries (${NOTIFICATION_CONSTANTS.MAX_RETRY_ATTEMPTS}) reached for notification ${notification.id}, marking as permanently failed`
                            );

                            await this.invokePermanentFailureCallback({
                                ...notification,
                                attemptCount: newAttemptCount,
                                lastError: errorMessage
                            });
                        } else {
                            // Re-enqueue for another retry
                            const updatedNotification: RetryableNotification = {
                                ...notification,
                                attemptCount: newAttemptCount,
                                lastError: errorMessage
                            };

                            const retryDelay = RetryService.calculateRetryDelay(newAttemptCount);

                            await this.enqueue(updatedNotification, retryDelay);

                            failed++;
                            logger.warn(
                                `[RetryService] Retry failed for notification ${notification.id} (attempt ${newAttemptCount}), re-enqueueing with delay ${retryDelay}ms`
                            );
                        }
                    }
                } catch (error) {
                    // Error processing this specific notification
                    failed++;
                    logger.error(
                        `[RetryService] Error processing retry for notification ${notification.id}:`,
                        error
                    );

                    // Re-enqueue with incremented attempt count if not at max
                    const newAttemptCount = notification.attemptCount + 1;
                    if (RetryService.isMaxRetriesReached(newAttemptCount)) {
                        permanentlyFailed++;
                        await this.invokePermanentFailureCallback({
                            ...notification,
                            attemptCount: newAttemptCount,
                            lastError:
                                error instanceof Error ? error.message : 'Unknown processing error'
                        });
                    } else {
                        const updatedNotification: RetryableNotification = {
                            ...notification,
                            attemptCount: newAttemptCount,
                            lastError:
                                error instanceof Error ? error.message : 'Unknown processing error'
                        };

                        const retryDelay = RetryService.calculateRetryDelay(newAttemptCount);
                        await this.enqueue(updatedNotification, retryDelay);
                    }
                }
            }

            logger.info('[RetryService] Retry processing complete', {
                processed,
                succeeded,
                failed,
                permanentlyFailed
            });

            return { processed, succeeded, failed, permanentlyFailed };
        } catch (error) {
            logger.error('[RetryService] Failed to process retries:', error);
            throw error;
        }
    }

    /**
     * Invokes the onPermanentFailure callback if configured.
     * Errors from the callback are logged but do not propagate.
     */
    private async invokePermanentFailureCallback(
        notification: RetryableNotification
    ): Promise<void> {
        if (!this.options.onPermanentFailure) {
            return;
        }

        try {
            await this.options.onPermanentFailure(notification);
        } catch (callbackError) {
            logger.error(
                `[RetryService] onPermanentFailure callback failed for notification ${notification.id}:`,
                callbackError
            );
        }
    }
}
