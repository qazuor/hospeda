/**
 * Unit Tests: Notification Idempotency Key Persistence
 *
 * Tests that notification idempotency keys are stored in Redis when available,
 * with fallback to in-memory Map (with TTL) when Redis is not configured.
 *
 * These tests exercise the RENEWAL_REMINDER path: as of HOS-121 the trial
 * reminders moved to a durable `billing_subscription_events` dedup ledger, so
 * the Redis-TTL + in-memory Map mechanism is now used only for renewal
 * reminders. The mechanism itself is unchanged — only its consumer is.
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
        where: vi.fn().mockResolvedValue(undefined),
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) }))
            }))
        })),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) }))
    };
    const withTx = vi.fn(async <T>(callback: (innerTx: typeof tx) => Promise<T>) => callback(tx));
    return { mockDbWithTransactionIdempotency: withTx };
});

// Mock @repo/db — required for pg_try_advisory_xact_lock concurrency guard (GAP-034).
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
    billingSubscriptionEvents: {
        id: 'id',
        subscriptionId: 'subscription_id',
        eventType: 'event_type'
    },
    and: vi.fn((...conds: unknown[]) => ({ __and: conds })),
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

// Mock TrialService (no trials — this suite exercises renewals only).
// buildTrialUpgradeUrl must still be exported: the module imports it eagerly.
vi.mock('../../src/services/trial.service', () => ({
    TrialService: vi.fn(),
    buildTrialUpgradeUrl: vi.fn(
        (input: { siteUrl: string }) => `${input.siteUrl}/es/suscriptores/planes/`
    )
}));

// Mock customer lookup used by the renewal branch.
vi.mock('../../src/utils/customer-lookup', () => ({
    lookupCustomerDetails: vi.fn().mockResolvedValue({
        email: 'renewal@test.com',
        name: 'Renewal User',
        userId: 'user-renewal'
    })
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

/**
 * Build a billing stub with one active subscription renewing in `daysAhead`
 * days (default 7 — the first RENEWAL_REMINDER_DAYS window), plus no trials.
 */
function mockRenewalBilling(daysAhead = 7): void {
    const now = Date.now();
    // -1h buffer so Math.ceil(msRemaining / day) lands exactly on `daysAhead`
    // (ceil rounds UP: a value just under N days rounds to N, just over rounds to N+1).
    const currentPeriodEnd = new Date(now + daysAhead * 24 * 60 * 60 * 1000 - 60 * 60 * 1000);

    const mockBilling = {
        subscriptions: {
            list: vi.fn().mockResolvedValue({
                data: [
                    {
                        customerId: 'cust-renewal',
                        planId: 'plan-1',
                        interval: 'monthly',
                        currentPeriodEnd: currentPeriodEnd.toISOString()
                    }
                ]
            })
        },
        plans: {
            get: vi.fn().mockResolvedValue({
                name: 'Owner Basico',
                prices: [{ billingInterval: 'monthly', unitAmount: 5000 }]
            })
        }
    };

    vi.mocked(getQZPayBilling).mockReturnValue(
        mockBilling as unknown as ReturnType<typeof getQZPayBilling>
    );
    vi.mocked(TrialService).mockImplementation(function () {
        return {
            findTrialsEndingSoon: vi.fn().mockResolvedValue([])
        } as unknown as InstanceType<typeof TrialService>;
    });
    vi.mocked(RetryService).mockImplementation(function () {
        return {
            processRetries: vi.fn().mockResolvedValue({
                processed: 0,
                succeeded: 0,
                failed: 0,
                permanentlyFailed: 0
            })
        } as unknown as InstanceType<typeof RetryService>;
    });
}

describe('Notification Idempotency Key Persistence (renewal reminders)', () => {
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
            mockGetRedisClient.mockResolvedValue({ set: mockRedisSet, exists: mockRedisExists });
            mockRenewalBilling();
            vi.mocked(sendNotification).mockResolvedValue(undefined);

            // Act
            await notificationScheduleJob.handler(createMockContext());

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
            mockRedisExists.mockResolvedValue(1);
            mockGetRedisClient.mockResolvedValue({ set: mockRedisSet, exists: mockRedisExists });
            mockRenewalBilling();

            // Act
            await notificationScheduleJob.handler(createMockContext());

            // Assert - notification was NOT sent (duplicate detected via Redis)
            expect(sendNotification).not.toHaveBeenCalled();
            expect(mockRedisExists).toHaveBeenCalled();
        });
    });

    describe('In-memory fallback', () => {
        it('should use in-memory Set when Redis is not available', async () => {
            // Arrange - no Redis
            mockGetRedisClient.mockResolvedValue(undefined);
            mockRenewalBilling();
            vi.mocked(sendNotification).mockResolvedValue(undefined);

            // Act
            await notificationScheduleJob.handler(createMockContext());

            // Assert - notification was sent (in-memory fallback works)
            expect(sendNotification).toHaveBeenCalledTimes(1);
            // Redis was NOT called
            expect(mockRedisSet).not.toHaveBeenCalled();
            expect(mockRedisExists).not.toHaveBeenCalled();
        });

        it('should preserve idempotency across multiple runs without Redis', async () => {
            // Arrange - no Redis, same customer in both runs
            mockGetRedisClient.mockResolvedValue(undefined);
            mockRenewalBilling();
            vi.mocked(sendNotification).mockResolvedValue(undefined);

            // Act - first run
            await notificationScheduleJob.handler(createMockContext());
            // Act - second run (same day, same customer)
            await notificationScheduleJob.handler(createMockContext());

            // Assert - first run sends once, second run is deduped by the fallback Map.
            expect(sendNotification).toHaveBeenCalledTimes(1);
        });

        it('should fall back to in-memory when Redis throws error', async () => {
            // Arrange - Redis throws
            mockGetRedisClient.mockRejectedValue(new Error('Connection refused'));
            mockRenewalBilling();
            vi.mocked(sendNotification).mockResolvedValue(undefined);

            // Act
            await notificationScheduleJob.handler(createMockContext());

            // Assert - notification was still sent despite Redis error
            expect(sendNotification).toHaveBeenCalledTimes(1);
        });
    });
});
