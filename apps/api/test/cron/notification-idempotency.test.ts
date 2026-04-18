/**
 * Unit Tests: Notification Idempotency Key Persistence
 *
 * Tests that notification idempotency keys are stored in Redis when available,
 * with fallback to in-memory Map (with TTL) when Redis is not configured.
 *
 * @module test/cron/notification-idempotency
 */

import { RetryService } from '@repo/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    notificationScheduleJob,
    resetSentNotificationsFallback
} from '../../src/cron/jobs/notification-schedule.job';
import type { CronJobContext } from '../../src/cron/types';

// withTransaction mock must be hoisted so it is available inside vi.mock() factory.
const { mockDbWithTransactionIdempotency } = vi.hoisted(() => {
    const tx = {
        execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined)
    };
    const withTx = vi.fn(async <T>(callback: (tx: typeof tx) => Promise<T>) => callback(tx));
    return { mockDbWithTransactionIdempotency: withTx };
});

// Mock @repo/db — required for pg_try_advisory_xact_lock concurrency guard (GAP-034).
// withTransaction is required because the job now wraps all work in a transaction.
vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined)
    }),
    withTransaction: mockDbWithTransactionIdempotency,
    billingNotificationLog: {
        customerId: 'customer_id',
        type: 'type',
        sentAt: 'sent_at',
        id: 'id',
        status: 'status',
        errorMessage: 'error_message'
    },
    eq: vi.fn((_col: unknown, _val: unknown) => ({ __eq: true })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        __sql: true,
        strings,
        values
    }))
}));

// Mock billing middleware
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

// Mock TrialService
vi.mock('../../src/services/trial.service', () => ({
    TrialService: vi.fn()
}));

// Mock notification helper
vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn()
}));

// Mock notification retry service
vi.mock('../../src/services/notification-retry.service', () => ({
    processDbNotificationRetries: vi.fn().mockResolvedValue({
        processed: 0,
        succeeded: 0,
        failed: 0,
        permanentlyFailed: 0
    })
}));

// Mock billing settings loader
vi.mock('../../src/utils/billing-settings', () => ({
    loadBillingSettings: vi.fn().mockResolvedValue({
        gracePeriodDays: 7,
        maxPaymentRetries: 3,
        retryIntervalHours: 24,
        trialExpiryReminderDays: 3,
        sendTrialExpiryReminder: true,
        sendPaymentFailedNotification: true
    })
}));

// Mock Redis client - configurable per test
const mockRedisSet = vi.fn().mockResolvedValue('OK');
const mockRedisExists = vi.fn().mockResolvedValue(0);
const mockGetRedisClient = vi.fn();

vi.mock('../../src/utils/redis', () => ({
    getRedisClient: (...args: unknown[]) => mockGetRedisClient(...args)
}));

// Mock @repo/notifications
vi.mock('@repo/notifications', async () => {
    const actual = await vi.importActual('@repo/notifications');
    return {
        ...actual,
        RetryService: vi.fn()
    };
});

// Import mocked modules after mocking
import { getQZPayBilling } from '../../src/middlewares/billing';
import { TrialService } from '../../src/services/trial.service';
import { sendNotification } from '../../src/utils/notification-helper';

/**
 * Helper to create mock CronJobContext
 */
function createMockContext(overrides?: Partial<CronJobContext>): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        },
        startedAt: new Date('2024-06-15T08:00:00Z'),
        dryRun: false,
        ...overrides
    };
}

