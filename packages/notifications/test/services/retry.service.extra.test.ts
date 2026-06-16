/**
 * RetryService — supplemental coverage for SPEC-236
 *
 * Targets the uncovered branches in retry.service.ts:
 *   • processRetries() inner catch — when sendFn throws (not rejects with
 *     {success:false}) the error is caught, the notification is re-enqueued
 *     or permanently-failed based on attemptCount (lines 262-291).
 *   • processRetries() outer catch — when dequeueReady() itself throws,
 *     the error is re-thrown to the caller (lines 300-306).
 *   • processRetries() re-enqueue path when a send fails and attemptCount
 *     is still below max — updatedNotification is enqueued with backoff.
 *
 * @module test/services/retry.service.extra.test
 */

import type Redis from 'ioredis';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTIFICATION_CONSTANTS } from '../../src/constants/notification.constants.js';
import { RetryService, type RetryableNotification } from '../../src/services/retry.service.js';

describe('RetryService — extended coverage', () => {
    let mockRedis: Redis;

    const baseNotification: RetryableNotification = {
        id: 'notif_base',
        payload: JSON.stringify({ type: 'payment_success', recipientEmail: 'u@example.com' }),
        attemptCount: 1,
        lastError: 'Initial error',
        createdAt: new Date().toISOString()
    };

    beforeEach(() => {
        mockRedis = {
            zadd: vi.fn().mockResolvedValue(1),
            expire: vi.fn().mockResolvedValue(1),
            zrangebyscore: vi.fn().mockResolvedValue([]),
            zremrangebyscore: vi.fn().mockResolvedValue(0)
        } as unknown as Redis;

        // Silence logger output in tests (the service uses createLogger internally)
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // processRetries() — inner catch (sendFn throws hard, not just fails)
    // =========================================================================

    describe('processRetries — inner catch when sendFn throws', () => {
        it('should count notification as failed and re-enqueue when sendFn throws and attemptCount is below max', async () => {
            // Arrange
            const service = new RetryService(mockRedis);
            const notification: RetryableNotification = { ...baseNotification, attemptCount: 1 };

            (mockRedis.zrangebyscore as Mock).mockResolvedValue([JSON.stringify(notification)]);
            const sendFn = vi.fn().mockRejectedValue(new Error('Unexpected JSON parse error'));

            // Act
            const stats = await service.processRetries(sendFn);

            // Assert
            expect(stats.processed).toBe(1);
            expect(stats.failed).toBe(1);
            expect(stats.succeeded).toBe(0);
            expect(stats.permanentlyFailed).toBe(0);

            // The notification should have been re-enqueued with incremented attemptCount
            expect(mockRedis.zadd).toHaveBeenCalledWith(
                NOTIFICATION_CONSTANTS.REDIS_RETRY_QUEUE_KEY,
                expect.any(Number),
                expect.stringContaining('"attemptCount":2')
            );
        });

        it('should count as permanentlyFailed and invoke callback when sendFn throws and attemptCount reaches max', async () => {
            // Arrange
            const onPermanentFailure = vi.fn().mockResolvedValue(undefined);
            const service = new RetryService(mockRedis, { onPermanentFailure });

            // attemptCount = MAX - 1 so after incrementing it hits MAX
            const notification: RetryableNotification = {
                ...baseNotification,
                attemptCount: NOTIFICATION_CONSTANTS.MAX_RETRY_ATTEMPTS - 1
            };

            (mockRedis.zrangebyscore as Mock).mockResolvedValue([JSON.stringify(notification)]);
            const sendFn = vi.fn().mockRejectedValue(new Error('Always throws'));

            // Act
            const stats = await service.processRetries(sendFn);

            // Assert
            expect(stats.permanentlyFailed).toBe(1);
            expect(stats.failed).toBe(1); // Still incremented in inner catch
            expect(onPermanentFailure).toHaveBeenCalledTimes(1);
            expect(onPermanentFailure).toHaveBeenCalledWith(
                expect.objectContaining({
                    attemptCount: NOTIFICATION_CONSTANTS.MAX_RETRY_ATTEMPTS,
                    lastError: 'Always throws'
                })
            );
        });

        it('should use "Unknown processing error" when sendFn throws a non-Error value', async () => {
            // Arrange
            const service = new RetryService(mockRedis);
            const notification: RetryableNotification = { ...baseNotification, attemptCount: 1 };

            (mockRedis.zrangebyscore as Mock).mockResolvedValue([JSON.stringify(notification)]);
            const sendFn = vi.fn().mockRejectedValue('a plain string error');

            // Act
            const stats = await service.processRetries(sendFn);

            // Assert
            expect(stats.failed).toBe(1);
            // Re-enqueued with "Unknown processing error" as lastError
            expect(mockRedis.zadd).toHaveBeenCalledWith(
                NOTIFICATION_CONSTANTS.REDIS_RETRY_QUEUE_KEY,
                expect.any(Number),
                expect.stringContaining('"lastError":"Unknown processing error"')
            );
        });

        it('should handle multiple notifications where some throw and some succeed', async () => {
            // Arrange
            const service = new RetryService(mockRedis);
            const notifications: RetryableNotification[] = [
                { ...baseNotification, id: 'n1', attemptCount: 1 },
                { ...baseNotification, id: 'n2', attemptCount: 1 },
                { ...baseNotification, id: 'n3', attemptCount: 1 }
            ];

            (mockRedis.zrangebyscore as Mock).mockResolvedValue(
                notifications.map((n) => JSON.stringify(n))
            );

            const sendFn = vi
                .fn()
                .mockResolvedValueOnce({ success: true }) // n1 succeeds
                .mockRejectedValueOnce(new Error('n2 throws')) // n2 throws
                .mockResolvedValueOnce({ success: false, error: 'n3 fails softly' }); // n3 fails

            // Act
            const stats = await service.processRetries(sendFn);

            // Assert
            expect(stats.processed).toBe(3);
            expect(stats.succeeded).toBe(1);
            expect(stats.failed).toBe(2); // n2 (throw) + n3 (soft fail)
            expect(stats.permanentlyFailed).toBe(0);
        });

        it('should re-enqueue with attemptCount=2 when sendFn throws at attempt 1', async () => {
            // Arrange — attempt 1 + 1 = 2, which is below MAX (3), so it re-enqueues
            const service = new RetryService(mockRedis);
            const notification: RetryableNotification = { ...baseNotification, attemptCount: 1 };

            (mockRedis.zrangebyscore as Mock).mockResolvedValue([JSON.stringify(notification)]);
            const sendFn = vi.fn().mockRejectedValue(new Error('Still failing at attempt 1'));

            // Act
            await service.processRetries(sendFn);

            // Assert — re-enqueued with incremented attemptCount=2
            expect(mockRedis.zadd).toHaveBeenCalledWith(
                NOTIFICATION_CONSTANTS.REDIS_RETRY_QUEUE_KEY,
                expect.any(Number),
                expect.stringContaining('"attemptCount":2')
            );
        });
    });

    // =========================================================================
    // processRetries() — send fails (not throw) and re-enqueue path
    // =========================================================================

    describe('processRetries — soft fail re-enqueue path', () => {
        it('should re-enqueue notification with incremented count when sendFn returns failure', async () => {
            // Arrange
            const service = new RetryService(mockRedis);
            const notification: RetryableNotification = { ...baseNotification, attemptCount: 1 };

            (mockRedis.zrangebyscore as Mock).mockResolvedValue([JSON.stringify(notification)]);
            const sendFn = vi.fn().mockResolvedValue({ success: false, error: 'Still failing' });

            // Act
            const stats = await service.processRetries(sendFn);

            // Assert
            expect(stats.failed).toBe(1);
            expect(stats.permanentlyFailed).toBe(0);
            // Should re-enqueue
            expect(mockRedis.zadd).toHaveBeenCalledWith(
                NOTIFICATION_CONSTANTS.REDIS_RETRY_QUEUE_KEY,
                expect.any(Number),
                expect.stringContaining('"attemptCount":2')
            );
        });

        it('should use "Unknown error during retry" when sendFn returns {success:false} with no error field', async () => {
            // Arrange
            const service = new RetryService(mockRedis);
            const notification: RetryableNotification = { ...baseNotification, attemptCount: 1 };

            (mockRedis.zrangebyscore as Mock).mockResolvedValue([JSON.stringify(notification)]);
            const sendFn = vi.fn().mockResolvedValue({ success: false }); // no error field

            // Act
            await service.processRetries(sendFn);

            // Assert
            expect(mockRedis.zadd).toHaveBeenCalledWith(
                NOTIFICATION_CONSTANTS.REDIS_RETRY_QUEUE_KEY,
                expect.any(Number),
                expect.stringContaining('"lastError":"Unknown error during retry"')
            );
        });
    });

    // =========================================================================
    // processRetries() — outer catch (dequeueReady throws)
    // =========================================================================

    describe('processRetries — outer catch when dequeueReady throws', () => {
        it('should re-throw when dequeueReady() rejects', async () => {
            // Arrange
            const service = new RetryService(mockRedis);
            (mockRedis.zrangebyscore as Mock).mockRejectedValue(
                new Error('Redis cluster unreachable')
            );
            const sendFn = vi.fn();

            // Act & Assert
            await expect(service.processRetries(sendFn)).rejects.toThrow(
                'Redis cluster unreachable'
            );
            expect(sendFn).not.toHaveBeenCalled();
        });

        it('should re-throw non-Error values thrown by dequeueReady()', async () => {
            // Arrange — simulate a non-Error rejection bubbling up through zrangebyscore
            const service = new RetryService(mockRedis);
            (mockRedis.zrangebyscore as Mock).mockRejectedValue('string rejection');
            const sendFn = vi.fn();

            // Act & Assert — the outer catch calls logger.error then re-throws
            await expect(service.processRetries(sendFn)).rejects.toBe('string rejection');
        });
    });

    // =========================================================================
    // processRetries() — no notifications ready
    // =========================================================================

    describe('processRetries — no notifications ready', () => {
        it('should return zero stats when queue is empty', async () => {
            // Arrange
            const service = new RetryService(mockRedis);
            (mockRedis.zrangebyscore as Mock).mockResolvedValue([]);
            const sendFn = vi.fn();

            // Act
            const stats = await service.processRetries(sendFn);

            // Assert
            expect(stats).toEqual({ processed: 0, succeeded: 0, failed: 0, permanentlyFailed: 0 });
            expect(sendFn).not.toHaveBeenCalled();
        });

        it('should return zero stats when Redis is null', async () => {
            // Arrange
            const service = new RetryService(null);
            const sendFn = vi.fn();

            // Act
            const stats = await service.processRetries(sendFn);

            // Assert
            expect(stats).toEqual({ processed: 0, succeeded: 0, failed: 0, permanentlyFailed: 0 });
            expect(sendFn).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // invokePermanentFailureCallback — callback throws (lines inside catch)
    // =========================================================================

    describe('invokePermanentFailureCallback — callback error handling in inner catch path', () => {
        it('should not propagate callback error when sendFn throws and callback throws too', async () => {
            // Arrange
            const onPermanentFailure = vi
                .fn()
                .mockRejectedValue(new Error('Callback DB write failed'));
            const service = new RetryService(mockRedis, { onPermanentFailure });

            const notification: RetryableNotification = {
                ...baseNotification,
                attemptCount: NOTIFICATION_CONSTANTS.MAX_RETRY_ATTEMPTS - 1
            };

            (mockRedis.zrangebyscore as Mock).mockResolvedValue([JSON.stringify(notification)]);
            const sendFn = vi.fn().mockRejectedValue(new Error('Always throws'));

            // Act — should NOT throw even though callback throws
            const stats = await service.processRetries(sendFn);

            // Assert
            expect(stats.permanentlyFailed).toBe(1);
            expect(onPermanentFailure).toHaveBeenCalledTimes(1);
        });
    });
});
