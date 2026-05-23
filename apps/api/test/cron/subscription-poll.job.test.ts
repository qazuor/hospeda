/**
 * Subscription Poll Cron Job Tests
 *
 * Tests the SPEC-143 Finding #17 polling fallback cron. The job runs every
 * minute and queries MercadoPago for in-flight subscription preapprovals
 * whose webhooks may have been dropped. These tests exercise the batch
 * loop, feature flag gate, advisory-lock behavior, and per-job decision
 * tree against fully mocked storage + adapter + transition function.
 *
 * Mocking strategy: mock at the smallest possible boundary so the
 * behavior under test is the cron's own orchestration logic, not the
 * downstream provider/storage internals.
 *
 * - `@repo/db`: only `sql` and `withTransaction` are touched; mocked to
 *   short-circuit the advisory lock (acquired=true by default) and
 *   forward through to the inner callback.
 * - `@repo/billing`: `createMercadoPagoAdapter` returns a stub adapter
 *   whose `subscriptions.retrieve` is per-test programmable.
 * - `getQZPayBilling`: returns a stub billing instance whose `getStorage`
 *   exposes a per-test programmable polling-jobs storage.
 * - `processSubscriptionUpdated`: mocked to surface a controllable
 *   transition result without running the real webhook handler.
 *
 * @module test/cron/subscription-poll.job
 */

import type { QZPaySubscriptionPollingJob } from '@qazuor/qzpay-core';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types.js';

// ---------- Mocks (must come before importing the job) ----------

vi.mock('../../src/utils/env.js', () => ({
    env: {
        HOSPEDA_BILLING_POLLING_ENABLED: true
    }
}));