describe('Notification Idempotency Key Persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetSentNotificationsFallback();
        mockRedisSet.mockResolvedValue('OK');
        mockRedisExists.mockResolvedValue(0);
        process.env.HOSPEDA_SITE_URL = 'https://hospeda.com';
    });

    describe('Redis-backed idempotency', () => {
        it('should store idempotency key in Redis when available', async () => {
            // Arrange
            const mockRedis = {
                set: mockRedisSet,
                exists: mockRedisExists
            };
            mockGetRedisClient.mockResolvedValue(mockRedis);

            const ctx = createMockContext();
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 3);

            const mockTrialService = {
                findTrialsEndingSoon: vi
                    .fn()
                    .mockResolvedValueOnce([
                        {
                            id: 'sub-1',
                            customerId: 'cust-1',
                            userEmail: 'user@test.com',
                            userName: 'Test User',
                            userId: 'user-1',
                            planSlug: 'owner-basico',
                            trialEnd,
                            daysRemaining: 3
                        }
                    ])
                    .mockResolvedValueOnce([]) // 1 day - empty
            };

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: [] })
                }
            };

            vi.mocked(getQZPayBilling).mockReturnValue(
                mockBilling as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(TrialService).mockImplementation(
                () => mockTrialService as unknown as InstanceType<typeof TrialService>
            );
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as unknown as InstanceType<typeof RetryService>
            );

            // Act
            await notificationScheduleJob.handler(ctx);

            // Assert - Redis set was called with idempotency key + TTL
            expect(mockRedisSet).toHaveBeenCalledWith(
                expect.stringContaining('notif:sent:'),
                '1',
                'EX',
                expect.any(Number) // 25 * 60 * 60
            );
        });

        it('should check Redis for existing key before sending', async () => {
            // Arrange - key already exists in Redis
            mockRedisExists.mockResolvedValue(1); // Key exists
            const mockRedis = {
                set: mockRedisSet,
                exists: mockRedisExists
            };
            mockGetRedisClient.mockResolvedValue(mockRedis);

            const ctx = createMockContext();
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 3);

            const mockTrialService = {
                findTrialsEndingSoon: vi
                    .fn()
                    .mockResolvedValueOnce([
                        {
                            id: 'sub-1',
                            customerId: 'cust-1',
                            userEmail: 'user@test.com',
                            userName: 'Test User',
                            userId: 'user-1',
                            planSlug: 'owner-basico',
                            trialEnd,
                            daysRemaining: 3
                        }
                    ])
                    .mockResolvedValueOnce([]) // 1 day - empty
            };

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: [] })
                }
            };

            vi.mocked(getQZPayBilling).mockReturnValue(
                mockBilling as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(TrialService).mockImplementation(
                () => mockTrialService as unknown as InstanceType<typeof TrialService>
            );
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as unknown as InstanceType<typeof RetryService>
            );

            // Act
            await notificationScheduleJob.handler(ctx);

            // Assert - notification was NOT sent (duplicate detected via Redis)
            expect(sendNotification).not.toHaveBeenCalled();
            expect(mockRedisExists).toHaveBeenCalled();
        });
    });

    describe('In-memory fallback', () => {
        it('should use in-memory Set when Redis is not available', async () => {
            // Arrange - no Redis
            mockGetRedisClient.mockResolvedValue(undefined);

            const ctx = createMockContext();
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 3);

            const mockTrialService = {
                findTrialsEndingSoon: vi
                    .fn()
                    .mockResolvedValueOnce([
                        {
                            id: 'sub-1',
                            customerId: 'cust-fallback',
                            userEmail: 'fallback@test.com',
                            userName: 'Fallback User',
                            userId: 'user-fallback',
                            planSlug: 'owner-basico',
                            trialEnd,
                            daysRemaining: 3
                        }
                    ])
                    .mockResolvedValueOnce([]) // 1 day - empty
            };

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: [] })
                }
            };

            vi.mocked(getQZPayBilling).mockReturnValue(
                mockBilling as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(TrialService).mockImplementation(
                () => mockTrialService as unknown as InstanceType<typeof TrialService>
            );
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as unknown as InstanceType<typeof RetryService>
            );

            // Act
            await notificationScheduleJob.handler(ctx);

            // Assert - notification was sent (in-memory fallback works)
            expect(sendNotification).toHaveBeenCalledTimes(1);
            // Redis was NOT called
            expect(mockRedisSet).not.toHaveBeenCalled();
            expect(mockRedisExists).not.toHaveBeenCalled();
        });

        it('should preserve idempotency across multiple runs without Redis', async () => {
            // Arrange - no Redis, same customer in both runs
            mockGetRedisClient.mockResolvedValue(undefined);

            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 3);

            const trialData = [
                {
                    id: 'sub-1',
                    customerId: 'cust-multi-run',
                    userEmail: 'multi@test.com',
                    userName: 'Multi Run User',
                    userId: 'user-multi',
                    planSlug: 'owner-basico',
                    trialEnd,
                    daysRemaining: 3
                }
            ];

            // Both runs return same customer for both 3-day and 1-day windows
            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue(trialData)
            };

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: [] })
                }
            };

            vi.mocked(getQZPayBilling).mockReturnValue(
                mockBilling as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(TrialService).mockImplementation(
                () => mockTrialService as unknown as InstanceType<typeof TrialService>
            );
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as unknown as InstanceType<typeof RetryService>
            );

            // Act - first run
            const ctx1 = createMockContext();
            await notificationScheduleJob.handler(ctx1);

            // Act - second run (same day, same customer)
            const ctx2 = createMockContext();
            await notificationScheduleJob.handler(ctx2);

            // Assert - first run sends 2 notifications (d3 + d1 have different keys),
            // second run sends 0 (both keys already exist in fallback map)
            expect(sendNotification).toHaveBeenCalledTimes(2);
        });

        it('should fall back to in-memory when Redis throws error', async () => {
            // Arrange - Redis throws
            mockGetRedisClient.mockRejectedValue(new Error('Connection refused'));

            const ctx = createMockContext();
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 3);

            const mockTrialService = {
                findTrialsEndingSoon: vi
                    .fn()
                    .mockResolvedValueOnce([
                        {
                            id: 'sub-1',
                            customerId: 'cust-error',
                            userEmail: 'error@test.com',
                            userName: 'Error User',
                            userId: 'user-error',
                            planSlug: 'owner-basico',
                            trialEnd,
                            daysRemaining: 3
                        }
                    ])
                    .mockResolvedValueOnce([]) // 1 day - empty
            };

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: [] })
                }
            };

            vi.mocked(getQZPayBilling).mockReturnValue(
                mockBilling as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(TrialService).mockImplementation(
                () => mockTrialService as unknown as InstanceType<typeof TrialService>
            );
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as unknown as InstanceType<typeof RetryService>
            );

            // Act
            await notificationScheduleJob.handler(ctx);

            // Assert - notification was still sent despite Redis error
            expect(sendNotification).toHaveBeenCalledTimes(1);
        });
    });
});
