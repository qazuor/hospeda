/**
 * Unit Tests: Notification Schedule Cron Job Handler
 *
 * Tests the notification-schedule job handler that sends scheduled notifications.
 *
 * Test Coverage:
 * - Sends trial ending reminders: config-aware, skip-tolerant primary ("D-3")
 *   window + exact day-1 window (HOS-121)
 * - Durable per-variant dedup via billing_subscription_events (survives
 *   process restarts / multi-replica races — HOS-121 §4.2)
 * - Processes notification retry queue
 * - Handles no pending notifications gracefully
 * - Returns correct CronJobResult structure
 * - Error handling during processing
 * - Dry run mode behavior
 * - Billing not configured scenario
 *
 * @module test/cron/notification-schedule
 */

import { NotificationType, RetryService } from '@repo/notifications';
import { BILLING_EVENT_TYPES } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    notificationScheduleJob,
    resetSentNotificationsFallback
} from '../../src/cron/jobs/notification-schedule.job';
import type { CronJobContext } from '../../src/cron/types';

// Hoisted so they are available inside vi.mock() factories. The umbrella
// transaction (withTransaction) only holds the advisory lock now; the durable
// trial dedup runs on the AUTOCOMMIT getDb() handle (HOS-121), which exposes the
// select (dedup lookup) + insert(...).onConflictDoNothing() chains.
const { mockDbWithTransaction, mockGetDb, getDbSelectLimit, getDbInsertValues } = vi.hoisted(() => {
    // Durable dedup lookup result — default: no prior event → the reminder sends.
    const selectLimit = vi.fn().mockResolvedValue([]);
    // Captures the inserted row and returns the onConflictDoNothing() terminator.
    const insertValues = vi.fn(() => ({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined)
    }));
    const dbHandle = {
        execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: selectLimit
                }))
            }))
        })),
        insert: vi.fn(() => ({ values: insertValues }))
    };
    // The lock-holding transaction only needs execute() for pg_try_advisory_xact_lock.
    const tx = { execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }) };
    const withTx = vi.fn(async <T>(callback: (innerTx: typeof tx) => Promise<T>) => callback(tx));
    return {
        mockDbWithTransaction: withTx,
        mockGetDb: dbHandle,
        getDbSelectLimit: selectLimit,
        getDbInsertValues: insertValues
    };
});

// Mock @repo/db — required for pg_try_advisory_xact_lock concurrency guard (GAP-034).
// withTransaction wraps the lock; getDb() is the autocommit handle used for the
// durable trial dedup.
vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => mockGetDb),
    withTransaction: mockDbWithTransaction,
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