vi.mock('../../src/lib/qzpay-logger.js', () => ({
    qzpayLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

const mockRetrieve = vi.fn();
const mockCreateMercadoPagoAdapter = vi.fn(() => ({
    subscriptions: { retrieve: mockRetrieve }
}));

vi.mock('@repo/billing', () => ({
    createMercadoPagoAdapter: (...args: unknown[]) => mockCreateMercadoPagoAdapter(...args)
}));

const mockExecute = vi.fn();
vi.mock('@repo/db', () => ({
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    withTransaction: async <T>(fn: (tx: { execute: Mock }) => Promise<T>): Promise<T> => {
        return fn({ execute: mockExecute });
    }
}));

const mockFindDuePending = vi.fn();
const mockStorageUpdate = vi.fn();
const mockFindActiveBySubscriptionId = vi.fn();
const mockGetStorage = vi.fn(() => ({
    subscriptionPollingJobs: {
        findDuePending: mockFindDuePending,
        update: mockStorageUpdate,
        findActiveBySubscriptionId: mockFindActiveBySubscriptionId,
        findById: vi.fn(),
        create: vi.fn()
    }
}));
const mockGetBilling = vi.fn(() => ({
    getStorage: mockGetStorage
}));

vi.mock('../../src/middlewares/billing.js', () => ({
    getQZPayBilling: () => mockGetBilling()
}));

const mockProcessSubscriptionUpdated = vi.fn();
vi.mock('../../src/routes/webhooks/mercadopago/subscription-logic.js', () => ({
    processSubscriptionUpdated: (...args: unknown[]) => mockProcessSubscriptionUpdated(...args)
}));

// ---------- Imports under test (after mocks) ----------

const { subscriptionPollJob } = await import('../../src/cron/jobs/subscription-poll.job.js');

// ---------- Helpers ----------

function buildJob(
    overrides: Partial<QZPaySubscriptionPollingJob> = {}
): QZPaySubscriptionPollingJob {
    const now = new Date();
    return {
        id: '00000000-0000-0000-0000-000000000001',
        subscriptionId: '11111111-1111-1111-1111-111111111111',
        provider: 'mercadopago',
        providerResourceId: 'preapproval_test',
        status: 'pending',
        attempts: 0,
        maxAttempts: 60,
        nextPollAt: now,
        lastPolledAt: null,
        lastProviderStatus: null,
        lastError: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        version: 'version-1',
        ...overrides
    };
}

function buildContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-05-23T00:00:00Z'),
        dryRun: false,
        ...overrides
    };
}

function advisoryLockAcquired(acquired: boolean): void {
    mockExecute.mockResolvedValue({ rows: [{ acquired }] });
}

// ---------- Tests ----------

describe('subscription-poll cron job', () => {
    beforeEach(() => {
        advisoryLockAcquired(true);
        mockFindDuePending.mockResolvedValue([]);
        mockStorageUpdate.mockImplementation(async (input) => ({
            ...buildJob(),
            ...input
        }));
        mockRetrieve.mockResolvedValue({ id: 'preapproval_test', status: 'active' });
        mockProcessSubscriptionUpdated.mockResolvedValue({
            success: true,
            statusChanged: true,
            newStatus: 'active'
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Job configuration', () => {
        it('exposes the expected name, schedule, and enabled flag', () => {
            expect(subscriptionPollJob.name).toBe('subscription-poll');
            expect(subscriptionPollJob.schedule).toBe('* * * * *');
            expect(subscriptionPollJob.enabled).toBe(true);
            expect(subscriptionPollJob.timeoutMs).toBeLessThanOrEqual(60_000);
        });
    });

    describe('Feature flag', () => {
        it('skips immediately when HOSPEDA_BILLING_POLLING_ENABLED is false', async () => {
            const envModule = await import('../../src/utils/env.js');
            (
                envModule.env as { HOSPEDA_BILLING_POLLING_ENABLED: boolean }
            ).HOSPEDA_BILLING_POLLING_ENABLED = false;

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.success).toBe(true);
            expect(result.message).toBe('subscription_polling_disabled_by_flag');
            expect(result.processed).toBe(0);
            expect(mockFindDuePending).not.toHaveBeenCalled();

            // Reset for following tests
            (
                envModule.env as { HOSPEDA_BILLING_POLLING_ENABLED: boolean }
            ).HOSPEDA_BILLING_POLLING_ENABLED = true;
        });
    });

    describe('Pre-flight checks', () => {
        it('exits cleanly when billing is not configured', async () => {
            mockGetBilling.mockReturnValueOnce(
                null as unknown as ReturnType<typeof mockGetBilling>
            );

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.message).toBe('billing_not_configured');
            expect(result.processed).toBe(0);
        });

        it('exits cleanly when the storage adapter does not expose polling jobs', async () => {
            mockGetStorage.mockReturnValueOnce({
                subscriptionPollingJobs: undefined
            } as unknown as ReturnType<typeof mockGetStorage>);

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.message).toBe('polling_storage_unavailable');
        });

        it('exits cleanly when MercadoPago adapter cannot be constructed', async () => {
            mockCreateMercadoPagoAdapter.mockImplementationOnce(() => {
                throw new Error('MP creds missing');
            });

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.message).toBe('mp_adapter_unavailable');
        });
    });

    describe('Advisory lock', () => {
        it('skips the batch when the advisory lock is held by another worker', async () => {
            advisoryLockAcquired(false);
            mockFindDuePending.mockResolvedValue([buildJob()]);

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.message).toBe('lock_not_acquired');
            expect(result.processed).toBe(0);
            expect(mockFindDuePending).not.toHaveBeenCalled();
        });
    });

    describe('Batch processing', () => {
        it('returns 0 processed when no due jobs are found', async () => {
            mockFindDuePending.mockResolvedValue([]);

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(result.success).toBe(true);
        });

        it('skips real work in dryRun mode', async () => {
            mockFindDuePending.mockResolvedValue([buildJob()]);

            const result = await subscriptionPollJob.handler(buildContext({ dryRun: true }));

            expect(result.processed).toBe(1);
            expect(mockProcessSubscriptionUpdated).not.toHaveBeenCalled();
            expect(mockStorageUpdate).not.toHaveBeenCalled();
        });

        it('transitions a pending job to succeeded when MP returns active', async () => {
            const job = buildJob({ id: 'job-1' });
            mockFindDuePending.mockResolvedValue([job]);
            mockProcessSubscriptionUpdated.mockResolvedValueOnce({
                success: true,
                statusChanged: true,
                newStatus: 'active'
            });

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(1);
            expect(result.errors).toBe(0);
            expect(mockProcessSubscriptionUpdated).toHaveBeenCalledTimes(1);
            // First update is the optimistic lock (lastPolledAt + attempts++).
            // Second update is the terminal transition to succeeded.
            const terminalUpdate = mockStorageUpdate.mock.calls.find(
                (call) => (call[0] as { status?: string }).status === 'succeeded'
            );
            expect(terminalUpdate).toBeDefined();
            expect(terminalUpdate?.[0]).toMatchObject({
                status: 'succeeded',
                completedAt: expect.any(Date)
            });
        });

        it('keeps the job pending and schedules next poll when MP is still pending', async () => {
            const job = buildJob({ id: 'job-2' });
            mockFindDuePending.mockResolvedValue([job]);
            mockRetrieve.mockResolvedValueOnce({ id: 'preapproval_test', status: 'pending' });
            mockProcessSubscriptionUpdated.mockResolvedValueOnce({
                success: true,
                statusChanged: false
            });

            await subscriptionPollJob.handler(buildContext());

            // No terminal update should have fired. Only the lock + reschedule.
            const terminalUpdates = mockStorageUpdate.mock.calls.filter((call) => {
                const status = (call[0] as { status?: string }).status;
                return status === 'succeeded' || status === 'failed' || status === 'timeout';
            });
            expect(terminalUpdates).toHaveLength(0);

            // Reschedule should be present (nextPollAt in the future).
            const reschedule = mockStorageUpdate.mock.calls.find((call) => {
                return (call[0] as { nextPollAt?: Date }).nextPollAt !== undefined;
            });
            expect(reschedule).toBeDefined();
        });

        it('marks the job timeout when attempts exceed maxAttempts', async () => {
            const job = buildJob({
                id: 'job-3',
                attempts: 60,
                maxAttempts: 60
            });
            mockFindDuePending.mockResolvedValue([job]);
            // Lock returns the job with incremented attempts (61 > 60)
            mockStorageUpdate.mockImplementationOnce(async (input) => ({
                ...job,
                ...input,
                attempts: 61,
                version: 'version-2'
            }));

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(1);
            // processSubscriptionUpdated must NOT be called when timed out
            expect(mockProcessSubscriptionUpdated).not.toHaveBeenCalled();
            const timeoutUpdate = mockStorageUpdate.mock.calls.find(
                (call) => (call[0] as { status?: string }).status === 'timeout'
            );
            expect(timeoutUpdate).toBeDefined();
        });

        it('continues batch processing when one job throws', async () => {
            const failingJob = buildJob({ id: 'fail', providerResourceId: 'fail_res' });
            const okJob = buildJob({
                id: 'ok',
                subscriptionId: '22222222-2222-2222-2222-222222222222',
                providerResourceId: 'ok_res'
            });
            mockFindDuePending.mockResolvedValue([failingJob, okJob]);

            // First processSubscriptionUpdated throws; second succeeds.
            mockProcessSubscriptionUpdated
                .mockRejectedValueOnce(new Error('MP timeout'))
                .mockResolvedValueOnce({
                    success: true,
                    statusChanged: true,
                    newStatus: 'active'
                });

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(2);
            expect(result.errors).toBe(1);
            expect(result.success).toBe(false);
        });

        it('silently exits when optimistic lock fails (concurrent worker won)', async () => {
            const job = buildJob({ id: 'race' });
            mockFindDuePending.mockResolvedValue([job]);
            // The first update (lock) returns null = lost race.
            mockStorageUpdate.mockResolvedValueOnce(null);

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(0);
            // processSubscriptionUpdated must NOT have been called for this job.
            expect(mockProcessSubscriptionUpdated).not.toHaveBeenCalled();
        });
    });
});
