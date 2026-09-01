/**
 * Unit Tests: Notification Schedule Cron Job Handler
 *
 * Tests the notification-schedule job handler that sends scheduled notifications.
 *
 * Test Coverage:
 * - Runs the nine-send trial email series once per run and folds its counters
 *   into the cron result (HOS-1012 T-016). The series' own behaviour lives in
 *   `test/cron/trial-series-dispatch.test.ts`.
 * - Processes notification retry queue
 * - Handles no pending notifications gracefully
 * - Returns correct CronJobResult structure
 * - Error handling during processing
 * - Dry run mode behavior
 * - Billing not configured scenario
 *
 * @module test/cron/notification-schedule
 */

import { RetryService } from '@repo/notifications';
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

// Mock billing settings loader. `trialExpiryReminderDays` is gone (HOS-1012
// T-016) — the nine offsets are constants, not an admin setting.
vi.mock('../../src/utils/billing-settings', () => ({
    loadBillingSettings: vi.fn().mockResolvedValue({
        gracePeriodDays: 7,
        maxPaymentRetries: 3,
        retryIntervalHours: 24,
        sendTrialExpiryReminder: true,
        sendPaymentFailedNotification: true
    })
}));

// Mock the nine-send trial series. Its own behaviour is covered by
// `test/cron/trial-series-dispatch.test.ts` against the real module; here the
// subject is the JOB, and what the job owns is running the series once and
// folding its counters into the cron result.
vi.mock('../../src/cron/jobs/trial-series-dispatch', () => ({
    dispatchTrialSeries: vi.fn().mockResolvedValue({
        sent: 0,
        deduped: 0,
        converted: 0,
        noCustomer: 0,
        errors: 0,
        cohortSizes: {}
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
import { dispatchTrialSeries } from '../../src/cron/jobs/trial-series-dispatch';
import { getQZPayBilling } from '../../src/middlewares/billing';
import { processDbNotificationRetries } from '../../src/services/notification-retry.service';
import { sendNotification } from '../../src/utils/notification-helper';

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
        // `clearAllMocks` clears call history but KEEPS implementations, so a
        // test that made the series reject would otherwise leak that rejection
        // into every test after it. Restore the empty-run default explicitly.
        vi.mocked(dispatchTrialSeries).mockReset().mockResolvedValue({
            sent: 0,
            deduped: 0,
            converted: 0,
            noCustomer: 0,
            errors: 0,
            cohortSizes: {}
        });
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

    describe('Trial Email Series (HOS-1012)', () => {
        // The nine sends themselves — cohort selection, per-offset templates,
        // durable dedup, the live paying re-check — are tested in
        // `test/cron/trial-series-dispatch.test.ts` against the real module.
        // What belongs HERE is only that the job runs the series and folds its
        // counters into its own result, because that is what this job owns.

        it('runs the series and folds its sent/errors counters into the result', async () => {
            const ctx = createMockContext();
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            mockEmptyRetryService();
            vi.mocked(dispatchTrialSeries).mockResolvedValue({
                sent: 3,
                deduped: 1,
                converted: 2,
                noCustomer: 0,
                errors: 1,
                cohortSizes: { '-10': 1, '-5': 1, '-1': 1 }
            });

            const result = await notificationScheduleJob.handler(ctx);

            expect(dispatchTrialSeries).toHaveBeenCalledTimes(1);
            expect(result.processed).toBe(3);
            expect(result.errors).toBe(1);
        });

        it('passes the admin reminder toggle through to the series', async () => {
            // The toggle gates the eight REMINDER sends and never the expiry
            // mail; that split is enforced inside the series. The job's part is
            // only to hand the setting over — which it did NOT do before
            // HOS-1012: the value was logged and never read.
            const ctx = createMockContext();
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            mockEmptyRetryService();

            await notificationScheduleJob.handler(ctx);

            expect(dispatchTrialSeries).toHaveBeenCalledWith(
                expect.objectContaining({ remindersEnabled: true })
            );
        });

        it('reports the per-offset cohort sizes and every skip reason', async () => {
            // A run that reports only what it sent cannot tell "nobody was due"
            // from "everything was skipped".
            const ctx = createMockContext();
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            mockEmptyRetryService();
            vi.mocked(dispatchTrialSeries).mockResolvedValue({
                sent: 0,
                deduped: 4,
                converted: 1,
                noCustomer: 2,
                errors: 0,
                cohortSizes: { '0': 7 }
            });

            const result = await notificationScheduleJob.handler(ctx);

            expect(result.details?.trialSeries).toEqual({
                cohortSizes: { '0': 7 },
                sent: 0,
                deduped: 4,
                converted: 1,
                noCustomer: 2
            });
        });
    });

    describe('Notification Retries', () => {
        it('should process database-based notification retry queue', async () => {
            // Arrange
            const ctx = createMockContext();
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
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(dispatchTrialSeries).mockResolvedValue({
                sent: 1,
                deduped: 0,
                converted: 0,
                noCustomer: 0,
                errors: 0,
                cohortSizes: { '-5': 1 }
            });
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
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert — dry-run is PASSED DOWN, not re-implemented here. The
            // series decides what a dry run means for its own nine sends
            // (count the cohorts, dispatch nothing); the job's obligation is
            // only to hand the flag over and never to send behind its back.
            expect(result.success).toBe(true);
            expect(dispatchTrialSeries).toHaveBeenCalledWith(
                expect.objectContaining({ dryRun: true })
            );
            expect(sendNotification).not.toHaveBeenCalled();
            expect(getDbInsertValues).not.toHaveBeenCalled();
            expect(result.details?.dryRun).toBe(true);
        });

        it('should skip retry processing in dry-run mode', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });
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
        it('reports failure when the trial series throws outright', async () => {
            // A per-candidate failure is counted inside the series and never
            // reaches here; only a failure of the whole pass does, and when it
            // does the job must report `success: false` rather than a green run
            // that quietly sent nothing.
            const ctx = createMockContext();
            vi.mocked(getQZPayBilling).mockReturnValue({} as never);
            vi.mocked(dispatchTrialSeries).mockRejectedValue(new Error('Database error'));

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to process scheduled notifications');
            expect(result.message).toContain('Database error');
            expect(result.errors).toBeGreaterThan(0);
        });
    });

    describe('Result Structure', () => {
        it('should return correctly structured CronJobResult', async () => {
            // Arrange
            const ctx = createMockContext();
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
                    trialSeries: expect.objectContaining({
                        cohortSizes: expect.any(Object),
                        sent: expect.any(Number),
                        deduped: expect.any(Number),
                        converted: expect.any(Number),
                        noCustomer: expect.any(Number)
                    }),
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