// Mock TrialService. buildTrialUpgradeUrl is re-implemented here (mirroring the
// real pure function in src/services/trial.service.ts) rather than stubbed as a
// bare vi.fn(), since several tests below assert on the actual upgradeUrl shape
// the job sends (HOS-115 §5 nudge).
vi.mock('../../src/services/trial.service', () => ({
    TrialService: vi.fn(),
    buildTrialUpgradeUrl: vi.fn((input: { siteUrl: string; intendedInterval?: unknown }) => {
        const base = `${input.siteUrl}/es/suscriptores/planes/`;
        return input.intendedInterval === 'monthly' || input.intendedInterval === 'annual'
            ? `${base}?interval=${input.intendedInterval}`
            : base;
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

// Mock Redis client (returns undefined = not configured, falls back to in-memory).
// Trials no longer use Redis dedup (HOS-121 — durable ledger); renewals still do.
vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined)
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
import { processDbNotificationRetries } from '../../src/services/notification-retry.service';
import { TrialService } from '../../src/services/trial.service';
import { sendNotification } from '../../src/utils/notification-helper';

/** A trial row as returned by `findTrialsEndingSoon`. */
type MockTrial = {
    id: string;
    customerId: string;
    userEmail: string;
    userName: string;
    userId: string;
    planSlug: string;
    planDisplayName?: string;
    trialEnd: Date;
    daysRemaining: number;
    intendedInterval?: string;
};

/**
 * Build a trial row with sensible defaults; override any field per test.
 */
function makeTrial(
    overrides: Partial<MockTrial> & { id: string; daysRemaining: number }
): MockTrial {
    return {
        customerId: `cust-${overrides.id}`,
        userEmail: `user-${overrides.id}@example.com`,
        userName: `User ${overrides.id}`,
        userId: `user-${overrides.id}`,
        planSlug: 'owner-basico',
        trialEnd: new Date('2024-06-18T00:00:00Z'),
        ...overrides
    };
}

/**
 * Stub a TrialService whose `findTrialsEndingSoon` returns trials keyed by the
 * requested `daysAhead`. The job now queries the config-aware primary window
 * (daysAhead = trialReminderDays and trialReminderDays-1) plus daysAhead=1, so
 * mapping by daysAhead is robust to the exact number/order of calls.
 */
function mockTrialServiceByDays(byDays: Record<number, MockTrial[]>): void {
    const service = {
        findTrialsEndingSoon: vi.fn((input: { daysAhead: number }) =>
            Promise.resolve(byDays[input.daysAhead] ?? [])
        )
    };
    vi.mocked(TrialService).mockImplementation(function () {
        return service as unknown as InstanceType<typeof TrialService>;
    });
}

/** Stub RetryService.processRetries as a no-op returning empty stats. */
function mockEmptyRetryService(): void {
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

describe('Notification Schedule Cron Job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetSentNotificationsFallback();
        // Reset durable dedup mocks to their defaults (no prior event → sends).
        // getDbInsertValues keeps its implementation (returns onConflictDoNothing);
        // only its call history is cleared.
        getDbSelectLimit.mockReset().mockResolvedValue([]);
        getDbInsertValues.mockClear();
        process.env.HOSPEDA_SITE_URL = 'https://hospeda.com';
    });

    describe('Job Definition', () => {
        it('should have correct job metadata', () => {
            expect(notificationScheduleJob.name).toBe('notification-schedule');
            expect(notificationScheduleJob.description).toBe(
                'Send scheduled notifications for trials and subscription renewals'
            );
            expect(notificationScheduleJob.schedule).toBe('0 8 * * *');
            expect(notificationScheduleJob.enabled).toBe(true);
            expect(notificationScheduleJob.timeoutMs).toBe(120000);
        });
    });

    describe('Trial Ending Reminders', () => {
        // HOS-231: the trial-ending email prefers the plan DISPLAY name
        // (TrialEndingSubscription.planDisplayName) over the raw slug. The trial is
        // returned for EVERY daysAhead window the job queries (not keyed to one
        // day) so the assertion is independent of the config reminder window.
        it('uses planDisplayName over planSlug when present', async () => {
            const ctx = createMockContext();
            const trial = makeTrial({
                id: 'sub-1',
                daysRemaining: 3,
                planSlug: 'owner-basico',
                planDisplayName: 'Basic'
            });
            const service = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([trial])
            };
            vi.mocked(TrialService).mockImplementation(function () {
                return service as unknown as InstanceType<typeof TrialService>;
            });
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            mockEmptyRetryService();

            await notificationScheduleJob.handler(ctx);

            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.TRIAL_ENDING_REMINDER,
                    planName: 'Basic'
                })
            );
            // Never the raw slug.
            expect(sendNotification).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.TRIAL_ENDING_REMINDER,
                    planName: 'owner-basico'
                })
            );
        });

        it('should send primary (D-3) reminders for trials in the config window', async () => {
            // Arrange
            const ctx = createMockContext();
            mockTrialServiceByDays({
                3: [
                    makeTrial({ id: 'sub-1', daysRemaining: 3 }),
                    makeTrial({ id: 'sub-2', daysRemaining: 3, planSlug: 'complex-basico' })
                ]
            });
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            mockEmptyRetryService();

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(2);
            expect(sendNotification).toHaveBeenCalledTimes(2);
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.TRIAL_ENDING_REMINDER,
                    customerId: 'cust-sub-1',
                    planName: 'owner-basico',
                    daysRemaining: 3
                })
            );
            // Durable dedup ledger written per sent reminder, tagged D-3.
            expect(getDbInsertValues).toHaveBeenCalledTimes(2);
            expect(getDbInsertValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    subscriptionId: 'sub-1',
                    eventType: BILLING_EVENT_TYPES.TRIAL_PRE_END_NOTIF_D3,
                    triggerSource: 'cron'
                })
            );
        });

        it('should point the upgradeUrl at the owner pricing page and carry ?interval=annual (HOS-115 §5)', async () => {
            // Arrange
            const ctx = createMockContext();
            mockTrialServiceByDays({
                3: [makeTrial({ id: 'sub-1', daysRemaining: 3, intendedInterval: 'annual' })]
            });
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            mockEmptyRetryService();

            // Act
            await notificationScheduleJob.handler(ctx);

            // Assert
            // Not asserting on the exact host (env.HOSPEDA_SITE_URL is resolved once at
            // module import, so the beforeEach process.env override above does not
            // retroactively apply) — mirrors the pattern in
            // trial.service.test.ts's TRIAL_EXPIRED upgradeUrl nudge tests (HOS-115 T-004).
            const payload = vi.mocked(sendNotification).mock.calls[0]?.[0] as {
                upgradeUrl: string;
            };
            expect(payload.upgradeUrl).toContain('/suscriptores/planes/');
            expect(payload.upgradeUrl).toContain('?interval=annual');
            expect(payload.upgradeUrl).not.toContain('/mi-cuenta/suscripcion');
        });

        it('should omit ?interval= when the trial has no recorded intent (HOS-115 §5, graceful degrade)', async () => {
            // Arrange
            const ctx = createMockContext();
            mockTrialServiceByDays({
                1: [makeTrial({ id: 'sub-1', daysRemaining: 1 })]
            });
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            mockEmptyRetryService();

            // Act
            await notificationScheduleJob.handler(ctx);

            // Assert
            const payload = vi.mocked(sendNotification).mock.calls[0]?.[0] as {
                upgradeUrl: string;
            };
            expect(payload.upgradeUrl).toContain('/suscriptores/planes/');
            expect(payload.upgradeUrl).not.toContain('interval=');
            expect(payload.upgradeUrl).not.toContain('/mi-cuenta/suscripcion');
        });

        it('should send the day-1 reminder for trials ending tomorrow', async () => {
            // Arrange
            const ctx = createMockContext();
            mockTrialServiceByDays({
                1: [makeTrial({ id: 'sub-1', daysRemaining: 1 })]
            });
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            mockEmptyRetryService();

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(1);
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.TRIAL_ENDING_REMINDER,
                    daysRemaining: 1
                })
            );
            expect(getDbInsertValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    subscriptionId: 'sub-1',
                    eventType: BILLING_EVENT_TYPES.TRIAL_PRE_END_NOTIF_D1
                })
            );
        });

        it('should still send the primary reminder when a cron day was skipped (skip-tolerant window, HOS-121 §4.1)', async () => {
            // Arrange — a trial that was 3 days out yesterday, missed the run, and
            // is now 2 days out. The old exact-day match (daysAhead === 3) would
            // drop it; the config-aware window (covers days 3 AND 2) still catches it.
            const ctx = createMockContext();
            mockTrialServiceByDays({
                2: [makeTrial({ id: 'sub-late', daysRemaining: 2 })]
            });
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            mockEmptyRetryService();

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.processed).toBe(1);
            expect(sendNotification).toHaveBeenCalledTimes(1);
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({ customerId: 'cust-sub-late', daysRemaining: 2 })
            );
            // Still recorded under the D-3 (primary) variant, not D-1.
            expect(getDbInsertValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    subscriptionId: 'sub-late',
                    eventType: BILLING_EVENT_TYPES.TRIAL_PRE_END_NOTIF_D3
                })
            );
        });

        it('should send both the primary and day-1 reminders for the same subscription (distinct variants)', async () => {
            // Arrange — same subscription appears in both the primary and day-1
            // windows. Each variant has its own durable event type, so both send.
            const ctx = createMockContext();
            const trial = makeTrial({ id: 'sub-1', daysRemaining: 3 });
            mockTrialServiceByDays({ 3: [trial], 1: [{ ...trial, daysRemaining: 1 }] });
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            mockEmptyRetryService();

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.processed).toBe(2);
            expect(sendNotification).toHaveBeenCalledTimes(2);
            expect(getDbInsertValues).toHaveBeenCalledWith(
                expect.objectContaining({ eventType: BILLING_EVENT_TYPES.TRIAL_PRE_END_NOTIF_D3 })
            );
            expect(getDbInsertValues).toHaveBeenCalledWith(
                expect.objectContaining({ eventType: BILLING_EVENT_TYPES.TRIAL_PRE_END_NOTIF_D1 })
            );
        });

        it('should de-duplicate a subscription appearing twice in the primary window (by id)', async () => {
            // Arrange — the same subscription returned twice for the same day.
            const ctx = createMockContext();
            const trial = makeTrial({ id: 'sub-1', daysRemaining: 3 });
            mockTrialServiceByDays({ 3: [trial, trial] });
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            mockEmptyRetryService();

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert — collapsed to a single send.
            expect(result.processed).toBe(1);
            expect(sendNotification).toHaveBeenCalledTimes(1);
        });

        it('should not re-send when a durable event already exists (survives restart, HOS-121 §4.2)', async () => {
            // Arrange — the durable dedup lookup finds a prior D-3 event row, as it
            // would after a process restart that cleared any in-memory state.
            const ctx = createMockContext();
            mockTrialServiceByDays({ 3: [makeTrial({ id: 'sub-1', daysRemaining: 3 })] });
            getDbSelectLimit.mockResolvedValue([{ id: 'existing-event' }]);
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            mockEmptyRetryService();

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert — dedup blocks the send AND the ledger insert.
            expect(result.processed).toBe(0);
            expect(sendNotification).not.toHaveBeenCalled();
            expect(getDbInsertValues).not.toHaveBeenCalled();
        });

        it('should handle no trials ending soon', async () => {
            // Arrange
            const ctx = createMockContext();
            mockTrialServiceByDays({});
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            mockEmptyRetryService();

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(sendNotification).not.toHaveBeenCalled();
            expect(getDbInsertValues).not.toHaveBeenCalled();
        });
    });

    describe('Notification Retries', () => {
        it('should process database-based notification retry queue', async () => {
            // Arrange
            const ctx = createMockContext();
            mockTrialServiceByDays({});
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            // Mock database-based retry to return stats
            vi.mocked(processDbNotificationRetries).mockResolvedValue({
                processed: 5,
                succeeded: 3,
                failed: 1,
                permanentlyFailed: 1
            });

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('5 retries');
            expect(result.message).toContain('3 succeeded');
            expect(result.message).toContain('1 re-queued');
            expect(result.message).toContain('1 permanently failed');
            expect(result.details?.retries).toMatchObject({
                processed: 5,
                succeeded: 3,
                failed: 1,
                permanentlyFailed: 1
            });
            expect(processDbNotificationRetries).toHaveBeenCalledTimes(1);
            expect(processDbNotificationRetries).toHaveBeenCalledWith(false); // Not dry run
        });

        it('should continue job execution even if retry processing fails', async () => {
            // Arrange
            const ctx = createMockContext();
            mockTrialServiceByDays({ 3: [makeTrial({ id: 'sub-1', daysRemaining: 3 })] });
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            // Mock database-based retry to fail
            vi.mocked(processDbNotificationRetries).mockRejectedValue(
                new Error('Database connection failed')
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true); // Job should not fail
            expect(result.processed).toBe(1); // Should still process notifications
            expect(ctx.logger.error).toHaveBeenCalledWith(
                'Failed to process notification retries',
                expect.objectContaining({
                    error: 'Database connection failed'
                })
            );
        });
    });

    describe('Dry Run Mode', () => {
        it('should count notifications without sending in dry-run mode', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });
            mockTrialServiceByDays({
                3: [
                    makeTrial({ id: 'sub-1', daysRemaining: 3 }),
                    makeTrial({ id: 'sub-2', daysRemaining: 3 })
                ],
                1: [makeTrial({ id: 'sub-3', daysRemaining: 1 })]
            });
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(3);
            expect(sendNotification).not.toHaveBeenCalled();
            expect(getDbInsertValues).not.toHaveBeenCalled();
            expect(result.details?.dryRun).toBe(true);
        });

        it('should skip retry processing in dry-run mode', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });
            mockTrialServiceByDays({});
            const mockRetryService = {
                processRetries: vi.fn()
            };

            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(RetryService).mockImplementation(function () {
                return mockRetryService as unknown as InstanceType<typeof RetryService>;
            });

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockRetryService.processRetries).not.toHaveBeenCalled();
        });
    });

    describe('Billing Not Configured', () => {
        it('should skip processing when billing is not configured', async () => {
            // Arrange
            const ctx = createMockContext();
            vi.mocked(getQZPayBilling).mockReturnValue(null);

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toBe('Skipped - Billing not configured');
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(ctx.logger.warn).toHaveBeenCalledWith(
                'Billing not configured, skipping notification schedule'
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle trial service errors gracefully', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockRejectedValue(new Error('Database error'))
            };
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(TrialService).mockImplementation(function () {
                return mockTrialService as unknown as InstanceType<typeof TrialService>;
            });

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to process scheduled notifications');
            expect(result.message).toContain('Database error');
            expect(result.errors).toBeGreaterThan(0);
        });

        it('should handle notification send failures gracefully (fire-and-forget)', async () => {
            // Arrange — the send rejects asynchronously; because it is fire-and-forget
            // the job still counts it as processed and writes the durable dedup row.
            const ctx = createMockContext();
            mockTrialServiceByDays({ 3: [makeTrial({ id: 'sub-1', daysRemaining: 3 })] });
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(sendNotification).mockRejectedValue(new Error('Email service unavailable'));
            mockEmptyRetryService();

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true); // Job should not fail due to send errors
            expect(result.processed).toBe(1);
            expect(ctx.logger.debug).toHaveBeenCalled();
        });
    });

    describe('Result Structure', () => {
        it('should return correctly structured CronJobResult', async () => {
            // Arrange
            const ctx = createMockContext();
            mockTrialServiceByDays({});
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(RetryService).mockImplementation(function () {
                return {
                    processRetries: vi.fn().mockResolvedValue({
                        processed: 2,
                        succeeded: 2,
                        failed: 0,
                        permanentlyFailed: 0
                    })
                } as unknown as InstanceType<typeof RetryService>;
            });

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result).toMatchObject({
                success: expect.any(Boolean),
                message: expect.any(String),
                processed: expect.any(Number),
                errors: expect.any(Number),
                durationMs: expect.any(Number)
            });

            if (result.details) {
                expect(result.details).toMatchObject({
                    trialsEndingPrimary: expect.any(Number),
                    trialsEnding1Day: expect.any(Number),
                    retries: expect.objectContaining({
                        processed: expect.any(Number),
                        succeeded: expect.any(Number),
                        failed: expect.any(Number),
                        permanentlyFailed: expect.any(Number)
                    }),
                    dryRun: expect.any(Boolean)
                });
            }
        });
    });
});
