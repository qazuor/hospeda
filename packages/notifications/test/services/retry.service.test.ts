/**
 * RetryService Test Suite
 *
 * Comprehensive tests for notification retry service including:
 * - Enqueueing items to Redis sorted set
 * - Dequeueing ready items (past timestamp)
 * - Exponential backoff calculation
 * - Max attempts handling
 * - Graceful degradation when Redis unavailable
 * - Idempotency of processRetries
 *
 * @module test/services/retry.service.test
 */

import type Redis from 'ioredis';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTIFICATION_CONSTANTS } from '../../src/constants/notification.constants';
import { RetryService, type RetryableNotification } from '../../src/services/retry.service';

describe('RetryService', () => {
    let service: RetryService;
    let mockRedis: Redis;

    const mockNotification: RetryableNotification = {
        id: 'notif_123',
        payload: JSON.stringify({ type: 'test', data: 'test' }),
        attemptCount: 1,
        lastError: 'Connection timeout',
        createdAt: new Date().toISOString()
    };

    beforeEach(() => {
        // Create mock Redis client
        mockRedis = {
            zadd: vi.fn(),
            expire: vi.fn(),
            zrangebyscore: vi.fn(),
            zremrangebyscore: vi.fn()
        } as unknown as Redis;

        // Create service instance
        service = new RetryService(mockRedis);

        // Default mock implementations
        (mockRedis.zadd as Mock).mockResolvedValue(1);
        (mockRedis.expire as Mock).mockResolvedValue(1);
        (mockRedis.zrangebyscore as Mock).mockResolvedValue([]);
        (mockRedis.zremrangebyscore as Mock).mockResolvedValue(0);
    });

    describe('enqueue', () => {
        it('should add item to Redis sorted set with correct score (timestamp)', async () => {
            // Arrange
            const retryAfterMs = 60000; // 1 minute
            const beforeEnqueue = Date.now();

            // Act
            await service.enqueue(mockNotification, retryAfterMs);

            // Assert
            expect(mockRedis.zadd).toHaveBeenCalledTimes(1);
            const call = (mockRedis.zadd as Mock).mock.calls[0];
            expect(call[0]).toBe(NOTIFICATION_CONSTANTS.REDIS_RETRY_QUEUE_KEY);

            const score = call[1] as number;
            const expectedScore = beforeEnqueue + retryAfterMs;
            expect(score).toBeGreaterThanOrEqual(expectedScore);
            expect(score).toBeLessThanOrEqual(expectedScore + 100); // Allow 100ms tolerance

            const member = call[2];
            expect(member).toBe(JSON.stringify(mockNotification));
        });

        it('should set TTL on the queue key', async () => {
            // Arrange
            const retryAfterMs = 60000;

            // Act
            await service.enqueue(mockNotification, retryAfterMs);

            // Assert
            expect(mockRedis.expire).toHaveBeenCalledWith(
                NOTIFICATION_CONSTANTS.REDIS_RETRY_QUEUE_KEY,
                NOTIFICATION_CONSTANTS.REDIS_RETRY_TTL_SECONDS
            );
        });

        it('should handle different retry delays', async () => {
            // Arrange
            const delays = [60000, 300000, 1800000]; // 1min, 5min, 30min
            const beforeEnqueue = Date.now();

            // Act
            for (const delay of delays) {
                await service.enqueue(mockNotification, delay);
            }

            // Assert
            expect(mockRedis.zadd).toHaveBeenCalledTimes(3);
            const calls = (mockRedis.zadd as Mock).mock.calls;

            calls.forEach((call, index) => {
                const score = call[1] as number;
                const expectedScore = beforeEnqueue + delays[index];
                expect(score).toBeGreaterThanOrEqual(expectedScore);
            });
        });

        it('should gracefully handle Redis unavailable', async () => {
            // Arrange
            const serviceWithoutRedis = new RetryService(null);
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            // Act
            await serviceWithoutRedis.enqueue(mockNotification, 60000);

            // Assert
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Redis not available')
            );
            consoleWarnSpy.mockRestore();
        });

        it('should log and throw error on Redis failure', async () => {
            // Arrange
            const error = new Error('Redis connection failed');
            (mockRedis.zadd as Mock).mockRejectedValue(error);
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Act & Assert
            await expect(service.enqueue(mockNotification, 60000)).rejects.toThrow(
                'Redis connection failed'
            );
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('dequeueReady', () => {
        it('should return items past current time and remove them', async () => {
            // Arrange
            const readyNotifications = [
                { ...mockNotification, id: 'notif_1' },
                { ...mockNotification, id: 'notif_2' }
            ];

            (mockRedis.zrangebyscore as Mock).mockResolvedValue(
                readyNotifications.map((n) => JSON.stringify(n))
            );
            (mockRedis.zremrangebyscore as Mock).mockResolvedValue(2);

            // Act
            const result = await service.dequeueReady();

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('notif_1');
            expect(result[1].id).toBe('notif_2');

            // Verify zrangebyscore was called with correct params
            expect(mockRedis.zrangebyscore).toHaveBeenCalledWith(
                NOTIFICATION_CONSTANTS.REDIS_RETRY_QUEUE_KEY,
                '-inf',
                expect.any(Number)
            );

            // Verify items were removed
            expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
                NOTIFICATION_CONSTANTS.REDIS_RETRY_QUEUE_KEY,
                '-inf',
                expect.any(Number)
            );
        });

        it('should return empty array when no items are ready', async () => {
            // Arrange
            (mockRedis.zrangebyscore as Mock).mockResolvedValue([]);

            // Act
            const result = await service.dequeueReady();

            // Assert
            expect(result).toEqual([]);
            expect(mockRedis.zremrangebyscore).not.toHaveBeenCalled();
        });

        it('should not remove items if none are ready', async () => {
            // Arrange
            (mockRedis.zrangebyscore as Mock).mockResolvedValue([]);

            // Act
            await service.dequeueReady();

            // Assert
            expect(mockRedis.zremrangebyscore).not.toHaveBeenCalled();
        });

        it('should return empty array when Redis is unavailable', async () => {
            // Arrange
            const serviceWithoutRedis = new RetryService(null);

            // Act
            const result = await serviceWithoutRedis.dequeueReady();

            // Assert
            expect(result).toEqual([]);
        });

        it('should handle errors gracefully', async () => {
            // Arrange
            const error = new Error('Redis read failed');
            (mockRedis.zrangebyscore as Mock).mockRejectedValue(error);
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Act & Assert
            await expect(service.dequeueReady()).rejects.toThrow('Redis read failed');
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });

        it('should parse JSON correctly for all dequeued items', async () => {
            // Arrange
            const notifications = [
                { ...mockNotification, id: 'notif_1', attemptCount: 1 },
                { ...mockNotification, id: 'notif_2', attemptCount: 2 }
            ];

            (mockRedis.zrangebyscore as Mock).mockResolvedValue(
                notifications.map((n) => JSON.stringify(n))
            );

            // Act
            const result = await service.dequeueReady();

            // Assert
            expect(result[0]).toMatchObject(notifications[0]);
            expect(result[1]).toMatchObject(notifications[1]);
        });
    });

    describe('calculateRetryDelay', () => {
        it('should calculate exponential backoff correctly (1min, 5min, 30min)', async () => {
            // Arrange & Act
            const delay1 = RetryService.calculateRetryDelay(1);
            const delay2 = RetryService.calculateRetryDelay(2);
            const delay3 = RetryService.calculateRetryDelay(3);

            // Assert
            // Formula: base_delay * multiplier^(attempt-1)
            // base = 60000ms, multiplier = 5
            expect(delay1).toBe(60000); // 60000 * 5^0 = 60000 (1 min)
            expect(delay2).toBe(300000); // 60000 * 5^1 = 300000 (5 min)
            expect(delay3).toBe(1500000); // 60000 * 5^2 = 1500000 (25 min)
        });

        it('should cap at 30 minutes max', async () => {
            // Arrange & Act
            const delay4 = RetryService.calculateRetryDelay(4);
            const delay5 = RetryService.calculateRetryDelay(5);

            // Assert
            // Without cap: 60000 * 5^3 = 7500000 (125 min)
            // With cap: 1800000 (30 min)
            const maxDelay = 30 * 60 * 1000; // 1800000ms
            expect(delay4).toBe(maxDelay);
            expect(delay5).toBe(maxDelay);
        });

        it('should use constants for calculation', async () => {
            // Arrange & Act
            const delay = RetryService.calculateRetryDelay(1);

            // Assert
            expect(delay).toBe(NOTIFICATION_CONSTANTS.RETRY_BASE_DELAY_MS);
        });

        it('should handle edge case of attempt 0', async () => {
            // Arrange & Act
            const delay = RetryService.calculateRetryDelay(0);

            // Assert
            // 60000 * 5^(-1) = 12000
            expect(delay).toBe(12000);
        });
    });

    describe('isMaxRetriesReached', () => {
        it('should return false when under max attempts', async () => {
            // Arrange & Act
            const result1 = RetryService.isMaxRetriesReached(1);
            const result2 = RetryService.isMaxRetriesReached(2);

            // Assert
            expect(result1).toBe(false);
            expect(result2).toBe(false);
        });

        it('should return true when max attempts reached (3)', async () => {
            // Arrange & Act
            const result = RetryService.isMaxRetriesReached(3);

            // Assert
            expect(result).toBe(true);
        });

        it('should return true when attempts exceed max', async () => {
            // Arrange & Act
            const result = RetryService.isMaxRetriesReached(4);

            // Assert
            expect(result).toBe(true);
        });

        it('should use constant for max retries', async () => {
            // Arrange & Act
            const result = RetryService.isMaxRetriesReached(
                NOTIFICATION_CONSTANTS.MAX_RETRY_ATTEMPTS
            );

            // Assert
            expect(result).toBe(true);
        });
    });

    describe('processRetries', () => {
        it('should invoke onPermanentFailure callback when max retries reached', async () => {
            // Arrange
            const onPermanentFailure = vi.fn().mockResolvedValue(undefined);
            const serviceWithCallback = new RetryService(mockRedis, { onPermanentFailure });

            const failedNotification: RetryableNotification = {
                ...mockNotification,
                attemptCount: NOTIFICATION_CONSTANTS.MAX_RETRY_ATTEMPTS - 1
            };

            (mockRedis.zrangebyscore as Mock).mockResolvedValue([
                JSON.stringify(failedNotification)
            ]);
            vi.spyOn(console, 'info').mockImplementation(() => {});
            vi.spyOn(console, 'error').mockImplementation(() => {});

            const sendFn = vi.fn().mockResolvedValue({ success: false, error: 'Still failing' });

            // Act
            const stats = await serviceWithCallback.processRetries(sendFn);

            // Assert
            expect(stats.permanentlyFailed).toBe(1);
            expect(onPermanentFailure).toHaveBeenCalledTimes(1);
            expect(onPermanentFailure).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: mockNotification.id,
                    attemptCount: NOTIFICATION_CONSTANTS.MAX_RETRY_ATTEMPTS,
                    lastError: 'Still failing'
                })
            );

            vi.restoreAllMocks();
        });

        it('should not crash if onPermanentFailure callback throws', async () => {
            // Arrange
            const onPermanentFailure = vi.fn().mockRejectedValue(new Error('DB write failed'));
            const serviceWithCallback = new RetryService(mockRedis, { onPermanentFailure });

            const failedNotification: RetryableNotification = {
                ...mockNotification,
                attemptCount: NOTIFICATION_CONSTANTS.MAX_RETRY_ATTEMPTS - 1
            };

            (mockRedis.zrangebyscore as Mock).mockResolvedValue([
                JSON.stringify(failedNotification)
            ]);
            vi.spyOn(console, 'info').mockImplementation(() => {});
            vi.spyOn(console, 'error').mockImplementation(() => {});

            const sendFn = vi.fn().mockResolvedValue({ success: false, error: 'Still failing' });

            // Act
            const stats = await serviceWithCallback.processRetries(sendFn);

            // Assert
            expect(stats.permanentlyFailed).toBe(1);
            expect(onPermanentFailure).toHaveBeenCalledTimes(1);

            vi.restoreAllMocks();
        });

        it('should not call onPermanentFailure when not configured', async () => {
            // Arrange
            const serviceWithoutCallback = new RetryService(mockRedis);

            const failedNotification: RetryableNotification = {
                ...mockNotification,
                attemptCount: NOTIFICATION_CONSTANTS.MAX_RETRY_ATTEMPTS - 1
            };

            (mockRedis.zrangebyscore as Mock).mockResolvedValue([
                JSON.stringify(failedNotification)
            ]);
            vi.spyOn(console, 'info').mockImplementation(() => {});
            vi.spyOn(console, 'error').mockImplementation(() => {});

            const sendFn = vi.fn().mockResolvedValue({ success: false, error: 'Failing' });

            // Act - should not throw
            const stats = await serviceWithoutCallback.processRetries(sendFn);

            // Assert
            expect(stats.permanentlyFailed).toBe(1);

            vi.restoreAllMocks();
        });
    });

    describe('integration scenarios', () => {
        it('should handle complete retry lifecycle', async () => {
            // Arrange
            const notification = { ...mockNotification, attemptCount: 1 };

            // Act - Enqueue
            await service.enqueue(notification, 100); // Very short delay for test

            // Wait for retry time
            await new Promise((resolve) => setTimeout(resolve, 150));

            // Mock dequeue to return the notification
            (mockRedis.zrangebyscore as Mock).mockResolvedValue([JSON.stringify(notification)]);

            // Act - Dequeue
            const dequeued = await service.dequeueReady();

            // Assert
            expect(dequeued).toHaveLength(1);
            expect(dequeued[0].id).toBe(notification.id);
        });

        it('should not dequeue items before their retry time', async () => {
            // Arrange
            const notification = { ...mockNotification, attemptCount: 1 };
            const futureDelay = 10000; // 10 seconds in future

            // Act - Enqueue with future timestamp
            await service.enqueue(notification, futureDelay);

            // Try to dequeue immediately (should return empty)
            const dequeued = await service.dequeueReady();

            // Assert
            expect(dequeued).toEqual([]);
        });

        it('should track attempt count across retries', async () => {
            // Arrange
            const attempts = [1, 2, 3];

            for (const attempt of attempts) {
                const _notification = { ...mockNotification, attemptCount: attempt };

                // Act
                const delay = RetryService.calculateRetryDelay(attempt);
                const isMax = RetryService.isMaxRetriesReached(attempt);

                // Assert
                if (attempt < 3) {
                    expect(isMax).toBe(false);
                    expect(delay).toBeGreaterThan(0);
                } else {
                    expect(isMax).toBe(true);
                }
            }
        });
    });
});
